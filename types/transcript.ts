import { z } from 'zod';
import { CourseIdSchema } from './course';
export const TranscriptRecordSchema = z.object({
  id: z.string(), course_id: CourseIdSchema.nullable(), title: z.string().nullable(),
  term: z.string().nullable(), grade: z.string().nullable(), credits: z.number().nullable(),
  status: z.enum(['completed', 'in_progress', 'withdrawn', 'failed', 'ambiguous']),
  transfer_credit: z.boolean(), repeated: z.boolean(), needs_review: z.boolean(),
  review_reasons: z.array(z.string()),
  // Course-entry text only; never the full transcript or student header.
  raw_entry: z.string(),
}).strict();
export type TranscriptRecord = z.infer<typeof TranscriptRecordSchema>;
export const TranscriptResponseSchema = z.object({
  schema_version: z.literal('2.0.0'), records: z.array(TranscriptRecordSchema),
  completed_courses: z.array(CourseIdSchema), in_progress_courses: z.array(CourseIdSchema),
  needs_review: z.literal(true), user_confirmation_required: z.literal(true),
  warnings: z.array(z.object({ code: z.string(), message: z.string() }).strict()),
}).strict();
export type TranscriptResponse = z.infer<typeof TranscriptResponseSchema>;
