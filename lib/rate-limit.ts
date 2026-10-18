import 'server-only';
import { externalAiEnabled } from './ai-config';

/**
 * Budget guard for optional AI calls (/api/ask, /api/goal, /api/plan explanations).
 * Counters live in this server process: correct for one `next start` instance, approximate
 * across several instances or serverless cold starts (use a shared store there).
 * The per-client key trusts X-Forwarded-For, which only a fronting proxy makes reliable;
 * the global daily cap is the hard budget limit.
 */
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
interface Window { start: number; count: number }
const windows = new Map<string, Window>();

function limit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isInteger(value) && value >= 0 ? value : fallback;
}
// Defaults: an /api/ask AI answer costs roughly $0.001 on gemini-3.5-flash-lite,
// so the global cap bounds worst-case spend near $0.30/day.
export function aiLimits() {
  return { perMinute: limit('AI_RATE_PER_MINUTE', 5), perDay: limit('AI_RATE_PER_DAY', 30), globalPerDay: limit('AI_RATE_GLOBAL_PER_DAY', 300) };
}
export function clientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip')?.trim() || 'local';
}
function current(key: string, length: number, now: number): Window {
  const window = windows.get(key);
  if (window && now - window.start < length) return window;
  const fresh = { start: now, count: 0 };
  windows.set(key, fresh);
  return fresh;
}
function prune(now: number) {
  if (windows.size < 10_000) return;
  for (const [key, window] of windows) if (now - window.start >= (key.startsWith('minute:') ? MINUTE : DAY)) windows.delete(key);
}

export type AiGate = { allowed: true } | { allowed: false; warning: string };
/** Consumes one AI call for this client when every window has room; otherwise reports which limit applies. */
export function consumeAiBudget(request: Request, now = Date.now()): AiGate {
  prune(now);
  const { perMinute, perDay, globalPerDay } = aiLimits();
  const client = clientKey(request);
  const checks = [
    { window: current('global', DAY, now), max: globalPerDay, message: 'the daily AI budget for this deployment is used up; try again tomorrow' },
    { window: current(`day:${client}`, DAY, now), max: perDay, message: `this client reached ${perDay} AI requests today` },
    { window: current(`minute:${client}`, MINUTE, now), max: perMinute, message: `this client reached ${perMinute} AI requests per minute; wait a moment` },
  ];
  const blocked = checks.find(c => c.window.count >= c.max);
  if (blocked) return { allowed: false, warning: `AI_RATE_LIMITED: ${blocked.message}. A local answer was returned instead.` };
  for (const c of checks) c.window.count++;
  return { allowed: true };
}
/** Gates a request that asked for AI. Requests that did not ask, or run without a key, consume nothing. */
export function gateAi(request: Request, requested: boolean): AiGate {
  return requested && externalAiEnabled() ? consumeAiBudget(request) : { allowed: true };
}
export function resetAiBudget() { windows.clear(); }
