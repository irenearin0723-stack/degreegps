/** Run against a local production or dev server, with no real transcripts. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { PlanResponseSchema } from '../types/plan';
import { TranscriptResponseSchema } from '../types/transcript';
async function main() {
  const origin = process.env.DEGREEGPS_TEST_ORIGIN || 'http://localhost:3100';
  const request = JSON.parse(await readFile('examples/sample-request.json', 'utf8'));
  const response = await fetch(`${origin}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  assert.equal(response.status, 200);
  const plan = PlanResponseSchema.parse(await response.json());
  assert.equal(plan.mode, 'generated');
  assert.equal(plan.quarters.flatMap(q => q.courses).length, 0);
  const mock = await fetch(`${origin}/api/plan/mock`);
  assert.equal(PlanResponseSchema.parse(await mock.json()).mode, 'mock');
  const bad = await fetch(`${origin}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(bad.status, 400);
  const doc = await PDFDocument.create(); const page = doc.addPage();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = (await readFile('examples/transcript-text.txt', 'utf8')).split('\n');
  lines.forEach((line, i) => page.drawText(line, { x: 30, y: 750 - i * 20, size: 10, font }));
  const form = new FormData(); form.set('file', new File([new Uint8Array(await doc.save())], 'fictional.pdf', { type: 'application/pdf' }));
  const transcriptResponse = await fetch(`${origin}/api/transcript`, { method: 'POST', body: form });
  const transcriptJson = await transcriptResponse.json();
  assert.equal(transcriptResponse.status, 200, JSON.stringify(transcriptJson));
  const transcript = TranscriptResponseSchema.parse(transcriptJson);
  assert.deepEqual(transcript.completed_courses, ['CSE 123']);
  assert.deepEqual(transcript.in_progress_courses, ['CSE 311']);
  assert.equal(transcript.records[2].status, 'ambiguous');
  const goal = await fetch(`${origin}/api/goal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'ML research before 2027-06-01' }) });
  assert.equal((await goal.json()).goal.type, 'research');
  await writeFile('examples/plan-response.json', JSON.stringify(plan, null, 2) + '\n');
  await writeFile('examples/transcript-response.json', JSON.stringify(transcript, null, 2) + '\n');
  console.log('Live HTTP smoke checks passed: real planning, mock, validation error, synthetic PDF upload, goal interpretation.');
}
main();
