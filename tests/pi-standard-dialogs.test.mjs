import test from 'node:test';
import assert from 'node:assert/strict';

import { requestStandardDialog } from '../extensions/pi/guided-workflows-core.js';

test('RPC single-choice prompts use the standard select dialog', async () => {
  const calls = [];
  const answer = await requestStandardDialog(
    {
      kind: 'single_choice',
      question: 'Which path?',
      context: 'Choose one now.',
      options: [{ label: 'Safe' }, { label: 'Fast' }],
    },
    {
      select: async (title, options) => {
        calls.push({ method: 'select', title, options });
        return 'Safe';
      },
      editor: async () => assert.fail('single choice must not open an editor'),
    },
  );

  assert.equal(answer, 'Safe');
  assert.deepEqual(calls, [
    { method: 'select', title: 'Which path?\n\nChoose one now.', options: ['Safe', 'Fast'] },
  ]);
});

test('RPC text prompts use the standard editor dialog and trim the answer', async () => {
  const calls = [];
  const answer = await requestStandardDialog(
    { kind: 'text', question: 'What happened?', context: 'Use observed behavior.' },
    {
      select: async () => assert.fail('text prompt must not open a select'),
      editor: async (title, prefill) => {
        calls.push({ method: 'editor', title, prefill });
        return '  The test failed.  ';
      },
    },
  );

  assert.equal(answer, 'The test failed.');
  assert.deepEqual(calls, [
    { method: 'editor', title: 'What happened?\n\nUse observed behavior.', prefill: '' },
  ]);
});

test('cancelled or empty standard dialogs return null', async () => {
  const single = await requestStandardDialog(
    { kind: 'single_choice', question: 'Choose', options: [{ label: 'A' }, { label: 'B' }] },
    { select: async () => undefined, editor: async () => undefined },
  );
  const text = await requestStandardDialog(
    { kind: 'text', question: 'Answer' },
    { select: async () => undefined, editor: async () => '   ' },
  );
  assert.equal(single, null);
  assert.equal(text, null);
});
