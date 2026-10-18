import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanRequestSchema } from '../types/plan';
import { AskResponseSchema } from '../types/ask';
import { generatePlan } from '../lib/plan-service';
import { blockingReason, planChunks } from '../lib/plan-context';
import { answerQuestion } from '../lib/ask-service';
import { POST } from '../app/api/ask/route';
import type { AcademicDecision } from '../types/registration';

const now = new Date('2026-10-17T18:00:00Z');
// Distinctive grades so a leak would be easy to spot in any text.
const plan = PlanRequestSchema.parse({ major: 'Computer Science', completed_courses: ['CSE 121', 'CSE 122', 'CSE 123', 'MATH 124', 'MATH 125', 'MATH 126'],
  in_progress_courses: [], reviewed_grades: { 'CSE 123': 3.7, 'MATH 126': 3.3 }, goal: { type: 'internship', track: 'swe', deadline: '2027-06-01' },
  start_term: '2027-winter', max_courses_per_term: 3 });
const ask = (question: string, extra: object = {}) => answerQuestion({ question, plan, ...extra }, { now });

test('plan sources describe inputs, quarters and every evaluated course, without grade values', async () => {
  const generated = await generatePlan(plan, { now });
  const chunks = planChunks(generated);
  const ids = chunks.map(c => c.id);
  assert.ok(ids.includes('plan:overview') && ids.includes('plan:quarter:2027-winter') && ids.includes('plan:course:CSE 332'));
  assert.ok(chunks.every(c => c.kind === 'plan' && !c.official && c.source_url === null));
  for (const c of chunks) assert.ok(!/3\.7|3\.3/.test(c.content), `${c.id} leaks a grade`);
  assert.match(chunks.find(c => c.id === 'plan:course:CSE 332')!.content, /2027-winter: not scheduled because prerequisites are not met yet/);
  assert.match(chunks.find(c => c.id === 'plan:quarter:2027-winter')!.content, /the next quarter/);
});

test('blocking reasons follow the planner order', () => {
  const d: AcademicDecision = { course_id: 'CSE 100', term: '2027-winter', catalog_prerequisite_status: 'met', prerequisite_conditional: false, prerequisite_reasons: [],
    section_registration_status: 'eligible', term_offering_status: 'confirmed', schedule_conflict_status: 'not_evaluated', schedule_conflict_reason: '', sections: [], source_ids: [] };
  assert.equal(blockingReason(d), null);
  assert.match(blockingReason({ ...d, catalog_prerequisite_status: 'unmet', term_offering_status: 'unknown' })!, /prerequisites/);
  assert.match(blockingReason({ ...d, term_offering_status: 'unknown', section_registration_status: 'ineligible' })!, /offering evidence/);
  assert.equal(blockingReason({ ...d, section_registration_status: 'unknown' }), null);
  assert.equal(blockingReason({ ...d, section_registration_status: 'ineligible' }), null);
  assert.match(blockingReason({ ...d, catalog_prerequisite_status: 'needs_grade_confirmation' })!, /grade must be confirmed/);
});

test('questions about the plan cite the plan; general questions still cite official records', async () => {
  const cases: [string, string][] = [
    ["Why can't I take CSE 421 next quarter?", 'plan:course:CSE 421'],
    ['What should I take next quarter?', 'plan:quarter:2027-winter'],
    ['Is CSE 351 in my plan?', 'plan:course:CSE 351'],
    ['What are the prerequisites for CSE 311?', 'course:CSE 311'],
    ['When does Winter 2027 registration open?', 'registration_policy:registration_periods'],
  ];
  for (const [question, expected] of cases) {
    const result = AskResponseSchema.parse(await ask(question));
    assert.equal(result.sources[0].id, expected, `${question} → ${result.sources.map(s => s.id).join(', ')}`);
    assert.deepEqual(result.citations, [expected]);
  }
  const general = await ask('When does Winter 2027 registration open?');
  assert.ok(!general.sources.some(s => s.kind === 'plan'));
  const withoutPlan = await answerQuestion({ question: 'What should I take next quarter?' }, { now });
  assert.ok(!withoutPlan.sources.some(s => s.kind === 'plan'));
});

test('AI answers receive plan sources but never grades', async () => {
  const previousFetch = globalThis.fetch; const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
  const bodies: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = String(init?.body); bodies.push(body);
    if (!String(url).endsWith('/chat/completions')) throw new Error('offline embedding');
    return Response.json({ id: 'chatcmpl_test', object: 'chat.completion', created: 0, model: 'test', choices: [{ index: 0, finish_reason: 'stop', logprobs: null,
      message: { role: 'assistant', refusal: null, content: JSON.stringify({ answer: 'You have not met the prerequisites for CSE 421 yet.', citations: ['S1'], insufficient_evidence: false }) } }] });
  }) as typeof fetch;
  try {
    const result = await ask("Why can't I take CSE 421 next quarter?", { use_ai: true });
    assert.equal(result.mode, 'ai');
    assert.deepEqual(result.citations, ['plan:course:CSE 421']);
    const prompt = bodies.find(b => b.includes('grounded_answer'))!;
    assert.ok(prompt.includes('\\"kind\\":\\"plan\\"'));
    assert.ok(!/3\.7|3\.3|reviewed_grades/.test(prompt));
  } finally { globalThis.fetch = previousFetch; if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey; }
});

test('the ask endpoint validates the plan inputs', async () => {
  const request = (body: unknown) => new Request('http://localhost/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await POST(request({ question: 'What should I take next quarter?', plan: { ...plan, goal: { type: 'internship', track: 'robotics', deadline: null } } }))).status, 400);
  assert.equal((await POST(request({ question: 'What should I take next quarter?', plan: { ...plan, reviewed_grades: { 'CSE 999': 4 } } }))).status, 400);
  assert.equal((await POST(request({ question: 'What should I take next quarter?', plan }))).status, 200);
});
