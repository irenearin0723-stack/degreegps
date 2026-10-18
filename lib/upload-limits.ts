// 4 MiB leaves multipart overhead below Vercel's 4.5 MB request limit; local API keeps 5 MiB.
export const MAX_PDF_MIB = process.env.NEXT_PUBLIC_FREE_DEMO === 'true' ? 4 : 5;
export const MAX_PDF_BYTES = MAX_PDF_MIB * 1024 * 1024;
