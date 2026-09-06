import { spawn } from 'node:child_process';
import { lstatSync, mkdtempSync, readdirSync, realpathSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveWriting } from './writing-config.mjs';
import { fail, WritingError, WritingProtocol, WRITING_LIMITS } from './writing-protocol.mjs';
export { listWritingActions } from './writing-config.mjs';
export { WritingError, WRITING_LIMITS } from './writing-protocol.mjs';

export const prepareWriting = (id, options) => resolveWriting(id, options).prepared;
const sameDirectory = (path, identity) => {
  const now = lstatSync(path);
  return now.isDirectory() && now.dev === identity.dev && now.ino === identity.ino;
};
function workspace() {
  const parent = realpathSync(tmpdir()), parentIdentity = lstatSync(parent);
  const path = mkdtempSync(join(parent, 'workstation-writing-'));
  const identity = lstatSync(path);
  return { path, cleanup() {
    // Never recursively remove unexpected state or follow a swapped directory.
    try {
      if (!sameDirectory(parent, parentIdentity) || realpathSync(parent) !== parent
        || !sameDirectory(path, identity) || readdirSync(path).length !== 0) fail('WRITING_CLEANUP');
      rmdirSync(path);
    } catch { fail('WRITING_CLEANUP'); }
  } };
}
function invocation(resolved) {
  const p = resolved.prepared;
  return [resolved.pi, '-p', '--mode', 'json', '--no-session', '--no-tools', '--no-extensions',
    '--no-skills', '--no-context-files', '--no-prompt-templates', '--no-themes', '--no-approve', '--offline',
    '--provider', p.provider, '--model', p.model, '--models', `${p.provider}/${p.model}`,
    '--thinking', p.thinking, '--system-prompt', resolved.system, '--append-system-prompt', ''];
}

/** Explicit confirmed send. Source/result/events remain in memory, never diagnostic files. */
export async function runWriting(id, input, { env = process.env, preferences, expectedFingerprint,
  signal, timeoutMs = WRITING_LIMITS.timeoutMs } = {}) {
  if (typeof input !== 'string' || !input.isWellFormed() || !input.trim()
    || Buffer.byteLength(input) > WRITING_LIMITS.inputBytes || input.includes('\0')) fail('WRITING_INPUT');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > WRITING_LIMITS.timeoutMs
    || signal !== undefined && !(signal instanceof AbortSignal)) fail('WRITING_OPTIONS');
  if (signal?.aborted) fail('WRITING_CANCELLED');
  const resolved = resolveWriting(id, { env, preferences });
  if (typeof expectedFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(expectedFingerprint)
    || resolved.prepared.fingerprint !== expectedFingerprint) fail('WRITING_CONFIRMATION');
  const envelope = 'Workstation writing input (JSON follows).\n'
    + JSON.stringify({ action: id, input }) + '\nEnd of workstation writing input.';
  let work;
  try { work = workspace(); } catch { fail('WRITING_CLEANUP'); }
  const started = performance.now();
  try {
    const text = await new Promise((resolve, reject) => {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const protocol = new WritingProtocol(resolved.prepared.provider, resolved.prepared.model, envelope);
      let child, failure, timer, escalation, stopped, releaseStop, pending = '', bytes = 0, stderrBytes = 0;
      const groupAlive = () => {
        if (!child?.pid) return false;
        try { process.kill(-child.pid, 0); return true; }
        catch (e) { return e.code !== 'ESRCH'; }
      };
      const kill = sig => {
        if (!child?.pid) return;
        try { process.kill(-child.pid, sig); } catch (error) {
          if (error.code !== 'ESRCH') failure ??= new WritingError('WRITING_PROCESS');
        }
      };
      const stop = (code) => {
        failure ??= new WritingError(code);
        kill('SIGTERM');
        stopped ??= new Promise(done => {
          releaseStop = done;
          escalation = setTimeout(() => { kill('SIGKILL'); done(); }, 500);
        });
      };
      const cancel = () => stop('WRITING_CANCELLED');
      const consume = (text) => {
        pending += text;
        let end;
        while ((end = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, end); pending = pending.slice(end + 1);
          if (!line || Buffer.byteLength(line) > WRITING_LIMITS.recordBytes) fail('WRITING_PROTOCOL');
          protocol.accept(JSON.parse(line));
        }
        if (Buffer.byteLength(pending) > WRITING_LIMITS.recordBytes) fail('WRITING_LIMIT');
      };
      const finished = async (code, terminationSignal) => {
        clearTimeout(timer);
        if (!failure && (code !== 0 || terminationSignal)) failure = new WritingError('WRITING_PROCESS');
        // A cooperative leader can close before its stubborn descendants. Do not
        // cancel group escalation merely because the leader's pipes closed.
        if (groupAlive()) stop(failure?.code ?? 'WRITING_PROCESS');
        else { clearTimeout(escalation); releaseStop?.(); }
        if (stopped) await stopped;
        process.off('SIGINT', cancel); process.off('SIGTERM', cancel);
        signal?.removeEventListener('abort', cancel);
        if (failure) { pending = ''; reject(failure); return; }
        try {
          consume(decoder.decode());
          if (pending !== '') fail('WRITING_PROTOCOL');
          const result = protocol.finish();
          if (resolveWriting(id, { env, preferences }).prepared.fingerprint !== expectedFingerprint) fail('WRITING_CONFIRMATION');
          resolve(result);
        } catch (e) { reject(e instanceof WritingError ? e : new WritingError('WRITING_PROTOCOL')); }
      };
      // Register before spawn so an immediate cancellation cannot leave a Pi
      // child in the gap between its creation and signal-handler installation.
      process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        // Use this already running Node, not a second PATH/shebang interpreter.
        child = spawn(process.execPath, invocation(resolved), {
          cwd: work.path, env: resolved.env, shell: false, detached: true, stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        process.off('SIGINT', cancel); process.off('SIGTERM', cancel);
        signal?.removeEventListener('abort', cancel);
        reject(new WritingError('WRITING_PROCESS')); return;
      }
      timer = setTimeout(() => stop('WRITING_TIMEOUT'), timeoutMs);
      child.once('error', () => stop('WRITING_PROCESS'));
      child.once('close', finished);
      child.stdout.on('data', chunk => {
        if (failure) return;
        bytes += chunk.length;
        if (bytes > WRITING_LIMITS.streamBytes) { stop('WRITING_LIMIT'); return; }
        try { consume(decoder.decode(chunk, { stream: true })); }
        catch (e) { stop(e instanceof WritingError ? e.code : 'WRITING_PROTOCOL'); }
      });
      child.stderr.on('data', chunk => {
        // Count, never store or echo, including on failure.
        stderrBytes += chunk.length;
        if (stderrBytes > WRITING_LIMITS.stderrBytes) stop('WRITING_LIMIT');
      });
      child.stdout.on('error', () => stop('WRITING_PROCESS'));
      child.stderr.on('error', () => stop('WRITING_PROCESS'));
      child.stdin.on('error', () => stop('WRITING_PROCESS'));
      if (signal?.aborted) cancel();
      if (!failure) child.stdin.end(envelope); else child.stdin.destroy();
    });
    return { ...resolved.prepared, text, durationMs: Math.round(performance.now() - started) };
  } finally {
    work.cleanup();
  }
}
