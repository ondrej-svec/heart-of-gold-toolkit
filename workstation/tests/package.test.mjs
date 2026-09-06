import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { executable } from '../src/process.mjs';
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
  assert.ok(files.includes('src/commands/workstation.ts'));
  for (const file of moduleFiles) {
    assert.match(file, /^workstation\/(?:package\.json|README\.md|(?:bin|src)\/[a-z-]+\.mjs|catalog\/(?:index\.json|cards\/[a-z-]+\.md)|docs\/[a-z-]+\.md|scripts\/backup\.mjs)$/);
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
});
