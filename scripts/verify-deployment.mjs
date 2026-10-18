import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
const origin = process.env.DEGREEGPS_SMOKE_ORIGIN ?? 'http://127.0.0.1:3117';
const passed = [];
async function check(name, fn) { await fn(); passed.push(name); console.log('PASS', name); }
async function post(path, body) {
  const r = await fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store'); return r.json();
}
const request = { major: 'Computer Science + Applied Mathematics', completed_courses: ['CSE 123', 'MATH 126'],
  reviewed_grades: { 'CSE 123': 3.8, 'MATH 126': 3.4 }, in_progress_courses: [],
  goal: { type: 'internship', track: 'ml', deadline: '2027-06-01' }, max_courses_per_term: 2,
  start_term: '2027-winter', graduation_term: '2029-spring', use_ai_explanation: true };
let plan;
await check('Public homepage serves DegreeGPS HTML', async () => {
  const r = await fetch(origin); assert.equal(r.status, 200); assert.match(await r.text(), /DegreeGPS/);
});
await check('Real Planner returns 8 quarters, sources and career preparation', async () => {
  plan = await post('/api/plan', request); assert.equal(plan.mode, 'generated'); assert.equal(plan.quarters.length, 8);
  assert.ok(plan.quarters.every(q => q.courses.length <= 2)); assert.ok(plan.sources.length > 0); assert.ok(plan.career_milestones.length);
  assert.ok(plan.warnings.some(w => w.message.includes('AI_DISABLED')));
});
await check('Real cited RAG answers plan questions without an external provider', async () => {
  const a = await post('/api/ask', { question: 'What should I take next quarter?', plan: request, use_ai: true });
  assert.equal(a.mode, 'deterministic'); assert.equal(a.retrieval, 'keyword'); assert.ok(a.answer); assert.ok(a.citations.length);
  assert.ok(a.citations.every(id => a.sources.some(s => s.id === id))); assert.ok(a.sources.some(s => s.kind === 'plan'));
  assert.ok(a.warnings.some(w => w.includes('AI_DISABLED')));
});
await check('Goal interpretation stays functional and local with AI opt-in', async () => {
  const g = await post('/api/goal', { text: 'ML internship before 2027-06-01', use_ai: true }); assert.equal(g.mode, 'deterministic'); assert.equal(g.goal.track, 'ml');
});
await check('Real PDF upload extracts course history and requires confirmation', async () => {
  const d = await PDFDocument.create(); const p = d.addPage(); const font = await d.embedFont(StandardFonts.Helvetica);
  ['AUTUMN 2026', 'CSE 123 PROGRAMMING 5.0 3.8'].forEach((line, i) => p.drawText(line, { x: 40, y: 700 - 25 * i, size: 12, font }));
  const form = new FormData(); form.set('file', new File([await d.save()], 'synthetic.pdf', { type: 'application/pdf' }));
  const r = await fetch(`${origin}/api/transcript`, { method: 'POST', body: form }); assert.equal(r.status, 200);
  const t = await r.json(); assert.ok(t.records.some(c => c.course_id === 'CSE 123')); assert.equal(t.user_confirmation_required, true);
});
await check('Invalid JSON and invalid transcript input retain structured errors', async () => {
  const r = await fetch(`${origin}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(r.status, 400); assert.ok((await r.json()).error.code);
  const t = await fetch(`${origin}/api/transcript`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'not a PDF' });
  assert.equal(t.status, 415);
});
await check('Plan can regenerate with a changed goal and course load', async () => {
  const changed = await post('/api/plan', { ...request, goal: { ...request.goal, type: 'research' }, max_courses_per_term: 3 });
  assert.equal(changed.request.goal.type, 'research'); assert.ok(changed.quarters.every(q => q.courses.length <= 3));
  assert.notDeepEqual(changed.career_milestones.map(m => m.action), plan.career_milestones.map(m => m.action));
});
await check('Server data and environment files are not public static downloads', async () => {
  for (const path of ['/.env.local', '/data/target_courses/courses.json', '/data/index/embeddings.json']) {
    const response = await fetch(`${origin}${path}`); assert.equal(response.status, 404, path);
  }
});
await check('Hosted PDF size limit rejects oversized files with a structured 413', async () => {
  const bytes = new Uint8Array(4 * 1024 * 1024 + 1); bytes.set(new TextEncoder().encode('%PDF-1.7'));
  const form = new FormData(); form.set('file', new File([bytes], 'synthetic-oversize.pdf', { type: 'application/pdf' }));
  const response = await fetch(`${origin}/api/transcript`, { method: 'POST', body: form });
  assert.equal(response.status, 413); assert.equal((await response.json()).error.code, 'FILE_TOO_LARGE');
});
console.log(JSON.stringify({ origin, passed: passed.length, failed: 0, real_api: true, paid_ai_requests: 0 }));
