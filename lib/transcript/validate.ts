export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_MULTIPART_BYTES = MAX_PDF_BYTES + 64 * 1024;
export const MAX_PDF_PAGES = 30;
export class UploadError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export async function validatePdf(file: File): Promise<Uint8Array> {
  if (file.size === 0) throw new UploadError('EMPTY_FILE', 'Upload a non-empty PDF.', 400);
  if (file.size > MAX_PDF_BYTES) throw new UploadError('FILE_TOO_LARGE', 'PDFs must be 5 MiB or smaller.', 413);
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'))
    throw new UploadError('INVALID_FILE_TYPE', 'Upload a PDF with application/pdf content type.', 415);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder('ascii').decode(bytes.slice(0, 5)) !== '%PDF-')
    throw new UploadError('INVALID_PDF', 'The uploaded file does not have a PDF signature.', 422);
  return bytes;
}
