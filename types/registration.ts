import { z } from 'zod';
import { CourseIdSchema, OfficialUrlSchema } from './course';

export const RegistrationRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('major_restriction'), allowed_major_label: z.enum(['CSE', 'ECE']), evidence_field: z.literal('notes'), scope: z.literal('this_section') }).strict(),
  z.object({ type: z.literal('section_corequisite'), course_id: CourseIdSchema, evidence_field: z.literal('notes'), scope: z.literal('this_section') }).strict(),
  z.object({ type: z.literal('exclude_by_default'), reason: z.literal('tentative_section') }).strict(),
  z.object({ type: z.literal('policy_reference'), url: OfficialUrlSchema, implies_add_code_required: z.literal(false) }).strict(),
]);
export const SectionEvidenceSchema = z.object({
  course_id: CourseIdSchema, term: z.literal('Winter 2027'), section: z.string().min(1), sln: z.string().regex(/^\d{5}$/),
  component: z.enum(['LEC', 'QZ']), restriction_flag: z.string(), section_status: z.string(), other_codes: z.string(), notes: z.string(),
  source_url: OfficialUrlSchema, detail_url: OfficialUrlSchema, snapshot_at: z.iso.datetime({ offset: true }),
  import_candidates: z.array(RegistrationRuleSchema), remaining_checks: z.array(z.string().min(1)).min(1),
}).strict();
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
