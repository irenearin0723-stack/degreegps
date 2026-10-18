import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Cross-platform; no shell-specific environment assignment, provider calls, or paid index rebuild.
const build = spawnSync(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'build', '--webpack'], {
  stdio: 'inherit',
  env: { ...process.env, DEGREEGPS_FREE_DEMO: 'true', NEXT_PUBLIC_FREE_DEMO: 'true',
    NEXT_PUBLIC_API_BASE_URL: '', NEXT_PUBLIC_USE_MOCK_DATA: 'false', NEXT_PUBLIC_USE_MOCK_TRANSCRIPT: 'false',
    OPENAI_API_KEY: '', GEMINI_API_KEY: '', GOOGLE_API_KEY: '', NEXT_TELEMETRY_DISABLED: '1' },
});
if (build.error) console.error(build.error.message);
process.exitCode = build.status ?? 1;
