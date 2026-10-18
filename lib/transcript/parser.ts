import { randomUUID } from 'node:crypto';
import { TranscriptResponseSchema, type TranscriptRecord, type TranscriptResponse } from '../../types/transcript';
import { normalizeCourseId } from './normalize';
import { MAX_PDF_PAGES, UploadError } from './validate';

/** Conservative line-oriented text parser. Not an official UW transcript specification. */
export function parseTranscriptText(text: string): TranscriptResponse {
  const records: TranscriptRecord[] = [];
  const warnings: TranscriptResponse['warnings'] = [];
  let term: string | null = null;
  let transfer = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, ' ');
    const quarter = /\b(AUTUMN|FALL|WINTER|SPRING|SUMMER)\s+(20\d{2}|19\d{2})\b/i.exec(line)
      ?? /\b(20\d{2}|19\d{2})\s+(AUTUMN|FALL|WINTER|SPRING|SUMMER)\b/i.exec(line);
    if (quarter) {
      const year = quarter[1].match(/^\d/) ? quarter[1] : quarter[2];
      const season = (quarter[1].match(/^\d/) ? quarter[2] : quarter[1]).toLowerCase().replace('fall', 'autumn');
      term = `${year}-${season}`;
      transfer = false;
    }
    if (/\bTRANSFER\s+(CREDIT|COURSES|WORK)|\bADVANCED PLACEMENT\b/i.test(line)) transfer = true;
    // Anchored course entry; student headers and arbitrary prose are not returned.
    const match = /^([A-Z][A-Z&]{0,7}(?:\s+[A-Z&]{1,5})?)\s*(\d{3}[A-Z]?)\b\s*(.*)$/.exec(line);
    if (!match) {
      if (/^(?:TRANSFER|AP|IB|EQUIVALENCY)\b/i.test(line)) {
        records.push({ id: randomUUID(), course_id: null, title: null, term, grade: null, credits: null,
          status: 'ambiguous', transfer_credit: true, repeated: false, needs_review: true,
          review_reasons: ['Transfer credit needs an explicit UW course equivalency; no course ID inferred.'],
          raw_entry: 'Unmapped transfer credit entry (review original document).' });
      }
      continue;
    }
    let courseId: string;
    try { courseId = normalizeCourseId(`${match[1]} ${match[2]}`); } catch { continue; }
    const tail = match[3];
    const repeated = /\b(REPEAT|REPEATED|RPT)\b/i.test(tail);
    const cleanTail = tail.replace(/\b(REPEAT|REPEATED|RPT)\b/gi, '').trim();
    // Only accept an explicit trailing credit + grade pair. Missing grades are NOT assumed in progress.
    const result = /(?:^|\s)(\d{1,2}(?:\.\d)?)\s+(4\.0|[0-3]\.\d|CR|NC|NS|S|W|HW|F|I|N|IP|IN PROGRESS|\*\*\*)$/i.exec(cleanTail);
    const grade = result?.[2].toUpperCase() ?? null;
    const credits = result ? Number(result[1]) : null;
    const title = result ? cleanTail.slice(0, result.index).trim() || null : cleanTail || null;
    const reasons: string[] = [];
    let status: TranscriptRecord['status'] = 'ambiguous';
    if (grade && ['W', 'HW'].includes(grade)) status = 'withdrawn';
    else if (grade && ['F', 'NC', 'NS', '0.0'].includes(grade)) status = 'failed';
    else if (grade && ['IP', 'IN PROGRESS'].includes(grade)) status = 'in_progress';
    else if (grade && (/^[0-3]\.\d$|^4\.0$/.test(grade) || ['CR', 'S'].includes(grade)) && (credits ?? 0) > 0) status = 'completed';
    else reasons.push('Missing or ambiguous credit/grade fields; confirm course status.');
    if (!term) reasons.push('Academic quarter could not be identified.');
    if (transfer) reasons.push('Verify transfer equivalency and accepted credit with UW.');
    if (repeated) reasons.push('Repeated course: review all attempts and applicable credit.');
    records.push({ id: randomUUID(), course_id: courseId, title, term, grade, credits, status,
      transfer_credit: transfer, repeated, needs_review: reasons.length > 0,
      review_reasons: reasons, raw_entry: line.slice(0, 500) });
  }
  const counts = new Map<string, number>();
  for (const record of records) if (record.course_id) counts.set(record.course_id, (counts.get(record.course_id) ?? 0) + 1);
  for (const record of records) {
    if (record.course_id && (counts.get(record.course_id) ?? 0) > 1) {
      record.repeated = true; record.needs_review = true;
      record.review_reasons.push('Multiple attempts or duplicate entries found. Confirm which attempt counts.');
    }
  }
  if (!text.trim()) warnings.push({ code: 'SCANNED_PDF_UNSUPPORTED', message: 'No extractable text. Image-only PDFs require OCR, which is not enabled. Review and enter courses manually.' });
  else if (!records.length) warnings.push({ code: 'NO_RECOGNIZABLE_COURSES', message: 'No supported course entries found. Review and enter courses manually.' });
  warnings.push({ code: 'CONFIRM_EXTRACTION', message: 'Review and correct every record before submitting course IDs to /api/plan. Extraction is heuristic, not an academic audit.' });
  const usable = (status: TranscriptRecord['status']) => [...new Set(records.filter(r => r.status === status && !r.needs_review && r.course_id).map(r => r.course_id!))];
  return TranscriptResponseSchema.parse({ schema_version: '2.0.0', records,
    completed_courses: usable('completed'), in_progress_courses: usable('in_progress'),
    needs_review: true, user_confirmation_required: true, warnings });
}

export async function extractTranscript(bytes: Uint8Array): Promise<TranscriptResponse> {
  // Lazy Node import; bytes and extracted text remain in memory, never sent to AI or logged.
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  try {
    const info = await parser.getInfo();
    if (info.total > MAX_PDF_PAGES) throw new UploadError('TOO_MANY_PAGES', `PDFs must contain no more than ${MAX_PDF_PAGES} pages.`, 413);
    const result = await parser.getText();
    if (result.text.length > 1_000_000) throw new UploadError('EXTRACTED_TEXT_TOO_LARGE', 'This PDF contains too much text. Upload a shorter transcript or enter courses manually.', 413);
    // Page numbers inserted by the extractor are not transcript content.
    return parseTranscriptText(result.pages.map(page => page.text).join('\n'));
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError('PDF_EXTRACTION_FAILED', 'Could not read this PDF. It may be damaged, encrypted, or unsupported. Enter courses manually or upload a text-based PDF.', 422);
  } finally { await parser.destroy(); }
}
