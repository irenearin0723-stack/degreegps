import { z } from 'zod';
import { CourseIdSchema, OfficialUrlSchema } from './course';

export const RegistrationRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('major_restriction'), allowed_major_label: z.enum(['CSE', 'ECE']), evidence_field: z.literal('notes'), scope: z.literal('this_section') }).strict(),
  z.object({ type: z.literal('section_corequisite'), course_id: CourseIdSchema, evidence_field: z.literal('notes'), scope: z.literal('this_section') }).strict(),
  z.object({ type: z.literal('exclude_by_default'), reason: z.literal('tentative_section') }).strict(),
  z.object({ type: z.literal('policy_reference'), url: OfficialUrlSchema, implies_add_code_required: z.literal(false) }).strict(),
]);
// Rules read from detailed SLN Notes (data/target_courses/registration_rules.json). Unknown rule types fail closed.
const MajorCodesSchema = z.array(z.string().min(1)).min(1);
export const StructuredRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('allowed_majors'), institutional_major_codes: MajorCodesSchema, scope: z.literal('this_section'),
    registration_period: z.string().optional(), start_date: z.iso.date().optional(), end_date: z.iso.date().optional() }).passthrough(),
  z.object({ type: z.literal('excluded_majors'), institutional_major_codes: MajorCodesSchema, scope: z.literal('this_section') }).passthrough(),
  z.object({ type: z.literal('excluded_student_level'), student_level: z.string().min(1) }).passthrough(),
  z.object({ type: z.literal('add_code_required'), value: z.boolean() }).passthrough(),
  z.object({ type: z.literal('tentative_section'), exclude_by_default: z.boolean() }).passthrough(),
  z.object({ type: z.literal('additional_course_fee'), amount: z.number(), currency: z.string() }).passthrough(),
  z.object({ type: z.literal('joint_offering'), counterpart_course_id: CourseIdSchema, counterpart_section: z.string(), counterpart_sln: z.string() }).passthrough(),
  z.object({ type: z.literal('waitlist_policy'), condition: z.string(), url: z.string().url() }).passthrough(),
  z.object({ type: z.literal('prerequisite_cancellation'), enabled: z.boolean() }).passthrough(),
]);
export type StructuredRule = z.infer<typeof StructuredRuleSchema>;
export const SectionEvidenceSchema = z.object({
  course_id: CourseIdSchema, term: z.literal('Winter 2027'), section: z.string().min(1), sln: z.string().regex(/^\d{5}$/),
  component: z.enum(['LEC', 'QZ']), restriction_flag: z.string(), section_status: z.string(), other_codes: z.string(), notes: z.string(),
  source_url: OfficialUrlSchema, detail_url: OfficialUrlSchema, snapshot_at: z.iso.datetime({ offset: true }),
  remaining_checks: z.array(z.string().min(1)).min(1),
  evidence_level: z.enum(['detailed_SLN_notes', 'department_schedule_only']),
  // Reviewed sections: structured_rules supersede baseline_import_candidates. Unreviewed sections keep import_candidates.
  structured_rules: z.array(StructuredRuleSchema).optional(),
  baseline_import_candidates: z.array(RegistrationRuleSchema).optional(),
  import_candidates: z.array(RegistrationRuleSchema).optional(),
}).passthrough().superRefine((s, ctx) => {
  if (s.evidence_level === 'detailed_SLN_notes' ? !s.structured_rules : !s.import_candidates)
    ctx.addIssue({ code: 'custom', message: `Section ${s.sln} is missing rules for its evidence level` });
});
export type SectionEvidence = z.infer<typeof SectionEvidenceSchema>;
// Keep every original section field (including fees, meetings and counts) distinct from interpreted rules.
export const ImportedSectionSchema = z.object({
  course_id: CourseIdSchema, term: z.literal('Winter 2027'), section: z.string(), sln: z.string().regex(/^\d{5}$/),
  component: z.enum(['LEC', 'QZ']), restriction_flag: z.string(), section_status: z.string(), other_codes: z.string(), notes: z.string(),
}).passthrough();
export type RegistrationSection = SectionEvidence & { term_id: string; metadata: z.infer<typeof ImportedSectionSchema> };
export const SectionDecisionSchema = z.object({
  sln: z.string(), section: z.string(), component: z.enum(['LEC', 'QZ']),
  registration_status: z.enum(['eligible', 'ineligible', 'unknown']),
  major_status: z.enum(['met', 'unmet', 'unknown']), corequisite_status: z.enum(['met', 'unmet', 'not_required']),
  excluded: z.boolean(), reasons: z.array(z.string()), source_ids: z.array(z.string()),
}).strict();
export const AcademicDecisionSchema = z.object({
  course_id: CourseIdSchema, term: z.string(),
  catalog_prerequisite_status: z.enum(['met', 'unmet', 'unknown', 'needs_grade_confirmation']),
  prerequisite_conditional: z.boolean(), prerequisite_reasons: z.array(z.string()),
  section_registration_status: z.enum(['eligible', 'ineligible', 'unknown']),
  term_offering_status: z.enum(['confirmed', 'projected', 'unknown']),
  schedule_conflict_status: z.literal('not_evaluated'),
  schedule_conflict_reason: z.string(),
  sections: z.array(SectionDecisionSchema), source_ids: z.array(z.string()),
}).strict();
export type AcademicDecision = z.infer<typeof AcademicDecisionSchema>;
