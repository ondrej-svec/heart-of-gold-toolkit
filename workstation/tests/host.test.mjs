import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executable } from '../src/process.mjs';
import { sha256 } from '../src/profile.mjs';
const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const HOST = join(ROOT, 'src/index.ts');
const CLI = join(ROOT, 'workstation/bin/workstation-guide.mjs');
const bun = executable('bun');
function fixture(t) {
  const home = mkdtempSync(join(tmpdir(), 'guide host '));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, 'bin'));
  symlinkSync(process.execPath, join(home, 'bin/node'));
  return { home, env: { HOME: home, PATH: join(home, 'bin'), XDG_CONFIG_HOME: join(home, '.config'), TERM: 'dumb' } };
}
const run = (binary, args, env, cwd) => spawnSync(binary, args, { env, cwd, input: 'literal stdin\n', encoding: 'utf8', timeout: 8000 });

test('host forwards raw arguments before citty help interception, with direct output/exit parity', { skip: !bun }, t => {
  const { home, env } = fixture(t);
  writeFileSync(join(home, '.env'), 'NODE_OPTIONS=--require /invalid/dotenv/injection\n');
  for (const args of [[], ['--help'], ['--version'], ['list', '--json'], ['show', 'shell.find-file', '--json'],
    ['return to my workspace'], ['--', '--help'], ['--json', '--', 'doctor'], ['show', 'invalid'], ['--', '$(touch nope); & |'], ['--wat']]) {
    const direct = run(process.execPath, [CLI, ...args], env, home);
    const host = run(bun, ['--no-env-file', HOST, 'workstation', ...args], env, home);
    assert.equal(host.status, direct.status, args.join(' ') + host.stderr);
    assert.equal(host.stdout, direct.stdout, args.join(' '));
    assert.equal(host.stderr, direct.stderr, args.join(' '));
  }
});

test('host keeps existing root/list/targets commands operational', { skip: !bun }, t => {
  const { home, env } = fixture(t);
  for (const args of [['--help'], ['list', '--help'], ['targets', '--help']]) {
    const result = run(bun, ['--no-env-file', HOST, ...args], env, home);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.length);
  }
});

for (const [signal, stubborn] of [['SIGTERM', false], ['SIGTERM', true], ['SIGINT', true]])
test(`host forwards ${signal} and reaps ${stubborn ? 'stubborn' : 'cooperative'} owned processes`, { skip: !bun, timeout: 10000 }, async t => {
  const { home, env } = fixture(t);
  const marker = join(home, 'pid');
  const tldr = join(home, 'bin/tldr');
  writeFileSync(tldr, `#!${process.execPath}\n${stubborn ? `process.on('${signal}',()=>{});` : ''}require('node:fs').writeFileSync(${JSON.stringify(marker)},String(process.pid));setInterval(()=>{},1000);\n`, { mode: 0o755 });
  const profile = join(home, 'profile.json');
  writeFileSync(profile, JSON.stringify({ schemaVersion:1, tldr:{client:'tldr-c-1.6.1',sha256:sha256(readFileSync(tldr))} }));
  const child = spawn(bun, ['--no-env-file', HOST, 'workstation', '--profile', profile, 'cmd', 'fzf'], { env, cwd: home, stdio: 'ignore' });
  t.after(() => { try { child.kill('SIGKILL'); } catch {} });
  const closed = new Promise(resolve => child.once('close', (code, signal) => resolve({code,signal})));
  const until = Date.now() + 4000;
  while (!existsSync(marker) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(existsSync(marker), 'owned optional process started');
  const pid = Number(readFileSync(marker, 'utf8'));
  t.after(() => { try { process.kill(pid, 'SIGKILL'); } catch {} });
  child.kill(signal);
  assert.equal((await closed).code, signal === 'SIGTERM' ? 143 : 130);
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});
