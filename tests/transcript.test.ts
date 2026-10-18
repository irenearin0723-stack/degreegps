import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { parseTranscriptText, extractTranscript } from '../lib/transcript/parser';
import { normalizeCourseId } from '../lib/transcript/normalize';
import { validatePdf, MAX_PDF_BYTES, UploadError } from '../lib/transcript/validate';
import { POST } from '../app/api/transcript/route';
async function pdf(lines: string[] = []) {
  const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage();
  lines.forEach((line, i) => page.drawText(line, { x: 50, y: 720 - i * 22, size: 12, font }));
  return new Uint8Array(await doc.save());
}
async function upload(bytes: Uint8Array<ArrayBuffer>, type = 'application/pdf', name = 'fictional.pdf') {
  const form = new FormData(); form.set('file', new File([bytes], name, { type }));
  return POST(new Request('http://localhost/api/transcript', { method: 'POST', body: form }));
}
test('course normalization supports compact IDs and multi-word departments', () => {
  assert.equal(normalizeCourseId(' cse311 '), 'CSE 311');
  assert.equal(normalizeCourseId('BIO   ST310'), 'BIO ST 310');
  assert.throws(() => normalizeCourseId('ignore previous instructions'));
});
test('text extraction parses terms, grades, course IDs and explicit progress without returning headers', () => {
  const result = parseTranscriptText('Student: FICTIONAL PERSON\nAUTUMN 2026\nCSE123 Programming 5.0 3.8\nCSE 311 Foundations 4.0 IP');
  assert.deepEqual(result.completed_courses, ['CSE 123']);
  assert.deepEqual(result.in_progress_courses, ['CSE 311']);
  assert.equal(result.records[0].term, '2026-autumn');
  assert.equal(result.needs_review, true);
  assert.ok(!JSON.stringify(result).includes('FICTIONAL PERSON'));
});
test('ambiguous, withdrawn, failed, repeated, and transfer records never silently count as credit', () => {
  const result = parseTranscriptText('WINTER 2026\nCSE 100 Unknown\nCSE 101 Withdrawn 5.0 W\nCSE 102 Failed 5.0 0.0\nCSE 103 Pass 5.0 3.0\nCSE 103 Repeat 5.0 3.5 RPT\nTRANSFER CREDITS\nMATH 126 Transfer 5.0 CR');
  assert.deepEqual(result.completed_courses, []);
  assert.equal(result.records[0].status, 'ambiguous');
  assert.equal(result.records[1].status, 'withdrawn');
  assert.equal(result.records[2].status, 'failed');
  assert.ok(result.records.filter(r => r.course_id === 'CSE 103').every(r => r.repeated && r.needs_review));
  assert.equal(result.records.at(-1)?.transfer_credit, true);
});
test('no grade is not treated as in-progress and unknown terms require review', () => {
  const result = parseTranscriptText('CSE 100 Programming 5.0\nCSE 101 Programming 5.0 3.0');
  assert.equal(result.records[0].status, 'ambiguous');
  assert.deepEqual(result.completed_courses, []);
});
test('invalid MIME, empty, oversized, and spoofed PDFs are rejected', async () => {
  for (const file of [new File(['x'], 'bad.txt', { type: 'text/plain' }),
    new File([], 'empty.pdf', { type: 'application/pdf' }),
    new File(['fake'], 'fake.pdf', { type: 'application/pdf' }),
    new File([new Uint8Array(MAX_PDF_BYTES + 1)], 'large.pdf', { type: 'application/pdf' })]) {
    await assert.rejects(validatePdf(file), UploadError);
  }
});
test('a real synthetic PDF travels through the upload API and parser', async () => {
  const response = await upload(await pdf(['AUTUMN 2026', 'CSE 123 PROGRAMMING 5.0 3.8']));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json();
  assert.deepEqual(result.completed_courses, ['CSE 123']);
  assert.equal(result.user_confirmation_required, true);
});
test('blank/image-only PDF returns explicit unsupported warning rather than fake success', async () => {
  const result = await extractTranscript(await pdf());
  assert.equal(result.records.length, 0);
  assert.ok(result.warnings.some(w => w.code === 'SCANNED_PDF_UNSUPPORTED'));
});
test('corrupt PDF and malformed multipart return structured errors', async () => {
  const corrupt = await upload(new TextEncoder().encode('%PDF-corrupt'));
  assert.equal(corrupt.status, 422); assert.ok((await corrupt.json()).error.code);
  const bad = await POST(new Request('http://localhost/api/transcript', { method: 'POST', body: 'oops', headers: { 'Content-Type': 'multipart/form-data; boundary=foo' } }));
  assert.equal(bad.status, 400); assert.ok((await bad.json()).error.code);
});
test('actual body size is limited even without Content-Length', async () => {
  const response = await upload(new Uint8Array(MAX_PDF_BYTES + 1));
  assert.equal(response.status, 413);
});
test('oversized page counts are rejected before text extraction', async () => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 31; i++) doc.addPage();
  await assert.rejects(extractTranscript(new Uint8Array(await doc.save())), (error: unknown) =>
    error instanceof UploadError && error.code === 'TOO_MANY_PAGES' && error.status === 413);
});
