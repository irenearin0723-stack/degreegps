import { TranscriptResponseSchema } from '../types/transcript';
import { MAX_PDF_BYTES, MAX_PDF_MIB } from './upload-limits';
export type DetectedCourseStatus = 'completed' | 'in_progress' | 'uncertain';
export interface DetectedTranscriptCourse {
  id: string; code: string; term: string | null; grade: string | null;
  status: DetectedCourseStatus; confidence: number | null; review_reasons?: string[];
}
export interface TranscriptParseResponse {
  completed_courses: string[]; in_progress_courses: string[];
  detected_courses: DetectedTranscriptCourse[]; warnings: string[];
}
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
const USE_MOCK_TRANSCRIPT = process.env.NEXT_PUBLIC_USE_MOCK_TRANSCRIPT === 'true';
export async function parseTranscript(file: File): Promise<TranscriptParseResponse> {
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Upload a text-based PDF. Scanned images and OCR are not supported.');
  if (!file.size || file.size > MAX_PDF_BYTES) throw new Error(`Upload a non-empty PDF no larger than ${MAX_PDF_MIB} MiB.`);
  if (USE_MOCK_TRANSCRIPT) return { completed_courses: ['CSE 123'], in_progress_courses: [], detected_courses: [
    { id: 'demo-only', code: 'CSE 123', term: null, grade: null, status: 'uncertain', confidence: null },
  ], warnings: ['DEMO ONLY: fictional course data; the selected file was not uploaded.'] };
  const body = new FormData(); body.append('file', file);
  let response: Response;
  try { response = await fetch(`${API_BASE_URL}/api/transcript`, { method: 'POST', body }); }
  catch { throw new Error('The transcript parser is unavailable. You can still enter courses manually.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? `Transcript parsing failed (${response.status}).`);
  const result = TranscriptResponseSchema.safeParse(data);
  if (!result.success) throw new Error('The parser returned an invalid response.');
  return { completed_courses: result.data.completed_courses, in_progress_courses: result.data.in_progress_courses,
    detected_courses: result.data.records.filter(r => r.course_id !== null).map(r => ({
      id: r.id, code: r.course_id!, term: r.term, grade: r.grade,
      status: r.needs_review || !['completed', 'in_progress'].includes(r.status) ? 'uncertain' : r.status as DetectedCourseStatus,
      confidence: null, review_reasons: r.review_reasons,
    })), warnings: result.data.warnings.map(w => w.message).concat(result.data.records.flatMap(r => r.review_reasons)) };
}

/** Numeric grades of confirmed completed courses. A course listed with different grades is left out (unknown). */
export function confirmedGrades(courses: DetectedTranscriptCourse[]): Record<string, number> {
  const grades = new Map<string, number | null>();
  for (const course of courses.filter(c => c.status === 'completed')) {
    const grade = /^[0-3]\.\d$|^4\.0$/.test(course.grade ?? '') ? Number(course.grade) : null;
    grades.set(course.code, grades.has(course.code) && grades.get(course.code) !== grade ? null : grade);
  }
  return Object.fromEntries([...grades].filter((entry): entry is [string, number] => entry[1] !== null));
}
