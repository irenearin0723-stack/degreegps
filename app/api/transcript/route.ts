import { extractTranscript } from '../../../lib/transcript/parser';
import { validatePdf, UploadError, MAX_MULTIPART_BYTES } from '../../../lib/transcript/validate';
import { apiError, HttpError, PRIVATE_HEADERS, readBoundedBody } from '../../../lib/http';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data;'))
      return apiError('INVALID_CONTENT_TYPE', 'Use multipart/form-data with one file field.', 415);
    const body = await readBoundedBody(request, MAX_MULTIPART_BYTES);
    let form: FormData;
    try { form = await new Response(body, { headers: { 'content-type': contentType } }).formData(); }
    catch { return apiError('INVALID_MULTIPART', 'Could not read multipart form data.', 400); }
    const entries = [...form.entries()];
    const file = form.get('file');
    if (entries.length !== 1 || !(file instanceof File)) return apiError('MISSING_FILE', 'Provide exactly one PDF in the file field.', 400);
    const result = await extractTranscript(await validatePdf(file));
    return Response.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof UploadError || error instanceof HttpError) return apiError(error.code, error.message, error.status);
    return apiError('TRANSCRIPT_ERROR', 'Could not process the transcript. Try a supported text-based PDF or enter courses manually.', 422);
  }
}
