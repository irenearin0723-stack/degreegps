import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
  poweredByHeader: false,
  // All APIs stay Node functions. These are private function assets, never public/ downloads.
  outputFileTracingIncludes: {
    '/api/plan': ['data/target_courses/*.json', 'data/major_requirements/major_requirements.json', 'data/career_paths.json', 'data/index/embeddings.json'],
    '/api/ask': ['data/target_courses/*.json', 'data/major_requirements/major_requirements.json', 'data/career_paths.json', 'data/index/embeddings.json'],
    '/api/plan/mock': ['mocks/course-data.json', 'data/career_paths.json'],
    '/api/transcript': [
      'node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs',
      'node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs',
      'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      'node_modules/pdfjs-dist/standard_fonts/**/*', 'node_modules/pdfjs-dist/cmaps/**/*', 'node_modules/pdfjs-dist/wasm/**/*',
      // pdfjs loads canvas dynamically; tracing otherwise drops this dependency and PDF parsing fails in Functions.
      'node_modules/@napi-rs/canvas/**/*', 'node_modules/@napi-rs/canvas-*/**/*',
    ],
  },
  outputFileTracingExcludes: {
    '/api/**': ['data/archive/**/*', 'data/**/*.csv', 'data/**/*.xlsx', '**/.DS_Store', '.env*', '.tools/**/*'],
  },
  // Freeze safe browser flags into the hosted $0 build even if .env.local has old demo URLs.
  ...(process.env.DEGREEGPS_FREE_DEMO === 'true' ? { env: {
    NEXT_PUBLIC_FREE_DEMO: 'true', NEXT_PUBLIC_API_BASE_URL: '',
    NEXT_PUBLIC_USE_MOCK_DATA: 'false', NEXT_PUBLIC_USE_MOCK_TRANSCRIPT: 'false',
  } } : {}),
};
export default config;
