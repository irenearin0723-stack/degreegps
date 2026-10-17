import { z } from 'zod';
import { CourseIdSchema, OfferingEvidenceSchema, OfficialUrlSchema, type Course, type OfferingEvidence } from '../types/course';
export const ProjectionDatasetSchema = z.object({
  schema_version: z.literal('1.0.0'),
  sources: z.array(z.object({ url: OfficialUrlSchema, checked_at: z.iso.date(), content_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    covered_terms: z.array(z.string().regex(/^2\d{3}-(winter|spring|summer|autumn)$/)), note: z.string() }).strict()),
  offerings: z.array(z.object({ course_id: CourseIdSchema, ...OfferingEvidenceSchema.shape }).strict()).superRefine((rows, ctx) => {
    if (new Set(rows.map(r => `${r.course_id}:${r.term}`)).size !== rows.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate course/term projection' });
  }),
}).strict().superRefine((dataset, ctx) => {
  for (const row of dataset.offerings) {
    const source = dataset.sources.find(s => s.url === row.source_url);
    if (row.status !== 'projected' || !source || !source.covered_terms.includes(row.term) || row.verified_at !== source.checked_at)
      ctx.addIssue({ code: 'custom', message: 'Projection must match its verified source coverage/date and cannot claim confirmation' });
  }
});
export function mergeProjectedOfferings(courses: Course[], input: unknown): Course[] {
  const dataset = ProjectionDatasetSchema.parse(input);
  const ids = new Set(courses.map(c => c.course_id));
  if (dataset.offerings.some(row => !ids.has(row.course_id))) throw new Error('Projection references an unknown catalog course');
  return courses.map(course => {
    const evidence = new Map((course.offering_evidence ?? []).map(e => [e.term, e]));
    for (const { course_id: _, ...projection } of dataset.offerings.filter(row => row.course_id === course.course_id))
      if (evidence.get(projection.term)?.status !== 'confirmed') evidence.set(projection.term, projection);
    return { ...course, offering_evidence: [...evidence.values()] };
  });
}
export function offeringForTerm(course: Course, term: string): OfferingEvidence {
  // An explicit unknown must not be upgraded using an older legacy array.
  const explicit = course.offering_evidence?.find(e => e.term === term);
  if (explicit) return explicit;
  if (course.offering_evidence === undefined && (course.offered_term_ids?.includes(term) || (course.offered_term_ids === undefined && course.offered_terms?.includes(term.split('-')[1] as 'winter'))))
    return { term, status: course.data_status === 'sample' ? 'projected' : 'confirmed', source_url: course.schedule_source_url ?? course.source_url, verified_at: course.verified_at, notes: 'Legacy verified offering rule; no seat guarantee.' };
  return { term, status: 'unknown', source_url: null, verified_at: null, notes: 'No verified positive offering evidence for this exact term.' };
}
