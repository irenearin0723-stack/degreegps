import type { CareerPath } from './data';
import type { PlanRequest, QuarterPlan, PlanWarning, CareerMilestone } from '../types/plan';
const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function planCareer(request: PlanRequest, quarters: QuarterPlan[], paths: CareerPath[], now = new Date()) {
  const warnings: PlanWarning[] = [];
  const path = paths.find(p => p.type === request.goal.type && p.track === request.goal.track);
  if (!path) {
    warnings.push({ code: 'CAREER_DATA_MISSING', severity: 'warning', message: 'No curated roadmap matches this goal. Add this combination to career_paths.json.', affected_course_codes: [] });
    return { career_milestones: [], recommended_skills: [], recommended_projects: [], warnings };
  }
  const today = new Date(`${iso(now)}T00:00:00Z`);
  const deadline = request.goal.deadline ? new Date(`${request.goal.deadline}T00:00:00Z`) : new Date(today.getTime() + 180 * DAY);
  const remaining = Math.max(0, Math.floor((deadline.getTime() - today.getTime()) / DAY));
  if (remaining < 42) warnings.push({ code: 'DEADLINE_FEASIBILITY', severity: 'warning', message: 'The deadline is near or has passed. Prioritize immediate actions; the roadmap does not guarantee a position or outcome.', affected_course_codes: [] });
  const actions = remaining < 42 ? path.actions.slice(0, 3) : path.actions;
  const milestones: CareerMilestone[] = actions.map((action, index) => {
    const start = new Date(today.getTime() + Math.floor(remaining * index / actions.length) * DAY);
    const end = new Date(today.getTime() + Math.floor(remaining * (index + 1) / actions.length) * DAY);
    const related = quarters[Math.min(2, Math.floor(index * 3 / actions.length))]?.courses.map(c => c.id) ?? [];
    return { id: `career-${index + 1}`, action, timeframe: { start: iso(start), end: iso(end), basis: 'recommended' },
      explanation: `Recommended preparation for ${request.goal.track} ${request.goal.type}. ${related.length ? `Suggested coursework (${related.join(', ')}) may support preparation; verify readiness independently.` : 'Begin activities independently while academic options are reviewed.'} These are suggested personal timeframes, not employer or lab deadlines.`,
      associated_goal: request.goal.type, related_course_ids: related };
  });
  warnings.push({ code: 'RECOMMENDED_TIMELINES', severity: 'info', message: 'Career activities and dates are recommendations. Check actual openings and deadlines with organizations; no internship, research, admission, or graduation outcome is guaranteed.', affected_course_codes: [] });
  return { career_milestones: milestones, recommended_skills: path.skills, recommended_projects: path.projects, warnings };
}
