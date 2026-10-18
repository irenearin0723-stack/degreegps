import type { PlanResponse } from '../types/ui-plan';

const difference = (before: string[], after: string[]) => ({
  added: [...new Set(after)].filter(value => !before.includes(value)),
  removed: [...new Set(before)].filter(value => !after.includes(value)),
});
export const quarterLabel = (id: string) => { const [year, season] = id.split('-'); return `${season[0].toUpperCase()}${season.slice(1)} ${year}`; };
export function comparePlans(previous: PlanResponse, current: PlanResponse) {
  const placements = (plan: PlanResponse) => new Map(plan.quarters.flatMap(q => q.courses.map(c => [c.code, q.id] as const)));
  const before = placements(previous), after = placements(current);
  const courses = difference([...before.keys()], [...after.keys()]);
  const moved = [...after].flatMap(([code, to]) => { const from = before.get(code); return from && from !== to ? [{ code, from, to }] : []; });
  const skills = difference((previous.recommended_skills ?? []).map(s => s.name), (current.recommended_skills ?? []).map(s => s.name));
  const projects = difference((previous.recommended_projects ?? []).map(p => p.title), (current.recommended_projects ?? []).map(p => p.title));
  const milestones = difference(previous.career_milestones.map(m => m.title), current.career_milestones.map(m => m.title));
  const updatedMilestones = current.career_milestones.filter(m => previous.career_milestones.some(old => old.title === m.title && (old.description !== m.description || old.quarter_id !== m.quarter_id))).map(m => m.title);
  const updatedSkills = (current.recommended_skills ?? []).filter(s => previous.recommended_skills?.some(old => old.name === s.name && (old.priority !== s.priority || old.reason !== s.reason))).map(s => s.name);
  const updatedProjects = (current.recommended_projects ?? []).filter(p => previous.recommended_projects?.some(old => old.title === p.title && (old.description !== p.description || JSON.stringify(old.skills) !== JSON.stringify(p.skills)))).map(p => p.title);
  const academicUnchanged = !courses.added.length && !courses.removed.length && !moved.length && JSON.stringify(previous.quarters.map(q => q.id)) === JSON.stringify(current.quarters.map(q => q.id));
  return { courses, moved, skills, projects, milestones, updatedMilestones, updatedSkills, updatedProjects, academicUnchanged };
}
