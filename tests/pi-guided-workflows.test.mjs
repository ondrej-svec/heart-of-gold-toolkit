import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESET_COMMAND_PATTERN,
  coerceExtractedPrompt,
  detectWorkflow,
  heuristicExtractPrompt,
  parseExtractionEnvelope,
} from '../extensions/pi/guided-workflows-core.js';

const fixtures = [
  {
    name: 'brainstorm numbered options become single choice',
    workflow: 'brainstorm',
    input: `Requirements seem fairly clear. Should we skip directly to planning or brainstorm first?\n\n1. Go to /plan (Recommended) — Requirements are clear; skip brainstorming and start planning\n2. Brainstorm first — Explore the problem space before committing to an approach`,
    expect: {
      kind: 'single_choice',
      question: 'Requirements seem fairly clear. Should we skip directly to planning or brainstorm first?',
      optionLabels: ['Go to /plan (Recommended)', 'Brainstorm first'],
    },
  },
  {
    name: 'architect yes/no chooser becomes single choice',
    workflow: 'architect',
    input: `Found brainstorm: notifications revamp. Use this as input?\n\n1. Yes, use it\n2. Different input`,
    expect: {
      kind: 'single_choice',
      question: 'Found brainstorm: notifications revamp. Use this as input?',
      optionLabels: ['Yes, use it', 'Different input'],
    },
  },
  {
    name: 'plan free text question stays plain when only low-confidence heuristic exists',
    workflow: 'plan',
    input: `We can proceed once the scope is clear.\n\nWhat problem does this solve?`,
    expect: null,
  },
];

for (const fixture of fixtures) {
  test(fixture.name, () => {
    const extracted = heuristicExtractPrompt(fixture.input);
    const prompt = coerceExtractedPrompt(fixture.workflow, extracted);
    if (fixture.expect === null) {
      assert.equal(prompt, null);
      return;
    }

    assert.ok(prompt);
    assert.equal(prompt.kind, fixture.expect.kind);
    assert.equal(prompt.question, fixture.expect.question);
    assert.deepEqual(prompt.options?.map((option) => option.label), fixture.expect.optionLabels);
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

test('parseExtractionEnvelope accepts markdown-wrapped JSON', () => {
  const parsed = parseExtractionEnvelope(`\n\
\`\`\`json
{ "kind": "single_choice", "question": "Pick one", "options": [
  { "label": "A" },
  { "label": "B", "description": "Second" }
], "confidence": "high" }
\`\`\`
`);

  assert.ok(parsed);
  assert.equal(parsed.kind, 'single_choice');
  assert.equal(parsed.options.length, 2);
});

test('coerceExtractedPrompt rejects low-confidence model text prompts', () => {
  const prompt = coerceExtractedPrompt('plan', {
    kind: 'text',
    question: 'What problem does this solve?',
    confidence: 'low',
  });
  assert.equal(prompt, null);
});
