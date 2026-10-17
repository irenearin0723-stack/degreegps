// Compatibility entry point for old team instructions. Validation lives in the v2 schemas.
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'scripts/check-contract.ts'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
