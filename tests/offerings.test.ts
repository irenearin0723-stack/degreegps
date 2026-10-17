import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CourseSchema, OfferingEvidenceSchema, type Course } from '../types/course';
import { PlanRequestSchema } from '../types/plan';
import { offeringForTerm, mergeProjectedOfferings, ProjectionDatasetSchema } from '../lib/offerings';
import { planAcademic } from '../lib/planner';
import { loadData } from '../lib/data';
import { generatePlan } from '../lib/plan-service';
const now = new Date('2026-10-17T19:00:00Z');
const request = PlanRequestSchema.parse({ major: 'Computer Science + Applied Mathematics', completed_courses: ['MATH 125', 'MATH 126', 'MATH 207', 'MATH 208', 'CSE 123', 'CSE 311', 'CSE 332', 'CSE 312'],
  in_progress_courses: [], goal: { type: 'internship', track: 'ml', deadline: '2027-06-01' }, max_courses_per_term: 2, start_term: '2027-winter' });
function course(status: 'confirmed' | 'projected' | 'unknown', changes: Partial<Course> = {}) {
  return CourseSchema.parse({ course_id: 'DEMO 100', title: 'Synthetic test rules only', credits: 4, category: 'major', prerequisite_groups: [],
    offered_terms: null, eligible_majors: ['*'], enrollment_status: 'verified', source_url: 'https://www.washington.edu/', verified_at: '2026-10-17', data_status: 'verified', tracks: ['ml'], foundation_priority: 5,
    offering_evidence: [{ term: '2027-winter', status, source_url: status === 'unknown' ? null : 'https://www.washington.edu/', verified_at: status === 'unknown' ? null : '2026-10-17', notes: 'Synthetic evidence for algorithm testing' }], ...changes });
}
test('confirmed offerings with satisfied eligibility are eligible, projected ones are tentative', () => {
  const confirmed = planAcademic(request, [course('confirmed')], now);
  assert.equal(confirmed.quarters[0].courses[0].scheduling_status, 'eligible');
  const projected = planAcademic(request, [course('projected')], now);
  assert.equal(projected.quarters[0].courses[0].scheduling_status, 'tentative');
  assert.ok(projected.warnings.some(w => w.code === 'PROJECTED_OFFERING'));
  assert.ok(projected.quarters[0].courses[0].source_ids.some(id => id.startsWith('offering:')));
});
test('unknown offering blocks scheduling even if a legacy field claims that term', () => {
  const result = planAcademic(request, [course('unknown', { offered_term_ids: ['2027-winter'] })], now);
  assert.equal(result.quarters.flatMap(q => q.courses).length, 0);
  assert.equal(result.warnings.some(w => w.code === 'COURSE_REVIEW_REQUIRED'), false);
});
test('projected offering cannot bypass unknown or missing prerequisite rules', () => {
  for (const prerequisites of [null, [{ any_of: [{ course_id: 'DEMO 099', minimum_grade: null, concurrent_allowed: false }] }]]) {
    const result = planAcademic(request, [course('projected', { prerequisite_groups: prerequisites })], now);
    assert.equal(result.quarters.flatMap(q => q.courses).length, 0);
    assert.equal(result.warnings.some(w => w.code === 'COURSE_REVIEW_REQUIRED'), false);
  }
});
test('unknown registration eligibility stays outside assignments; candidates are explicitly marked for review', () => {
  const result = planAcademic(request, [course('projected', { enrollment_status: 'unknown', eligible_majors: null })], now);
  assert.equal(result.quarters.flatMap(q => q.courses).length, 0);
  assert.ok(result.quarters[0].notes.includes('REVIEW ONLY'));
  assert.ok(result.warnings.some(w => w.code === 'COURSE_REVIEW_REQUIRED'));
});
test('review-only candidate cannot satisfy a later-quarter prerequisite', () => {
  const first = course('projected', { enrollment_status: 'unknown', eligible_majors: null });
  const second = course('projected', { course_id: 'DEMO 200', prerequisite_groups: [{ any_of: [{ course_id: 'DEMO 100', minimum_grade: null, concurrent_allowed: false }] }],
    offering_evidence: [{ term: '2027-spring', status: 'projected', source_url: 'https://www.washington.edu/', verified_at: '2026-10-17', notes: 'Synthetic' }] });
  const result = planAcademic(request, [first, second], now);
  assert.equal(result.quarters.flatMap(q => q.courses).length, 0);
  assert.equal(result.warnings.some(w => w.code === 'COURSE_REVIEW_REQUIRED' && w.affected_course_codes.includes('DEMO 200')), false);
});
test('missing section meeting times do not block quarter-level recommendations', () => {
  const result = planAcademic(request, [course('projected', { section_data_status: 'not_imported' })], now);
  assert.equal(result.quarters[0].courses[0].id, 'DEMO 100');
});
test('a verified major mismatch remains blocked rather than becoming a review candidate', () => {
  const result = planAcademic(request, [course('projected', { eligible_majors: ['Physics'] })], now);
  assert.equal(result.quarters[0].courses.length, 0);
  assert.equal(result.warnings.some(w => w.code === 'COURSE_REVIEW_REQUIRED'), false);
});
test('a positive offering requires official dated evidence, and projection imports cannot claim confirmation', async () => {
  assert.equal(OfferingEvidenceSchema.safeParse({ term: '2027-spring', status: 'projected', source_url: null, verified_at: null, notes: '' }).success, false);
  const dataset = JSON.parse(await readFile('data/target_courses/projected_offerings.json', 'utf8'));
  assert.ok(ProjectionDatasetSchema.safeParse(dataset).success);
  const invalid = structuredClone(dataset); invalid.offerings[0].status = 'confirmed';
  assert.equal(ProjectionDatasetSchema.safeParse(invalid).success, false);
  const duplicate = structuredClone(dataset); duplicate.offerings.push(duplicate.offerings[0]);
  assert.equal(ProjectionDatasetSchema.safeParse(duplicate).success, false);
});
test('real imports preserve confirmed Winter listings, AMATH Summer projections, and unknown CSE/INFO Summer', async () => {
  const { courses } = await loadData();
  assert.equal(offeringForTerm(courses.find(c => c.course_id === 'CSE 446')!, '2027-winter').status, 'confirmed');
  assert.equal(offeringForTerm(courses.find(c => c.course_id === 'CSE 446')!, '2027-spring').status, 'projected');
  assert.equal(offeringForTerm(courses.find(c => c.course_id === 'AMATH 353')!, '2027-summer').status, 'projected');
  assert.equal(offeringForTerm(courses.find(c => c.course_id === 'CSE 446')!, '2027-summer').status, 'unknown');
  assert.equal(offeringForTerm(courses.find(c => c.course_id === 'INFO 201')!, '2027-summer').status, 'unknown');
  assert.equal(offeringForTerm(courses.find(c => c.course_id === 'AMATH 352')!, '2028-summer').status, 'unknown');
});
test('realistic CS + AMATH history receives useful review candidates in all three quarters without inventing eligibility', async () => {
  const plan = await generatePlan(request, { now });
  assert.deepEqual(plan.quarters.map(q => q.term), ['2027-winter', '2027-spring', '2027-summer']);
  assert.ok(plan.quarters.every(q => q.notes.includes('REVIEW ONLY')));
  assert.ok(plan.warnings.filter(w => w.code === 'COURSE_REVIEW_REQUIRED').length >= 3);
  assert.equal(plan.quarters.flatMap(q => q.courses).length, 0);
  assert.equal(plan.career_milestones.length, 4);
  assert.ok(plan.sources.some(s => s.url?.includes('amath-cfrm-undergraduate-course-schedule')));
});
test('adding projections never changes prerequisite branches, eligibility, or section evidence', async () => {
  const { courses } = await loadData();
  const rows = JSON.parse(await readFile('data/target_courses/courses.json', 'utf8'));
  const rules = JSON.parse(await readFile('data/target_courses/prerequisites.json', 'utf8'));
  const { importCourse } = await import('../lib/course-import');
  for (const row of rows) {
    const original = importCourse(row, rules[row.course_id]);
    const merged = courses.find(c => c.course_id === row.course_id)!;
    assert.deepEqual(merged.prerequisite_alternatives, original.prerequisite_alternatives);
    assert.equal(merged.enrollment_status, original.enrollment_status);
    assert.equal(merged.eligible_majors, original.eligible_majors);
    assert.equal(merged.section_data_status, original.section_data_status);
  }
});
test('projected offerings still require actual minimum-grade evidence', () => {
  const restricted = course('projected', { prerequisite_groups: [{ any_of: [{ course_id: 'CSE 123', minimum_grade: 2, concurrent_allowed: false }] }] });
  const result = planAcademic(request, [restricted], now);
  assert.equal(result.quarters[0].courses.length, 0);
  assert.equal(result.warnings.some(w => w.code === 'COURSE_REVIEW_REQUIRED'), false);
  assert.ok(result.warnings.some(w => w.code === 'NEEDS_GRADE_CONFIRMATION'));
});
test('a projected dependent cannot use an in-progress prerequisite as completed', () => {
  const restricted = course('projected', { prerequisite_groups: [{ any_of: [{ course_id: 'DEMO 099', minimum_grade: null, concurrent_allowed: false }] }] });
  const result = planAcademic({ ...request, in_progress_courses: ['DEMO 099'] }, [restricted], now);
  assert.equal(result.quarters[0].courses.length, 0);
  assert.equal(result.warnings.some(w => w.code === 'COURSE_REVIEW_REQUIRED'), false);
});
