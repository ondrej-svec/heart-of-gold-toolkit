import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executable, toolEnv, runProcess } from './process.mjs';
export { toolEnv } from './process.mjs';

// No preview, reload, execute bindings, shell templates or inherited FZF_* hooks.
export async function pick(cards, env = process.env) {
  const fzf = executable('fzf', env);
  if (!fzf) return undefined;
  const record = card => `${card.id}\t${card.title} [${card.chapter}]` +
    (card.synonyms?.length ? `\t${card.synonyms.join(' · ')}` : '');
  const result = await runProcess(fzf, [
    '--no-multi', '--no-sort', '--no-extended', '--layout=reverse', '--border=rounded',
    '--delimiter=\t', '--with-nth=2..', '--prompt=How do I…? ',
    '--header=Type a task · Enter: read only · Esc: quit',
  ], { env: toolEnv(env), input: cards.map(record).join('\n') + '\n', timeout: 0 });
  if (result.interrupted) process.exitCode = result.code;
  if (result.code === 130 || result.code === 1 && !result.stdout) return null;
  if (result.code !== 0) return undefined;
  const line = result.stdout.trimEnd();
  if (line.includes('\n')) return undefined;
  return cards.find(card => line === record(card));
}
export async function present(markdown, { env = process.env, glow = false, tty = false } = {}) {
  const binary = glow && tty && executable('glow', env);
  if (!binary) return markdown;
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'workstation-glow-')));
  try {
    // Glow may initialize config. Contain that in an owned disposable cwd/HOME,
    // use stdin and a built-in style, and never request its external pager/TUI.
    const childEnv = { ...toolEnv(env), HOME: home, XDG_CONFIG_HOME: home, XDG_CACHE_HOME: home, XDG_DATA_HOME: home, GLOW_CONFIG_HOME: home };
    const result = await runProcess(binary, ['--style', 'dark', '--width', '80', '-'], { env: childEnv, cwd: home, input: markdown });
    if (result.interrupted) { process.exitCode = result.code; return ''; }
    return result.code === 0 && result.stdout.trim() ? result.stdout : markdown;
  } finally { rmSync(home, { recursive: true, force: true }); }
}
