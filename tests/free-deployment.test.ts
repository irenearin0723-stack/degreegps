import test from 'node:test';
import assert from 'node:assert/strict';
import { isFreeDemo, externalAiEnabled } from '../lib/ai-config';
import { openaiClient, interpretGoal, explainPlan } from '../lib/ai';
import { answerQuestion } from '../lib/ask-service';
import { generatePlan } from '../lib/plan-service';
import { PlanRequestSchema } from '../types/plan';

test('free demo blocks all provider calls even with a configured key and explicit AI opt-in', async () => {
  const names = ['DEGREEGPS_FREE_DEMO', 'NEXT_PUBLIC_FREE_DEMO', 'OPENAI_API_KEY'] as const;
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    process.env.DEGREEGPS_FREE_DEMO = 'true';
    process.env.OPENAI_API_KEY = 'synthetic-test-key';
    globalThis.fetch = async () => { calls++; throw new Error('Unexpected provider call'); };
    assert.equal(isFreeDemo(), true); assert.equal(externalAiEnabled(), false);
    assert.throws(() => openaiClient(), /AI_DISABLED/);
    const goal = await interpretGoal('ML internship before 2027-06-01', true);
    assert.equal(goal.mode, 'deterministic');
    const request = PlanRequestSchema.parse({ major: 'Computer Science', completed_courses: ['CSE 123'], in_progress_courses: [],
      goal: { type: 'internship', track: 'ml', deadline: '2027-06-01' }, max_courses_per_term: 2, start_term: '2027-winter' });
    const plan = await generatePlan(request, { now: new Date('2026-10-18T12:00:00Z') });
    const explanation = await explainPlan(plan);
    assert.match(explanation.warning!, /AI_DISABLED/);
    const answer = await answerQuestion({ question: 'What are the prerequisites for CSE 311?', use_ai: true });
    assert.equal(answer.mode, 'deterministic'); assert.equal(answer.retrieval, 'keyword');
    assert.ok(answer.citations.length > 0); assert.ok(answer.answer?.includes('CSE 311'));
    assert.ok(answer.warnings.some(w => w.includes('AI_DISABLED')));
    assert.equal(calls, 0);
    // A compiled public free-demo flag independently protects the runtime too.
    delete process.env.DEGREEGPS_FREE_DEMO;
    process.env.NEXT_PUBLIC_FREE_DEMO = 'true';
    assert.equal(externalAiEnabled(), false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
  }
});
