import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { importCourse } from '../lib/course-import';
import { scenarios, verifyScenario } from './backend-scenarios';
import { PlanResponseSchema } from '../types/plan';
import { TranscriptResponseSchema } from '../types/transcript';
async function main() {
  const origin = 'http://127.0.0.1:3101';
  const missingOrigin = 'http://127.0.0.1:3102';
  const passed: string[] = [];
  const failed: { name: string; error: string }[] = [];
  async function check(name: string, task: () => Promise<void>) {
    try { await task(); passed.push(name); console.log(`PASS ${name}`); }
    catch (error) { failed.push({ name, error: String(error) }); console.error(`FAIL ${name}: ${String(error)}`); }
  }
  async function post(path: string, body: unknown, base = origin) {
    return fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  async function expectedError(response: Response, status: number, code?: string) {
    assert.equal(response.status, status);
    const result = await response.json(); assert.equal(typeof result.error.message, 'string');
    if (code) assert.equal(result.error.code, code);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  async function pdf(blank = false) {
    const doc = await PDFDocument.create(); const page = doc.addPage();
    if (!blank) {
      const font = await doc.embedFont(StandardFonts.Helvetica);
      ['FICTIONAL VALIDATION ONLY', 'AUTUMN 2026', 'CSE 123 PROGRAMMING 5.0 3.8', 'CSE 311 FOUNDATIONS 4.0 IP', 'AMATH 301 AMBIGUOUS'].forEach((line, i) => page.drawText(line, { x: 30, y: 700 - 25 * i, size: 12, font }));
    }
    return new Uint8Array(await doc.save());
  }
  async function upload(bytes: Uint8Array<ArrayBuffer>, filename = 'fictional.pdf', mime = 'application/pdf') {
    const form = new FormData(); form.set('file', new File([bytes], filename, { type: mime }));
    return fetch(`${origin}/api/transcript`, { method: 'POST', body: form });
  }
  const rows = JSON.parse(await readFile('data/target_courses/courses.json', 'utf8'));
  const rules = JSON.parse(await readFile('data/target_courses/prerequisites.json', 'utf8'));
  const courses = rows.map((row: { course_id: string }) => importCourse(row, rules[row.course_id]));
  const scenarioResults: unknown[] = [];
  const livePlans: Record<string, unknown> = {};
  for (const scenario of scenarios) await check(`Scenario ${scenario.id}: ${scenario.title}`, async () => {
    const response = await post('/api/plan', scenario.request);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json(); livePlans[scenario.id] = body;
    scenarioResults.push(verifyScenario(scenario, body, courses, new Date()));
    if (scenario.id === 'B') await writeFile('docs/reports/backend-validation-plan.json', JSON.stringify(body, null, 2) + '\n');
  });
  await check('Primary goal change changes roadmap over HTTP', async () => {
    const a = PlanResponseSchema.parse(livePlans.B); const b = PlanResponseSchema.parse(livePlans.I);
    assert.notDeepEqual(a.career_milestones.map(m => m.action), b.career_milestones.map(m => m.action));
  });
  await check('GET /api/plan/mock returns independent explicit demo fixture', async () => {
    const response = await fetch(`${origin}/api/plan/mock`); assert.equal(response.status, 200);
    const mock = PlanResponseSchema.parse(await response.json()); assert.equal(mock.mode, 'mock');
    assert.ok(mock.quarters.flatMap(q => q.courses).length > 0);
    assert.notEqual(mock.plan_id, PlanResponseSchema.parse(livePlans.A).plan_id);
  });
  await check('POST /api/plan rejects unsupported goal', async () => expectedError(await post('/api/plan', { ...scenarios[0].request, goal: { type: 'guaranteed_job', track: 'ml', deadline: null } }), 400, 'INVALID_REQUEST'));
  await check('POST /api/plan rejects normalized conflicting course history', async () => expectedError(await post('/api/plan', { ...scenarios[0].request, in_progress_courses: ['cse123'] }), 400, 'INVALID_REQUEST'));
  await check('POST /api/plan rejects malformed JSON', async () => expectedError(await fetch(`${origin}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }), 400, 'INVALID_JSON'));
  await check('POST /api/plan rejects wrong MIME', async () => expectedError(await fetch(`${origin}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' }), 415));
  await check('POST /api/plan bounds actual body size', async () => expectedError(await post('/api/plan', { notes: 'a'.repeat(70 * 1024) }), 413));
  await check('POST /api/plan missing data returns 503 in isolated server', async () => expectedError(await post('/api/plan', scenarios[0].request, missingOrigin), 503, 'DATA_UNAVAILABLE'));
  await check('POST /api/plan AI opt-in without key returns deterministic fallback', async () => {
    const response = await post('/api/plan', { ...scenarios[0].request, use_ai_explanation: true });
    assert.equal(response.status, 200); const result = PlanResponseSchema.parse(await response.json());
    assert.ok(result.warnings.some(w => w.code === 'AI_UNAVAILABLE'));
    assert.deepEqual(result.quarters, PlanResponseSchema.parse(livePlans.A).quarters);
  });
  await check('POST /api/transcript extracts a real in-memory synthetic PDF', async () => {
    const response = await upload(await pdf()); assert.equal(response.status, 200);
    const result = TranscriptResponseSchema.parse(await response.json());
    assert.deepEqual(result.completed_courses, ['CSE 123']); assert.deepEqual(result.in_progress_courses, ['CSE 311']);
    assert.equal(result.records[2].status, 'ambiguous'); assert.equal(result.user_confirmation_required, true);
  });
  await check('POST /api/transcript blank/image-only document requires manual review', async () => {
    const response = await upload(await pdf(true)); assert.equal(response.status, 200);
    const result = TranscriptResponseSchema.parse(await response.json());
    assert.ok(result.warnings.some(w => w.code === 'SCANNED_PDF_UNSUPPORTED'));
  });
  await check('POST /api/transcript rejects invalid file type', async () => expectedError(await upload(new TextEncoder().encode('fake'), 'fake.txt', 'text/plain'), 415));
  await check('POST /api/transcript rejects spoofed PDF signature', async () => expectedError(await upload(new TextEncoder().encode('fake')), 422, 'INVALID_PDF'));
  await check('POST /api/transcript rejects damaged PDF', async () => expectedError(await upload(new TextEncoder().encode('%PDF-corrupt')), 422));
  await check('POST /api/transcript rejects oversized file', async () => expectedError(await upload(new Uint8Array(5 * 1024 * 1024 + 1)), 413));
  await check('POST /api/transcript rejects missing file', async () => {
    const form = new FormData(); form.set('text', 'missing');
    await expectedError(await fetch(`${origin}/api/transcript`, { method: 'POST', body: form }), 400, 'MISSING_FILE');
  });
  await check('POST /api/goal works locally without an API key', async () => {
    const response = await post('/api/goal', { text: 'AI research before 2027-06-01' }); assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.goal.type, 'research'); assert.equal(result.goal.track, 'ml'); assert.equal(result.mode, 'deterministic');
  });
  await check('POST /api/goal missing key falls back with opt-in', async () => {
    const response = await post('/api/goal', { text: 'SWE internship before 2027-06-01', use_ai: true }); assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.mode, 'deterministic'); assert.ok(result.warnings.some((w: string) => w.includes('AI_UNAVAILABLE')));
  });
  await check('POST /api/goal unsupported or ambiguous goal requests clarification', async () => {
    const response = await post('/api/goal', { text: 'Guarantee me admission next summer' }); assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.goal, null); assert.equal(result.clarification_required, true);
  });
  await check('POST /api/goal invalid body returns structured 400', async () => expectedError(await post('/api/goal', { text: '' }), 400, 'INVALID_REQUEST'));
  await check('Projected three-quarter CS + AMATH review plan preserves unknown registration restrictions', async () => {
    const request = { ...scenarios[1].request, completed_courses: [...scenarios[1].request.completed_courses, 'MATH 207'] };
    const response = await post('/api/plan', request); assert.equal(response.status, 200);
    const plan = PlanResponseSchema.parse(await response.json());
    assert.deepEqual(plan.quarters.map(q => q.term), ['2027-winter', '2027-spring', '2027-summer']);
    assert.ok(plan.quarters.every(q => q.notes.includes('REVIEW ONLY')));
    assert.equal(plan.quarters.flatMap(q => q.courses).length, 0);
    assert.ok(plan.warnings.some(w => w.code === 'COURSE_REVIEW_REQUIRED' && w.message.includes('2027-summer') && w.message.includes('projected')));
    assert.ok(plan.sources.some(s => s.url?.includes('amath-cfrm-undergraduate-course-schedule')));
    assert.equal(plan.career_milestones.length, 4);
    await writeFile('docs/reports/backend-projected-plan.json', JSON.stringify(plan, null, 2) + '\n');
    await writeFile('examples/projected-review-request.json', JSON.stringify(request, null, 2) + '\n');
  });
  const report = { generated_at: new Date().toISOString(), paid_ai_requests: 0, passed: passed.length, failed: failed.length, checks_passed: passed, failures: failed, scenarios: scenarioResults };
  await writeFile('docs/reports/backend-http-verification.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`HTTP checks: ${passed.length} passed; ${failed.length} failed.`);
  if (failed.length) process.exitCode = 1;
}
main();
