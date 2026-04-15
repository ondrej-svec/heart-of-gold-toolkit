import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findHeartOfGoldPiPackageInstalls } from '../src/utils/pi-package-detection.js';

function withTempHome(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'hog-pi-detect-'));
  const previousHome = process.env.HOME;
  process.env.HOME = tempRoot;

  try {
    fn(tempRoot);
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

test('detects npm package installs from global Pi settings', () => {
  withTempHome((home) => {
    const settingsDir = join(home, '.pi', 'agent');
    mkdirSync(settingsDir, { recursive: true });
    writeFileSync(
      join(settingsDir, 'settings.json'),
      JSON.stringify({ packages: ['npm:@heart-of-gold/toolkit'] }, null, 2),
    );

    const matches = findHeartOfGoldPiPackageInstalls(home);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].source, 'npm:@heart-of-gold/toolkit');
  });
});

test('detects local path package installs from project Pi settings', () => {
  withTempHome((home) => {
    const projectRoot = join(home, 'project');
    const packageRoot = join(projectRoot, 'vendor', 'hog');
    const nestedStartDir = join(projectRoot, 'apps', 'cli');
    mkdirSync(join(projectRoot, '.pi'), { recursive: true });
    mkdirSync(packageRoot, { recursive: true });
    mkdirSync(nestedStartDir, { recursive: true });

    writeFileSync(
      join(packageRoot, 'package.json'),
      JSON.stringify({ name: '@heart-of-gold/toolkit' }, null, 2),
    );
    writeFileSync(
      join(projectRoot, '.pi', 'settings.json'),
      JSON.stringify({ packages: ['../vendor/hog'] }, null, 2),
    );

    const matches = findHeartOfGoldPiPackageInstalls(nestedStartDir);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].source, '../vendor/hog');
  });
});

test('ignores unrelated npm packages', () => {
  withTempHome((home) => {
    const settingsDir = join(home, '.pi', 'agent');
    mkdirSync(settingsDir, { recursive: true });
    writeFileSync(
      join(settingsDir, 'settings.json'),
      JSON.stringify({ packages: ['npm:@someone/else'] }, null, 2),
    );

    const matches = findHeartOfGoldPiPackageInstalls(home);
    assert.deepEqual(matches, []);
  });
});
