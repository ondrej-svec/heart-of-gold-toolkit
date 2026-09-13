// Named failure: post-turn extraction converted mandatory lists into single-choice
// answers, even after the extraction model returned a high-confidence `none`.
// Exercise the registered package entrypoint, not a replacement parser. No real UI,
// model, file mutation, publication, or skill execution occurs in this harness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import heartOfGold from '../extensions/pi/index.ts';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/pi-interactions/assistant-turns.json', import.meta.url), 'utf8'));
const launchers = [
  ['deep-thought-brainstorm', 'brainstorm', 'Brainstorm topic'],
  ['deep-thought-plan', 'plan', 'Plan topic or brainstorm path'],
  ['deep-thought-architect', 'architect', 'Architect input (feature or brainstorm path)'],
  ['marvin-work', 'work', 'Plan path'],
  ['share-html', 'share-html', 'HTML file or static site directory'],
  ['share-server-setup', 'share-server-setup'],
  ['share-server-control', 'share-server-control'],
];

function harness({ mode = 'tui', idle = true, editorAnswer } = {}) {
  const events = new Map(), commands = new Map(), effects = [];
  const record = (kind, result) => (...args) => { effects.push({ kind, args }); return result; };
  const pi = {
    on(name, handler) { events.set(name, [...(events.get(name) ?? []), handler]); },
    registerCommand(name, command) {
      assert.equal(commands.has(name), false, `Duplicate command ${name}`);
      commands.set(name, command);
    },
    sendUserMessage: record('message'),
  };
  const ctx = {
    mode, hasUI: mode === 'tui' || mode === 'rpc',
    isIdle: () => idle, hasPendingMessages: () => !idle,
    get model() { effects.push({ kind: 'model access' }); return undefined; },
    ui: {
      notify: record('notify'),
      editor: record('editor', Promise.resolve(editorAnswer)),
      select: record('select', Promise.resolve(undefined)),
      custom: record('custom', Promise.resolve(null)),
    },
  };
  heartOfGold(pi);
  return {
    effects, commands,
    async emit(name, event) {
      for (const handler of events.get(name) ?? []) await handler(event, ctx);
    },
    async launch(name, args = '') {
      assert.ok(commands.has(name), `Missing command ${name}`);
      await commands.get(name).handler(args, ctx);
    },
  };
}

for (const mode of ['tui', 'rpc', 'print', 'json']) {
  for (const fixture of fixtures) {
    test(`${mode}: prose is not an interaction — ${fixture.name}`, async () => {
      for (const idle of [true, false]) {
        const h = harness({ mode, idle });
        for (const text of [
          '/skill:brainstorm topic', '/deep-thought-plan topic', '/skill:architect topic',
          'Now implement the agreed plan.', '/review src/file.ts',
        ]) {
          await h.emit('input', { text, source: 'interactive' });
          const message = { role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: fixture.text }] };
          await h.emit('before_agent_start', { prompt: text });
          await h.emit('agent_start', {});
          await h.emit('turn_end', { message, toolResults: [] });
          await h.emit('agent_end', { messages: [message] });
          await h.emit('agent_settled', {});
          await h.emit('session_tree', {});
        }
        assert.deepEqual(h.effects, [], 'No prompt, model lookup, or synthetic answer may be emitted');
      }
    });
  }
}

test('the package has only deliberate launch commands; no retired debug or generic answer command', () => {
  const h = harness();
  assert.deepEqual([...h.commands.keys()].sort(), launchers.map(([name]) => name).sort());
});

for (const [command, skill, editorTitle] of launchers) {
  for (const idle of [true, false]) {
    test(`${command}: explicitly expands the intended skill (${idle ? 'idle' : 'queued'})`, async () => {
      const h = harness({ idle });
      await h.launch(command, '  sample input  ');
      assert.deepEqual(h.effects.filter(({ kind }) => kind === 'message'), [{
        kind: 'message', args: [`/skill:${skill} sample input`, {
          ...(idle ? {} : { deliverAs: 'followUp' }), expandPromptTemplates: true,
        }],
      }]);
      assert.equal(h.effects.some(({ kind }) => ['custom', 'editor', 'select', 'model access'].includes(kind)), false);
    });
  }
  if (!editorTitle) continue;
  for (const mode of ['tui', 'rpc']) {
    test(`${command}: ${mode} retains its explicit input dialog and cancellation`, async () => {
      for (const editorAnswer of [undefined, '', '   ', '  my input  ']) {
        const h = harness({ mode, editorAnswer });
        await h.launch(command);
        assert.deepEqual(h.effects.filter(({ kind }) => kind === 'editor'), [{ kind: 'editor', args: [editorTitle, ''] }]);
        const messages = h.effects.filter(({ kind }) => kind === 'message');
        assert.deepEqual(messages, editorAnswer?.trim() ? [{
          kind: 'message', args: [`/skill:${skill} my input`, { expandPromptTemplates: true }],
        }] : []);
      }
    });
  }
}

test('launching a workflow does not enable post-turn prompts', async () => {
  const h = harness();
  await h.launch('deep-thought-plan', 'sample');
  h.effects.length = 0;
  await h.emit('input', { text: '/skill:plan sample', source: 'extension' });
  for (const { text } of fixtures) {
    await h.emit('agent_end', { messages: [{ role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text }] }] });
  }
  assert.deepEqual(h.effects, []);
});
