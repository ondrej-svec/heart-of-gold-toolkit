import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PI_EXTENSIONS = join(ROOT, 'extensions', 'pi');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function skillName(path) {
  const text = readFileSync(join(ROOT, path, 'SKILL.md'), 'utf8');
  return text.match(/^name:\s*([^\s]+)\s*$/m)?.[1];
}

test('Pi package exports every skill emitted by an extension command', () => {
  const pkg = readJson(join(ROOT, 'package.json'));
  const emitted = new Set();
  for (const file of readdirSync(PI_EXTENSIONS).filter((name) => name.endsWith('.ts'))) {
    const source = readFileSync(join(PI_EXTENSIONS, file), 'utf8');
    for (const match of source.matchAll(/\/skill:([a-z0-9-]+)/g)) emitted.add(match[1]);
  }

  const exported = new Map(pkg.pi.skills.map((path) => [skillName(path), path]));
  assert.ok(emitted.size > 0, 'the extension probe found no emitted skill commands');
  for (const name of emitted) {
    assert.ok(exported.has(name), `/skill:${name} is emitted but its skill path is absent from package.json`);
  }

  assert.equal(exported.get('brainstorm'), './plugins/deep-thought/skills/brainstorm');
  assert.equal(exported.get('plan'), './plugins/deep-thought/skills/plan');
  assert.equal(exported.get('work'), './plugins/marvin/skills/work');
});

test('Pi package uses only the current Earendil namespace', () => {
  const pkg = readJson(join(ROOT, 'package.json'));
  assert.equal(pkg.version, '0.2.5');
  assert.deepEqual(
    Object.keys(pkg.peerDependencies).sort(),
    ['@earendil-works/pi-ai', '@earendil-works/pi-coding-agent', '@earendil-works/pi-tui', 'typebox'],
  );

  const stale = [];
  for (const file of readdirSync(PI_EXTENSIONS).filter((name) => name.endsWith('.ts'))) {
    const source = readFileSync(join(PI_EXTENSIONS, file), 'utf8');
    if (source.includes('@mariozechner/')) stale.push(file);
  }
  assert.deepEqual(stale, []);
});

test('private Pi session and todo state is excluded and blocked from publication', () => {
  assert.match(readFileSync(join(ROOT, '.npmignore'), 'utf8'), /^\.pi\/$/m);
  assert.ok(readFileSync(join(ROOT, 'scripts/check-publish-safety.py'), 'utf8').includes('(^|/)\\.pi(/|$)'));
});

test('the Pi package entrypoint is singular', () => {
  const pkg = readJson(join(ROOT, 'package.json'));
  assert.deepEqual(pkg.pi.extensions, ['./extensions/pi']);
});
