import test from 'node:test';
import assert from 'node:assert/strict';
import { AskResponseSchema } from '../types/ask';
import { consumeAiBudget, gateAi, resetAiBudget } from '../lib/rate-limit';
import { POST as askPost } from '../app/api/ask/route';
import { POST as goalPost } from '../app/api/goal/route';

const from = (ip: string) => new Request('http://localhost/api/ask', { headers: { 'X-Forwarded-For': `${ip}, 10.0.0.1` } });
async function withEnv<T>(values: Record<string, string | undefined>, run: () => Promise<T> | T): Promise<T> {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  resetAiBudget();
  try { return await run(); }
  finally { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; resetAiBudget(); }
}

test('per-minute, per-day and global windows each cap AI calls', () => withEnv({ AI_RATE_PER_MINUTE: '2', AI_RATE_PER_DAY: '3', AI_RATE_GLOBAL_PER_DAY: '4' }, () => {
  const t = Date.parse('2026-10-17T12:00:00Z');
  assert.ok(consumeAiBudget(from('1.1.1.1'), t).allowed);
  assert.ok(consumeAiBudget(from('1.1.1.1'), t + 1).allowed);
  const minute = consumeAiBudget(from('1.1.1.1'), t + 2);
  assert.ok(!minute.allowed && minute.warning.includes('per minute'));
  assert.ok(consumeAiBudget(from('1.1.1.1'), t + 61_000).allowed);
  const day = consumeAiBudget(from('1.1.1.1'), t + 122_000);
  assert.ok(!day.allowed && day.warning.includes('today'));
  assert.ok(consumeAiBudget(from('2.2.2.2'), t + 122_000).allowed);
  const global = consumeAiBudget(from('3.3.3.3'), t + 122_000);
  assert.ok(!global.allowed && global.warning.includes('daily AI budget'));
  assert.ok(consumeAiBudget(from('3.3.3.3'), t + 24 * 3600_000 + 122_000).allowed);
}));

test('requests without AI, or without a key, consume no budget', () => withEnv({ AI_RATE_PER_MINUTE: '0', OPENAI_API_KEY: undefined }, () => {
  assert.ok(gateAi(from('4.4.4.4'), false).allowed);
  assert.ok(gateAi(from('4.4.4.4'), true).allowed);
}));

test('a rate-limited ask returns the local answer without calling the provider', () => withEnv({ AI_RATE_PER_MINUTE: '0', OPENAI_API_KEY: 'test-only-not-a-real-key' }, async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('provider must not be called'); };
  try {
    const request = (path: string, body: unknown) => new Request(`http://localhost${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const ask = AskResponseSchema.parse(await (await askPost(request('/api/ask', { question: 'What are the prerequisites for CSE 311?', use_ai: true }))).json());
    assert.equal(ask.mode, 'deterministic');
    assert.ok(ask.warnings[0].startsWith('AI_RATE_LIMITED'));
    const goal = await (await goalPost(request('/api/goal', { text: 'ML internship before 2027-06-01', use_ai: true }))).json();
    assert.equal(goal.mode, 'deterministic');
    assert.ok(goal.warnings[0].startsWith('AI_RATE_LIMITED'));
  } finally { globalThis.fetch = previousFetch; }
}));
