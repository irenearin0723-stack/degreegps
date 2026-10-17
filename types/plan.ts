/** Canonical contract v2. Runtime schemas and TypeScript types share one source. */
import { z } from 'zod';
import { CourseIdSchema, TrackSchema, AcademicTermSchema } from './course';
export type { AcademicTerm } from './course';
export const GoalTypeSchema = z.enum(['internship', 'research', 'projects', 'explore']);
export const SUPPORTED_GOALS = {
  internship: ['swe', 'ml', 'data', 'systems', 'hci'],
  research: ['swe', 'ml', 'data', 'systems', 'hci'],
  projects: ['swe', 'ml', 'data', 'systems', 'hci'],
  explore: ['swe', 'ml', 'data', 'systems', 'hci', 'undecided'],
} as const;
export const GoalSchema = z.object({
  type: GoalTypeSchema,
  track: TrackSchema,
  deadline: z.iso.date().nullable(),
  notes: z.string().trim().max(2000).optional(),
}).strict().superRefine((goal, ctx) => {
  if (!(SUPPORTED_GOALS[goal.type] as readonly string[]).includes(goal.track))
    ctx.addIssue({ code: 'custom', path: ['track'], message: 'Undecided is supported only for exploration; select a focus track for this goal.' });
});
export type Goal = z.infer<typeof GoalSchema>;
export const TermIdSchema = z.string().regex(/^2\d{3}-(winter|spring|summer|autumn)$/);
export const PlanRequestSchema = z.object({
  major: z.string().trim().min(1).max(200),
  completed_courses: z.array(CourseIdSchema).max(300),
  in_progress_courses: z.array(CourseIdSchema).max(30),
  goal: GoalSchema,
  max_courses_per_term: z.number().int().min(1).max(5),
  start_term: TermIdSchema.refine(value => Number(value.slice(0, 4)) <= 2099, 'Start year must be 2000–2099').optional(),
  preferences: z.string().trim().max(2000).optional(),
  // Explicit opt-in: sends structured goal/course plan to OpenAI, never PDF or grades.
  use_ai_explanation: z.boolean().default(false),
}).strict().superRefine((request, ctx) => {
  const all = [...request.completed_courses, ...request.in_progress_courses];
  if (new Set(all).size !== all.length)
    ctx.addIssue({ code: 'custom', path: ['completed_courses'], message: 'Duplicate or conflicting course IDs after normalization' });
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export const PlanWarningSchema = z.object({
  code: z.string().min(1), severity: z.enum(['info', 'warning', 'blocking']),
  message: z.string().min(1), affected_course_codes: z.array(CourseIdSchema),
}).strict();
export type PlanWarning = z.infer<typeof PlanWarningSchema>;
export const PlanSourceSchema = z.object({
  id: z.string(), title: z.string(), url: z.url().nullable(),
  kind: z.enum(['official', 'mock']), verified_at: z.iso.date().nullable(),
  data_status: z.enum(['verified', 'sample', 'unknown']),
}).strict();
export type PlanSource = z.infer<typeof PlanSourceSchema>;
export const PlannedCourseSchema = z.object({
  id: CourseIdSchema, title: z.string(), credits: z.number().nullable(),
  explanation: z.string(), scheduling_status: z.enum(['eligible', 'tentative']),
  source_ids: z.array(z.string()),
}).strict();
export type PlannedCourse = z.infer<typeof PlannedCourseSchema>;
export const QuarterPlanSchema = z.object({
  term: TermIdSchema, courses: z.array(PlannedCourseSchema), notes: z.string(),
}).strict();
export type QuarterPlan = z.infer<typeof QuarterPlanSchema>;
export const CareerMilestoneSchema = z.object({
  id: z.string(), action: z.string(), timeframe: z.object({
    start: z.iso.date(), end: z.iso.date(), basis: z.literal('recommended'),
  }).strict(), explanation: z.string(), associated_goal: GoalTypeSchema,
  related_course_ids: z.array(CourseIdSchema),
}).strict();
export type CareerMilestone = z.infer<typeof CareerMilestoneSchema>;
export const PlanResponseSchema = z.object({
  schema_version: z.literal('2.0.0'), plan_id: z.string(),
  mode: z.enum(['mock', 'generated']), generated_at: z.iso.datetime(),
  request: PlanRequestSchema, quarters: z.array(QuarterPlanSchema).length(3),
  career_milestones: z.array(CareerMilestoneSchema),
  recommended_skills: z.array(z.string()), recommended_projects: z.array(z.string()),
  warnings: z.array(PlanWarningSchema), sources: z.array(PlanSourceSchema),
  plan_summary: z.string().optional(),
}).strict().superRefine((plan, ctx) => {
  const ids = new Set(plan.sources.map(s => s.id));
  const seen = new Set([...plan.request.completed_courses, ...plan.request.in_progress_courses]);
  for (const q of plan.quarters) {
    if (q.courses.length > plan.request.max_courses_per_term)
      ctx.addIssue({ code: 'custom', message: 'Course load exceeded' });
    for (const course of q.courses) {
      if (seen.has(course.id) || course.source_ids.some(id => !ids.has(id)))
        ctx.addIssue({ code: 'custom', message: 'Duplicate course or broken source reference' });
      seen.add(course.id);
    }
  }
  if (plan.mode === 'mock' && !plan.warnings.some(w => w.code === 'UNVERIFIED_CATALOG'))
    ctx.addIssue({ code: 'custom', message: 'Mock plans must disclose sample data' });
});
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
export const ApiErrorResponseSchema = z.object({ error: z.object({
  code: z.string(), message: z.string(), details: z.array(z.string()).optional(),
}).strict() }).strict();
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
