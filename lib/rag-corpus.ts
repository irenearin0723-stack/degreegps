import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { CourseIdSchema } from '../types/course';
import type { ChunkKindSchema } from '../types/ask';

export type ChunkKind = z.infer<typeof ChunkKindSchema>;
/** One citable unit of the retrieval corpus. Content is derived from data/ only; nothing is fetched. */
export interface CorpusChunk {
  id: string; kind: ChunkKind; document_title: string; content: string;
  source_url: string | null; section: string | null; verified_at: string | null; effective_date: string | null;
  official: boolean; program_id: string | null; program_name: string | null; course_ids: string[];
}
export interface Corpus { chunks: CorpusChunk[]; prefixes: string[] }

const text = z.string().nullish().transform(v => v ?? '');
const RawCourse = z.object({
  course_id: CourseIdSchema, course_name: z.string(), credits: z.number().nullish(), term: text, offering_status: text,
  lecture_sections: text, prerequisite_summary: text, category: text, description: text, skills: text,
  verification_notes: text, catalog_url: z.string().nullish(), checked_at: z.string().nullish(),
});
const Offering = z.object({ course_id: CourseIdSchema, term: z.string(), status: z.string(), source_url: z.string().nullish(), verified_at: z.string().nullish() });
const Section = z.object({
  course_id: CourseIdSchema, section: z.string(), component: z.string(), days: text, start_time: text, end_time: text,
  registration_rules_summary: text, source_url: z.string().nullish(), snapshot_at: z.string().nullish(),
});
const Source = z.object({ source_id: z.string(), title: z.string(), url: z.string(), checked_at: z.string().nullish() });
type Logic = { type: string; [key: string]: unknown };

/** Changes whenever the embedded text changes, so stale index entries are detectable. */
export function chunkHash(chunk: Pick<CorpusChunk, 'document_title' | 'content'>) {
  return createHash('sha256').update(embeddingText(chunk)).digest('hex').slice(0, 16);
}
export function embeddingText(chunk: Pick<CorpusChunk, 'document_title' | 'content'>) {
  return `${chunk.document_title}\n${chunk.content}`;
}
/** Course codes such as "CSE 311" or "cse311", limited to department prefixes the dataset actually uses. */
export function extractCourseIds(value: string, prefixes: string[]): string[] {
  if (!prefixes.length) return [];
  const escaped = [...prefixes].sort((a, b) => b.length - a.length).map(p => p.replace(/[&]/g, '\\&').replace(/ /g, ' ?'));
  const matcher = new RegExp(`\\b(${escaped.join('|')}) ?(\\d{3}[A-Z]?)\\b`, 'gi');
  return [...new Set([...value.matchAll(matcher)].map(m => CourseIdSchema.safeParse(`${m[1]} ${m[2]}`)).flatMap(r => r.success ? [r.data] : []))];
}
const list = (items: string[]) => items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
const termLabel = (term: string) => term.replace(/^(\d{4})-(\w+)$/, (_, y, q) => `${q[0].toUpperCase()}${q.slice(1)} ${y}`);

function describeLogic(logic: Logic, pools: Record<string, { courses: string[]; complete?: boolean }>): { text: string; courses: string[] } {
  const courses: string[] = [];
  const pool = (id: unknown) => {
    const p = typeof id === 'string' ? pools[id] : undefined;
    if (!p) return '';
    courses.push(...p.courses);
    return ` from ${p.complete === false ? 'a partial list including' : 'the list'}: ${p.courses.join(', ')}`;
  };
  const grade = typeof logic.min_grade === 'number' ? ` with a minimum grade of ${logic.min_grade.toFixed(1)}` : '';
  const named = Array.isArray(logic.courses) ? logic.courses.filter((c): c is string => typeof c === 'string') : [];
  courses.push(...named);
  let out: string;
  switch (logic.type) {
    case 'any_of': {
      const branches = (Array.isArray(logic.branches) ? logic.branches : []).map(b => describeLogic(b as Logic, pools));
      branches.forEach(b => courses.push(...b.courses));
      out = `One of: ${branches.map(b => b.text).join('; or ')}`;
      break;
    }
    case 'all_of': out = `All of ${list(named)}${grade}${typeof logic.min_credits === 'number' ? ` (at least ${logic.min_credits} credits)` : ''}`; break;
    case 'choose_courses': {
      const pools_ = [logic.pool_id, ...(Array.isArray(logic.pool_ids) ? logic.pool_ids : [])].map(pool).filter(Boolean).join(';');
      out = `Choose at least ${logic.min_courses ?? 'the required number of'} courses${grade}${named.length ? ` from ${list(named)}` : ''}${pools_}`;
      break;
    }
    case 'min_credits': out = `At least ${logic.min_credits} credits${grade}${named.length ? ` from ${list(named)}` : ''}${pool(logic.pool_id)}`; break;
    case 'min_gpa': out = `Minimum ${String(logic.metric ?? 'GPA').replace(/_/g, ' ')} of ${Number(logic.minimum).toFixed(1)}`; break;
    case 'waiver_if_completed': courses.push(String(logic.course)); out = `Waived if ${logic.course} is completed`; break;
    default: out = `Requires manual adviser review${typeof logic.action === 'string' ? `: ${logic.action}` : ''}`;
  }
  return { text: out, courses };
}

/** Every data file the corpus reads; retrieval rebuilds when any of them changes. */
export const CORPUS_FILES = ['target_courses/courses.json', 'target_courses/projected_offerings.json', 'target_courses/registration_rules.json',
  'target_courses/sections.json', 'target_courses/prerequisites.json', 'major_requirements/major_requirements.json', 'career_paths.json'];

async function json(directory: string, path: string): Promise<unknown> {
  return JSON.parse(await readFile(join(directory, path), 'utf8'));
}

export async function buildCorpus(directory = join(process.cwd(), 'data')): Promise<Corpus> {
  const [rawCourses, projections, registration, sections, majors, careers] = await Promise.all([
    json(directory, 'target_courses/courses.json'), json(directory, 'target_courses/projected_offerings.json'),
    json(directory, 'target_courses/registration_rules.json'), json(directory, 'target_courses/sections.json'),
    json(directory, 'major_requirements/major_requirements.json'), json(directory, 'career_paths.json'),
  ]) as [unknown[], { offerings: unknown[] }, Record<string, any>, unknown[], Record<string, any>, { paths: any[] }];
  const chunks: CorpusChunk[] = [];
  const courses = z.array(RawCourse).parse(rawCourses);
  const offerings = z.array(Offering).parse(projections.offerings);
  const concurrency: Record<string, { summary?: string }> = registration.course_concurrency_rules ?? {};
  const base = { section: null, effective_date: null, official: true, program_id: null, program_name: null } as const;

  for (const c of courses) {
    const projected = offerings.filter(o => o.course_id === c.course_id && termLabel(o.term) !== c.term).map(o => `${termLabel(o.term)} (${o.status})`);
    const content = [
      `${c.course_id}: ${c.course_name}.${c.credits ? ` ${c.credits} credits.` : ''} ${c.description}`,
      c.skills && `Skills: ${c.skills.split('|').map(s => s.replace(/_/g, ' ')).join(', ')}.`,
      c.prerequisite_summary && `Prerequisites: ${c.prerequisite_summary}.`,
      concurrency[c.course_id]?.summary && `Concurrency: ${concurrency[c.course_id].summary}.`,
      c.term && `${c.term} time schedule: ${c.offering_status}${c.lecture_sections ? ` (lecture sections ${c.lecture_sections.split('|').join(', ')})` : ''}.`,
      projected.length && `Other terms in departmental schedules: ${projected.join(', ')}. Projections are tentative.`,
      c.verification_notes && `Data note: ${c.verification_notes}`,
    ].filter(Boolean).join(' ');
    chunks.push({ ...base, id: `course:${c.course_id}`, kind: 'course', document_title: `${c.course_id} ${c.course_name}`, content,
      source_url: c.catalog_url ?? null, section: 'Course catalog', verified_at: c.checked_at ?? null, course_ids: [c.course_id] });
  }

  const lectures = z.array(Section).parse(sections).filter(s => s.component === 'LEC');
  for (const id of [...new Set(lectures.map(s => s.course_id))]) {
    const rows = lectures.filter(s => s.course_id === id);
    const content = `${id} Winter 2027 lecture sections: ${rows.map(s =>
      `${s.section} (${s.days.split('|').join('/')} ${s.start_time}-${s.end_time})${s.registration_rules_summary ? `, restriction: ${s.registration_rules_summary}` : ''}`).join('; ')}. ` +
      'Restrictions are time-schedule notes, not an eligibility decision.';
    chunks.push({ ...base, id: `sections:${id}`, kind: 'sections', document_title: `${id} Winter 2027 sections`, content,
      source_url: rows[0].source_url ?? null, section: 'Winter 2027 time schedule', verified_at: rows[0].snapshot_at?.slice(0, 10) ?? null, course_ids: [id] });
  }

  const registrationSources = new Map(z.array(Source).parse(registration.source_registry).map(s => [s.source_id, s]));
  const policies: Record<string, any> = registration.general_policies ?? {};
  const periods = Array.isArray(policies.registration_periods) ? policies.registration_periods : [];
  if (periods.length) chunks.push({ ...base, id: 'registration_policy:registration_periods', kind: 'registration_policy',
    document_title: 'Winter 2027 registration periods',
    content: `Winter 2027 registration periods (${policies.time_zone ?? 'local time'}): ${periods.map((p: any) =>
      `Period ${p.period} runs ${p.start_date} to ${p.end_date}, opening at ${p.opening_time}${p.student_specific_start_required ? '; each student has a specific start date' : ''}`).join('. ')}.`,
    source_url: registrationSources.get(periods[0].source_ids?.[0])?.url ?? null, section: 'Registration periods', verified_at: null, course_ids: [] });
  for (const [key, policy] of Object.entries(policies)) {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy) || !policy.source_id) continue;
    const details = Object.entries(policy).filter(([k, v]) => k !== 'source_id' && (typeof v === 'string' || Array.isArray(v)))
      .map(([k, v]) => `${k === 'rule' ? '' : `${k.replace(/_/g, ' ')}: `}${Array.isArray(v) ? v.join(', ') : v}`.replace(/\.$/, '')).join('. ');
    const source = registrationSources.get(policy.source_id);
    chunks.push({ ...base, id: `registration_policy:${key}`, kind: 'registration_policy', document_title: source?.title ?? key.replace(/_/g, ' '),
      content: `${key.replace(/_/g, ' ')}. ${details}.`, source_url: source?.url ?? null, section: key, verified_at: null,
      program_id: key.startsWith('amath') ? 'AMATH' : null, program_name: key.startsWith('amath') ? 'Applied Mathematics' : null, course_ids: [] });
  }

  const majorSources = new Map(z.array(Source).parse(majors.source_registry).map(s => [s.source_id, s]));
  const programs = new Map<string, { name: string; degree: string }>(majors.programs.map((p: any) => [p.program_id, p]));
  const firstSource = (ids: string[]) => ids.map(id => majorSources.get(id)).find(Boolean);
  const programName = (id: string) => programs.get(id)?.name ?? null;
  for (const p of majors.programs) {
    const source = firstSource(p.source_ids);
    chunks.push({ ...base, id: `program:${p.program_id}`, kind: 'program', document_title: `${p.name} (${p.degree}) requirements overview`,
      content: `${p.name} ${p.degree} at ${majors.institution}. Coverage: ${p.coverage}${p.published_major_credit_range ? ` Published major credits: ${p.published_major_credit_range.join('-')}.` : ''}${p.document_revision ? ` Document revision ${p.document_revision}.` : ''}`,
      source_url: source?.url ?? null, section: p.profile_id, verified_at: source?.checked_at ?? majors.checked_at ?? null,
      effective_date: p.effective_from ?? null, program_id: p.program_id, program_name: p.name, course_ids: [] });
  }
  for (const r of majors.requirements) {
    const logic = describeLogic(r.logic, majors.course_pools ?? {});
    const source = firstSource(r.source_ids);
    chunks.push({ ...base, id: `requirement:${r.rule_id}`, kind: 'requirement', document_title: `${programName(r.program_id) ?? r.program_id}: ${r.label}`,
      content: `${programName(r.program_id) ?? r.program_id} ${r.scope.replace(/_/g, ' ')} requirement "${r.label}". ${logic.text}. Verification: ${r.verification_status.replace(/_/g, ' ')}.${r.notes ? ` ${r.notes}` : ''}`,
      source_url: source?.url ?? null, section: r.rule_id, verified_at: r.checked_at ?? null,
      program_id: r.program_id, program_name: programName(r.program_id), course_ids: [...new Set(logic.courses)] });
  }
  for (const o of majors.optional_profiles ?? []) {
    const source = majorSources.get(o.source_id);
    chunks.push({ ...base, id: `program_option:${o.option_id}`, kind: 'program_option', document_title: `${programName(o.program_id) ?? o.program_id} option ${o.option_id}`,
      content: `${programName(o.program_id) ?? o.program_id} optional option ${o.option_id} (${o.credits} credits, not enabled by default): ${o.courses.join(', ')}.`,
      source_url: source?.url ?? null, section: o.option_id, verified_at: source?.checked_at ?? null,
      program_id: o.program_id, program_name: programName(o.program_id), course_ids: o.courses });
  }
  for (const i of majors.issues ?? []) {
    const source = firstSource(i.source_ids);
    chunks.push({ ...base, id: `policy_issue:${i.issue_id}`, kind: 'policy_issue', document_title: `Known policy issue: ${i.issue_id.replace(/_/g, ' ')}`,
      content: `${i.issue} Resolution: ${i.resolution}`, source_url: source?.url ?? null, section: i.issue_id, verified_at: i.checked_at ?? null,
      program_id: i.program_id === 'ALL' ? null : i.program_id, program_name: i.program_id === 'ALL' ? null : programName(i.program_id), course_ids: [] });
  }

  const tracks: Record<string, string> = { swe: 'software engineering (SWE)', ml: 'machine learning (ML)', data: 'data science',
    systems: 'computer systems', hci: 'human-computer interaction (HCI)', undecided: 'undecided track' };
  for (const p of careers.paths) chunks.push({ ...base, id: `career:${p.type}:${p.track}`, kind: 'career_path', official: false,
    document_title: `${tracks[p.track] ?? p.track} ${p.type} preparation`,
    content: `General ${tracks[p.track] ?? p.track} ${p.type} preparation (recommended, not a hiring requirement). Skills: ${p.skills.join(', ')}. Projects: ${p.projects.join('; ')}. Actions: ${p.actions.join('; ')}.`,
    source_url: null, section: 'DegreeGPS career guidance', verified_at: null, course_ids: [] });

  for (const chunk of chunks) chunk.course_ids = [...new Set(chunk.course_ids.flatMap(id => { const r = CourseIdSchema.safeParse(id); return r.success ? [r.data] : []; }))];
  const known = new Set([...chunks.flatMap(c => c.course_ids), ...Object.keys(await json(directory, 'target_courses/prerequisites.json') as object)]);
  const prefixes = [...new Set([...known].map(id => id.replace(/ \d{3}[A-Z]?$/, '')))];
  return { chunks, prefixes };
}
