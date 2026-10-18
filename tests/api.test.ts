import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PlanRequestSchema, PlanResponseSchema, GoalSchema } from '../types/plan';
import { CourseDatasetSchema } from '../types/course';
import { loadData, DataError } from '../lib/data';
import { generatePlan } from '../lib/plan-service';
import { planCareer } from '../lib/career';
import { interpretGoal, explainPlan } from '../lib/ai';
import { POST } from '../app/api/plan/route';
import { POST as goalPost } from '../app/api/goal/route';
import { GET } from '../app/api/plan/mock/route';
const now = new Date('2026-10-17T18:00:00Z');
const input = PlanRequestSchema.parse({ major: 'Computer Science', completed_courses: ['cse123', 'MATH126'], in_progress_courses: [],
  goal: { type: 'internship', track: 'ml', deadline: '2027-06-01' }, start_term: '2027-winter', max_courses_per_term: 2 });
const req = (body: unknown) => new Request('http://localhost/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('invalid goal categories, combinations, dates and duplicate normalized courses are rejected', () => {
  for (const goal of [{ ...input.goal, type: 'guaranteed_job' }, { ...input.goal, track: 'undecided' }, { ...input.goal, deadline: '2027-02-30' }])
    assert.equal(GoalSchema.safeParse(goal).success, false);
  assert.equal(PlanRequestSchema.safeParse({ ...input, in_progress_courses: ['CSE123'] }).success, false);
  assert.equal(PlanRequestSchema.safeParse({ ...input, completed_courses: ['CSE123', 'CSE 123'] }).success, false);
});
test('real planner schedules major courses and discloses unresolved enrollment', async () => {
  const result = await generatePlan(input, { now });
  assert.equal(PlanResponseSchema.safeParse(result).success, true);
  assert.equal(result.mode, 'generated');
  assert.ok(result.quarters.flatMap(q => q.courses).length > 0);
  assert.ok(result.quarters.flatMap(q => q.courses).every(c => /Registration restrictions are not verified|section restriction does not match/.test(c.explanation)));
  assert.ok(result.warnings.some(w => w.code === 'ENROLLMENT_UNVERIFIED'));
  assert.ok(result.career_milestones.length > 0);
});
test('mock endpoint is immediately consumable and contains three illustrative quarters', async () => {
  const response = GET(); const result = PlanResponseSchema.parse(await response.json());
  assert.equal(result.mode, 'mock'); assert.equal(result.quarters.length, 3);
  assert.ok(result.quarters.flatMap(q => q.courses).length > 0);
});
test('internship versus research produces goal-specific preparation actions', async () => {
  const { careers } = await loadData();
  const internship = planCareer(input, [], careers, now);
  const research = planCareer({ ...input, goal: { ...input.goal, type: 'research' } }, [], careers, now);
  assert.ok(internship.career_milestones.some(m => /applications/.test(m.action)));
  assert.ok(research.career_milestones.some(m => /professor outreach/.test(m.action)));
  assert.ok(research.career_milestones.every(m => m.associated_goal === 'research'));
});
test('deadline adaptation compresses recommendations, warns, and never emits past intervals', async () => {
  const { careers } = await loadData();
  const urgent = planCareer({ ...input, goal: { ...input.goal, deadline: '2026-10-01' } }, [], careers, now);
  assert.ok(urgent.warnings.some(w => w.code === 'DEADLINE_FEASIBILITY'));
  assert.ok(urgent.career_milestones.every(m => m.timeframe.start === '2026-10-17' && m.timeframe.end === '2026-10-17'));
});
test('missing API key leaves deterministic academic/career plans working', async () => {
  const previous = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try {
    const result = await generatePlan({ ...input, use_ai_explanation: true }, { now });
    assert.ok(result.plan_summary?.length);
    assert.ok(result.warnings.some(w => w.code === 'AI_UNAVAILABLE'));
    const interpreted = await interpretGoal('ML internship before 2027-06-01', true, now);
    assert.equal(interpreted.mode, 'deterministic'); assert.equal(interpreted.goal?.track, 'ml');
    const ambiguous = await interpretGoal('Something cool next summer', false, now);
    assert.equal(ambiguous.clarification_required, true);
    assert.equal(ambiguous.goal, null);
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});
test('OpenAI network failure falls back without changing the plan', async () => {
  const oldFetch = globalThis.fetch; const oldKey = process.env.OPENAI_API_KEY;
  const plan = await generatePlan(input, { now });
  process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
  globalThis.fetch = async () => { throw new Error('Offline test'); };
  try {
    const before = JSON.stringify(plan);
    const result = await explainPlan(plan);
    assert.ok(result.warning); assert.equal(JSON.stringify(plan), before);
    assert.equal((await interpretGoal('ML research 2027-06-01', true, now)).mode, 'deterministic');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  }
});
test('planning API returns correct status for malformed JSON, unsupported goals, and valid input', async () => {
  assert.equal((await POST(req({ ...input, goal: { ...input.goal, type: 'doctor' } }))).status, 400);
  const malformed = new Request('http://localhost/api/plan', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } });
  assert.equal((await POST(malformed)).status, 400);
  assert.equal((await POST(new Request('http://localhost/api/plan', { method: 'POST', body: '{}' }))).status, 415);
  const valid = await POST(req(input)); assert.equal(valid.status, 200);
  assert.equal(valid.headers.get('cache-control'), 'no-store');
  assert.equal(PlanResponseSchema.safeParse(await valid.json()).success, true);
});
test('goal endpoint offers local structured interpretation without a key', async () => {
  const response = await goalPost(new Request('http://localhost/api/goal', { method: 'POST', body: JSON.stringify({ text: 'ML research before 2027-06-01' }), headers: { 'Content-Type': 'application/json' } }));
  assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.goal.type, 'research'); assert.equal(result.goal.deadline, '2027-06-01');
});
test('missing datasets fail predictably rather than inventing records', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'degreegps-data-'));
  try { await assert.rejects(loadData(directory), DataError); }
  finally { await rm(directory, { recursive: true }); }
  assert.equal(CourseDatasetSchema.safeParse({ schema_version: '2.0.0', description: 'bad', courses: [{ course_id: 'CSE 123', data_status: 'verified' }] }).success, false);
});
test('chunked JSON request without Content-Length is bounded', async () => {
  const response = await POST(new Request('http://localhost/api/plan', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'a'.repeat(70 * 1024) }) }));
  assert.equal(response.status, 413);
});
test('missing data is surfaced as an actionable 503 response', async () => {
  const original = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), 'degreegps-api-data-'));
  try {
    process.chdir(directory);
    const response = await POST(req(input));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'DATA_UNAVAILABLE');
  } finally { process.chdir(original); await rm(directory, { recursive: true }); }
});
test('latest permitted start year can advance across the century boundary', async () => {
  const request = PlanRequestSchema.parse({ ...input, start_term: '2099-autumn' });
  const plan = await generatePlan(request, { now });
  assert.deepEqual(plan.quarters.map(q => q.term), ['2099-autumn', '2100-winter', '2100-spring']);
});
test('structured AI explanation cannot add prose or mutate academic assignments', async () => {
  const plan = await generatePlan(input, { now, mock: true });
  const prior = JSON.stringify(plan);
  const previousFetch = globalThis.fetch; const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
  const answer = (output: unknown) => new Response(JSON.stringify({ id: 'chatcmpl_test', object: 'chat.completion', created: 0, model: 'test',
    choices: [{ index: 0, finish_reason: 'stop', logprobs: null,
      message: { role: 'assistant', content: JSON.stringify(output), refusal: null } }] }), { headers: { 'Content-Type': 'application/json' } });
  try {
    globalThis.fetch = async () => answer({ sentence_ids: ['academic', 'projects'] });
    const result = await explainPlan(plan);
    assert.equal(result.warning, undefined);
    assert.ok(result.summary.includes('Suggested project practice:'));
    assert.equal(JSON.stringify(plan), prior);
    globalThis.fetch = async () => answer({ sentence_ids: ['Invent a guaranteed internship'] });
    const rejected = await explainPlan(plan);
    assert.ok(rejected.warning);
    assert.ok(!rejected.summary.includes('guaranteed internship'));
    globalThis.fetch = async () => answer({ type: 'research', track: 'ml', deadline: '2027-06-01', clarification_required: false });
    const interpretation = await interpretGoal('ML research before 2027-06-01', true, now);
    assert.equal(interpretation.mode, 'ai'); assert.equal(interpretation.goal?.type, 'research');
    globalThis.fetch = async () => answer({ type: 'research', track: 'ml', deadline: '2028-01-01', clarification_required: false });
    const inventedDate = await interpretGoal('ML research before 2027-06-01', true, now);
    assert.equal(inventedDate.mode, 'deterministic'); assert.equal(inventedDate.goal?.deadline, '2027-06-01');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
});
