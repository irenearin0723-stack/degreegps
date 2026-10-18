import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePlans } from '../lib/plan-comparison';
import { toUiPlan } from '../lib/plan-api';
import { generatePlan } from '../lib/plan-service';
import type { PlanRequest } from '../types/plan';
import type { PlanResponse as UiPlan } from '../types/ui-plan';
import { supportedCourseCodes } from '../lib/course-codes';
import { readFile } from 'node:fs/promises';
const request: PlanRequest = { major: 'Computer Science + Applied Mathematics', completed_courses: ['CSE 123', 'MATH 126'], reviewed_grades: { 'CSE 123': 3.8, 'MATH 126': 3.4 }, in_progress_courses: [], goal: { type: 'internship', track: 'ml', deadline: '2027-06-01' }, max_courses_per_term: 3, start_term: '2027-winter', graduation_term: '2029-spring', use_ai_explanation: false };
const uiRequest = { majors: ['Computer Science', 'Applied Mathematics'], completed_courses: request.completed_courses, in_progress_courses: [], target_role: 'ML Intern', target_summer: 2027, max_courses_per_term: 3, start_term: 'winter' as const, start_year: 2027, horizon_terms: 8 };
async function realPlan() { return toUiPlan(await generatePlan(request), uiRequest); }
test('comparison accurately detects additions, removals and moves without mutating results', async () => {
  const old = await realPlan(), next = structuredClone(old); const original = JSON.stringify(old);
  const removed = next.quarters[0].courses.pop()!;
  const moved = next.quarters[0].courses.shift()!; next.quarters[1].courses.push(moved);
  const added = { ...removed, code: 'CSE 499', title: 'Synthetic test addition' }; next.quarters[1].courses.push(added);
  const diff = comparePlans(old, next);
  assert.deepEqual(diff.courses.added, ['CSE 499']); assert.deepEqual(diff.courses.removed, [removed.code]);
  assert.ok(diff.moved.some(m => m.code === moved.code && m.from === old.quarters[0].id && m.to === old.quarters[1].id));
  assert.equal(JSON.stringify(old), original);
});
test('identical academic schedules honestly show no changes while tracking career changes', async () => {
  const old = await realPlan(), next: UiPlan = structuredClone(old);
  next.recommended_skills = [{ name: 'Synthetic skill', priority: 'now', reason: 'Test only' }];
  next.recommended_projects = [{ title: 'Synthetic project', description: '', skills: [] }];
  next.career_milestones[0].description += ' Updated timing.';
  const diff = comparePlans(old, next);
  assert.equal(diff.academicUnchanged, true); assert.equal(diff.courses.added.length, 0); assert.equal(diff.moved.length, 0);
  assert.deepEqual(diff.skills.added, ['Synthetic skill']); assert.deepEqual(diff.projects.added, ['Synthetic project']);
  assert.ok(diff.updatedMilestones.includes(next.career_milestones[0].title));
  assert.equal(comparePlans(old, structuredClone(old)).updatedMilestones.length, 0);
});
test('real goal/load change produces a comparison from two generated plans', async () => {
  const old = await realPlan();
  const raw = await generatePlan({ ...request, goal: { ...request.goal, track: 'swe' }, max_courses_per_term: 2 });
  const next = toUiPlan(raw, { ...uiRequest, target_role: 'SWE Intern', max_courses_per_term: 2 });
  const diff = comparePlans(old, next);
  assert.ok(diff.skills.added.length + diff.skills.removed.length + diff.projects.added.length > 0);
  assert.ok(diff.moved.length + diff.courses.removed.length + diff.courses.added.length > 0);
});
test('unknown and ineligible registration never receive eligible scheduling status', async () => {
  const raw = await generatePlan({ ...request, major: 'Computer Science', selected_slns: { '2027-winter': ['12932'] }, max_courses_per_term: 5 });
  let checked = 0;
  for (const q of raw.quarters) for (const c of q.courses) {
    const d = raw.academic_decisions!.find(d => d.course_id === c.id && d.term === q.term)!;
    if (d.section_registration_status !== 'eligible') { assert.equal(c.scheduling_status, 'tentative'); checked++; }
  }
  assert.ok(checked > 0);
  assert.match(raw.plan_summary!, new RegExp(`across ${raw.quarters.length} quarters`));
});
test('summer-only range produces a useful regular-quarter fallback and explicit warning', async () => {
  const raw = await generatePlan({ ...request, start_term: '2027-summer', graduation_term: '2027-summer' });
  assert.equal(raw.quarters[0].term, '2027-autumn');
  assert.ok(raw.warnings.some(w => w.code === 'NO_REGULAR_QUARTERS'));
});
test('milestones never reference courses in quarters ending after the activity begins', async () => {
  const raw = await generatePlan(request); const ends: Record<string,string> = { winter: '04-01', spring: '07-01', summer: '10-01', autumn: '01-01' };
  for (const m of raw.career_milestones) for (const id of m.related_course_ids) {
    const q = raw.quarters.find(q => q.courses.some(c => c.id === id))!; const [year, term] = q.term.split('-');
    assert.ok(`${Number(year) + (term === 'autumn' ? 1 : 0)}-${ends[term]}` <= m.timeframe.start);
  }
});
test('unsupported course history returns an actionable client error without inventing course facts', async () => {
  await assert.rejects(generatePlan({ ...request, completed_courses: ['ZZZZ 999'], reviewed_grades: {} }), e => (e as {status:number}).status === 400 && /supported data snapshot/.test((e as Error).message));
  const courses = JSON.parse(await readFile('data/target_courses/courses.json', 'utf8'));
  const external = JSON.parse(await readFile('data/target_courses/external_prerequisites.json', 'utf8'));
  assert.deepEqual([...supportedCourseCodes].sort(), [...new Set([...courses.map((c: {course_id:string}) => c.course_id), ...external.course_ids])].sort());
});
