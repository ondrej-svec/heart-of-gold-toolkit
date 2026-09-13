import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/pi-runtime.mjs';
import { normalizeQuestion, createController, outcome } from '../extensions/pi/hog-ask-core.mjs';
import { createInteractions, askRpc } from '../extensions/pi/hog-ask-runtime.mjs';
const { default: extension, presentTui } = await import('../extensions/pi/hog-ask.ts');
const { AskSchema } = await import('../extensions/pi/hog-ask-schema.ts');
const { Check } = await import('typebox/value');

const decision = { id: 'audience', purpose: 'decision', title: 'Rollout', question: 'Who gets first access?', context: 'One pilot release.', options: [
  { id: 'internal', label: 'Internal', description: 'Smaller pilot.' }, { id: 'public', label: 'Public', description: 'Wider reach.' },
], recommendation: { optionId: 'internal', reason: 'Lower risk.' } };
const approval = { id: 'scope-r1', purpose: 'approval', title: 'Implement plan', question: 'Approve this scope?', scope: { action: 'Implement all three tasks. Excludes publishing.', artifactPath: 'docs/plans/test.md', revision: 'r1' } };
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise((resolve) => setImmediate(resolve));
function scripted(...responses) {
  const calls = [];
  const call = async (method, title, arg, options) => {
    calls.push({ method, title, arg, options });
    assert.ok(options.signal instanceof AbortSignal);
    assert.ok(responses.length, `Unexpected ${method}`);
    const answer = responses.shift();
    return typeof answer === 'function' ? answer(arg) : answer;
  };
  return { calls, select: (...args) => call('select', ...args), input: (...args) => call('input', ...args) };
}
const option = (id) => (labels) => labels.find((label) => label.startsWith(`Option [${id}]:`));
const action = (name) => `Action: ${name}`;
const ctx = (ui, mode = 'rpc') => ({ ui, mode, hasUI: ['tui', 'rpc'].includes(mode), sessionManager: { getSessionId: () => 'session', getLeafId: () => 'branch' } });
function registered() {
  const hooks = new Map(); let tool;
  extension({ on: (name, fn) => hooks.set(name, fn), registerTool: (value) => { tool = value; } });
  return { tool, hooks };
}

test('schema uses an ordinary enum and runtime validates cross-field/normalized identity rules', () => {
  assert.equal(Check(AskSchema, decision), true);
  assert.equal(Check(AskSchema, approval), true);
  assert.deepEqual(AskSchema.properties.purpose.enum, ['decision', 'approval']);
  for (const change of [
    { options: [] }, { options: [decision.options[0]] }, { options: [...decision.options, ...decision.options, decision.options[0]] },
    { id: '' }, { id: '../x' }, { title: '  ' }, { question: '\x1b[31m hidden' }, { scope: { action: 'wrong purpose' } },
    { options: [{ ...decision.options[0] }, { ...decision.options[1], id: 'internal' }] },
    { options: [{ ...decision.options[0], label: 'Ａ   B' }, { ...decision.options[1], label: 'a b' }] },
    { recommendation: { optionId: 'missing', reason: 'no such ID' } }, { selected: 'internal' },
  ]) assert.throws(() => normalizeQuestion({ ...decision, ...change }), JSON.stringify(change));
  for (const change of [{ scope: undefined }, { recommendation: decision.recommendation }, { options: decision.options }]) {
    assert.throws(() => normalizeQuestion({ ...approval, ...change }));
  }
  const { tool } = registered();
  assert.equal(tool.name, 'hog_ask'); assert.equal(tool.executionMode, 'sequential');
  assert.ok(tool.promptGuidelines.every((text) => text.includes('hog_ask')));
});

test('controller has no preselection and only a reviewed, unqualified approve grants approval', () => {
  for (const id of ['approve', 'revise', 'pause']) {
    for (const note of ['', 'thanks', 'yes, but test first']) {
      const c = createController(normalizeQuestion(approval));
      assert.equal(c.state.answer, null); assert.throws(() => c.submit());
      c.choose(id); c.editNote(); c.saveText(note);
      const result = c.submit();
      assert.equal(result.details.approved, id === 'approve' && !note);
      assert.equal(result.details.status, note ? 'needs_discussion' : 'answered');
      assert.equal(result.details.answer.optionId, id);
      assert.match(result.content[0].text, /Excludes publishing/);
    }
  }
  const c = createController(normalizeQuestion(approval)); c.custom();
  assert.equal(c.saveText('   '), false);
  assert.equal(c.saveText('x'.repeat(2001)), false);
  assert.equal(c.saveText('A different scope'), true);
  assert.equal(c.submit().details.status, 'needs_discussion');
  assert.equal(c.submit().details.approved, false);
});

test('RPC maps IDs explicitly and reviews selected answer, scope, recommendation and note', async () => {
  const q = normalizeQuestion(decision);
  const ui = scripted(option('public'), action('Add / edit note'), 'Include support', action('Send answer'));
  const result = await askRpc(q, ui, new AbortController().signal);
  assert.equal(result.details.answer.optionId, 'public');
  assert.equal(result.details.answer.note, 'Include support');
  assert.equal(result.details.status, 'answered');
  assert.ok(ui.calls.every((call) => call.title.includes(q.question) && call.title.includes('Lower risk.')));
  assert.equal(ui.calls[1].arg[0], action('Back / change answer'));
  assert.match(ui.calls.at(-1).title, /Note: Include support/);
});

test('RPC generated actions never collide with model option labels', async () => {
  const q = normalizeQuestion({ ...decision, options: [{ ...decision.options[0], label: 'Action: Write a different answer' }, decision.options[1]] });
  const ui = scripted(option('internal'), action('Send answer'));
  const result = await askRpc(q, ui, new AbortController().signal);
  assert.equal(new Set(ui.calls[0].arg).size, ui.calls[0].arg.length);
  assert.equal(result.details.answer.kind, 'option');
  assert.equal(result.details.answer.optionId, 'internal');
});

test('RPC approval custom and qualification return discussion; invalid/blank responses never consent', async () => {
  for (const responses of [
    [action('Write a different answer'), '', 'Only after dry run', action('Send answer')],
    [option('approve'), action('Add / edit note'), 'thanks', action('Send answer')],
  ]) {
    const ui = scripted(...responses);
    const result = await askRpc(normalizeQuestion(approval), ui, new AbortController().signal);
    assert.equal(result.details.status, 'needs_discussion'); assert.equal(result.details.approved, false);
    assert.ok(ui.calls.every((call) => call.title.includes('r1') && call.title.includes('Excludes publishing')));
    assert.match(ui.calls.at(-1).title, /No approval will be granted/);
  }
  const invalid = await askRpc(normalizeQuestion(approval), scripted('approve'), new AbortController().signal);
  assert.equal(invalid.details.reason, 'invalid_ui_response'); assert.equal(invalid.details.approved, false);
});

for (const stage of ['choose', 'review', 'custom', 'note']) {
  test(`RPC cancellation at ${stage} dismisses without any next dialog`, async () => {
    const prefix = stage === 'choose' ? [] : stage === 'custom' ? [action('Write a different answer')] : stage === 'review' ? [option('approve')] : [option('approve'), action('Add / edit note')];
    const ui = scripted(...prefix, undefined);
    const result = await askRpc(normalizeQuestion(approval), ui, new AbortController().signal);
    assert.equal(result.details.status, 'dismissed'); assert.equal(result.details.approved, false);
    assert.equal(result.terminate, true); assert.equal(ui.calls.length, prefix.length + 1);
  });
}

for (const mode of ['tui', 'rpc']) {
  test(`${mode}: overlap rejects without disturbing owner; cancellation invalidates late completion`, async () => {
    const q = normalizeQuestion(approval), first = defer(), next = defer();
    let calls = 0;
    const show = () => (++calls === 1 ? first.promise : next.promise);
    const ui = { select: show, input: show };
    const owner = createInteractions(show);
    const firstSignal = new AbortController();
    const firstRun = owner.run(q, ctx(ui, mode), firstSignal.signal);
    assert.equal((await owner.run(q, ctx(ui, mode))).details.reason, 'interaction_in_progress');
    assert.equal((await owner.run(q, ctx(ui, mode))).details.reason, 'interaction_in_progress');
    assert.equal(calls, 1);
    owner.invalidate('session_changed');
    const newRun = owner.run(q, ctx(ui, mode));
    assert.equal(calls, 2);
    assert.equal((await firstRun).details.status, 'aborted');
    assert.equal((await owner.run(q, ctx(ui, mode))).details.reason, 'interaction_in_progress');
    // A stale success cannot approve, release the new lock, or start another RPC step.
    first.resolve(mode === 'rpc' ? 'Option [approve]: Approve this scope — Approve only the named action and scope.' : outcome(q, 'answered', { kind: 'option', optionId: 'approve', label: 'Approve this scope', note: '' }));
    await tick(); assert.equal(calls, 2);
    assert.equal((await owner.run(q, ctx(ui, mode))).details.reason, 'interaction_in_progress');
    owner.invalidate('shutdown');
    assert.equal((await newRun).details.status, 'aborted');
    next.reject(new Error('Late adapter failure')); await tick();
  });
}

test('registered tool aborts a pending RPC input and every session-navigation boundary', async () => {
  for (const event of ['session_before_switch', 'session_before_fork', 'session_before_tree', 'session_tree', 'session_shutdown', 'session_start', 'signal']) {
    const { tool, hooks } = registered();
    const pending = defer(); let inputSignal;
    const ui = { select: async () => action('Write a different answer'), input: (_title, _arg, options) => { inputSignal = options.signal; return pending.promise; } };
    const signal = new AbortController();
    const run = tool.execute('call', approval, signal.signal, undefined, ctx(ui));
    await tick(); assert.ok(inputSignal);
    if (event === 'signal') signal.abort(); else hooks.get(event)({}, ctx(ui));
    const result = await run;
    assert.equal(result.details.status, 'aborted'); assert.equal(result.details.approved, false);
    assert.equal(inputSignal.aborted, true);
    assert.deepEqual(result.details.origin, { sessionId: 'session', leafId: 'branch' });
    pending.resolve('yes'); await tick();
  }
});

test('no UI, pre-abort, lost UI, and throwing adapters return conservative outcomes and release owner', async () => {
  const q = normalizeQuestion(approval); let calls = 0;
  const owner = createInteractions(() => { calls++; throw new Error('private adapter details'); });
  for (const mode of ['print', 'json', undefined]) {
    assert.equal((await owner.run(q, { hasUI: false, mode })).details.status, 'unavailable');
  }
  const abort = new AbortController(); abort.abort();
  assert.equal((await owner.run(q, ctx({}, 'tui'), abort.signal)).details.status, 'aborted');
  assert.equal(calls, 0);
  for (let i = 0; i < 2; i++) assert.equal((await owner.run(q, ctx({}, 'tui'))).details.reason, 'ui_error');
  assert.equal(calls, 2);
  const lost = createInteractions(async () => undefined);
  assert.equal((await lost.run(q, ctx({}, 'tui'))).details.reason, 'ui_unavailable');
  const broken = ctx({}, 'tui'); broken.sessionManager.getSessionId = () => { throw new Error('stale session'); };
  assert.equal((await owner.run(q, broken)).details.reason, 'ui_error');
  assert.equal((await owner.run(q, ctx({}, 'tui'))).details.reason, 'ui_error');
});

test('native custom lifecycle closes once on abort/disposal and ignores stale input', async () => {
  const q = normalizeQuestion(approval);
  for (const how of ['abort', 'dispose', 'preabort']) {
    const signal = new AbortController(); let component; let closes = 0;
    if (how === 'preabort') signal.abort();
    const ui = { custom: (factory) => new Promise((resolve) => {
      component = factory({ terminal: { rows: 48 }, requestRender() {} }, { fg: (_, text) => text }, { matches: () => false, getKeys: () => [] }, (result) => { closes++; resolve(result); });
    }) };
    const pending = presentTui(q, ctx(ui, 'tui'), signal.signal);
    if (how === 'abort') signal.abort();
    else if (how === 'dispose') component.dispose();
    const result = await pending;
    assert.equal(result.details.status, how === 'dispose' ? 'unavailable' : 'aborted');
    component.dispose(); component.handleInput('\r'); component.focused = true;
    assert.equal(component.focused, false); assert.equal(closes, 1);
  }
});
