import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCatalog, ROOT } from '../src/catalog.mjs';
import { BINDINGS, validateProfile, emptyProfile, interpolate, sha256 } from '../src/profile.mjs';

const additions = [
  'nvim.find-project', 'nvim.code-navigation', 'nvim.buffers-windows', 'nvim.tests',
  'nvim.quick-reference', 'tmux.panes', 'tmux.copy-mode', 'tmux.quick-reference',
];
const sources = {
  'nvim/lua/plugins/snacks.lua': ['nvim.find-files', 'nvim.buffers', 'nvim.grep', 'nvim.explorer', 'nvim.recent'],
  'nvim/lua/plugins/lsp-config.lua': ['nvim.hover', 'nvim.definition', 'nvim.references', 'nvim.code-action', 'nvim.format', 'nvim.rename'],
  'nvim/lua/plugins/oil.lua': ['nvim.directory'],
  'nvim/lua/plugins/nvim-tmux-navigation.lua': ['nvim.navigate-panes'],
  'nvim/lua/plugins/vim-test.lua': ['nvim.test-nearest', 'nvim.test-file', 'nvim.test-suite', 'nvim.test-last', 'nvim.test-visit'],
  'tmux/main.conf': ['tmux.split-below', 'tmux.split-right', 'tmux.navigate-panes', 'tmux.new-window', 'tmux.copy-mode-keys', 'tmux.clipboard-paste', 'tmux.session-picker'],
};
const getCard = id => {
  const card = loadCatalog().cards.find(card => card.id === id);
  assert.ok(card, `missing ${id}`);
  return card;
};

test('eight focused references have teaching, recovery, provenance and no executable exercises', () => {
  for (const id of additions) {
    const card = getCard(id);
    for (const heading of ['## When', '## Try', '## Why', '## Recovery', '## Sources']) assert.ok(card.content.includes(heading), `${id}: ${heading}`);
    assert.match(card.content, /reference only/i);
    assert.match(card.content, /stock|native/i);
    assert.equal(card.exercise, undefined);
    assert.doesNotMatch(card.content, /\/Users\/|\/home\/|claude -p|:Llm|codex exec/);
    const rendered = interpolate(card.content, emptyProfile());
    assert.doesNotMatch(rendered, /\{\{binding\.|\[recorded;/);
    assert.match(rendered, /unknown binding:/);
  }
});

test('expanded binding allowlist pins each action to only its authored source', () => {
  const used = new Set(additions.flatMap(id => [...getCard(id).content.matchAll(/\{\{binding\.([a-z.-]+)\}\}/g)].map(match => match[1])));
  for (const [source, names] of Object.entries(sources)) {
    for (const name of names) {
      assert.deepEqual(BINDINGS[name], [source], name);
      assert.ok(used.has(name), `unused allowlist entry: ${name}`);
      const binding = { value: 'synthetic key', source, sha256: sha256('fixture'), verifiedAt: '2026-09-06' };
      assert.doesNotThrow(() => validateProfile({ schemaVersion: 1, bindings: { [name]: binding } }));
      for (const wrong of ['../private.lua', 'nvim/init.lua', source === 'tmux/main.conf' ? 'nvim/lua/plugins/snacks.lua' : 'tmux/main.conf']) {
        assert.throws(() => validateProfile({ schemaVersion: 1, bindings: { [name]: { ...binding, source: wrong } } }), `${name}: ${wrong}`);
      }
    }
  }
});

test('leader remains separately fingerprinted when a plugin mapping is recorded', t => {
  const root = mkdtempSync(join(tmpdir(), 'workstation content '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'nvim/lua/plugins'), { recursive: true });
  writeFileSync(join(root, 'nvim/lua/plugins/snacks.lua'), 'synthetic plugin');
  writeFileSync(join(root, 'nvim/lua/vim-options.lua'), 'synthetic leader');
  const profile = validateProfile({ schemaVersion: 1, bindings: {
    'nvim.find-files': { value: 'Ctrl-p or Leader f f', source: 'nvim/lua/plugins/snacks.lua', sha256: sha256('synthetic plugin'), verifiedAt: '2026-09-06' },
  } });
  const body = getCard('nvim.find-project').content;
  assert.match(body, /Leader.*separate|separate.*Leader/);
  let rendered = interpolate(body, profile, root);
  assert.match(rendered, /Ctrl-p or Leader f f \[recorded; confirm loaded\]/);
  assert.match(rendered, /unknown binding: nvim.leader/);
  assert.doesNotMatch(rendered, /Space f f/);
  profile.bindings['nvim.leader'] = { value: 'Comma', source: 'nvim/lua/vim-options.lua', sha256: sha256('synthetic leader'), verifiedAt: '2026-09-06' };
  assert.match(interpolate(body, profile, root), /Comma \[recorded; confirm loaded\]/);
  writeFileSync(join(root, 'nvim/lua/vim-options.lua'), 'changed leader');
  rendered = interpolate(body, profile, root);
  assert.match(rendered, /stale binding: nvim.leader/);
  assert.match(rendered, /Leader f f \[recorded; confirm loaded\]/);
  assert.doesNotMatch(rendered, /Comma \[recorded/);
});

test('LSP and test references distinguish local scope and consequential actions', () => {
  const lsp = getCard('nvim.code-navigation').content;
  assert.match(lsp, /LspAttach/);
  assert.match(lsp, /buffer-local/);
  assert.match(lsp, /literal Space r n/);
  assert.match(lsp, /not.*Leader/i);
  for (const action of ['definition', 'references', 'hover', 'code_action', 'format', 'rename']) assert.ok(lsp.includes(`vim.lsp.buf.${action}`));
  const tests = getCard('nvim.tests').content;
  for (const command of ['TestNearest', 'TestFile', 'TestSuite', 'TestLast', 'TestVisit']) assert.ok(tests.includes(`:${command}`));
  assert.match(tests, /vimux/);
  assert.match(tests, /side effects/i);
});

test('tmux content separates prefix, suffix, stock defaults and clipboard defect', () => {
  for (const id of ['tmux.panes', 'tmux.copy-mode', 'tmux.quick-reference']) {
    const body = getCard(id).content;
    assert.ok(body.includes('{{binding.tmux.prefix}}'));
    assert.match(body, /suffix/i);
    assert.match(body, /not live verification/i);
    assert.doesNotMatch(body, /C-a|Ctrl-a/);
  }
  const panes = getCard('tmux.panes').content;
  assert.match(panes, /horizontal.*below/i);
  assert.match(panes, /vertical.*right/i);
  assert.match(panes, /split-window -v/);
  assert.match(panes, /split-window -h/);
  const copy = getCard('tmux.copy-mode').content;
  assert.match(copy, /pbcopy/);
  assert.match(copy, /known defect/i);
  assert.match(copy, /tmux buffer/i);
  assert.match(copy, /system clipboard/i);
  const quick = getCard('tmux.quick-reference').content;
  assert.match(quick, /list-keys -N/);
  assert.match(quick, /menu.*\?|\?.*menu/i);
});

test('coverage note reconciles discrepancies without exporting the private sheet', () => {
  const note = readFileSync(join(ROOT, 'docs/reference-coverage.md'), 'utf8');
  for (const id of additions) assert.ok(note.includes(id), id);
  for (const filename of ['CHEATSHEET.md', 'vim-options.lua', 'snacks.lua', 'lsp-config.lua', 'oil.lua', 'nvim-tmux-navigation.lua', 'vim-test.lua', 'which-key.lua', 'tmux/main.conf']) assert.ok(note.includes(filename), filename);
  for (const topic of [/legacy AI/i, /untouched/i, /pbcopy/, /timeoutlen/, /global = true/, /Leader Space/]) assert.match(note, topic);
  assert.doesNotMatch(note, /\/Users\/|\/home\/|claude\.ai\/code\/artifact|password-store|himalaya/);
});
