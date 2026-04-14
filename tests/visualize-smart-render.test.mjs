import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const script = 'plugins/babel-fish/skills/visualize/scripts/smart-render.js';

function render(inputPath) {
  const dir = mkdtempSync(join(tmpdir(), 'hog-visualize-'));
  const out = join(dir, 'view.html');
  execFileSync('node', [script, inputPath, '--out', out], { stdio: 'inherit' });
  const html = readFileSync(out, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  return html;
}

test('safe default render is outline-oriented unless the agent forces a mode', () => {
  const html = render('docs/plans/2026-04-14-feat-smart-visualize-html-plan.md');
  assert.match(html, /safe default/i);
  assert.match(html, /Mode: outline/);
});

test('forced roadmap mode renders a plan dashboard instead of markdown-shaped output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hog-visualize-'));
  const out = join(dir, 'view.html');
  execFileSync('node', [script, 'docs/plans/2026-04-14-feat-smart-visualize-html-plan.md', '--mode', 'roadmap', '--out', out], { stdio: 'inherit' });
  const html = readFileSync(out, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  assert.match(html, /Mode: roadmap/);
  assert.match(html, /Plan Dashboard/);
  assert.match(html, /Execution Summary/);
  assert.match(html, /Priority Lanes/);
  assert.match(html, /Workstreams & Tasks/);
  assert.match(html, /Key Sequencing/);
  assert.match(html, /Source Appendix/);
  assert.doesNotMatch(html, /<h2>Implementation Tasks<\/h2>/);
});
