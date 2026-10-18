import { PlanRequestSchema, PlanResponseSchema, type PlanRequest as BackendRequest, type PlanResponse as BackendResponse } from '../types/plan';
import type { PlanRequest, PlanResponse } from '../types/ui-plan';
import type { GoalDraft } from '../types/goal';
import { uniqueCourseIds } from './course-history';
import { CourseIdSchema } from '../types/course';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
export class PlanApiError extends Error {
  constructor(message: string, public readonly code = 'INTERNAL_ERROR', public readonly details: string[] = []) { super(message); }
}
function legacyGoal(request: PlanRequest): GoalDraft {
  // Old saved UI plans need conservative interpretation; unsupported text must not silently become SWE.
  const role = request.target_role.toLowerCase();
  const track = /machine learning|\bml\b|\bai\b/.test(role) ? 'ml' : /software|\bswe\b/.test(role) ? 'swe' : /data science/.test(role) ? 'data' : /explor/.test(role) ? 'undecided' : null;
  const type = /research/.test(role) ? 'research' : /explor/.test(role) ? 'explore' : /profile|project/.test(role) ? 'projects' : /intern/.test(role) ? 'internship' : null;
  if (!track || !type) throw new PlanApiError('Choose a supported goal and direction before regenerating this saved plan.', 'UNSUPPORTED_GOAL');
  return { type, track, deadline: { term: 'summer', year: request.target_summer }, notes: '', career_hours_per_week: 6, intensity: 'balanced' };
}
export function toBackendRequest(request: PlanRequest, options: { aiExplanation?: boolean } = {}): BackendRequest {
  const goal = request.goal_draft ?? legacyGoal(request);
  // Keep only grades for courses still listed as completed (the student may have edited the list after import).
  const completed = new Set(request.completed_courses.flatMap(id => { const r = CourseIdSchema.safeParse(id); return r.success ? [r.data] : []; }));
  const grades = Object.entries(request.reviewed_grades ?? {}).flatMap(([id, grade]) => { const r = CourseIdSchema.safeParse(id); return r.success && completed.has(r.data) ? [[r.data, grade] as const] : []; });
  const boundary = { winter: '01-01', spring: '04-01', summer: '06-01', autumn: '09-01' };
  const parsed = PlanRequestSchema.safeParse({
    major: request.majors.join(' + '), completed_courses: uniqueCourseIds(request.completed_courses),
    in_progress_courses: uniqueCourseIds(request.in_progress_courses),
    ...(grades.length ? { reviewed_grades: Object.fromEntries(grades) } : {}),
    goal: { type: goal.type, track: goal.track, deadline: goal.deadline ? `${goal.deadline.year}-${boundary[goal.deadline.term]}` : null, notes: goal.notes },
    max_courses_per_term: request.max_courses_per_term, start_term: `${request.start_year}-${request.start_term}`,
    ...(request.graduation_term && request.graduation_year ? { graduation_term: `${request.graduation_year}-${request.graduation_term}` } : {}),
    preferences: `Career preparation preference: ${goal.career_hours_per_week} hours/week; ${goal.intensity} pace. These preferences do not change academic eligibility.`,
    // Explicit opt-in only: sends the goal, preferences and planned course sentences to the AI provider.
    use_ai_explanation: options.aiExplanation ?? false,
  });
  if (!parsed.success) throw new PlanApiError('Check your courses, goal and direction before planning.', 'INVALID_REQUEST', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
  return parsed.data;
}
/** UI-only mapping. Review candidates stay in notes/warnings, never invented course cards. */
export function toUiPlan(raw: BackendResponse, request: PlanRequest): PlanResponse {
  const plan = PlanResponseSchema.parse(raw);
  const quarters = plan.quarters.map(q => {
    const [year, term] = q.term.split('-');
    return { id: q.term, year: Number(year), term: term as PlanRequest['start_term'], notes: q.notes,
      courses: q.courses.map(c => ({ registration_status: plan.academic_decisions?.find(d => d.course_id === c.id && d.term === q.term)?.section_registration_status ?? 'unknown', code: c.id, title: c.title, credits: c.credits, category: 'other' as const,
        status: c.scheduling_status === 'tentative' ? 'tentative' as const : 'planned' as const,
        rationale: c.explanation, source_ids: c.source_ids })) };
  });
  const startDate = (term: string) => { const [year, season] = term.split('-'); return `${year}-${({ winter: '01-01', spring: '04-01', summer: '06-01', autumn: '09-01' } as Record<string, string>)[season]}`; };
  return { schema_version: '1.0.0', plan_id: plan.plan_id, mode: plan.mode, generated_at: plan.generated_at,
    request: { ...request, horizon_terms: quarters.length }, quarters,
    career_milestones: plan.career_milestones.map(m => ({ id: m.id,
      quarter_id: [...quarters].reverse().find(q => startDate(q.id) <= m.timeframe.start)?.id ?? quarters[0].id,
      title: m.action, description: `${m.explanation} Recommended timeframe: ${m.timeframe.start}–${m.timeframe.end}.`,
      action_items: [], status: 'not_started' as const })),
    // Backend skills/projects are curated text for the goal track; earlier items are the most immediate.
    recommended_skills: plan.recommended_skills.map((name, i) => ({ name, reason: `Recommended for ${plan.request.goal.track} ${plan.request.goal.type} preparation.`,
      priority: i < 2 ? 'now' as const : i < 4 ? 'next' as const : 'later' as const })),
    recommended_projects: plan.recommended_projects.map(title => ({ title, description: '', skills: [] })),
    warnings: [...plan.warnings, ...(plan.mode === 'mock' ? [{ code: 'DEMO_PROFILE', severity: 'info' as const, message: 'This fixture uses a fictional example profile, not your submitted history.', affected_course_codes: [] }] : [])],
    sources: plan.sources.map(s => ({ id: s.id, title: s.title, url: s.url, kind: s.kind, retrieved_at: s.verified_at })), summary: plan.plan_summary };
}
export async function createPlan(payload: PlanRequest, options: { aiExplanation?: boolean } = {}): Promise<PlanResponse> {
  const request = toBackendRequest(payload, options);
  let response: Response;
  try {
    response = USE_MOCK_DATA ? await fetch(`${API_BASE_URL}/api/plan/mock`, { cache: 'no-store' })
      : await fetch(`${API_BASE_URL}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  } catch { throw new PlanApiError('The planning service is unavailable. Please retry; no mock plan was substituted.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new PlanApiError(data?.error?.message ?? `Planning request failed (${response.status}).`, data?.error?.code, data?.error?.details);
  const result = PlanResponseSchema.safeParse(data);
  if (!result.success) throw new PlanApiError('The planning service returned an invalid response.');
  if (!USE_MOCK_DATA && (result.data.mode !== 'generated' || JSON.stringify(result.data.request) !== JSON.stringify(request)))
    throw new PlanApiError('The planning response does not match your submitted inputs. Please retry.');
  return toUiPlan(result.data, payload);
}
export function isMockMode() { return USE_MOCK_DATA; }
