import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executable } from '../src/process.mjs';

const zsh = executable('zsh');
const wrapper = fileURLToPath(new URL('../integrations/zsh/help.zsh', import.meta.url));
function fixture(t, { node = true, entry = true } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'guide zsh '));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const module = join(home, 'toolkit with spaces/workstation');
  mkdirSync(join(module, 'integrations/zsh'), { recursive: true });
  mkdirSync(join(module, 'bin'));
  mkdirSync(join(home, 'executables'));
  if (node) symlinkSync(process.execPath, join(home, 'executables/node'));
  const script = join(module, 'integrations/zsh/help.zsh');
  cpSync(wrapper, script);
  if (entry) writeFileSync(join(module, 'bin/workstation-guide.mjs'), "console.log(JSON.stringify(process.argv.slice(2)));process.exitCode=Number(process.env.TEST_EXIT || 0);\n");
  return { home, script, env: { HOME: home, PATH: join(home, 'executables') } };
}
function run(context, code, args = [], extraEnv = {}) {
  return spawnSync(zsh, ['-f', '-c', code, 'zsh-test', context.script, ...args], { cwd: context.home, env: { ...context.env, ...extraEnv }, encoding: 'utf8', timeout: 5000 });
}

test('zsh help safely replaces an existing alias and repeats sourcing without launching tldr', { skip: !zsh }, t => {
  const context = fixture(t);
  const result = run(context, `alias help='print WRONG'; function tldr { print kept; }
source "$1"
source "$1"
help -l
whence -w help
tldr`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '["-l"]\nhelp: function\nkept\n');
});

test('zsh forwarding survives spaces, changed cwd, literal metacharacters and exit status', { skip: !zsh }, t => {
  const context = fixture(t);
  const values = ['--', 'find a file', '$(touch NEVER)', ';', '[x]', '雪'];
  const result = run(context, `source "$1"
shift
cd /
help "$@"`, values, { TEST_EXIT: '7' });
  assert.equal(result.status, 7, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), values);
});

test('missing Node or relocated entry returns an actionable error without exiting the shell', { skip: !zsh }, t => {
  for (const missing of ['node', 'entry']) {
    const context = fixture(t, { [missing]: false });
    const result = run(context, `source "$1"
help
print status=$?
print shell-still-alive`);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'status=127\nshell-still-alive\n');
    assert.match(result.stderr, missing === 'node' ? /Node/ : /entry/);
    assert.doesNotMatch(result.stdout + result.stderr, /MODULE_NOT_FOUND/);
  }
});
