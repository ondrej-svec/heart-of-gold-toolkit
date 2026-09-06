import { fileURLToPath } from 'node:url';
import { executable, runProcess, toolEnv } from '../../workstation/src/process.mjs';

/** Convenience only. The direct executable is Node-only and imports no host code. */
export async function runWorkstation(argv: string[]): Promise<number> {
  const node = executable('node');
  if (!node) {
    console.error('workstation-guide requires Node.js 22+. No installation was attempted.');
    return 1;
  }
  const env = toolEnv(process.env);
  for (const key of ['XDG_CONFIG_HOME', 'XDG_STATE_HOME']) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  const entry = fileURLToPath(new URL('../../workstation/bin/workstation-guide.mjs', import.meta.url));
  const result = await runProcess(node, [entry, ...argv], { env, inherit: true, timeout: 0, graceMs: 1500 });
  return result.code;
}
