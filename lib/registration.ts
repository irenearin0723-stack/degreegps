import { z } from 'zod';
import { CourseIdSchema } from '../types/course';
import { ImportedPrerequisiteSchema } from './course-import';
import { ImportedSectionSchema, SectionEvidenceSchema, SectionDecisionSchema, type RegistrationSection, type StructuredRule } from '../types/registration';

const RegistrationRulesSchema = z.object({
  schema_version: z.literal('uniflow-registration-rules-v1'), term: z.literal('Winter 2027'),
  counts: z.object({ courses_in_catalog: z.number(), sections: z.number(), detailed_SLN_notes_reviewed: z.number(),
    baseline_only_sections: z.number(), minimum_grade_courses: z.number() }).passthrough(),
  minimum_grade_rules: z.record(CourseIdSchema, ImportedPrerequisiteSchema),
  course_concurrency_rules: z.record(CourseIdSchema, ImportedPrerequisiteSchema),
  section_evidence: z.array(SectionEvidenceSchema), acceptance_checks: z.array(z.string()).length(12),
}).passthrough();

// Key-order-independent JSON, since schema parsing reorders object keys.
const canonical = (value: unknown): string => JSON.stringify(value, (_, v) =>
  v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);

/** Fail closed when registration_rules.json disagrees with the course, prerequisite or section files it describes. */
export function importRegistration(input: unknown, files: Record<string, string>): RegistrationSection[] {
  const registration = RegistrationRulesSchema.parse(input);
  const courses = z.array(z.object({ course_id: CourseIdSchema }).passthrough()).parse(JSON.parse(files['courses.json']));
  const rules = z.record(CourseIdSchema, ImportedPrerequisiteSchema).parse(JSON.parse(files['prerequisites.json']));
  for (const [id, rule] of [...Object.entries(registration.minimum_grade_rules), ...Object.entries(registration.course_concurrency_rules)]) {
    const existing = rules[id];
    if (!existing || JSON.stringify(existing.any_of) !== JSON.stringify(rule.any_of) || existing.source_url !== rule.source_url || existing.checked_at !== rule.checked_at)
      throw new Error(`Registration prerequisite mismatch: ${id}`);
  }
  const rows = z.array(ImportedSectionSchema).parse(JSON.parse(files['sections.json']));
  const evidence = registration.section_evidence;
  if (new Set(rows.map(r => `${r.term}:${r.sln}`)).size !== rows.length ||
      new Set(evidence.map(r => `${r.term}:${r.sln}`)).size !== evidence.length ||
      rows.length !== registration.counts.sections || rows.length !== evidence.length ||
      courses.length !== registration.counts.courses_in_catalog ||
      evidence.filter(s => s.evidence_level === 'detailed_SLN_notes').length !== registration.counts.detailed_SLN_notes_reviewed)
    throw new Error('Registration rules count/key mismatch');
  return evidence.map(section => {
    const row = rows.find(r => r.sln === section.sln && r.term === section.term);
    if (!row || !courses.some(c => c.course_id === row.course_id) ||
        ['course_id', 'section', 'component', 'restriction_flag', 'section_status', 'other_codes', 'notes'].some(key => row[key] !== section[key as keyof typeof section]) ||
        canonical(row.registration_rules ?? []) !== canonical(section.structured_rules ?? []))
      throw new Error(`Registration section mismatch: ${section.sln}`);
    const url = new URL(section.detail_url);
    if (url.searchParams.get('SLN') !== row.sln || url.searchParams.get('QTRYR') !== 'WIN 2027')
      throw new Error('Registration detail URL scope mismatch');
    return { ...section, term_id: '2027-winter', metadata: row };
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
/** Application major → UW institutional major codes used in SLN Notes. CS never implies CMP E. */
export function institutionalMajorCodes(major: string): Set<string> {
  const codes: Record<string, string> = {
    cs: 'C SCI', cse: 'C SCI', 'computer science': 'C SCI', 'c sci': 'C SCI',
    'computer engineering': 'CMP E', 'cmp e': 'CMP E',
    ece: 'ECE', 'electrical and computer engineering': 'ECE', 'electrical engineering': 'E E', 'e e': 'E E',
    amath: 'AMATH', 'applied mathematics': 'AMATH', 'applied math': 'AMATH',
    acms: 'ACMS', 'applied and computational mathematical sciences': 'ACMS',
    cfrm: 'CFRM', 'computational finance': 'CFRM',
    info: 'INFO', informatics: 'INFO',
  };
  return new Set(major.split('+').map(m => codes[m.trim().toLowerCase()]).filter(Boolean));
}

export type RuleCondition = 'pass' | 'fail' | 'unknown' | 'not_applicable';
/** Condition of one structured rule for a student at a given registration date (YYYY-MM-DD). */
export function ruleCondition(rule: StructuredRule, context: { majorCodes: ReadonlySet<string> | null; date?: string; studentLevel?: string }): RuleCondition {
  const known = context.majorCodes && context.majorCodes.size > 0;
  const matches = (codes: string[]) => codes.some(code => context.majorCodes?.has(code));
  switch (rule.type) {
    case 'allowed_majors':
      if (rule.start_date && rule.end_date) {
        if (!context.date) return 'unknown';
        if (context.date < rule.start_date || context.date > rule.end_date) return 'not_applicable';
      }
      return !known ? 'unknown' : matches(rule.institutional_major_codes) ? 'pass' : 'fail';
    case 'excluded_majors':
      return !known ? 'unknown' : matches(rule.institutional_major_codes) ? 'fail' : 'pass';
    case 'excluded_student_level':
      return !context.studentLevel ? 'unknown' : context.studentLevel === rule.student_level ? 'fail' : 'pass';
    default:
      return 'not_applicable';
  }
}

function evaluateReviewedSection(section: RegistrationSection, major: string, asOf?: string) {
  const codes = institutionalMajorCodes(major);
  const majorResults: RuleCondition[] = [];
  const reasons: string[] = [];
  let excluded = false;
  for (const rule of section.structured_rules ?? []) {
    switch (rule.type) {
      case 'allowed_majors': {
        const list = rule.institutional_major_codes.join(', ');
        if (rule.start_date && rule.end_date) {
          if (asOf && asOf > rule.end_date) break;
          // Period-limited: a non-matching major can still try after the period, so this never blocks a plan.
          if (ruleCondition(rule, { majorCodes: codes, date: rule.start_date }) === 'pass') majorResults.push('pass');
          else reasons.push(`Registration period ${rule.registration_period ?? ''} (${rule.start_date} to ${rule.end_date}): ${list} majors only; others may try after it ends.`);
          break;
        }
        const result = ruleCondition(rule, { majorCodes: codes });
        majorResults.push(result);
        if (result === 'fail') reasons.push(`Section limited to ${list} majors; supplied major does not match.`);
        if (result === 'unknown') reasons.push(`Section limited to ${list} majors; supplied major has no institutional code mapping.`);
        break;
      }
      case 'excluded_majors': {
        const result = ruleCondition(rule, { majorCodes: codes });
        majorResults.push(result);
        if (result === 'fail') reasons.push(`Section excludes ${rule.institutional_major_codes.join(', ')} majors.`);
        break;
      }
      case 'excluded_student_level': reasons.push(`Not open to ${rule.student_level} students.`); break;
      case 'add_code_required': if (rule.value) reasons.push('Add code required.'); break;
      case 'tentative_section': if (rule.exclude_by_default) excluded = true; break;
      case 'additional_course_fee': reasons.push(`Additional course fee: ${rule.amount} ${rule.currency}.`); break;
      case 'joint_offering': reasons.push(`Jointly offered with ${rule.counterpart_course_id} ${rule.counterpart_section} (SLN ${rule.counterpart_sln}); not a lecture/quiz pairing permission.`); break;
      case 'waitlist_policy': reasons.push(`Waitlist policy applies when ${rule.condition.replaceAll('_', ' ')}.`); break;
      case 'prerequisite_cancellation': if (rule.enabled) reasons.push('Prerequisite cancellation in effect: registration can be dropped if prerequisites are unmet.'); break;
    }
  }
  const majorStatus = majorResults.includes('fail') ? 'unmet' : majorResults.includes('pass') ? 'met' : 'unknown';
  return { majorStatus, corequisiteStatus: 'not_required', excluded, reasons } as const;
}

function evaluateBaselineSection(section: RegistrationSection, major: string, concurrent: ReadonlySet<string>) {
  const candidates = section.import_candidates ?? [];
  const majors = candidates.filter(r => r.type === 'major_restriction');
  const corequisites = candidates.filter(r => r.type === 'section_corequisite');
  const majorStatus = majors.length ? (majors.some(r => majorLabels(major).has(r.allowed_major_label)) ? 'met' : 'unmet') : 'unknown';
  const corequisiteStatus = corequisites.length ? (corequisites.every(r => concurrent.has(r.course_id)) ? 'met' : 'unmet') : 'not_required';
  const excluded = candidates.some(r => r.type === 'exclude_by_default');
  const reasons: string[] = [];
  if (majorStatus === 'unmet') reasons.push('Known section major restriction does not match the supplied major.');
  if (corequisiteStatus === 'unmet') reasons.push('Explicit concurrent section corequisite is missing. Prior completion alone does not waive it.');
  return { majorStatus, corequisiteStatus, excluded, reasons } as const;
}

export function evaluateSection(section: RegistrationSection, major: string, concurrent: ReadonlySet<string>, asOf?: string) {
  const result = section.evidence_level === 'detailed_SLN_notes'
    ? evaluateReviewedSection(section, major, asOf) : evaluateBaselineSection(section, major, concurrent);
  const excluded = section.section_status === 'tentative' || result.excluded;
  const reasons = [...section.remaining_checks, ...result.reasons];
  if (excluded) reasons.push('Tentative section excluded by default.');
  // Even matching recorded rules leave student-specific checks unresolved, so the best outcome is unknown.
  return SectionDecisionSchema.parse({ sln: section.sln, section: section.section, component: section.component,
    registration_status: excluded || result.majorStatus === 'unmet' || result.corequisiteStatus === 'unmet' ? 'ineligible' : 'unknown',
    major_status: result.majorStatus, corequisite_status: result.corequisiteStatus, excluded, reasons,
    source_ids: [`section:${section.term_id}:${section.sln}`, `section-detail:${section.term_id}:${section.sln}`] });
}

export function evaluateRegistration(sections: RegistrationSection[], courseId: string, term: string, major: string,
  concurrent: ReadonlySet<string>, selectedSlns: string[] = [], asOf?: string) {
  const scoped = sections.filter(s => s.course_id === courseId && s.term_id === term);
  const selected = scoped.filter(s => selectedSlns.includes(s.sln));
  const decisions = scoped.map(s => evaluateSection(s, major, concurrent, asOf));
  // Unselected quizzes must not veto an otherwise possible lecture; selected components all apply.
  const options = selected.length ? decisions.filter(d => selected.some(s => s.sln === d.sln)) : decisions.filter(d => d.component === 'LEC');
  const status = selected.length
    ? options.some(d => d.registration_status === 'ineligible') ? 'ineligible' : 'unknown'
    : options.length && options.every(d => d.registration_status === 'ineligible') ? 'ineligible' : 'unknown';
  return { status: status as 'ineligible' | 'unknown', sections: decisions };
}
