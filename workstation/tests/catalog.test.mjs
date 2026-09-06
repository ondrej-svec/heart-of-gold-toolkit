import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadCatalog, validateCatalog, search, CHAPTERS } from '../src/catalog.mjs';
import { validateProfile, bindingStatus, interpolate, emptyProfile } from '../src/profile.mjs';

const clone = value => structuredClone(value);
const catalog = () => loadCatalog();
const hash = text => createHash('sha256').update(text).digest('hex');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'workstation profile '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'tmux'));
  writeFileSync(join(root, 'tmux/main.conf'), 'set -g prefix C-a\n');
  return root;
}

test('the catalog has real reference content in all six chapters, with no AI required', () => {
  const data = catalog();
  assert.equal(data.schemaVersion, 1);
  for (const chapter of CHAPTERS) assert.ok(data.cards.some(card => card.chapter === chapter.id));
  for (const card of data.cards) {
    assert.ok(card.content.includes('## When'));
    assert.ok(card.content.includes('## Try'));
    assert.ok(card.content.includes('## Why'));
    if (card.chapter !== 'writing') assert.notEqual(card.kind, 'ai');
  }
});

test('validation rejects duplicate/invalid IDs, broken links, unknown tools and executable metadata', () => {
  for (const mutate of [
    c => c.cards.push(clone(c.cards[0])),
    c => c.cards[0].id = '../escape',
    c => c.cards[0].related.push('not-present'),
    c => c.cards[0].requirements.push('arbitrary-shell-command'),
    c => c.cards[0].command = 'touch /tmp/never',
    c => c.cards[0].prompt = 'unwanted',
    c => c.cards[0].body = '../outside.md',
    c => c.cards[0].content += '{{binding.made.up}}',
    c => c.cards[0].title = 'unsafe\x1b[31m',
  ]) {
    const data = clone(catalog()); mutate(data);
    assert.throws(() => validateCatalog(data));
  }
});

test('task synonyms find shell and tmux by intention with deterministic ranking', () => {
  const data = catalog();
  for (const [query, expected] of [
    ['find a file', 'shell.find-file'], ['without typing a path', 'shell.find-file'],
    ['return to my workspace', 'tmux.workspaces'], ['get back to my session', 'tmux.workspaces'],
    ['undo an edit', 'nvim.modes'], ['recall a command', 'shell.history'],
    ['go to definition', 'nvim.code-navigation'],
    ['find text in project', 'nvim.find-project'],
    ['switch buffers', 'nvim.buffers-windows'],
    ['split terminal', 'tmux.panes'],
    ['copy terminal output', 'tmux.copy-mode'],
    ['run nearest test', 'nvim.tests'],
    ['nvim cheatsheet', 'nvim.quick-reference'],
    ['tmux cheatsheet', 'tmux.quick-reference'],
  ]) assert.equal(search(data, query)[0]?.id, expected, query);
  assert.deepEqual(search(data, '  FILE  '), search(data, 'file'));
  assert.deepEqual(search(data, '$(touch /tmp/no); | &'), []);
  assert.deepEqual(search(data, 'no-such-concept'), []);
});

test('unknown bindings never silently use an upstream default', () => {
  assert.equal(bindingStatus('tmux.prefix', emptyProfile()).status, 'unknown');
  assert.match(interpolate('{{binding.tmux.prefix}}', emptyProfile()), /unknown/);
});

test('binding fingerprints distinguish checked, stale and unavailable sources', t => {
  const configRoot = fixture(t);
  const profile = validateProfile({ schemaVersion: 1, bindings: {
    'tmux.prefix': { value: 'Ctrl-a', source: 'tmux/main.conf', sha256: hash('set -g prefix C-a\n'), verifiedAt: '2026-09-06' },
  } });
  assert.equal(bindingStatus('tmux.prefix', profile, configRoot).status, 'recorded');
  assert.match(interpolate('{{binding.tmux.prefix}}', profile, configRoot), /Ctrl-a/);
  writeFileSync(join(configRoot, 'tmux/main.conf'), 'set -g prefix C-b\n');
  assert.equal(bindingStatus('tmux.prefix', profile, configRoot).status, 'stale');
  assert.doesNotMatch(interpolate('{{binding.tmux.prefix}}', profile, configRoot), /Ctrl-a/);
  rmSync(join(configRoot, 'tmux/main.conf'));
  assert.equal(bindingStatus('tmux.prefix', profile, configRoot).status, 'unknown');
  symlinkSync('/etc/passwd', join(configRoot, 'tmux/main.conf'));
  assert.equal(bindingStatus('tmux.prefix', profile, configRoot).status, 'unknown');
});

test('profiles are strict data, never arbitrary paths, templates or executable steps', () => {
  const good = { value: 'Ctrl-a', source: 'tmux/main.conf', sha256: hash(''), verifiedAt: '2026-09-06' };
  for (const patch of [{ source: '../auth.json' }, { source: 'pi/auth.json' }, { sha256: 'bad' },
    { value: '{{binding.nvim.leader}}' }, { value: 'bad\nline' }, { command: 'anything' }]) {
    assert.throws(() => validateProfile({ schemaVersion: 1, bindings: { 'tmux.prefix': { ...good, ...patch } } }));
  }
  assert.throws(() => validateProfile({ schemaVersion: 2 }));
  assert.throws(() => validateProfile({ schemaVersion: 1, provider: 'not-in-this-slice' }));
});

test('interpolation does not evaluate shell syntax or recursively expand values', t => {
  const root = fixture(t);
  const profile = validateProfile({ schemaVersion: 1, bindings: { 'tmux.prefix': {
    value: '$(false); &', source: 'tmux/main.conf', sha256: hash('set -g prefix C-a\n'), verifiedAt: '2026-09-06',
  } } });
  assert.match(interpolate('{{binding.tmux.prefix}}', profile, root), /\$\(false\); &/);
});
