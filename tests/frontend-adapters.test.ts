import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toBackendRequest, toUiPlan, createPlan, isMockMode } from '../lib/plan-api';
import { parseTranscript } from '../lib/transcript-api';
import { PlanResponseSchema, SUPPORTED_GOALS } from '../types/plan';
import type { PlanRequest } from '../types/ui-plan';
import { validGoalTracks, formatGoalDeadline } from '../types/goal';
const input: PlanRequest = { majors: ['Computer Science', 'Applied Mathematics'], completed_courses: ['CSE123', 'MATH126'], in_progress_courses: [],
  target_role: 'ML Intern', target_summer: 2027, max_courses_per_term: 2, start_term: 'winter', start_year: 2027, horizon_terms: 3,
  goal_draft: { type: 'research', track: 'ml', deadline: null, notes: 'Interested in reproducible models', career_hours_per_week: 6, intensity: 'balanced' } };
test('UI structured goal, flexible deadline and course history survive the v2 request adapter', () => {
  const request = toBackendRequest(input);
  assert.equal(request.goal.type, 'research'); assert.equal(request.goal.track, 'ml'); assert.equal(request.goal.deadline, null);
  assert.equal(request.goal.notes, input.goal_draft!.notes);
  assert.deepEqual(request.completed_courses, ['CSE 123', 'MATH 126']);
  assert.equal(request.major, 'Computer Science + Applied Mathematics'); assert.equal(request.start_term, '2027-winter');
  assert.equal(request.use_ai_explanation, false);
});
test('quarter deadline uses the documented boundary and unsupported frontend tracks fail safely', () => {
  assert.equal(toBackendRequest({ ...input, goal_draft: { ...input.goal_draft!, deadline: { term: 'summer', year: 2027 } } }).goal.deadline, '2027-06-01');
  assert.throws(() => toBackendRequest({ ...input, goal_draft: { ...input.goal_draft!, track: 'robotics' } }));
  assert.deepEqual(validGoalTracks.internship, [...SUPPORTED_GOALS.internship]);
  assert.equal(formatGoalDeadline(input.goal_draft, 2027), 'Flexible deadline');
});
test('the UI adapter preserves review-only notes and warnings without manufacturing course cards', async () => {
  const plan = PlanResponseSchema.parse(JSON.parse(await readFile('docs/reports/backend-projected-plan.json', 'utf8')));
  const ui = toUiPlan(plan, input);
  assert.equal(ui.quarters.length, 3); assert.equal(ui.quarters.flatMap(q => q.courses).length, 0);
  assert.ok(ui.quarters.every(q => q.notes.includes('REVIEW ONLY')));
  assert.deepEqual(ui.warnings, plan.warnings);
  assert.ok(ui.career_milestones.every(m => ui.quarters.some(q => q.id === m.quarter_id)));
  assert.ok(ui.career_milestones.every(m => m.description.includes('Recommended timeframe')));
});
test('the browser client defaults to the real endpoint and validates the response', async () => {
  assert.equal(isMockMode(), false);
  const plan = JSON.parse(await readFile('docs/reports/backend-projected-plan.json', 'utf8'));
  plan.request = toBackendRequest(input);
  const previous = globalThis.fetch;
  let posted: unknown;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/plan'); posted = JSON.parse(String(options?.body));
    return Response.json(plan);
  };
  try { const result = await createPlan(input); assert.equal(result.mode, 'generated'); assert.equal((posted as { goal: { type: string } }).goal.type, 'research'); }
  finally { globalThis.fetch = previous; }
});
test('the browser client never silently substitutes a mock after a network error', async () => {
  const previous = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline'); };
  try { await assert.rejects(createPlan(input), /no mock plan was substituted/); }
  finally { globalThis.fetch = previous; }
});
test('transcript client uses the real file field/path and preserves uncertain attempts for review', async () => {
  const response = JSON.parse(await readFile('examples/transcript-response.json', 'utf8'));
  response.records[0].needs_review = true; response.records[0].review_reasons = ['Repeated attempt needs review'];
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/transcript'); assert.ok(options?.body instanceof FormData);
    assert.ok(options.body.get('file') instanceof File); assert.equal(options.body.has('transcript'), false);
    return Response.json(response);
  };
  try {
    const result = await parseTranscript(new File(['%PDF- test'], 'synthetic.pdf', { type: 'application/pdf' }));
    assert.equal(result.detected_courses[0].status, 'uncertain');
    assert.equal(result.detected_courses[0].confidence, null);
    assert.deepEqual(result.detected_courses[0].review_reasons, ['Repeated attempt needs review']);
  } finally { globalThis.fetch = previous; }
});
test('unsupported images and oversized PDFs are rejected before any upload', async () => {
  await assert.rejects(parseTranscript(new File(['image'], 'scan.png', { type: 'image/png' })), /text-based PDF/);
  await assert.rejects(parseTranscript(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' })), /5 MiB/);
});
test('real client rejects a response for a different profile rather than relabeling it', async () => {
  const previous = globalThis.fetch;
  const plan = JSON.parse(await readFile('docs/reports/backend-projected-plan.json', 'utf8'));
  globalThis.fetch = async () => Response.json(plan);
  try { await assert.rejects(createPlan(input), /does not match/); }
  finally { globalThis.fetch = previous; }
});
test('AI explanation is an explicit opt-in and the plan summary reaches the UI', async () => {
  assert.equal(toBackendRequest(input, { aiExplanation: true }).use_ai_explanation, true);
  const plan = PlanResponseSchema.parse(JSON.parse(await readFile('docs/reports/backend-projected-plan.json', 'utf8')));
  assert.equal(toUiPlan({ ...plan, plan_summary: 'Grounded summary.' }, input).summary, 'Grounded summary.');
});
test('the ask client validates input and responses', async () => {
  const { askQuestion, AskApiError } = await import('../lib/ask-api');
  await assert.rejects(askQuestion({ question: 'hi' }), AskApiError);
  const previous = globalThis.fetch;
  let posted: unknown;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/ask'); posted = JSON.parse(String(options?.body));
    return Response.json({ schema_version: '1.0.0', mode: 'deterministic', retrieval: 'keyword', answer: 'From X: y', insufficient_evidence: false,
      citations: ['course:CSE 311'], sources: [{ id: 'course:CSE 311', kind: 'course', document_title: 'X', content: 'y', source_url: null, section: null,
        verified_at: null, effective_date: null, official: true, score: 1 }], warnings: [], disclaimer: 'd' });
  };
  try {
    const result = await askQuestion({ question: 'CSE 311 prerequisites?', plan_course_ids: ['cse311'] });
    assert.equal(result.citations[0], 'course:CSE 311');
    assert.deepEqual(posted, { question: 'CSE 311 prerequisites?', official_only: false, plan_course_ids: ['CSE 311'], use_ai: false });
    globalThis.fetch = async () => Response.json({ answer: 'missing fields' });
    await assert.rejects(askQuestion({ question: 'CSE 311 prerequisites?' }), AskApiError);
  } finally { globalThis.fetch = previous; }
});
