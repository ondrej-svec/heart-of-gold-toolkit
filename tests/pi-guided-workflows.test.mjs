import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RESET_COMMAND_PATTERN,
  coerceExtractedPrompt,
  detectWorkflow,
  heuristicExtractPrompt,
  parseExtractionEnvelope,
} from '../extensions/pi/guided-workflows-core.js';

const FIXTURES_ROOT = join(process.cwd(), 'tests/fixtures/pi-guided-workflows');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadText(path) {
  return readFileSync(path, 'utf8');
}

function collectFixturePairs(dir) {
  const directory = join(FIXTURES_ROOT, dir);
  return readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((jsonFile) => {
      const base = jsonFile.slice(0, -5);
      return {
        name: `${dir}/${base}`,
        jsonPath: join(directory, jsonFile),
        textPath: join(directory, `${base}.txt`),
      };
    });
}

for (const { name, jsonPath, textPath } of [
  ...collectFixturePairs('brainstorm'),
  ...collectFixturePairs('plan'),
  ...collectFixturePairs('architect'),
]) {
  test(`heuristic fixture: ${name}`, () => {
    const manifest = loadJson(jsonPath);
    const input = loadText(textPath);
    const extracted = heuristicExtractPrompt(input);
    const prompt = coerceExtractedPrompt(manifest.workflow, extracted);

    if (manifest.expected === null) {
      assert.equal(prompt, null);
      return;
    }

    assert.ok(prompt);
    assert.equal(prompt.kind, manifest.expected.kind);
    assert.equal(prompt.question, manifest.expected.question);
    assert.deepEqual(prompt.options?.map((option) => option.label), manifest.expected.optionLabels);
  });
}

for (const { name, jsonPath, textPath } of collectFixturePairs('model')) {
  test(`model fixture: ${name}`, () => {
    const manifest = loadJson(jsonPath);
    const input = loadText(textPath);
    const parsed = parseExtractionEnvelope(input);

    assert.ok(parsed);
    assert.equal(parsed.kind, manifest.expected.kind);
    assert.equal(parsed.question, manifest.expected.question);
    assert.deepEqual(parsed.options?.map((option) => option.label), manifest.expected.optionLabels);
  });
}

test('detectWorkflow recognizes Heart of Gold entrypoints', () => {
  assert.equal(detectWorkflow('/skill:brainstorm topic'), 'brainstorm');
  assert.equal(detectWorkflow('/deep-thought-plan docs/brainstorms/foo.md'), 'plan');
  assert.equal(detectWorkflow('/architect auth redesign'), 'architect');
  assert.equal(detectWorkflow('/marvin-work docs/plans/x.md'), undefined);
});

test('RESET_COMMAND_PATTERN clears unrelated slash commands', () => {
  assert.ok(RESET_COMMAND_PATTERN.test('/marvin-work docs/plans/x.md'));
  assert.ok(RESET_COMMAND_PATTERN.test('/review src/index.ts'));
  assert.equal(RESET_COMMAND_PATTERN.test('/deep-thought-plan topic'), false);
});

test('coerceExtractedPrompt rejects low-confidence model text prompts', () => {
  const prompt = coerceExtractedPrompt('plan', {
    kind: 'text',
    question: 'What problem does this solve?',
    confidence: 'low',
  });
  assert.equal(prompt, null);
});
