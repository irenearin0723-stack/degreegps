import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { loadData } from '../lib/data';
import { importCourse } from '../lib/course-import';
import { checkPrerequisites } from '../lib/prerequisites';
import { planAcademic } from '../lib/planner';
import { offeringForTerm } from '../lib/offerings';
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
  const rows = await read('data/target_courses/courses.json');
  const rules = await read('data/target_courses/prerequisites.json');
  // 64 Winter 2027 target courses plus 287 records added 2026-10-17 for courses the full-depth major profiles name.
  assert.equal(rows.length, 351);
  assert.equal(audit.total_courses, rows.length); assert.equal(audit.normalized_schema_valid, rows.length);
  assert.equal(audit.normalized_rejected, 0); assert.deepEqual(audit.duplicate_ids, []);
  // Courses whose Winter 2027 schedule was not checked never get a confirmed offering.
  assert.equal(audit.not_collected_winter_2027, rows.filter((r: { offering_status: string }) => r.offering_status === 'not_collected').length);
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
    if (['non_course_only', 'too_complex'].includes(rules[row.course_id].catalog_prerequisite_status)) {
      assert.equal(course.prerequisite_alternatives, undefined); continue;
    }
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
test('exact Winter 2027 evidence is never generalized: later terms are only tentative catalog patterns', async () => {
  const { courses } = await loadData();
  // Synthetic authorization below isolates term logic; no real record is changed or authorized.
  const isolated = { ...courses.find(c => c.course_id === 'AMATH 301')!, eligible_majors: ['*'], enrollment_status: 'verified' as const };
  const request = PlanRequestSchema.parse({ major: 'Computer Science', completed_courses: ['MATH 125'], in_progress_courses: [],
    goal: { type: 'internship', track: 'ml', deadline: '2028-06-01' }, max_courses_per_term: 2, start_term: '2028-winter' });
  const plan = planAcademic(request, [isolated], new Date('2026-10-17T18:00:00Z'));
  assert.notEqual(offeringForTerm(isolated, '2028-winter').status, 'confirmed');
  for (const c of plan.quarters.flatMap(q => q.courses)) {
    assert.equal(c.scheduling_status, 'tentative'); assert.match(c.explanation, /catalog/i);
  }
});
test('past/current start term is adjusted by chronological quarter order, not lexicographic comparison', () => {
  const request = PlanRequestSchema.parse({ major: 'CS', completed_courses: [], in_progress_courses: [],
    goal: { type: 'explore', track: 'undecided', deadline: null }, max_courses_per_term: 2, start_term: '2026-autumn' });
  const plan = planAcademic(request, [], new Date('2026-10-17T18:00:00Z'));
  assert.deepEqual(plan.quarters.map(q => q.term), ['2027-winter', '2027-spring', '2027-autumn']);
  assert.ok(plan.warnings.some(w => w.code === 'START_TERM_ADJUSTED'));
});
test('invalid import rules fail closed instead of dropping grades or concurrency metadata', async () => {
  const rows = await read('data/target_courses/courses.json');
  const rules = await read('data/target_courses/prerequisites.json');
  assert.throws(() => importCourse(rows[0], { ...rules['CSE 311'], any_of: [{ all_of: ['CSE 123'], min_grades: { 'MATH 126': 2 } }] }));
  assert.throws(() => importCourse({ ...rows[0], category: 'invented_requirement' }, rules['CSE 311']));
});
test('program catalog covers every UW Seattle undergraduate major and links full profiles both ways', async () => {
  const catalog = await read('data/major_requirements/program_catalog.json');
  const major = await read('data/major_requirements/major_requirements.json');
  const programIds = new Set(major.programs.map((p: { program_id: string }) => p.program_id));
  assert.equal(programIds.size, major.programs.length);
  assert.equal(catalog.programs.length, 112);
  for (const record of catalog.programs) {
    assert.match(record.source_url, /^https:\/\/www\.washington\.edu\/students\/gencat\//);
    assert.ok(record.credentials.length > 0);
    for (const id of record.requirement_program_ids) assert.ok(programIds.has(id), id);
    assert.equal(record.detail_level, record.requirement_program_ids.length ? 'full_requirement_profiles' : 'catalog_summary');
  }
  const full = catalog.programs.filter((r: { detail_level: string }) => r.detail_level !== 'catalog_summary');
  assert.equal(full.length, 14);
  for (const p of major.programs.filter((p: { parent_program_id?: string }) => p.parent_program_id))
    assert.ok(full.some((r: { catalog_program_id: string }) => r.catalog_program_id === p.catalog_program_id), p.program_id);
});
test('new major names map to official institutional codes from catalog program IDs', async () => {
  const { institutionalMajorCodes } = await import('../lib/registration');
  const catalog = await read('data/major_requirements/program_catalog.json');
  const codes = new Set(catalog.programs.map((r: { institutional_major_code: string }) => r.institutional_major_code));
  for (const [name, code] of [['Statistics', 'STAT'], ['Computer Engineering', 'CMP E'], ['Electrical and Computer Engineering', 'ECENG'],
    ['Industrial and Systems Engineering', 'IND E'], ['Mechanical Engineering', 'M E'], ['Aeronautics and Astronautics', 'A A'],
    ['Human Centered Design and Engineering', 'HCDE'], ['Applied and Computational Mathematical Sciences', 'ACMS']]) {
    assert.deepEqual([...institutionalMajorCodes(name)], [code]);
    assert.ok(codes.has(code), code);
  }
  assert.ok(!institutionalMajorCodes('Computer Science').has('CMP E'));
});
test('not_collected Winter 2027 status is never treated as an offering, and unencodable prerequisites stay unknown', async () => {
  const rows = await read('data/target_courses/courses.json');
  const rules = await read('data/target_courses/prerequisites.json');
  const row = { ...rows.find((r: { course_id: string }) => r.course_id === 'STAT 302'), offering_status: 'not_collected', lecture_sections: '' };
  const course = importCourse(row, rules['STAT 302']);
  assert.deepEqual(course.offered_term_ids, []); assert.deepEqual(course.offering_evidence, []);
  const plan = planAcademic(PlanRequestSchema.parse({ major: 'Statistics', completed_courses: [], in_progress_courses: [],
    goal: { type: 'internship', track: 'data', deadline: '2027-06-01' }, max_courses_per_term: 3, start_term: '2027-winter' }),
    [course], new Date('2026-10-17T18:00:00Z'));
  // At most a tentative catalog pattern; an unchecked schedule is never a confirmed offering.
  assert.ok(plan.academic_decisions.every(d => d.term_offering_status !== 'confirmed'));
  assert.ok(plan.quarters.flatMap(q => q.courses).every(c => c.scheduling_status === 'tentative'));
  const opaque = importCourse(row, { ...rules['STAT 302'], any_of: [{ all_of: [] }], catalog_prerequisite_status: 'non_course_only' });
  assert.equal(opaque.prerequisite_alternatives, undefined);
  assert.equal(checkPrerequisites(opaque, { completed: new Set() }).status, 'unknown');
});
