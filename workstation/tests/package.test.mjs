import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { executable } from '../src/process.mjs';
import { fixture } from './writing-fixture.mjs';
const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const npm = executable('npm');

test('exact host package payload allows only module assets and runs independently of Bun/Pi', { skip: !npm, timeout: 30000 }, t => {
  const home = mkdtempSync(join(tmpdir(), 'guide package '));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const env = { HOME: home, PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, npm_config_cache: join(home, 'npm-cache') };
  const pack = spawnSync(npm, ['pack', '--dry-run', '--ignore-scripts', '--offline', '--json'], { cwd: ROOT, env, encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(pack.status, 0, pack.stderr);
  const files = JSON.parse(pack.stdout)[0].files.map(file => file.path);
  const moduleFiles = files.filter(file => file.startsWith('workstation/'));
  assert.ok(moduleFiles.includes('workstation/bin/workstation-guide.mjs'));
  assert.ok(moduleFiles.includes('workstation/docs/interface.md'));
  assert.ok(moduleFiles.includes('workstation/integrations/zsh/help.zsh'));
  assert.ok(moduleFiles.includes('workstation/integrations/nvim/workstation-help.lua'));
  assert.ok(moduleFiles.includes('workstation/integrations/nvim/workstation-ai.lua'));
  assert.ok(files.includes('src/commands/workstation.ts'));
  for (const file of ['LICENSE', 'SOURCE.json', 'improve_writing/system.md', 'analyze_prose/system.md', 'summarize_micro/system.md']) {
    assert.ok(moduleFiles.includes('workstation/vendor/fabric/' + file), 'include pinned prompt provenance: ' + file);
  }
  for (const file of moduleFiles) {
    assert.match(file, /^workstation\/(?:package\.json|README\.md|(?:bin|src)\/[a-z-]+\.mjs|catalog\/(?:index\.json|cards\/[a-z-]+\.md)|docs\/[a-z-]+\.md|integrations\/(?:zsh\/help\.zsh|nvim\/workstation-(?:help|ai)\.lua)|vendor\/fabric\/(?:LICENSE|SOURCE\.json|(?:improve_writing|analyze_prose|summarize_micro)\/system\.md)|scripts\/backup\.mjs)$/);
    assert.doesNotMatch(file, /(?:auth|profile\.json|sessions|backups|state|tests|fixtures|\.env)/);
    assert.equal(isAbsolute(file), false);
    const target = join(home, 'payload', file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(ROOT, file), target);
  }
  const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json')));
  assert.equal(rootPkg.bin['workstation-guide'], 'workstation/bin/workstation-guide.mjs');
  const result = spawnSync(process.execPath, [join(home, 'payload', rootPkg.bin['workstation-guide']), 'show', 'tmux.workspaces', '--json'], {
    env: { HOME: home, PATH: join(home, 'no-programs') }, cwd: home, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).card.id, 'tmux.workspaces');
  assert.equal(JSON.parse(result.stdout).card.tools[0].status, 'missing');
  const actions = spawnSync(process.execPath, [join(home, 'payload', rootPkg.bin['workstation-guide']), 'ai', 'list', '--json'], {
    env: { HOME: home, PATH: join(home, 'no-programs') }, cwd: home, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(actions.status, 0, actions.stderr); assert.equal(JSON.parse(actions.stdout).actions.length, 3);
  const fake = fixture(t);
  const packaged = args => spawnSync(process.execPath, [join(home, 'payload', rootPkg.bin['workstation-guide']), ...args], {
    env: fake.env, cwd: home, input: 'Synthetic packaged input.', encoding: 'utf8', timeout: 5000,
  });
  const prepared = packaged(['ai', 'prepare', 'improve-writing', '--json']);
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr);
  const sent = packaged(['ai', 'run', 'improve-writing', '--send', '--expect', JSON.parse(prepared.stdout).fingerprint, '--json']);
  assert.equal(sent.status, 0, sent.stdout + sent.stderr);
  assert.equal(JSON.parse(sent.stdout).text, 'Rewritten café 🙂\u2028next');
  const zsh = executable('zsh');
  if (zsh) {
    const shell = spawnSync(zsh, ['-f', '-c', 'source "$1"\nhelp -l --json', 'packaged-guide', join(home, 'payload/workstation/integrations/zsh/help.zsh')], {
      env: { HOME: home, PATH: dirname(process.execPath) }, cwd: home, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(shell.status, 0, shell.stderr);
    assert.equal(JSON.parse(shell.stdout).cards[0].id, 'shell.build-command');
  }
});
