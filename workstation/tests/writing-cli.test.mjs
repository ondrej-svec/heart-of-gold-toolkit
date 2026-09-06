import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture, choice } from './writing-fixture.mjs';
import { validateProfile } from '../src/profile.mjs';
const CLI = fileURLToPath(new URL('../bin/workstation-guide.mjs', import.meta.url));
const invoke = (f, args, input = '') => spawnSync(process.execPath, [CLI, ...args], { env: f.env, input, encoding: 'utf8', timeout: 10000 });
const data = result => JSON.parse(result.stdout);

test('AI listing is offline, independent of Pi setup, and references cannot send', t => {
  const f = fixture(t); f.env.PATH = '/missing';
  const result = invoke(f, ['ai', 'list', '--json']);
  assert.equal(result.status, 0, result.stderr); assert.equal(data(result).actions.length, 3);
  for (const args of [['--', 'ai', 'run'], ['show', 'writing.review', '--json'], ['list', '--json']]) {
    assert.equal(invoke(f, args).status, 0); assert.equal(existsSync(join(f.root, 'capture.json')), false);
  }
});
test('CLI requires a fresh explicit confirmation and accepts source only on stdin', t => {
  const f = fixture(t);
  const prepare = invoke(f, ['ai', 'prepare', 'improve-writing', '--json']);
  assert.equal(prepare.status, 0, prepare.stderr);
  const p = data(prepare); assert.equal(p.provider, choice.provider);
  for (const args of [
    ['ai', 'run', 'improve-writing'],
    ['ai', 'run', 'improve-writing', '--expect', p.fingerprint],
    ['ai', 'run', 'improve-writing', '--send'],
    ['ai', 'run', 'improve-writing', 'PRIVATE text', '--send', '--expect', p.fingerprint],
    ['ai', 'prepare', 'improve-writing', '--send'], ['list', '--send'],
  ]) {
    const failed = invoke(f, [...args, '--json'], 'text');
    assert.notEqual(failed.status, 0); assert.equal(data(failed).ok, false);
    assert.equal(existsSync(join(f.root, 'capture.json')), false);
  }
  const input = '/llama @private\r\n  café 🙂\n';
  const result = invoke(f, ['ai', 'run', 'improve-writing', '--send', '--expect', p.fingerprint, '--json'], input);
  assert.equal(result.status, 0, result.stderr); assert.equal(data(result).text, 'Rewritten café 🙂\u2028next');
  assert.equal(JSON.parse(f.capture().input.split('\n')[1]).input, input);
});
test('CLI failure is safe JSON, and blank/oversized/invalid UTF-8 stdin never spawns', t => {
  const f = fixture(t), preparation = invoke(f, ['ai', 'prepare', 'improve-writing', '--json']);
  assert.equal(preparation.status, 0, preparation.stderr);
  const p = data(preparation);
  for (const input of ['', ' \n', 'x'.repeat(131073), Buffer.from([0xc3, 0x28])]) {
    const result = invoke(f, ['ai', 'run', 'improve-writing', '--send', '--expect', p.fingerprint, '--json'], input);
    assert.notEqual(result.status, 0); assert.equal(data(result).ok, false);
    assert.equal(existsSync(join(f.root, 'capture.json')), false);
  }
});
test('optional private writing preferences stay strict and do not require AI for reference', () => {
  assert.deepEqual(validateProfile({ schemaVersion: 1, ai: choice }).ai, choice);
  for (const ai of [{}, { ...choice, key: 'secret' }, { ...choice, thinking: 'ultra' }, { ...choice, model: 'm --tools bash' }, { ...choice, provider: 'other' }]) {
    assert.throws(() => validateProfile({ schemaVersion: 1, ai }));
  }
});
