import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData } from '../lib/data';
import { importRegistration, evaluateSection } from '../lib/registration';
import { planAcademic } from '../lib/planner';
import { generatePlan } from '../lib/plan-service';
import { PlanRequestSchema, PlanResponseSchema, type PlanRequest } from '../types/plan';
import { checkPrerequisites } from '../lib/prerequisites';
const data = loadData();
const handoff = JSON.parse(readFileSync('data/handoff/registration_evidence_handoff.json', 'utf8'));
const now = new Date('2026-10-17T18:00:00Z');
function request(changes: Partial<PlanRequest> = {}) {
  return PlanRequestSchema.parse({ major: 'Computer Science + Applied Mathematics', completed_courses: [], in_progress_courses: [],
    goal: { type: 'internship', track: 'ml', deadline: '2027-06-01' }, max_courses_per_term: 2, start_term: '2027-winter', ...changes });
}
async function decision(id: string, changes: Partial<PlanRequest> = {}) {
  const { courses, sections } = await data;
  const c = courses.find(c => c.course_id === id)!;
  const plan = planAcademic(request(changes), [c], now, false, sections);
  return { decision: plan.academic_decisions[0], plan };
}
async function section(id: string, name: string) {
  return (await data).sections.find(s => s.course_id === id && s.section === name)!;
}
const acceptance: (() => Promise<void>)[] = [
  async () => {
    for (const [id, prerequisites] of Object.entries({ 'CSE 311': ['CSE 123', 'MATH 126'], 'CSE 331': ['CSE 123'], 'INFO 340': ['CSE 123', 'INFO 201'], 'INFO 430': ['INFO 330'] })) {
      assert.equal((await decision(id, { completed_courses: prerequisites })).decision.catalog_prerequisite_status, 'needs_grade_confirmation');
    }
  },
  async () => {
    for (const [grade, expected] of [[1.9, 'unmet'], [2, 'met']] as const)
      assert.equal((await decision('CSE 331', { completed_courses: ['CSE 123'], reviewed_grades: { 'CSE 123': grade } })).decision.catalog_prerequisite_status, expected);
  },
  async () => {
    for (const id of ['INFO 330', 'CSE 414', 'I S 445']) {
      const d = await decision('INFO 430', { completed_courses: ['INFO 330', 'CSE 414', 'I S 445'], reviewed_grades: { [id]: 2 } });
      assert.equal(d.decision.catalog_prerequisite_status, 'met');
    }
  },
  async () => {
    const { decision: d } = await decision('INFO 340', { completed_courses: ['INFO 201'], reviewed_grades: { 'INFO 201': 2 }, concurrent_courses: { '2027-winter': ['CSE 163'] } });
    assert.equal(d.catalog_prerequisite_status, 'met'); assert.equal(d.prerequisite_conditional, true);
  },
  async () => {
    assert.equal((await decision('INFO 340', { completed_courses: ['INFO 201'], reviewed_grades: { 'INFO 201': 2 }, concurrent_courses: { '2027-winter': ['CSE 123'] } })).decision.catalog_prerequisite_status, 'unmet');
  },
  async () => {
    for (const reviewed_grades of [undefined, { 'INFO 201': 1.9 }]) {
      const d = await decision('INFO 340', { completed_courses: ['INFO 201'], reviewed_grades, concurrent_courses: { '2027-winter': ['CSE 163'] } });
      assert.notEqual(d.decision.catalog_prerequisite_status, 'met');
    }
    assert.notEqual((await decision('INFO 340', { concurrent_courses: { '2027-winter': ['CSE 163', 'INFO 201'] } })).decision.catalog_prerequisite_status, 'met');
  },
  async () => {
    for (const name of ['A', 'B', 'C', 'D']) {
      const s = await section('CSE 351', name);
      assert.equal(evaluateSection(s, 'CS + AMATH', new Set()).major_status, ['A', 'B'].includes(name) ? 'met' : 'unmet');
      assert.equal(evaluateSection(s, 'ECE', new Set()).major_status, ['C', 'D'].includes(name) ? 'met' : 'unmet');
    }
    const b = await section('CSE 351', 'C');
    const d = await decision('CSE 351', { completed_courses: ['CSE 123'], selected_slns: { '2027-winter': [b.sln] } });
    assert.equal(d.decision.section_registration_status, 'ineligible');
    assert.equal(d.plan.warnings.some(w => w.code === 'COURSE_REVIEW_REQUIRED' && w.message.startsWith('2027-winter:')), false);
  },
  async () => {
    const a = await section('CSE 391', 'A'); const b = await section('CSE 391', 'B');
    assert.equal(evaluateSection(a, 'CSE', new Set()).corequisite_status, 'not_required');
    assert.equal(evaluateSection(b, 'ECE', new Set()).corequisite_status, 'unmet');
    assert.equal(evaluateSection(b, 'ECE', new Set(['CSE 351'])).corequisite_status, 'met');
    assert.equal(evaluateSection(b, 'CSE', new Set(['CSE 351'])).registration_status, 'ineligible');
    const d = await decision('CSE 391', { major: 'ECE', completed_courses: ['CSE 123', 'CSE 351'], selected_slns: { '2027-winter': [b.sln] } });
    assert.equal(d.decision.catalog_prerequisite_status, 'met');
    assert.equal(d.decision.section_registration_status, 'ineligible');
  },
  async () => {
    for (const name of ['AH', 'AI', 'AJ']) {
      const s = await section('CSE 373', name); const d = evaluateSection(s, 'Physics', new Set());
      assert.equal(d.excluded, true); assert.equal(d.registration_status, 'ineligible');
      const p = await decision('CSE 373', { completed_courses: ['CSE 123'], selected_slns: { '2027-winter': [s.sln] } });
      assert.equal(p.decision.section_registration_status, 'ineligible');
      assert.equal(p.plan.quarters.flatMap(q => q.courses).length, 0);
    }
  },
  async () => {
    const s = await section('AMATH 351', 'A');
    assert.ok(s.import_candidates.some(r => r.type === 'policy_reference' && !r.implies_add_code_required));
    const d = await decision('AMATH 351', { completed_courses: ['MATH 125'] });
    assert.equal(d.decision.catalog_prerequisite_status, 'met'); assert.equal(d.decision.section_registration_status, 'unknown');
    assert.ok(!JSON.stringify(d.decision).includes('Add code required'));
  },
  async () => {
    const d = await decision('CSE 351', { completed_courses: ['CSE 123'] });
    assert.equal(d.decision.catalog_prerequisite_status, 'met'); assert.equal(d.decision.section_registration_status, 'unknown');
    assert.equal(d.decision.term_offering_status, 'confirmed'); assert.equal(d.decision.schedule_conflict_status, 'not_evaluated');
    assert.equal(d.plan.quarters.flatMap(q => q.courses).length, 0);
    assert.ok(d.plan.warnings.some(w => w.code === 'COURSE_REVIEW_REQUIRED'));
  },
  async () => {
    const s = (await data).sections.find(s => !s.notes && !s.restriction_flag)!;
    assert.equal(evaluateSection(s, 'CSE', new Set()).registration_status, 'unknown');
    assert.equal((await decision('INFO 330')).decision.section_registration_status, 'unknown');
  },
];
handoff.acceptance_checks.forEach((name: string, i: number) => test(`handoff acceptance ${i + 1}: ${name}`, acceptance[i]));

test('reviewed grade IDs normalize; invalid, colliding, nonnumeric, or unconfirmed grades fail safely', () => {
  assert.deepEqual(request({ completed_courses: ['cse123'], reviewed_grades: { cse123: 2 } }).reviewed_grades, { 'CSE 123': 2 });
  for (const grades of [{ 'CSE 123': 4.1 }, { 'CSE 123': -1 }, { cse123: 2, 'CSE 123': 3 }, { 'BAD': 2 }, { 'CSE 123': '2.0' }])
    assert.equal(PlanRequestSchema.safeParse({ ...request({ completed_courses: ['CSE 123'] }), reviewed_grades: grades }).success, false);
  assert.throws(() => request({ reviewed_grades: { 'CSE 123': 2 } }));
});
test('CSE 311 preserves AND and alternatives, without penalizing unused low/missing grades', async () => {
  const changes = { completed_courses: ['CSE 123', 'CSE 143', 'MATH 126', 'MATH 135'], reviewed_grades: { 'CSE 123': 1.9, 'CSE 143': 2, 'MATH 135': 2 } };
  assert.equal((await decision('CSE 311', changes)).decision.catalog_prerequisite_status, 'met');
  assert.equal((await decision('CSE 311', { completed_courses: ['CSE 143'], reviewed_grades: { 'CSE 143': 4 } })).decision.catalog_prerequisite_status, 'unmet');
  assert.equal((await decision('CSE 331', { completed_courses: ['CSE 123', 'CSE 143'], reviewed_grades: { 'CSE 123': 1.9, 'CSE 143': 2 } })).decision.catalog_prerequisite_status, 'met');
});
test('concurrency is exact-term, never inferred from in-progress or review-only courses', async () => {
  const { courses, sections } = await data; const course = courses.find(c => c.course_id === 'INFO 340')!;
  const p = planAcademic(request({ completed_courses: ['INFO 201'], reviewed_grades: { 'INFO 201': 2 }, concurrent_courses: { '2027-winter': ['CSE 163'] } }), [course], now, false, sections);
  assert.equal(p.academic_decisions[0].catalog_prerequisite_status, 'met');
  assert.equal(p.academic_decisions[1].catalog_prerequisite_status, 'unmet');
  assert.equal((await decision('INFO 340', { completed_courses: ['INFO 201'], reviewed_grades: { 'INFO 201': 2 }, in_progress_courses: ['CSE 163'] })).decision.catalog_prerequisite_status, 'unmet');
});
test('all 115 sections preserve complete original metadata, provenance and exact SLN/term scope', async () => {
  const rows = JSON.parse(readFileSync('data/target_courses/sections.json', 'utf8'));
  const { sections } = await data; assert.equal(sections.length, 115);
  for (const s of sections) {
    assert.deepEqual(s.metadata, rows.find((r: { sln: string }) => r.sln === s.sln));
    assert.ok(s.detail_url.includes(`SLN=${s.sln}`)); assert.equal(s.term_id, '2027-winter');
    assert.equal(s.snapshot_at, '2026-10-17T00:03:00-07:00');
  }
  const plan = await generatePlan(request({ completed_courses: ['CSE 123'], selected_slns: { '2027-winter': ['12962'] } }), { now });
  assert.ok(PlanResponseSchema.safeParse(plan).success);
  const winter = plan.academic_decisions!.find(d => d.course_id === 'CSE 391' && d.term === '2027-winter')!;
  assert.ok(winter.sections.every(s => s.source_ids.every(id => plan.sources.some(source => source.id === id && source.url))));
  assert.equal(plan.academic_decisions!.find(d => d.course_id === 'CSE 391' && d.term === '2027-spring')!.sections.length, 0);
});
test('stale inputs, duplicate sections or altered prerequisite handoff fail closed', () => {
  const files = Object.fromEntries(['courses.json', 'prerequisites.json', 'sections.json'].map(name => [name, readFileSync(`data/target_courses/${name}`, 'utf8')]));
  assert.throws(() => importRegistration(handoff, { ...files, 'sections.json': files['sections.json'] + ' ' }));
  const duplicate = structuredClone(handoff); duplicate.section_evidence[1] = duplicate.section_evidence[0];
  assert.throws(() => importRegistration(duplicate, files));
  const altered = structuredClone(handoff); altered.minimum_grade_rules['CSE 331'].any_of[0].min_grades['CSE 123'] = 1;
  assert.throws(() => importRegistration(altered, files));
});
test('backward-compatible requests still work and no handoff course becomes falsely validated', async () => {
  const plan = await generatePlan(request(), { now });
  assert.ok(!Object.hasOwn(plan.request, 'reviewed_grades'));
  assert.equal(plan.quarters.flatMap(q => q.courses).length, 0);
  const { courses } = await data;
  for (const c of courses) {
    const prereqs = c.prerequisite_alternatives!.flatMap(b => b.all_of.map(o => o.course_id));
    assert.equal(checkPrerequisites(c, { completed: new Set(prereqs), grades: Object.fromEntries(prereqs.map(id => [id, 4])) }).status, 'met');
  }
});

test('selected SLNs never cross terms or silently establish clearance for unknown selections', async () => {
  const s = await section('CSE 351', 'A');
  const { courses, sections } = await data;
  const p = planAcademic(request({ completed_courses: ['CSE 123'], selected_slns: { '2027-spring': [s.sln] } }), [courses.find(c => c.course_id === 'CSE 351')!], now, false, sections);
  const spring = p.academic_decisions.find(d => d.term === '2027-spring')!;
  assert.equal(spring.sections.length, 0); assert.equal(spring.section_registration_status, 'unknown');
  assert.ok(p.warnings.some(w => w.code === 'SECTION_SELECTION_UNKNOWN'));
});

test('request grade confirmation does not mutate extracted transcript records or waive completion', async () => {
  const { parseTranscriptText } = await import('../lib/transcript/parser');
  const extracted = parseTranscriptText('AUTUMN 2026\nCSE 123 PROGRAMMING 5.0 3.8');
  assert.equal(extracted.user_confirmation_required, true);
  assert.equal(Object.hasOwn(extracted, 'reviewed_grades'), false);
  assert.throws(() => request({ in_progress_courses: ['CSE 123'], reviewed_grades: { 'CSE 123': 3.8 } }));
});
