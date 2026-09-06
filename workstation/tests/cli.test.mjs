import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../src/profile.mjs';
import { toolEnv, pick, present } from '../src/presentation.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(ROOT, 'bin/workstation-guide.mjs');
function home(t) {
  const root = mkdtempSync(join(tmpdir(), 'offline guide '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'bin'));
  return { root, env: { HOME: root, XDG_CONFIG_HOME: join(root, 'config'), PATH: join(root, 'bin'), TERM: 'xterm-256color' } };
}
function run(env, args = [], input = '') {
  return spawnSync(process.execPath, [CLI, ...args], { env, input, encoding: 'utf8', timeout: 5000 });
}
function fake(root, name, code) {
  const file = join(root, 'bin', name);
  writeFileSync(file, `#!${process.execPath}\n${code}\n`, { mode: 0o755 });
  return file;
}

test('root is broad, printable and never waits on non-TTY stdin', t => {
  const { root, env } = home(t);
  const result = run(env, [], 'not a command\n');
  assert.equal(result.status, 0, result.stderr);
  for (const title of ['Shell &', 'Find files', 'tmux', 'Neovim', 'AI-assisted writing', 'cockpits', 'Practise', 'doctor']) assert.ok(result.stdout.includes(title), title);
  assert.match(result.stdout, /Nothing runs/);
  assert.deepEqual(readdirSync(root).sort(), ['bin']);
});

test('reference/search/learn/doctor work with macOS network access denied', { skip: process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec') }, t => {
  const { env } = home(t);
  for (const args of [[], ['find a file'], ['learn', 'shell.find-file', '--hint', '1'], ['doctor', '--json']]) {
    const result = spawnSync('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)(deny network*)', process.execPath, CLI, ...args], {
      env, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.length);
  }
});

test('queries search intentions; opening reference and JSON need no optional binaries', t => {
  const { env } = home(t);
  const found = run(env, ['find a file', '--json']);
  assert.equal(found.status, 0, found.stderr);
  const data = JSON.parse(found.stdout);
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.cards[0].id, 'shell.find-file');
  const card = run(env, ['show', 'shell.find-file', '--json']);
  assert.equal(card.status, 0, card.stderr);
  assert.match(JSON.parse(card.stdout).card.content, /unknown binding/);
  assert.equal(JSON.parse(card.stdout).card.tools[0].status, 'missing');
});

test('read-only doctor checks presence, not tool execution or auth', t => {
  const { root, env } = home(t);
  const marker = join(root, 'executed');
  for (const name of ['fzf', 'glow', 'tldr', 'pi', 'nvim', 'cockpit']) fake(root, name, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'bad');`);
  const result = run(env, ['doctor', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const info = JSON.parse(result.stdout);
  assert.equal(info.profile, 'absent');
  assert.equal(info.tools.find(tool => tool.name === 'pi').status, 'present');
  assert.ok(info.bindings.every(binding => binding.status === 'unknown'));
  assert.equal(existsSync(marker), false);
  assert.deepEqual(readdirSync(root), ['bin']);
});

test('piped lessons, queries and JSON never launch Neovim even when it is installed', t => {
  const { root, env } = home(t);
  const marker = join(root, 'editor-ran');
  fake(root, 'nvim', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'bad');`);
  for (const args of [['show', 'nvim.modes'], ['show', 'nvim.modes', '--json'], ['find a file'], ['list', '--json'], ['show', 'nvim.modes', '--plain']]) {
    const result = run(env, args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(marker), false);
  }
  assert.deepEqual(readdirSync(root), ['bin']);
});

test('invalid profile errors redact private JSON snippets and do not fall back silently', t => {
  const { root, env } = home(t);
  const file = join(root, 'bad.json');
  writeFileSync(file, '{"private-secret": malformed-SENSITIVE-CONTENT}');
  const result = run(env, ['--profile', file, 'list', '--json']);
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /SENSITIVE-CONTENT|private-secret/);
  assert.equal(JSON.parse(result.stdout).ok, false);
});

test('reserved commands reject invalid arguments; literal -- preserves query text', t => {
  const { root, env } = home(t);
  for (const args of [['show'], ['show', 'no-such-id'], ['--wat'], ['list', 'ignored'], ['ai', 'run', 'anything'], ['learn', '--hint', '-1']]) {
    assert.equal(run(env, args).status, 1, args.join(' '));
  }
  const marker = join(root, 'unsafe');
  const result = run(env, ['--', `$(touch '${marker}'); | &`, '--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No matching/);
  assert.equal(existsSync(marker), false);
  for (const word of ['doctor', 'ai', 'show']) {
    const literal = run(env, ['--json', '--', word]);
    assert.equal(literal.status, 0, literal.stderr);
    assert.ok(Array.isArray(JSON.parse(literal.stdout).cards));
  }
});

test('manual exercise hints are progressive and no learning state is written', t => {
  const { root, env } = home(t);
  const before = run(env, ['learn', 'shell.find-file']);
  const hint = run(env, ['learn', 'shell.find-file', '--hint', '1']);
  assert.equal(before.status, 0, before.stderr);
  assert.equal(hint.status, 0, hint.stderr);
  assert.doesNotMatch(before.stdout, /Start at your shell prompt/);
  assert.match(hint.stdout, /Start at your shell prompt/);
  assert.doesNotMatch(hint.stdout, /Type nvim followed/);
  assert.deepEqual(readdirSync(root), ['bin']);
});

test('tool environment drops inherited executable hooks, credentials and pagers', () => {
  const env = toolEnv({ HOME: '/tmp/home', PATH: '/usr/bin', TERM: 'xterm', FZF_DEFAULT_OPTS: '--bind start:execute(bad)',
    FZF_DEFAULT_OPTS_FILE: '/tmp/bad', FZF_DEFAULT_COMMAND: 'bad', NODE_OPTIONS: '--require bad', PAGER: 'bad',
    PI_SESSION_ID: 'bad', OPENAI_API_KEY: 'bad', GLOW_STYLE: 'https://bad', BASH_ENV: '/tmp/bad' });
  assert.deepEqual(Object.keys(env).sort(), ['HOME', 'PATH', 'TERM']);
});

test('fzf accepts only offered IDs, cancels cleanly, and never interpolates commands', async t => {
  const { root, env } = home(t);
  const cards = [{ id: 'shell.find-file', title: 'Find a file', chapter: 'finding', synonyms: ['without typing a path'] }];
  fake(root, 'fzf', `let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{if(Object.keys(process.env).some(k=>k.startsWith('FZF_')))process.exit(3);process.stdout.write(s.split('\\n')[0]+'\\n');});`);
  assert.equal((await pick(cards, { ...env, FZF_DEFAULT_OPTS: 'bad' })).id, 'shell.find-file');
  fake(root, 'fzf', `process.stdout.write('evil-id\\tbad\\n');`);
  assert.equal(await pick(cards, env), undefined);
  fake(root, 'fzf', 'process.exit(130);');
  assert.equal(await pick(cards, env), null);
});

test('Glow is explicit, stdin-only, disposable and never gets pager/config hooks', async t => {
  const { root, env } = home(t);
  const marker = join(root, 'glow-record.json');
  fake(root, 'glow', `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(marker)}, JSON.stringify({args:process.argv.slice(2),home:process.env.HOME,cwd:process.cwd(),env:process.env}));let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(s));`);
  const body = '# hello\n';
  assert.equal(await present(body, { env, glow: false, tty: true }), body);
  assert.equal(existsSync(marker), false);
  assert.equal(await present(body, { env: { ...env, PAGER: 'bad', GLOW_CONFIG_HOME: '/private' }, glow: true, tty: true }), body);
  const info = JSON.parse(readFileSync(marker));
  assert.equal(info.args.at(-1), '-');
  assert.equal(info.env.PAGER, undefined);
  assert.equal(info.home, info.cwd);
  assert.equal(existsSync(info.home), false);
  assert.notEqual(info.home, root);
  fake(root, 'glow', `process.stdout.write('X'.repeat(2*1024*1024));`);
  assert.equal(await present(body, { env, glow: true, tty: true }), body, 'bounded-output failure must fall back, not cancel');
  assert.equal(process.exitCode, undefined);
});

test('cmd fails closed for missing/unreviewed tldr; a pinned C client gets update-disabled env', t => {
  const { root, env } = home(t);
  assert.equal(run(env, ['cmd', 'fzf']).status, 1);
  const marker = join(root, 'tldr-record.json');
  const binary = fake(root, 'tldr', `require('node:fs').writeFileSync(${JSON.stringify(marker)},JSON.stringify({args:process.argv.slice(2),disabled:process.env.TLDR_AUTO_UPDATE_DISABLED}));process.stdout.write('cached examples\\n');`);
  assert.equal(run(env, ['cmd', 'fzf']).status, 1);
  assert.equal(existsSync(marker), false);
  const profile = join(root, 'reviewed.json');
  writeFileSync(profile, JSON.stringify({schemaVersion:1,tldr:{client:'tldr-c-1.6.1',sha256:sha256(readFileSync(binary))}}));
  const result = run(env, ['--profile', profile, 'cmd', 'git', 'status']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /cached examples/);
  assert.deepEqual(JSON.parse(readFileSync(marker)), {args:['git-status'],disabled:'1'});
  assert.equal(run(env, ['--profile', profile, 'cmd', '--', '--update']).status, 1);
  writeFileSync(binary, '#!/bin/sh\nexit 0\n');
  assert.equal(run(env, ['--profile', profile, 'cmd', 'fzf']).status, 1);
});
