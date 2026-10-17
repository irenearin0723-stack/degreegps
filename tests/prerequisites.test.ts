import test from 'node:test';
import assert from 'node:assert/strict';
import { CourseSchema, type Course } from '../types/course';
import { checkPrerequisites } from '../lib/prerequisites';
import { planAcademic } from '../lib/planner';
import { PlanRequestSchema } from '../types/plan';
const option = (id: string, concurrent_allowed = false, minimum_grade: number | null = null) => ({ course_id: id, concurrent_allowed, minimum_grade });
export function course(id: string, prerequisites: Course['prerequisite_groups'] = [], changes: Partial<Course> = {}): Course {
  return CourseSchema.parse({ course_id: id, title: `Test ${id}`, credits: 5, category: 'major',
    prerequisite_groups: prerequisites, offered_terms: ['winter', 'spring', 'summer', 'autumn'],
    eligible_majors: ['*'], source_url: 'https://www.washington.edu/', verified_at: '2026-10-17',
    data_status: 'verified', tracks: ['ml'], foundation_priority: 5, ...changes });
}
const fixedNow = new Date('2026-10-17T18:00:00Z');
const academic = (request: Parameters<typeof planAcademic>[0], courses: Parameters<typeof planAcademic>[1]) => planAcademic(request, courses, fixedNow);
const request = PlanRequestSchema.parse({ major: 'Computer Science', completed_courses: [], in_progress_courses: [],
  goal: { type: 'internship', track: 'ml', deadline: '2027-06-01' }, max_courses_per_term: 1, start_term: '2027-winter' });

test('AND of OR groups accepts alternatives and rejects missing groups', () => {
  const c = course('CSE 400', [{ any_of: [option('CSE 100'), option('CSE 101')] }, { any_of: [option('MATH 126')] }]);
  assert.equal(checkPrerequisites(c, { completed: new Set(['CSE101', 'MATH126']) }).eligible, true);
  const missing = checkPrerequisites(c, { completed: new Set(['CSE 100']) });
  assert.equal(missing.eligible, false);
  assert.deepEqual(missing.missing_groups, [['MATH 126']]);
});
test('completed/in-progress/previously planned target courses cannot be duplicated', () => {
  for (const key of ['completed', 'in_progress', 'previously_planned'] as const) {
    assert.equal(checkPrerequisites(course('CSE 100'), { completed: new Set(), [key]: new Set(['CSE 100']) }).eligible, false);
  }
});
test('in-progress prerequisite does not count as completed', () => {
  const c = course('CSE 200', [{ any_of: [option('CSE 100')] }]);
  assert.equal(checkPrerequisites(c, { completed: new Set(), in_progress: new Set(['CSE 100']) }).eligible, false);
  const planned = checkPrerequisites(c, { completed: new Set(), previously_planned: new Set(['CSE 100']) });
  assert.equal(planned.eligible, true); assert.equal(planned.conditional, true);
});
test('only explicit verified concurrent rules allow parallel prerequisites', () => {
  const c = course('CSE 200', [{ any_of: [option('CSE 100', true)] }]);
  const ctx = { completed: new Set<string>(), concurrent: new Set(['CSE 100']) };
  assert.equal(checkPrerequisites(c, ctx).eligible, true);
  assert.equal(checkPrerequisites({ ...c, data_status: 'sample' }, { ...ctx, allow_sample: true }).eligible, false);
  assert.equal(checkPrerequisites(course('CSE 200', [{ any_of: [option('CSE 100')] }]), ctx).eligible, false);
});
test('minimum grades require actual evidence rather than just a course ID', () => {
  const c = course('CSE 200', [{ any_of: [option('CSE 100', false, 2.0)] }]);
  assert.equal(checkPrerequisites(c, { completed: new Set(['CSE 100']) }).eligible, false);
  assert.equal(checkPrerequisites(c, { completed: new Set(['CSE 100']), grades: { 'CSE 100': 2.5 } }).eligible, true);
});
test('unknown/unverified prerequisites are not eligible', () => {
  assert.equal(checkPrerequisites(course('CSE 100', null), { completed: new Set() }).eligible, false);
  assert.equal(checkPrerequisites(course('CSE 100', [], { data_status: 'unknown' }), { completed: new Set() }).eligible, false);
});
test('three-term chain obeys prerequisite order, limits, and marks conditional courses tentative', () => {
  const data = [course('CSE 100'), course('CSE 200', [{ any_of: [option('CSE 100')] }]), course('CSE 300', [{ any_of: [option('CSE 200')] }])];
  const result = academic(request, data);
  assert.deepEqual(result.quarters.map(q => q.courses.map(c => c.id)), [['CSE 100'], ['CSE 200'], ['CSE 300']]);
  assert.equal(result.quarters[1].courses[0].scheduling_status, 'tentative');
});
test('same-quarter planned courses do not satisfy strict prerequisites', () => {
  const result = academic({ ...request, max_courses_per_term: 3 }, [course('CSE 100'), course('CSE 200', [{ any_of: [option('CSE 100')] }])]);
  assert.deepEqual(result.quarters[0].courses.map(c => c.id), ['CSE 100']);
});
test('completed courses never repeat and missing rules produce a partial plan', () => {
  const result = academic({ ...request, completed_courses: ['CSE 100'] }, [course('CSE 100'), course('CSE 300', [{ any_of: [option('CSE 200')] }])]);
  assert.equal(result.quarters.flatMap(q => q.courses).length, 0);
  assert.ok(result.warnings.some(w => w.code === 'COURSE_BLOCKED'));
  assert.ok(result.warnings.some(w => w.code === 'PARTIAL_SCHEDULE'));
});
test('unknown offering, restricted major, and sample data are excluded from real plans', () => {
  const result = academic(request, [course('CSE 100', [], { offered_terms: null }), course('CSE 101', [], { eligible_majors: ['Physics'] }), course('CSE 102', [], { data_status: 'sample' })]);
  assert.equal(result.quarters.flatMap(q => q.courses).length, 0);
});
test('verified offering restrictions are honored and summer/year boundaries advance correctly', () => {
  const result = academic({ ...request, start_term: '2027-autumn' }, [course('CSE 100', [], { offered_terms: ['spring'] })]);
  assert.deepEqual(result.quarters.map(q => q.term), ['2027-autumn', '2028-winter', '2028-spring']);
  assert.equal(result.quarters[0].courses.length, 0);
  assert.equal(result.quarters[2].courses[0].id, 'CSE 100');
});
test('track matching changes priority when otherwise equal foundations compete for one slot', () => {
  const data = [course('CSE 100', [], { tracks: ['swe'] }), course('CSE 101', [], { tracks: ['ml'] })];
  const ml = academic(request, data);
  const swe = academic({ ...request, goal: { ...request.goal, track: 'swe' } }, data);
  assert.equal(ml.quarters[0].courses[0].id, 'CSE 101');
  assert.equal(swe.quarters[0].courses[0].id, 'CSE 100');
});
