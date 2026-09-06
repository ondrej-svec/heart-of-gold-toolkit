import { listWritingActions, prepareWriting, runWriting, WritingError, WRITING_LIMITS } from './writing.mjs';

function readInput() {
  if (process.stdin.isTTY) return Promise.reject(new WritingError('WRITING_INPUT'));
  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = '', size = 0;
    const finish = (error) => {
      clearTimeout(timer);
      process.stdin.off('data', data); process.stdin.off('end', end); process.stdin.off('error', bad);
      if (error) { process.stdin.destroy(); reject(new WritingError('WRITING_INPUT')); }
      else resolve(text);
    };
    const bad = () => finish(true);
    const data = chunk => {
      size += chunk.length;
      if (size > WRITING_LIMITS.inputBytes) { bad(); return; }
      try { text += decoder.decode(chunk, { stream: true }); } catch { bad(); }
    };
    const end = () => { try { text += decoder.decode(); finish(false); } catch { bad(); } };
    const timer = setTimeout(bad, 10000);
    process.stdin.on('data', data); process.stdin.once('end', end); process.stdin.once('error', bad);
  });
}
const print = object => process.stdout.write(JSON.stringify({ schemaVersion: 1, ...object }) + '\n');
export async function writingCommand(words, options, state, env) {
  try {
    const [command, action, ...extra] = words;
    if (extra.length || options.hintSet || options.plain || options.glow) throw new WritingError('WRITING_OPTIONS');
    if (command === 'list' && !action && !options.send && !options.expect) {
      print({ ok: true, actions: listWritingActions() }); return 0;
    }
    if (!action || !['prepare', 'run'].includes(command)) throw new WritingError('WRITING_ACTION');
    const preferences = state.profile.ai;
    if (command === 'prepare') {
      if (options.send || options.expect) throw new WritingError('WRITING_CONFIRMATION');
      print({ ok: true, ...prepareWriting(action, { env, preferences }) }); return 0;
    }
    if (!options.send || !options.expect) throw new WritingError('WRITING_CONFIRMATION');
    // Recheck before reading input; runWriting checks again just before spawn.
    const prepared = prepareWriting(action, { env, preferences });
    if (prepared.fingerprint !== options.expect) throw new WritingError('WRITING_CONFIRMATION');
    const result = await runWriting(action, await readInput(), { env, preferences, expectedFingerprint: options.expect });
    print({ ok: true, ...result }); return 0;
  } catch (error) {
    const safe = error instanceof WritingError ? error : new WritingError('WRITING_PROCESS');
    print({ ok: false, error: { code: safe.code, message: safe.message } }); return 1;
  }
}
