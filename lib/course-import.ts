import { z } from 'zod';
import { CourseIdSchema, CourseSchema, OfficialUrlSchema } from '../types/course';
const GradeMapSchema = z.record(CourseIdSchema, z.number().min(0).max(4));
export const ImportedPrerequisiteSchema = z.object({
  any_of: z.array(z.object({
    all_of: z.array(CourseIdSchema),
    min_grades: GradeMapSchema.optional(),
    concurrent_allowed: z.array(CourseIdSchema).optional(),
  }).strict().superRefine((branch, ctx) => {
    if ([...Object.keys(branch.min_grades ?? {}), ...branch.concurrent_allowed ?? []].some(id => !branch.all_of.includes(id)))
      ctx.addIssue({ code: 'custom', message: 'Grade/concurrent rules must reference members of their own branch' });
    if (new Set(branch.all_of).size !== branch.all_of.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate prerequisite in branch' });
  })).min(1),
  summary: z.string().min(1), source_url: OfficialUrlSchema, checked_at: z.iso.date(),
}).passthrough();
export const ImportedCourseSchema = z.object({
  course_id: CourseIdSchema, course_name: z.string().min(1),
  credits: z.number().positive().nullable(), credits_min: z.number().positive(), credits_max: z.number().positive(),
  term: z.literal('Winter 2027'), offering_status: z.enum(['listed', 'not_listed']),
  lecture_sections: z.string(), prerequisite_summary: z.string(), category: z.string().min(1),
  description: z.string(), skills: z.string(), verification_notes: z.string(),
  catalog_url: OfficialUrlSchema, schedule_url: OfficialUrlSchema, checked_at: z.iso.date(),
  section_data_status: z.enum(['imported', 'not_imported', 'not_applicable']),
}).passthrough().superRefine((course, ctx) => {
  if (course.credits_min > course.credits_max || (course.credits !== null && (course.credits < course.credits_min || course.credits > course.credits_max)))
    ctx.addIssue({ code: 'custom', message: 'Invalid credit range' });
});
export const CATEGORY_MAP = {
  cs_core: 'major', nonmajor_elective: 'elective', tools: 'elective', ml_elective: 'elective',
  amath_core: 'math', amath_elective: 'math', data_elective: 'elective',
  info_elective: 'elective', info_society_choice: 'elective', info_core: 'major',
  info_capstone: 'major', info_software_choice: 'elective', info_research: 'elective',
  info_foundation: 'major', info_experiential: 'elective',
} as const;
/** These are application ranking labels, never official degree-requirement membership. */
function ranking(course: z.infer<typeof ImportedCourseSchema>) {
  const text = `${course.course_name} ${course.skills}`.toLowerCase();
  const tracks: ('swe' | 'ml' | 'data' | 'systems' | 'hci')[] = [];
  if (/program|software|algorithm|data.structure|testing|web|logic|discrete/.test(text)) tracks.push('swe');
  if (/machine.learning|linear|numerical|probability|scientific|computational|calculus|differential|mathematical|modeling/.test(text)) tracks.push('ml');
  if (/data|database|statistic|probability|visual|scientific|numerical/.test(text)) tracks.push('data');
  if (/system|network|parallel|hardware|memory|security/.test(text)) tracks.push('systems');
  if (/human|design|interaction|user|accessib|social/.test(text)) tracks.push('hci');
  return { tracks, foundation_priority: /core|foundation/.test(course.category) ? 8 : /capstone|research/.test(course.category) ? 3 : 5 };
}
/** Lossless OR-of-AND import. Never flatten branches or discard grade/concurrency rules. */
export function importCourse(raw: unknown, rawPrerequisites: unknown) {
  const row = ImportedCourseSchema.parse(raw);
  const rule = ImportedPrerequisiteSchema.parse(rawPrerequisites);
  const category = CATEGORY_MAP[row.category as keyof typeof CATEGORY_MAP];
  if (!category) throw new Error(`Unknown planning category: ${row.category}`);
  return CourseSchema.parse({ course_id: row.course_id, title: row.course_name, credits: row.credits,
    category, source_category: row.category,
    prerequisite_groups: null,
    prerequisite_alternatives: rule.any_of.map(branch => ({ all_of: branch.all_of.map(id => ({
      course_id: id, minimum_grade: branch.min_grades?.[id] ?? null,
      concurrent_allowed: branch.concurrent_allowed?.includes(id) ?? false,
    })) })),
    offering_evidence: row.offering_status === 'listed' ? [{ term: '2027-winter', status: 'confirmed', source_url: row.schedule_url, verified_at: row.checked_at, notes: 'Listed in the Winter 2027 Time Schedule snapshot; not live seat availability or eligibility clearance.' }] : [],
    offered_terms: null, offered_term_ids: row.offering_status === 'listed' ? ['2027-winter'] : [],
    // A Restr flag or a degree membership does not establish registration eligibility.
    eligible_majors: null, enrollment_status: 'unknown',
    section_data_status: row.section_data_status,
    source_url: rule.source_url, schedule_source_url: row.schedule_url,
    verified_at: row.checked_at < rule.checked_at ? row.checked_at : rule.checked_at,
    data_status: 'verified', verification_notes: row.verification_notes,
    ...ranking(row),
  });
}
