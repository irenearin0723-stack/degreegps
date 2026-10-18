import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PlanResponseSchema } from '../types/plan';
const origin = process.env.DEGREEGPS_SMOKE_ORIGIN ?? 'http://127.0.0.1:3113';
async function main() {
  const handoff = JSON.parse(await readFile('data/handoff/registration_evidence_handoff.json', 'utf8'));
  const passed: string[] = [];
  async function plan(changes: Record<string, unknown> = {}) {
    const response = await fetch(`${origin}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      major: 'Computer Science + Applied Mathematics', completed_courses: [], in_progress_courses: [],
      goal: { type: 'internship', track: 'ml', deadline: '2027-06-01' }, max_courses_per_term: 2, start_term: '2027-winter', use_ai_explanation: false, ...changes,
    }) });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = PlanResponseSchema.parse(await response.json());
    assert.equal(result.mode, 'generated');
    assert.equal(result.quarters.flatMap(q => q.courses).length, 0);
    for (const d of result.academic_decisions!) for (const id of [...d.source_ids, ...d.sections.flatMap(s => s.source_ids)])
      assert.ok(result.sources.some(s => s.id === id && s.url));
    return result;
  }
  async function decision(id: string, changes: Record<string, unknown>) {
    return (await plan(changes)).academic_decisions!.find(d => d.term === '2027-winter' && d.course_id === id)!;
  }
  const checks = [
    async () => { for (const [id, prerequisites] of Object.entries({ 'CSE 311': ['CSE 123', 'MATH 126'], 'CSE 331': ['CSE 123'], 'INFO 340': ['CSE 123', 'INFO 201'], 'INFO 430': ['INFO 330'] }))
      assert.equal((await decision(id, { completed_courses: prerequisites })).catalog_prerequisite_status, 'needs_grade_confirmation'); },
    async () => { for (const [grade, expected] of [[1.9, 'unmet'], [2, 'met']]) assert.equal((await decision('CSE 331', { completed_courses: ['cse123'], reviewed_grades: { cse123: grade } })).catalog_prerequisite_status, expected); },
    async () => { for (const id of ['INFO 330', 'CSE 414', 'I S 445']) assert.equal((await decision('INFO 430', { completed_courses: ['INFO 330', 'CSE 414', 'I S 445'], reviewed_grades: { [id]: 2 } })).catalog_prerequisite_status, 'met'); },
    async () => { assert.equal((await decision('INFO 340', { completed_courses: ['INFO 201'], reviewed_grades: { 'INFO 201': 2 }, concurrent_courses: { '2027-winter': ['CSE 163'] } })).catalog_prerequisite_status, 'met'); },
    async () => { assert.equal((await decision('INFO 340', { completed_courses: ['INFO 201'], reviewed_grades: { 'INFO 201': 2 }, concurrent_courses: { '2027-winter': ['CSE 123'] } })).catalog_prerequisite_status, 'unmet'); },
    async () => { for (const grade of [undefined, 1.9]) assert.notEqual((await decision('INFO 340', { completed_courses: ['INFO 201'], ...(grade === undefined ? {} : { reviewed_grades: { 'INFO 201': grade } }), concurrent_courses: { '2027-winter': ['CSE 163'] } })).catalog_prerequisite_status, 'met'); },
    async () => { for (const major of ['CSE', 'ECE']) { const d = await decision('CSE 351', { major, completed_courses: ['CSE 123'] });
      for (const s of d.sections.filter(s => s.component === 'LEC')) assert.equal(s.major_status, (major === 'CSE' ? ['A', 'B'] : ['C', 'D']).includes(s.section) ? 'met' : 'unmet'); } },
    async () => { for (const concurrent of [[], ['CSE 351']]) { const d = await decision('CSE 391', { major: 'ECE', completed_courses: ['CSE 123'], concurrent_courses: { '2027-winter': concurrent } });
      assert.equal(d.sections.find(s => s.section === 'B')!.corequisite_status, concurrent.length ? 'met' : 'unmet');
      assert.equal(d.sections.find(s => s.section === 'A')!.corequisite_status, 'not_required'); } },
    async () => { const d = await decision('CSE 373', { completed_courses: ['CSE 123'] }); for (const name of ['AH', 'AI', 'AJ']) {
      const s = d.sections.find(s => s.section === name)!; assert.equal(s.excluded, true); assert.equal(s.registration_status, 'ineligible'); } },
    async () => { const d = await decision('AMATH 351', { completed_courses: ['MATH 125'] }); assert.equal(d.catalog_prerequisite_status, 'met'); assert.equal(d.section_registration_status, 'unknown'); assert.ok(d.sections.every(s => !s.reasons.some(r => r === 'Add code required'))); },
    async () => { const d = await decision('CSE 351', { completed_courses: ['CSE 123'] }); assert.equal(d.catalog_prerequisite_status, 'met'); assert.equal(d.section_registration_status, 'unknown'); assert.equal(d.term_offering_status, 'confirmed'); assert.equal(d.schedule_conflict_status, 'not_evaluated'); },
    async () => { const d = await decision('AMATH 301', { completed_courses: ['MATH 125'] }); assert.equal(d.section_registration_status, 'unknown'); assert.ok(d.sections.every(s => s.registration_status === 'unknown')); },
  ];
  for (const [i, check] of checks.entries()) { await check(); passed.push(handoff.acceptance_checks[i]); console.log(`PASS ${i + 1}: ${handoff.acceptance_checks[i]}`); }
  for (const reviewed_grades of [{ 'CSE 123': 5 }, { 'CSE 123': 2, cse123: 3 }, { 'CSE 123': '2' }]) {
    const response = await fetch(`${origin}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ major: 'CSE', completed_courses: ['CSE 123'], in_progress_courses: [], goal: { type: 'research', track: 'ml', deadline: null }, max_courses_per_term: 2, reviewed_grades }) });
    assert.equal(response.status, 400);
  }
  console.log(JSON.stringify({ acceptance_passed: passed.length, acceptance_failed: 0, invalid_grade_requests_rejected: 3, all_decision_sources_preserved: true }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
