import { z } from 'zod';

export const AcademicTermSchema = z.enum(['winter', 'spring', 'summer', 'autumn']);
export type AcademicTerm = z.infer<typeof AcademicTermSchema>;
export const CourseIdSchema = z.string().trim().min(1).max(30)
  .transform(value => value.toUpperCase().replace(/\s+/g, ' ').replace(/^([A-Z& ]+?)\s*(\d{3}[A-Z]?)$/, '$1 $2'))
  .pipe(z.string().regex(/^[A-Z][A-Z& ]{0,14} \d{3}[A-Z]?$/, 'Use a course ID such as CSE 311'));
export const TrackSchema = z.enum(['swe', 'ml', 'data', 'systems', 'hci', 'undecided']);
export type Track = z.infer<typeof TrackSchema>;
export const OfficialUrlSchema = z.url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && (url.hostname === 'washington.edu' || url.hostname.endsWith('.washington.edu') || url.hostname === 'uw.edu' || url.hostname.endsWith('.uw.edu'));
}, 'Use an official HTTPS UW source');
export const PrerequisiteOptionSchema = z.object({
  course_id: CourseIdSchema,
  minimum_grade: z.number().min(0).max(4).nullable(),
  concurrent_allowed: z.boolean(),
}).strict();
export const PrerequisiteAlternativeSchema = z.object({
  all_of: z.array(PrerequisiteOptionSchema),
}).strict();
export const OfferingEvidenceSchema = z.object({
  term: z.string().regex(/^2\d{3}-(winter|spring|summer|autumn)$/),
  status: z.enum(['confirmed', 'projected', 'unknown']),
  source_url: OfficialUrlSchema.nullable(), verified_at: z.iso.date().nullable(),
  notes: z.string(),
}).strict().superRefine((evidence, ctx) => {
  if (evidence.status !== 'unknown' && (!evidence.source_url || !evidence.verified_at))
    ctx.addIssue({ code: 'custom', message: 'Confirmed/projected offerings require dated official evidence' });
});
export type OfferingEvidence = z.infer<typeof OfferingEvidenceSchema>;
export const CourseSchema = z.object({
  course_id: CourseIdSchema,
  title: z.string().min(1).max(200),
  credits: z.number().positive().max(30).nullable(),
  category: z.enum(['major', 'math', 'elective', 'general_education', 'other']),
  // Every group is required (AND); any one option satisfies a group (OR).
  // [] means verified no prerequisites; null means unknown.
  prerequisite_groups: z.array(z.object({ any_of: z.array(PrerequisiteOptionSchema).min(1) }).strict()).nullable(),
  prerequisite_alternatives: z.array(PrerequisiteAlternativeSchema).min(1).optional(),
  offered_terms: z.array(AcademicTermSchema).min(1).nullable(),
  offering_evidence: z.array(OfferingEvidenceSchema).optional(),
  // Exact verified snapshots, never recurring future availability.
  offered_term_ids: z.array(z.string().regex(/^2\d{3}-(winter|spring|summer|autumn)$/)).optional(),
  // UW course catalog "Offered:" pattern (e.g. AWSp), used only for terms without snapshot/projection evidence.
  // null: the catalog publishes no pattern. Never a term guarantee.
  typical_offered_terms: z.array(AcademicTermSchema).nullable().optional(),
  catalog_source_url: OfficialUrlSchema.optional(),
  schedule_source_url: OfficialUrlSchema.optional(),
  source_category: z.string().optional(),
  verification_notes: z.string().optional(),
  enrollment_status: z.enum(['unknown', 'verified']).optional(),
  section_data_status: z.enum(['imported', 'not_imported', 'not_applicable']).optional(),
  // null is unknown. ['*'] explicitly means no major restriction.
  eligible_majors: z.array(z.string().min(1)).min(1).nullable(),
  source_url: OfficialUrlSchema.nullable(),
  verified_at: z.iso.date().nullable(),
  data_status: z.enum(['verified', 'sample', 'unknown']),
  tracks: z.array(TrackSchema),
  foundation_priority: z.number().int().min(0).max(10),
}).strict().superRefine((course, ctx) => {
  if (course.offering_evidence && new Set(course.offering_evidence.map(e => e.term)).size !== course.offering_evidence.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate offering term evidence' });
  if (course.prerequisite_alternatives && course.prerequisite_groups !== null)
    ctx.addIssue({ code: 'custom', message: 'Use one prerequisite representation; do not combine AND/OR and OR/AND.' });
  if (course.data_status === 'verified' && (!course.source_url || !course.verified_at)) {
    ctx.addIssue({ code: 'custom', message: 'Verified records require an official source and verification date' });
  }
});
export type Course = z.infer<typeof CourseSchema>;
export const CourseDatasetSchema = z.object({
  schema_version: z.literal('2.0.0'),
  description: z.string(),
  courses: z.array(CourseSchema),
}).strict().superRefine((data, ctx) => {
  if (new Set(data.courses.map(c => c.course_id)).size !== data.courses.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate course IDs' });
});
