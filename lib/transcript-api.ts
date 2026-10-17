export type DetectedCourseStatus = 'completed' | 'in_progress' | 'uncertain';

export interface DetectedTranscriptCourse {
  id: string;
  code: string;
  term: string | null;
  grade: string | null;
  status: DetectedCourseStatus;
  confidence: number;
}

export interface TranscriptParseResponse {
  completed_courses: string[];
  in_progress_courses: string[];
  detected_courses: DetectedTranscriptCourse[];
  warnings: string[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
const USE_MOCK_TRANSCRIPT = process.env.NEXT_PUBLIC_USE_MOCK_TRANSCRIPT !== 'false';

const mockResult: TranscriptParseResponse = {
  completed_courses: ['CSE 123', 'MATH 126', 'MATH 207'],
  in_progress_courses: ['CSE 311', 'CSE 351', 'INFO 201'],
  detected_courses: [
    { id: 'det-1', code: 'CSE 123', term: 'Spring 2026', grade: '3.8', status: 'completed', confidence: 0.99 },
    { id: 'det-2', code: 'MATH 126', term: 'Spring 2026', grade: '3.5', status: 'completed', confidence: 0.98 },
    { id: 'det-3', code: 'MATH 207', term: 'Spring 2026', grade: '3.7', status: 'completed', confidence: 0.96 },
    { id: 'det-4', code: 'CSE 311', term: 'Autumn 2026', grade: null, status: 'in_progress', confidence: 0.99 },
    { id: 'det-5', code: 'CSE 351', term: 'Autumn 2026', grade: null, status: 'in_progress', confidence: 0.97 },
    { id: 'det-6', code: 'INFO 20I', term: 'Autumn 2026', grade: null, status: 'uncertain', confidence: 0.72 },
  ],
  warnings: ['Demo extraction: review every detected course before adding it to your plan.'],
};

export async function parseTranscript(file: File): Promise<TranscriptParseResponse> {
  if (USE_MOCK_TRANSCRIPT) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return structuredClone(mockResult);
  }

  const body = new FormData();
  body.append('transcript', file);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/transcript/parse`, { method: 'POST', body });
  } catch {
    throw new Error('The transcript parser is unavailable. You can still enter courses manually.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? `Transcript parsing failed (${response.status}).`);
  if (!data || !Array.isArray(data.detected_courses)) throw new Error('The parser returned an invalid response.');
  return data as TranscriptParseResponse;
}
