import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { isAbsolute, join } from 'node:path';

export function executable(name, env = process.env) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) return undefined;
  for (const directory of (env.PATH ?? '').split(':').filter(isAbsolute)) {
    try {
      const file = realpathSync(join(directory, name));
      if (!statSync(file).isFile()) continue;
      accessSync(file, constants.X_OK);
      return file;
    } catch { /* Presence checks neither invoke executables nor source shells. */ }
  }
}
export function toolEnv(env = process.env) {
  const result = {};
  for (const key of ['HOME', 'PATH', 'TERM', 'COLORTERM', 'LANG', 'LC_ALL', 'LC_CTYPE']) {
    if (typeof env[key] === 'string') result[key] = env[key];
  }
  return result;
}
/** Shell-free, bounded capture with signal forwarding and awaited child closure. */
export function runProcess(file, args, { env, cwd, input = '', inherit = false, timeout = 10000, maxBytes = 1024 * 1024, graceMs = 500 } = {}) {
  return new Promise((resolve) => {
    let stdout = '', bytes = 0, failed = false, interrupted, escalation, timer;
    const child = spawn(file, args, { shell: false, env, cwd, stdio: inherit ? 'inherit' : ['pipe', 'pipe', 'inherit'] });
    const stop = signal => {
      child.kill(signal);
      escalation ??= setTimeout(() => child.kill('SIGKILL'), graceMs);
      escalation.unref();
    };
    const onInt = () => { interrupted = 'SIGINT'; stop('SIGINT'); };
    const onTerm = () => { interrupted = 'SIGTERM'; stop('SIGTERM'); };
    process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
    if (timeout) timer = setTimeout(() => { failed = true; stop('SIGTERM'); }, timeout);
    child.on('error', () => { failed = true; });
    if (!inherit) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > maxBytes) { failed = true; stop('SIGTERM'); }
        else stdout += chunk;
      });
      child.stdin.on('error', () => { /* Early exits such as fzf Esc can close stdin. */ });
      child.stdin.end(input);
    }
    child.on('close', (code, signal) => {
      clearTimeout(timer); clearTimeout(escalation);
      process.off('SIGINT', onInt); process.off('SIGTERM', onTerm);
      resolve({ code: failed ? 1 : interrupted === 'SIGINT' ? 130 : interrupted === 'SIGTERM' ? 143 : code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1), stdout, interrupted });
    });
  });
}
