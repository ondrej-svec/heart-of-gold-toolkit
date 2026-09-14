import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { observeTerminalFocus } from '../extensions/pi/hog-ask-focus.mjs';
import './helpers/pi-runtime.mjs';
import { normalizeQuestion, createController, outcome } from '../extensions/pi/hog-ask-core.mjs';
import { createInteractions, askRpc } from '../extensions/pi/hog-ask-runtime.mjs';
const { default: extension, presentTui } = await import('../extensions/pi/hog-ask.ts');
const { AskSchema } = await import('../extensions/pi/hog-ask-schema.ts');
const { Check } = await import('typebox/value');
const { matchesKey } = await import('@earendil-works/pi-tui');

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

test('RPC preset submits in exactly one select response without review', async () => {
  const q = normalizeQuestion(decision), ui = scripted(option('public'));
  const result = await askRpc(q, ui, new AbortController().signal);
  assert.deepEqual(result.details.answer, { kind: 'option', optionId: 'public', label: 'Public', note: '' });
  assert.equal(result.details.status, 'answered');
  assert.equal(ui.calls.length, 1);
  assert.match(ui.calls[0].title, /Select an answer to submit immediately/);
});

test('RPC custom input submits immediately; invalid drafts stay editable without review', async () => {
  const invalid = 'x'.repeat(2001);
  const ui = scripted(action('Write a different answer'), invalid, 'Support + internal 🦊');
  const result = await askRpc(normalizeQuestion(decision), ui, new AbortController().signal);
  assert.deepEqual(result.details.answer, { kind: 'custom', text: 'Support + internal 🦊', note: '' });
  assert.deepEqual(ui.calls.map(c => c.method), ['select', 'input', 'input']);
  assert.match(ui.calls[2].title, /answer must be/);
  assert.ok(ui.calls[2].title.includes(invalid));
  assert.ok(ui.calls.slice(1).every(c => !c.arg.includes('reviewed')));
});

test('RPC opt-in notes show the exact answer and submit both without a review screen', async () => {
  for (const custom of [false, true]) {
    for (const note of ['Include support', '']) {
      const ui = scripted(action('Answer with a note'), ...(custom ? [action('Write a different answer'), 'Support 🦊'] : [option('public')]), note);
      const result = await askRpc(normalizeQuestion(decision), ui, new AbortController().signal);
      assert.equal(result.details.answer.note, note);
      assert.equal(custom ? result.details.answer.text : result.details.answer.optionId, custom ? 'Support 🦊' : 'public');
      assert.equal(ui.calls.length, custom ? 4 : 3);
      assert.ok(ui.calls.every(c => c.title.includes(decision.question) && c.title.includes('Lower risk.')));
      assert.match(ui.calls.at(-1).title, custom ? /Note for: Support 🦊/ : /Note for: Public/);
      assert.ok(ui.calls.every(c => !c.title.includes('Review before sending')));
    }
  }
});

test('RPC note errors retain the draft and current association; note mode can be exited before answering', async () => {
  const invalid = 'n'.repeat(1001);
  const ui = scripted(action('Answer with a note'), option('public'), invalid, 'Corrected note');
  const result = await askRpc(normalizeQuestion(decision), ui, new AbortController().signal);
  assert.equal(result.details.answer.note, 'Corrected note');
  assert.equal(ui.calls.length, 4);
  assert.match(ui.calls.at(-1).title, /Note for: Public/);
  assert.match(ui.calls.at(-1).title, /note must be/);
  assert.ok(ui.calls.at(-1).title.includes(invalid));
  const direct = scripted(action('Answer with a note'), action('Answer without a note'), option('internal'));
  assert.equal((await askRpc(normalizeQuestion(decision), direct, new AbortController().signal)).details.answer.note, '');
  assert.ok(direct.calls.every(c => c.method === 'select'));
});

for (const prefix of [[], [action('Write a different answer')], [action('Answer with a note')], [action('Answer with a note'), option('public')]]) {
  test(`RPC ordinary cancellation after ${prefix.length} responses is final`, async () => {
    const ui = scripted(...prefix, undefined);
    const result = await askRpc(normalizeQuestion(decision), ui, new AbortController().signal);
    assert.equal(result.details.status, 'dismissed');
    assert.equal(result.details.answer, null);
    assert.equal(ui.calls.length, prefix.length + 1);
  });
}

test('RPC approval still requires two responses with exact review and Send first, never Back by default', async () => {
  const ui = scripted(option('approve'), labels => { assert.equal(labels[0], action('Send approval')); return labels[0]; });
  const result = await askRpc(normalizeQuestion(approval), ui, new AbortController().signal);
  assert.equal(ui.calls.length, 2);
  assert.match(ui.calls[1].title, /Review before sending/);
  assert.match(ui.calls[1].title, /docs\/plans\/test\.md/);
  assert.match(ui.calls[1].title, /Revision: r1/);
  assert.ok(ui.calls[1].arg.includes(action('Back / change answer')));
  assert.equal(result.details.approved, true);
});

test('RPC immediate answers cannot win an abort at the final select or input boundary', async () => {
  for (const stage of ['preset', 'custom', 'note']) {
    const signal = new AbortController();
    const final = labels => { signal.abort(); return stage === 'preset' ? option('public')(labels) : 'Answer'; };
    const ui = scripted(...(stage === 'preset' ? [] : stage === 'custom' ? [action('Write a different answer')] : [action('Answer with a note'), option('public')]), final);
    const result = await createInteractions(() => assert.fail('No native adapter')).run(normalizeQuestion(decision), ctx(ui), signal.signal);
    assert.equal(result.details.status, 'aborted');
    assert.equal(result.details.answer, null);
    assert.equal(ui.calls.length, stage === 'preset' ? 1 : stage === 'custom' ? 2 : 3);
  }
});

test('RPC generated actions never collide with model option labels', async () => {
  const q = normalizeQuestion({ ...decision, options: [{ ...decision.options[0], label: 'Action: Write a different answer' }, decision.options[1]] });
  const ui = scripted(option('internal'));
  const result = await askRpc(q, ui, new AbortController().signal);
  assert.equal(new Set(ui.calls[0].arg).size, ui.calls[0].arg.length);
  assert.equal(result.details.answer.kind, 'option');
  assert.equal(result.details.answer.optionId, 'internal');
});

test('RPC approval presents stable intents, sends feedback only through Request changes, and has no note action', async () => {
  const q = normalizeQuestion(approval);
  const ui = scripted(option('revise'), 'Only after dry run', action('Send feedback'));
  const result = await askRpc(q, ui, new AbortController().signal);
  assert.equal(result.details.status, 'needs_discussion'); assert.equal(result.details.approved, false);
  assert.equal(result.details.answer.kind, 'custom');
  assert.ok(ui.calls.every((call) => call.title.includes('r1') && call.title.includes('Excludes publishing')));
  assert.match(ui.calls[0].arg.find((label) => label.startsWith('Option [approve]:')), /Approve as written/);
  assert.match(ui.calls[0].arg.find((label) => label.startsWith('Option [revise]:')), /Request changes/);
  assert.ok(!ui.calls.at(-1).arg.includes(action('Add / edit note')));
  assert.ok(!ui.calls.at(-1).title.includes('No approval will be granted'));
  const invalid = await askRpc(q, scripted('approve'), new AbortController().signal);
  assert.equal(invalid.details.reason, 'invalid_ui_response'); assert.equal(invalid.details.approved, false);
});

test('RPC approval requires explicit clearing of valid or invalid feedback drafts before approval', async () => {
  const q = normalizeQuestion(approval);
  for (const draft of ['Changes needed', '   ', 'x'.repeat(2001)]) {
    const clear = (labels) => {
      assert.ok(labels.includes(action('Clear feedback draft')));
      assert.ok(!labels.some((label) => label.startsWith('Option [approve]:')));
      return action('Clear feedback draft');
    };
    const ui = scripted(option('revise'), draft, ...(draft.trim() && draft.length <= 2000 ? [action('Back / change answer')] : []), clear, option('approve'), action('Send approval'));
    const result = await askRpc(q, ui, new AbortController().signal);
    assert.equal(result.details.status, 'answered'); assert.equal(result.details.approved, true);
    assert.doesNotMatch(ui.calls.at(-1).title, /Approve as written: Approve as written/);
  }
});

for (const stage of ['choose', 'review', 'feedback']) {
  test(`RPC cancellation at ${stage} dismisses without any next dialog`, async () => {
    const prefix = stage === 'choose' ? [] : stage === 'feedback' ? [option('revise')] : [option('approve')];
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
    const ui = { select: async (_title, labels) => option('revise')(labels), input: (_title, _arg, options) => { inputSignal = options.signal; return pending.promise; } };
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

test('passive focus observer handles split reports before dispatch and removes only its own listener', () => {
  const input = Object.assign(new EventEmitter(), { isTTY: true });
  const seen = [];
  input.on('data', () => seen.push('consumer'));
  const stop = observeTerminalFocus(input, () => seen.push('focus'));
  input.emit('data', Buffer.from('\x1b'));
  input.emit('data', Buffer.from('['));
  input.emit('data', Buffer.from('I\r'));
  assert.deepEqual(seen, ['consumer', 'consumer', 'focus', 'consumer']);
  seen.length = 0;
  input.emit('data', 'ordinary text'); input.emit('data', '\x1b[O\r');
  assert.deepEqual(seen, ['consumer', 'focus', 'consumer']);
  stop(); stop();
  assert.equal(input.listenerCount('data'), 1);
  seen.length = 0; input.emit('data', '\x1b[I');
  assert.deepEqual(seen, ['consumer']);
  const nonTty = new EventEmitter();
  observeTerminalFocus(nonTty, () => assert.fail('non-TTY observer'))();
  assert.equal(nonTty.listenerCount('data'), 0);
});

test('actual custom wrapper forwards releases/mouse and disposes its focus observer on every exit', async () => {
  for (const how of ['send', 'abort', 'dispose', 'preabort']) {
    const input = Object.assign(new EventEmitter(), { isTTY: true });
    const signal = new AbortController(); let component, closes = 0;
    const binding = { 'tui.select.confirm': 'enter', 'tui.input.submit': 'enter', 'tui.select.cancel': 'escape' };
    const theme = { fg: (_, text) => text, bg: (_, text) => text, bold: (text) => text };
    // Model the host consuming focus but dispatching activation in the same chunk.
    input.on('data', (data) => { if (data.includes('\r')) component.handleInput('\r'); });
    const ui = { custom: (factory) => new Promise((resolve) => {
      component = factory({ mode: 'fullscreen', terminal: { rows: 48 }, requestRender() {} }, theme,
        { matches: (data, action) => binding[action] ? matchesKey(data, binding[action]) : false, getKeys: (action) => [binding[action] ?? 'unbound'] },
        (result) => { closes++; resolve(result); });
    }) };
    if (how === 'preabort') signal.abort();
    const pending = presentTui(normalizeQuestion(approval), ctx(ui, 'tui'), signal.signal, input);
    assert.equal(component.wantsKeyRelease, true);
    assert.equal(typeof component.handleMouse, 'function');
    if (how !== 'preabort') {
      assert.equal(input.listenerCount('data'), 2);
      component.focused = true;
      component.handleInput('\x1b[13;1u'); component.handleInput('\x1b[13;1:3u');
      input.emit('data', '\x1b[O\x1b[I\r');
      assert.equal(closes, 0, 'refocusing chunk must be disarmed before Enter dispatch');
      if (how === 'abort') signal.abort();
      else if (how === 'dispose') component.dispose();
      else { component.handleInput('\x1b[13;1:3u'); component.handleInput('\x1b[13;1u'); }
    }
    const result = await pending;
    assert.equal(result.details.approved, how === 'send');
    assert.equal(closes, 1);
    assert.equal(input.listenerCount('data'), 1);
    component.dispose(); input.emit('data', '\x1b[I\r');
    assert.equal(closes, 1);
  }
});

test('host custom-UI failures or lost results dispose the created view and raw observer', async () => {
  for (const how of ['throw', 'reject', 'lost']) {
    const input = Object.assign(new EventEmitter(), { isTTY: true });
    const signal = new AbortController(); let component, closes = 0;
    const ui = { custom(factory) {
      component = factory({ mode: 'fullscreen', terminal: { rows: 40 }, requestRender() {} },
        { fg: (_, text) => text, bg: (_, text) => text, bold: text => text },
        { matches: () => false, getKeys: () => [] }, () => closes++);
      if (how === 'throw') throw new Error('host setup failed');
      return how === 'reject' ? Promise.reject(new Error('host setup failed')) : Promise.resolve(undefined);
    } };
    if (how === 'lost') assert.equal(await presentTui(normalizeQuestion(approval), ctx(ui, 'tui'), signal.signal, input), undefined);
    else await assert.rejects(async () => presentTui(normalizeQuestion(approval), ctx(ui, 'tui'), signal.signal, input), /host setup failed/);
    assert.equal(input.listenerCount('data'), 0, `${how} leaked a raw observer`);
    assert.deepEqual(component.render(80), []);
    signal.abort(); input.emit('data', '\x1b[I'); component.handleInput('\r'); component.focused = true;
    assert.equal(component.focused, false); assert.equal(closes, 0);
  }
});
