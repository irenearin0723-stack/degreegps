import { z } from 'zod';
import { createHash } from 'node:crypto';
import { CourseIdSchema } from '../types/course';
import { ImportedPrerequisiteSchema } from './course-import';
import { ImportedSectionSchema, SectionEvidenceSchema, SectionDecisionSchema, type RegistrationSection } from '../types/registration';

const HandoffSchema = z.object({
  schema_version: z.literal('registration-handoff-v1'), checked_at: z.iso.date(), term: z.literal('Winter 2027'),
  input_files: z.array(z.object({ name: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()),
  counts: z.object({ courses: z.number(), section_records: z.number(), sections_with_recorded_notes: z.number(), grade_sensitive_courses: z.number() }).strict(),
  minimum_grade_rules: z.record(CourseIdSchema, ImportedPrerequisiteSchema),
  course_concurrency_rules: z.record(CourseIdSchema, ImportedPrerequisiteSchema),
  section_evidence: z.array(SectionEvidenceSchema), acceptance_checks: z.array(z.string()).length(12),
}).passthrough();

/** Fail closed on stale handoff inputs, missing records or changed interpreted evidence. */
export function importRegistration(input: unknown, files: Record<string, string>): RegistrationSection[] {
  const handoff = HandoffSchema.parse(input);
  for (const name of ['courses.json', 'prerequisites.json', 'sections.json']) {
    const entry = handoff.input_files.find(f => f.name === name);
    if (!entry || !files[name] || createHash('sha256').update(files[name]).digest('hex') !== entry.sha256)
      throw new Error(`Registration handoff input mismatch: ${name}`);
  }
  const courses = z.array(z.object({ course_id: CourseIdSchema }).passthrough()).parse(JSON.parse(files['courses.json']));
  const rules = z.record(CourseIdSchema, ImportedPrerequisiteSchema).parse(JSON.parse(files['prerequisites.json']));
  for (const [id, rule] of [...Object.entries(handoff.minimum_grade_rules), ...Object.entries(handoff.course_concurrency_rules)]) {
    const existing = rules[id];
    if (!existing || JSON.stringify(existing.any_of) !== JSON.stringify(rule.any_of) || existing.source_url !== rule.source_url || existing.checked_at !== rule.checked_at)
      throw new Error(`Registration prerequisite mismatch: ${id}`);
  }
  const rows = z.array(ImportedSectionSchema).parse(JSON.parse(files['sections.json']));
  if (new Set(rows.map(r => `${r.term}:${r.sln}`)).size !== rows.length ||
      new Set(handoff.section_evidence.map(r => `${r.term}:${r.sln}`)).size !== handoff.section_evidence.length ||
      rows.length !== handoff.counts.section_records || rows.length !== handoff.section_evidence.length ||
      courses.length !== handoff.counts.courses || rows.filter(r => r.notes).length !== handoff.counts.sections_with_recorded_notes)
    throw new Error('Registration handoff count/key mismatch');
  return handoff.section_evidence.map(evidence => {
    const row = rows.find(r => r.sln === evidence.sln && r.term === evidence.term);
    if (!row || !courses.some(c => c.course_id === row.course_id) ||
        ['course_id', 'section', 'component', 'restriction_flag', 'section_status', 'other_codes', 'notes'].some(key => row[key] !== evidence[key as keyof typeof evidence]))
      throw new Error(`Registration section mismatch: ${evidence.sln}`);
    const url = new URL(evidence.detail_url);
    if (url.searchParams.get('SLN') !== row.sln || url.searchParams.get('QTRYR') !== 'WIN 2027')
      throw new Error('Registration detail URL scope mismatch');
    return { ...evidence, term_id: '2027-winter', metadata: row };
  });
}

/** Explicit application-label mapping, not substring matching (e.g. AMATH is never CSE). */
export function majorLabels(major: string): Set<string> {
  const labels: Record<string, string> = {
    cs: 'CSE', cse: 'CSE', 'computer science': 'CSE',
    ece: 'ECE', 'electrical and computer engineering': 'ECE',
  };
  return new Set(major.split('+').map(m => labels[m.trim().toLowerCase()]).filter(Boolean));
}
export function evaluateSection(section: RegistrationSection, major: string, concurrent: ReadonlySet<string>) {
  const majors = section.import_candidates.filter(r => r.type === 'major_restriction');
  const corequisites = section.import_candidates.filter(r => r.type === 'section_corequisite');
  const majorStatus = majors.length ? (majors.some(r => majorLabels(major).has(r.allowed_major_label)) ? 'met' : 'unmet') : 'unknown';
  const corequisiteStatus = corequisites.length ? (corequisites.every(r => concurrent.has(r.course_id)) ? 'met' : 'unmet') : 'not_required';
  const excluded = section.section_status === 'tentative' || section.import_candidates.some(r => r.type === 'exclude_by_default');
  const reasons = [...section.remaining_checks];
  if (majorStatus === 'unmet') reasons.push('Known section major restriction does not match the supplied major.');
  if (corequisiteStatus === 'unmet') reasons.push('Explicit concurrent section corequisite is missing. Prior completion alone does not waive it.');
  if (excluded) reasons.push('Tentative section excluded by default.');
  // Even matching recorded rules do not resolve the handoff's missing SLN/component evidence.
  return SectionDecisionSchema.parse({ sln: section.sln, section: section.section, component: section.component,
    registration_status: excluded || majorStatus === 'unmet' || corequisiteStatus === 'unmet' ? 'ineligible' : 'unknown',
    major_status: majorStatus, corequisite_status: corequisiteStatus, excluded, reasons,
    source_ids: [`section:${section.term_id}:${section.sln}`, `section-detail:${section.term_id}:${section.sln}`] });
}

export function evaluateRegistration(sections: RegistrationSection[], courseId: string, term: string, major: string,
  concurrent: ReadonlySet<string>, selectedSlns: string[] = []) {
  const scoped = sections.filter(s => s.course_id === courseId && s.term_id === term);
  const selected = scoped.filter(s => selectedSlns.includes(s.sln));
  const decisions = scoped.map(s => evaluateSection(s, major, concurrent));
  // Unselected quizzes must not veto an otherwise possible lecture; selected components all apply.
  const options = selected.length ? decisions.filter(d => selected.some(s => s.sln === d.sln)) : decisions.filter(d => d.component === 'LEC');
  const status = selected.length
    ? options.some(d => d.registration_status === 'ineligible') ? 'ineligible' : 'unknown'
    : options.length && options.every(d => d.registration_status === 'ineligible') ? 'ineligible' : 'unknown';
  return { status: status as 'ineligible' | 'unknown', sections: decisions };
}
