import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { loadData } from '../lib/data';
import { importCourse } from '../lib/course-import';
import { checkPrerequisites } from '../lib/prerequisites';
import { planAcademic } from '../lib/planner';
import { PlanRequestSchema } from '../types/plan';
import { auditData } from '../scripts/validate-data';
import { CourseSchema } from '../types/course';
const read = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
interface Fixture {
  case_id: string; kind: string; course_id?: string; completed_courses?: string[]; concurrent_courses?: string[];
  grades?: Record<string, number>; expected: string | boolean; sln?: string; slns?: string[];
}
const fixtures: Fixture[] = JSON.parse(readFileSync('data/target_courses/test_cases.json', 'utf8')).cases;
for (const fixture of fixtures) {
  test(`imported fixture: ${fixture.case_id}`, async () => {
    const { courses } = await loadData();
    if (fixture.kind === 'prerequisite') {
      const course = courses.find(c => c.course_id === fixture.course_id)!;
      assert.ok(course);
      const result = checkPrerequisites(course, { completed: new Set(fixture.completed_courses), concurrent: new Set(fixture.concurrent_courses), grades: fixture.grades });
      assert.equal(result.status, fixture.expected);
    } else if (fixture.kind === 'term_filter') {
      assert.equal(courses.find(c => c.course_id === fixture.course_id)!.offered_term_ids!.includes('2027-winter'), fixture.expected);
    } else {
      // These check the supplied section evidence only, not a full timetable/registration solver.
      const sections = await read('data/target_courses/sections.json') as { sln: string; days: string; start_time: string; end_time: string; section_status: string }[];
      if (fixture.kind === 'section_filter') assert.equal(sections.find(s => s.sln === fixture.sln)!.section_status, fixture.expected);
      else {
        assert.equal(fixture.kind, 'time_overlap');
        const [a, b] = fixture.slns!.map(sln => sections.find(s => s.sln === sln)!);
        assert.ok(a && b);
        const sharedDays = a.days.split('|').some(day => b.days.split('|').includes(day));
        assert.equal(sharedDays && a.start_time < b.end_time && b.start_time < a.end_time, fixture.expected);
      }
    }
  });
}
test('all supplied course/prerequisite records import without loss, duplicate IDs, or invented offerings', async () => {
  const audit = await auditData();
  assert.equal(audit.total_courses, 64); assert.equal(audit.normalized_schema_valid, 64);
  assert.equal(audit.normalized_rejected, 0); assert.deepEqual(audit.duplicate_ids, []);
  const rows = await read('data/target_courses/courses.json');
  const rules = await read('data/target_courses/prerequisites.json');
  for (const row of rows) {
    const course = importCourse(row, rules[row.course_id]);
    assert.equal(course.title, row.course_name); assert.equal(course.credits, row.credits);
    assert.equal(course.source_url, rules[row.course_id].source_url);
    assert.equal(course.schedule_source_url, row.schedule_url);
    assert.equal(course.verified_at, row.checked_at);
    assert.equal(course.source_category, row.category);
    assert.equal(course.offered_terms, null);
    assert.deepEqual(course.offered_term_ids, row.offering_status === 'listed' ? ['2027-winter'] : []);
    assert.equal(course.eligible_majors, null);
    assert.equal(course.prerequisite_alternatives!.length, rules[row.course_id].any_of.length);
    for (let i = 0; i < course.prerequisite_alternatives!.length; i++) {
      const original = rules[row.course_id].any_of[i];
      assert.deepEqual(course.prerequisite_alternatives![i].all_of, original.all_of.map((id: string) => ({
        course_id: id, minimum_grade: original.min_grades?.[id] ?? null,
        concurrent_allowed: original.concurrent_allowed?.includes(id) ?? false,
      })));
    }
  }
});
test('DNF branches retain correlated alternatives instead of accepting a flattened cross-product', () => {
  const base = { course_id: 'CSE 400', title: 'Synthetic logic test only', credits: 4, category: 'major',
    offered_terms: ['winter'], eligible_majors: ['*'], source_url: 'https://www.washington.edu/', verified_at: '2026-10-17', data_status: 'verified', tracks: ['swe'], foundation_priority: 5 };
  const option = (course_id: string) => ({ course_id, minimum_grade: null, concurrent_allowed: false });
  const course = CourseSchema.parse({ ...base, prerequisite_groups: null, prerequisite_alternatives: [
    { all_of: [option('CSE 100'), option('CSE 101')] }, { all_of: [option('CSE 200'), option('CSE 201')] },
  ] });
  assert.equal(checkPrerequisites(course, { completed: new Set(['CSE 100', 'CSE 201']) }).eligible, false);
  assert.equal(checkPrerequisites(course, { completed: new Set(['CSE 200', 'CSE 201']) }).eligible, true);
});
test('exact Winter 2027 evidence cannot schedule Winter 2028 or infer Spring offerings', async () => {
  const { courses } = await loadData();
  // Synthetic authorization below isolates term logic; no real record is changed or authorized.
  const isolated = { ...courses.find(c => c.course_id === 'AMATH 301')!, eligible_majors: ['*'], enrollment_status: 'verified' as const };
  const request = PlanRequestSchema.parse({ major: 'Computer Science', completed_courses: ['MATH 125'], in_progress_courses: [],
    goal: { type: 'internship', track: 'ml', deadline: '2028-06-01' }, max_courses_per_term: 2, start_term: '2028-winter' });
  const plan = planAcademic(request, [isolated], new Date('2026-10-17T18:00:00Z'));
  assert.equal(plan.quarters.flatMap(q => q.courses).length, 0);
});
test('past/current start term is adjusted by chronological quarter order, not lexicographic comparison', () => {
  const request = PlanRequestSchema.parse({ major: 'CS', completed_courses: [], in_progress_courses: [],
    goal: { type: 'explore', track: 'undecided', deadline: null }, max_courses_per_term: 2, start_term: '2026-autumn' });
  const plan = planAcademic(request, [], new Date('2026-10-17T18:00:00Z'));
  assert.deepEqual(plan.quarters.map(q => q.term), ['2027-winter', '2027-spring', '2027-summer']);
  assert.ok(plan.warnings.some(w => w.code === 'START_TERM_ADJUSTED'));
});
test('invalid import rules fail closed instead of dropping grades or concurrency metadata', async () => {
  const rows = await read('data/target_courses/courses.json');
  const rules = await read('data/target_courses/prerequisites.json');
  assert.throws(() => importCourse(rows[0], { ...rules['CSE 311'], any_of: [{ all_of: ['CSE 123'], min_grades: { 'MATH 126': 2 } }] }));
  assert.throws(() => importCourse({ ...rows[0], category: 'invented_requirement' }, rules['CSE 311']));
});
