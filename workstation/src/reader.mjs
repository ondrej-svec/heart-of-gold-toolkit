import { mkdtempSync, mkdirSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CHAPTERS } from './catalog.mjs';
import { executable, toolEnv, runProcess } from './process.mjs';

const READING = 'Read-only guide copy · j/k: move · /word then n: search\n' +
  'Put the cursor on a .md filename and press gf to follow it; Ctrl-O goes back.\n' +
  ':q returns to the picker (or shell for a direct lookup). No custom key mappings.\n';

/** Shared full lesson renderer: bodies alone omit important context/recovery. */
export function renderCard(card, { files = false } = {}) {
  const related = files ? '## Related guides\n\n' + card.related.map(id => `- [${id}](${id}.md)`).join('\n') + '\n- [All chapters](index.md)'
    : `Related: ${card.related.join(' · ')}`;
  return `# ${card.title}\n\n${files ? READING + '\n' : ''}WHERE  ${card.layer}\nSETUP  ${card.tools.map(tool => `${tool.name}: ${tool.status}`).join(' · ') || 'No tool required to read or understand this lesson'}\n\n${card.content}\n## Expected effect\n\n${card.effect}\n\n## Exit / undo\n\n${card.recovery}\n\n${related}\n\nSource: ${card.source.label} — ${card.source.revision}\n${card.source.url}\n${files ? '' : '\nRead another card: workstation-guide show <id>\n'}`;
}

/** Private regular files, not catalog-source buffers; resolved labels never enter Git. */
export function createDocuments(cards, selectedId, parent = tmpdir()) {
  const ids = new Set(cards.map(card => card.id));
  if (ids.size !== cards.length || !ids.has(selectedId) || cards.some(card =>
    !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(card.id) || card.id.length > 80 || card.id === 'index' ||
    card.related.some(id => !ids.has(id)))) throw new Error('Invalid lesson document IDs');
  const directory = realpathSync(mkdtempSync(join(parent, 'workstation-reader-')));
  try {
    for (const card of cards) writeFileSync(join(directory, `${card.id}.md`), renderCard(card, { files: true }), { mode: 0o600, flag: 'wx' });
    const index = '# Your workstation — learning and quick reference\n\n' + READING + '\n' + CHAPTERS.map(chapter =>
      `## ${chapter.title}\n\n` + cards.filter(card => card.chapter === chapter.id).map(card => `- [${card.title}](${card.id}.md)`).join('\n')
    ).join('\n\n') + '\n\nThese are temporary reading copies of the shared catalog, not its editable source.\nNo examples run automatically. No progress is tracked.\n';
    writeFileSync(join(directory, 'index.md'), index, { mode: 0o600, flag: 'wx' });
    return { directory, entry: join(directory, `${selectedId}.md`) };
  } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
}

export function readerInvocation(file, documents, env) {
  const childEnv = { ...toolEnv(env), HOME: documents.directory, NVIM_LOG_FILE: '/dev/null' };
  for (const [key, folder] of Object.entries({ XDG_CONFIG_HOME: 'config', XDG_DATA_HOME: 'data', XDG_STATE_HOME: 'state',
    XDG_CACHE_HOME: 'cache', XDG_RUNTIME_DIR: 'runtime', TMPDIR: 'tmp' })) {
    childEnv[key] = join(documents.directory, folder);
    mkdirSync(childEnv[key], { mode: 0o700 });
  }
  return {
    file,
    args: ['-u', 'NONE', '-i', 'NONE', '-n', '-R', '--noplugin',
      '--cmd', 'set nomodeline nomodelineexpr noexrc noundofile noswapfile',
      '--cmd', 'filetype on', '--cmd', 'syntax enable',
      '--cmd', 'set number wrap linebreak breakindent laststatus=2 statusline=%t%=%l:%c\\ %P',
      '--', documents.entry],
    options: { env: childEnv, cwd: documents.directory },
  };
}

export async function readLesson(cards, selectedId, { env = process.env, tty = false } = {}) {
  if (!tty) return { opened: false, reason: 'non-tty' };
  const file = executable('nvim', env);
  if (!file) return { opened: false, reason: 'missing' };
  let documents;
  try {
    documents = createDocuments(cards, selectedId);
    const request = readerInvocation(file, documents, env);
    const result = await runProcess(request.file, request.args, { ...request.options, inherit: true, timeout: 0 });
    return { opened: result.code === 0, code: result.code, interrupted: result.interrupted, reason: result.code ? 'failed' : undefined };
  } catch {
    return { opened: false, reason: 'failed', code: 1 };
  } finally {
    // Wait for editor closure before removing only this invocation's owned copies.
    // SIGKILL/OS crashes can leave a private directory; never sweep other runs.
    if (documents) rmSync(documents.directory, { recursive: true, force: true });
  }
}
