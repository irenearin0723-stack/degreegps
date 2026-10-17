import assert from 'node:assert/strict';
import type { Course } from '../types/course';
import { PlanRequestSchema, PlanResponseSchema, type PlanRequest } from '../types/plan';
import { offeringForTerm } from '../lib/offerings';
import { checkPrerequisites } from '../lib/prerequisites';
import { consecutiveTerms, nextTerm } from '../lib/planner';
export const VALIDATION_NOW = new Date('2026-10-17T19:00:00Z');
const base = PlanRequestSchema.parse({ major: 'Computer Science', completed_courses: ['CSE 123', 'MATH 126', 'CSE 311', 'CSE 351'],
  in_progress_courses: [], goal: { type: 'internship', track: 'swe', deadline: '2027-06-01' },
  max_courses_per_term: 2, start_term: '2027-winter', use_ai_explanation: false });
export const scenarios: { id: string; title: string; request: PlanRequest }[] = [
  { id: 'A', title: 'CS → SWE internship', request: base },
  { id: 'B', title: 'CS + AMATH → ML internship', request: { ...base, major: 'Computer Science + Applied Mathematics', completed_courses: [...base.completed_courses, 'MATH 125', 'MATH 208', 'CSE 312', 'CSE 332'], goal: { ...base.goal, track: 'ml' } } },
  { id: 'C', title: 'AI research assistant preparation', request: { ...base, goal: { type: 'research', track: 'ml', deadline: '2027-06-01' } } },
  { id: 'D', title: 'Missing prerequisites', request: { ...base, completed_courses: [] } },
  { id: 'E', title: 'Maximum two courses per quarter', request: { ...base, max_courses_per_term: 2 } },
  { id: 'F', title: 'Completed courses must not repeat', request: { ...base, completed_courses: [...base.completed_courses, 'CSE 312', 'CSE 332', 'AMATH 301'] } },
  { id: 'G', title: 'In-progress prerequisite is not completed', request: { ...base, completed_courses: ['CSE 123', 'MATH 126'], in_progress_courses: ['CSE 311'] } },
  { id: 'H', title: 'No feasible courses', request: { ...base, major: 'Unverified program', completed_courses: [] } },
  { id: 'I', title: 'Primary goal changed to ML research', request: { ...base, goal: { type: 'research', track: 'ml', deadline: '2027-06-01' } } },
  { id: 'J', title: 'Approaching internship deadline', request: { ...base, goal: { ...base.goal, deadline: '2026-10-24' } } },
];
export function verifyScenario(scenario: typeof scenarios[number], raw: unknown, courses: Course[], now: Date) {
  const response = PlanResponseSchema.parse(raw);
  const request = PlanRequestSchema.parse(scenario.request);
  assert.equal(response.mode, 'generated');
  assert.deepEqual(response.request, request);
  assert.equal(response.quarters.length, 3);
  const start = response.quarters[0].term;
  assert.deepEqual(response.quarters.map(q => q.term), consecutiveTerms(start));
  const ordinal = (value: string) => Number(value.slice(0, 4)) * 4 + ['winter', 'spring', 'summer', 'autumn'].indexOf(value.split('-')[1]);
  assert.ok(ordinal(start) >= ordinal(nextTerm(now)));
  const seen = new Set([...request.completed_courses, ...request.in_progress_courses]);
  const previous = new Set<string>();
  for (const quarter of response.quarters) {
    assert.ok(quarter.courses.length <= request.max_courses_per_term);
    for (const planned of quarter.courses) {
      assert.ok(!seen.has(planned.id));
      const course = courses.find(c => c.course_id === planned.id)!;
      assert.ok(course); assert.equal(course.data_status, 'verified');
      assert.notEqual(course.enrollment_status, 'unknown');
      assert.ok(checkPrerequisites(course, { completed: new Set(request.completed_courses), in_progress: new Set(request.in_progress_courses), previously_planned: previous }).eligible);
      const offering = offeringForTerm(course, quarter.term);
      assert.notEqual(offering.status, 'unknown');
      if (offering.status === 'projected') assert.equal(planned.scheduling_status, 'tentative');
      assert.ok(planned.source_ids.length);
      assert.ok(planned.source_ids.every(id => response.sources.some(s => s.id === id && s.url && s.kind === 'official')));
      seen.add(planned.id);
    }
    for (const planned of quarter.courses) previous.add(planned.id);
  }
  assert.ok(response.warnings.length);
  assert.ok(response.sources.length, 'Blocked-course evidence should still be traceable.');
  assert.ok(response.sources.every(s => s.kind === 'official' && s.url && s.verified_at));
  assert.ok(response.career_milestones.length);
  assert.ok(response.career_milestones.every(m => m.associated_goal === request.goal.type && m.timeframe.basis === 'recommended' && m.timeframe.start <= m.timeframe.end));
  const today = now.toISOString().slice(0, 10);
  for (const milestone of response.career_milestones) {
    assert.ok(milestone.timeframe.start >= today);
    if (request.goal.deadline && request.goal.deadline >= today) assert.ok(milestone.timeframe.end <= request.goal.deadline);
  }
  if (request.goal.track === 'ml') assert.ok(response.recommended_skills.includes('Model evaluation'));
  if (request.goal.track === 'swe') assert.ok(response.recommended_skills.includes('Testing'));
  if (scenario.id === 'G') assert.ok(response.warnings.some(w => w.code === 'IN_PROGRESS_NOT_COMPLETED'));
  if (scenario.id === 'J') assert.ok(response.warnings.some(w => w.code === 'DEADLINE_FEASIBILITY'));
  return { id: scenario.id, scenario: scenario.title, safety_checks: 'PASS', academic_completeness: previous.size ? 'PARTIAL' : 'BLOCKED_BY_INCOMPLETE_VERIFICATION',
    courses_per_quarter: response.quarters.map(q => q.courses.length), milestones: response.career_milestones.length,
    sources: response.sources.length, warning_codes: [...new Set(response.warnings.map(w => w.code))] };
}
