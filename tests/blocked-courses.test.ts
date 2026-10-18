import test from 'node:test';
import assert from 'node:assert/strict';
import { CourseSchema, type Course } from '../types/course';
import { PlanRequestSchema } from '../types/plan';
import { BLOCKED_DETAIL_LIMIT, planAcademic } from '../lib/planner';
import { loadData } from '../lib/data';
import { matchPrograms, scopeToMajor } from '../lib/major-scope';
import { generatePlan } from '../lib/plan-service';
import { toBackendRequest } from '../lib/plan-api';
import { confirmedGrades } from '../lib/transcript-api';
import type { PlanRequest as UiPlanRequest } from '../types/ui-plan';

const now = new Date('2026-10-17T18:00:00Z');
const course = (id: string, prerequisite?: string, changes: Partial<Course> = {}): Course => CourseSchema.parse({
  course_id: id, title: `Test ${id}`, credits: 5, category: 'major',
  prerequisite_groups: prerequisite ? [{ any_of: [{ course_id: prerequisite, concurrent_allowed: false, minimum_grade: null }] }] : [],
  offered_terms: ['winter', 'spring', 'summer', 'autumn'], eligible_majors: ['*'], source_url: 'https://www.washington.edu/',
  verified_at: '2026-10-17', data_status: 'verified', tracks: ['ml'], foundation_priority: 5, ...changes });
const request = PlanRequestSchema.parse({ major: 'Computer Science', completed_courses: [], in_progress_courses: [],
  goal: { type: 'internship', track: 'ml', deadline: '2027-06-01' }, max_courses_per_term: 1, start_term: '2027-winter' });

test('blocked courses beyond the detail limit collapse into one summary, nearest-to-ready first', () => {
  // 15 courses need a prerequisite nobody has; 3 have prerequisites met but no offering evidence.
  const waiting = Array.from({ length: 15 }, (_, i) => course(`CSE ${300 + i}`, 'CSE 999'));
  const unoffered = ['CSE 200', 'CSE 201', 'CSE 202'].map(id => course(id, undefined, { offered_terms: null }));
  const result = planAcademic(request, [...waiting, ...unoffered], now);
  const detailed = result.warnings.filter(w => w.code === 'COURSE_BLOCKED');
  assert.equal(detailed.length, BLOCKED_DETAIL_LIMIT);
  assert.deepEqual(detailed.slice(0, 3).map(w => w.affected_course_codes[0]), ['CSE 200', 'CSE 201', 'CSE 202']);
  const summary = result.warnings.filter(w => w.code === 'COURSE_BLOCKED_SUMMARY');
  assert.equal(summary.length, 1);
  assert.equal(summary[0].affected_course_codes.length, 18 - BLOCKED_DETAIL_LIMIT);
  assert.match(summary[0].message, /^8 more courses were not scheduled: 8 need prerequisites not yet completed\./);
  assert.equal(result.academic_decisions.filter(d => d.term === '2027-winter').length, 18);
});

test('form majors map to requirement programs, including differently worded names', async () => {
  const programs = [{ program_id: 'ISE', name: 'Industrial Engineering' }, { program_id: 'AA', name: 'Aeronautical and Astronautical Engineering' },
    { program_id: 'CS', name: 'Computer Science' }, { program_id: 'CS_DS', name: 'Computer Science: Data Science' }, { program_id: 'AMATH', name: 'Applied Mathematics' }];
  assert.deepEqual(matchPrograms('Industrial and Systems Engineering', programs), ['ISE']);
  assert.deepEqual(matchPrograms('Aeronautics and Astronautics', programs), ['AA']);
  assert.deepEqual(matchPrograms('Computer Science + Applied Mathematics', programs), ['CS', 'CS_DS', 'AMATH']);
  assert.deepEqual(matchPrograms('Underwater Basket Weaving', programs), []);
});

test('major scope keeps program courses and their prerequisites, and nothing from unrelated majors', async () => {
  const { courses } = await loadData();
  const cs = await scopeToMajor('Computer Science', courses);
  const ids = new Set(cs.courses.map(c => c.course_id));
  assert.ok(cs.programs.includes('CS'));
  assert.ok(ids.has('CSE 311') && ids.has('CSE 332'));
  for (const c of cs.courses) for (const option of c.prerequisite_alternatives?.flatMap(b => b.all_of) ?? [])
    if (courses.some(k => k.course_id === option.course_id)) assert.ok(ids.has(option.course_id), `${c.course_id} prerequisite ${option.course_id} missing`);
  assert.ok(![...ids].some(id => /^(M E|A A|ECON) /.test(id)));
  const unknown = await scopeToMajor('Underwater Basket Weaving', courses);
  assert.equal(unknown.courses.length, courses.length);
});

test('a real CS plan reports a short, scoped warning list', async () => {
  const plan = await generatePlan(PlanRequestSchema.parse({ major: 'Computer Science', completed_courses: ['CSE 121', 'CSE 122', 'CSE 123', 'MATH 124', 'MATH 125', 'MATH 126'],
    in_progress_courses: [], goal: { type: 'internship', track: 'swe', deadline: '2027-06-01' }, start_term: '2027-winter', max_courses_per_term: 3 }), { now });
  assert.ok(plan.warnings.length < 40, `${plan.warnings.length} warnings`);
  assert.ok(plan.warnings.some(w => w.code === 'MAJOR_SCOPE'));
  assert.ok(plan.warnings.filter(w => w.code === 'COURSE_BLOCKED' || w.code === 'NEEDS_GRADE_CONFIRMATION').length <= BLOCKED_DETAIL_LIMIT);
  // PHYS courses are expected: CS_SCIENCE names them. Mechanical, Aeronautics and Economics courses are not.
  assert.ok(!plan.warnings.flatMap(w => w.affected_course_codes).some(id => /^(M E|A A|ECON) /.test(id)));
});

test('confirmed transcript grades reach the request and satisfy minimum-grade prerequisites', async () => {
  const grades = confirmedGrades([
    { id: '1', code: 'CSE 123', term: 'AUT 2025', grade: '3.6', status: 'completed', confidence: null },
    { id: '2', code: 'MATH 126', term: 'AUT 2025', grade: 'CR', status: 'completed', confidence: null },
    { id: '3', code: 'CSE 122', term: 'SPR 2025', grade: '3.0', status: 'completed', confidence: null },
    { id: '4', code: 'CSE 122', term: 'AUT 2025', grade: '3.9', status: 'completed', confidence: null },
    { id: '5', code: 'CSE 311', term: 'WIN 2026', grade: '2.5', status: 'in_progress', confidence: null },
  ]);
  assert.deepEqual(grades, { 'CSE 123': 3.6 });
  const ui: UiPlanRequest = { majors: ['Computer Science'], completed_courses: ['CSE 123', 'MATH 126'], in_progress_courses: [], target_role: 'SWE Intern',
    target_summer: 2027, max_courses_per_term: 3, start_term: 'winter', start_year: 2027, horizon_terms: 3,
    reviewed_grades: { 'CSE 123': 3.6, 'CSE 142': 3.0, 'MATH 126': 3.2 },
    goal_draft: { type: 'internship', track: 'swe', deadline: null, notes: '', career_hours_per_week: 6, intensity: 'balanced' } };
  assert.deepEqual(toBackendRequest(ui).reviewed_grades, { 'CSE 123': 3.6, 'MATH 126': 3.2 });
  assert.equal(toBackendRequest({ ...ui, reviewed_grades: {} }).reviewed_grades, undefined);
  const plan = await generatePlan({ ...toBackendRequest(ui), start_term: '2027-winter' }, { now });
  assert.equal(plan.academic_decisions?.find(d => d.course_id === 'CSE 311' && d.term === '2027-winter')?.catalog_prerequisite_status, 'met');
});
