import { ApiErrorResponseSchema } from '../types/plan';
export const PRIVATE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export class HttpError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export function apiError(code: string, message: string, status = 400, details?: string[]) {
  return Response.json(ApiErrorResponseSchema.parse({ error: { code, message, ...(details ? { details } : {}) } }), { status, headers: PRIVATE_HEADERS });
}
/** Read with an actual byte cap, including chunked requests that omit Content-Length. */
export async function readBoundedBody(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit))
    throw new HttpError('REQUEST_TOO_LARGE', 'Request body exceeds the allowed size.', 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError('REQUEST_TOO_LARGE', 'Request body exceeds the allowed size.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new HttpError('INVALID_CONTENT_TYPE', 'Use application/json.', 415);
  const bytes = await readBoundedBody(request, 64 * 1024);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new HttpError('INVALID_JSON', 'Request body must contain valid JSON.', 400); }
}
