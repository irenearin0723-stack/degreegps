import { z } from 'zod';
import { CourseIdSchema } from './course';

export const ChunkKindSchema = z.enum(['course', 'sections', 'requirement', 'program', 'program_option', 'policy_issue', 'registration_policy', 'career_path']);
export const RetrievedSourceSchema = z.object({
  id: z.string().min(1), kind: ChunkKindSchema, document_title: z.string(), content: z.string(),
  source_url: z.string().nullable(), section: z.string().nullable(),
  verified_at: z.string().nullable(), effective_date: z.string().nullable(),
  official: z.boolean(), score: z.number(),
}).strict();
export type RetrievedSourceDto = z.infer<typeof RetrievedSourceSchema>;

export const AskRequestSchema = z.object({
  question: z.string().trim().min(3).max(500),
  // Program ID (CS, AMATH, INFO) or name; narrows requirement/policy sources, never course records.
  major: z.string().trim().min(1).max(100).optional(),
  official_only: z.boolean().default(false),
  // Courses already in the student's plan; used only to rank related sources higher.
  plan_course_ids: z.array(CourseIdSchema).max(30).default([]),
  use_ai: z.boolean().default(false),
}).strict();
export type AskRequest = z.input<typeof AskRequestSchema>;

export const AskResponseSchema = z.object({
  schema_version: z.literal('1.0.0'),
  mode: z.enum(['ai', 'deterministic']),
  retrieval: z.enum(['hybrid', 'keyword']),
  answer: z.string().nullable(),
  insufficient_evidence: z.boolean(),
  citations: z.array(z.string()),
  sources: z.array(RetrievedSourceSchema),
  warnings: z.array(z.string()),
  disclaimer: z.string(),
}).strict().superRefine((response, ctx) => {
  const ids = new Set(response.sources.map(s => s.id));
  if (response.citations.some(id => !ids.has(id))) ctx.addIssue({ code: 'custom', message: 'Every citation must reference a returned source' });
});
export type AskResponse = z.infer<typeof AskResponseSchema>;
