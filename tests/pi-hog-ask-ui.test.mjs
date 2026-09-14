import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/pi-runtime.mjs';
const { AskCard } = await import('../extensions/pi/hog-ask-ui.ts');
const { normalizeQuestion } = await import('../extensions/pi/hog-ask-core.mjs');
const { Key, matchesKey, visibleWidth, CURSOR_MARKER } = await import('@earendil-works/pi-tui');

const token = {
  up: 'UP', down: 'DOWN', pageUp: 'PGUP', pageDown: 'PGDOWN', confirm: 'GO', cancel: 'ESC',
  interrupt: 'ABORT', submit: 'GO', newLine: 'NL', tab: 'TAB', clear: 'CLEAR', dismiss: 'DISMISS',
};
const keyFor = {
  'tui.select.up': token.up, 'tui.select.down': token.down,
  'tui.select.pageUp': token.pageUp, 'tui.select.pageDown': token.pageDown,
  'tui.select.confirm': token.confirm, 'tui.select.cancel': token.cancel,
  'app.interrupt': token.interrupt, 'app.clear': token.dismiss, 'tui.input.submit': token.submit,
  'tui.input.newLine': token.newLine, 'tui.input.tab': token.tab,
  'tui.editor.deleteToLineStart': token.clear,
};
const keyId = {
  'tui.select.up': Key.up, 'tui.select.down': Key.down,
  'tui.select.pageUp': Key.pageUp, 'tui.select.pageDown': Key.pageDown,
  'tui.select.confirm': Key.enter, 'tui.select.cancel': Key.escape,
  'app.interrupt': Key.escape, 'app.clear': Key.ctrl('c'), 'tui.input.submit': Key.enter,
  'tui.input.newLine': Key.shift('enter'), 'tui.input.tab': Key.tab,
  'tui.editor.deleteToLineStart': Key.ctrl('u'),
};
const bindings = {
  matches(data, action) { return data === keyFor[action] || (keyId[action] ? matchesKey(data, keyId[action]) : false); },
  getKeys(action) { return keyFor[action] ? [keyFor[action]] : []; },
};
const decision = {
  id: 'audience', purpose: 'decision', title: 'Rollout audience', question: 'Who should have access first?',
  context: 'One pilot release.',
  options: [
    { id: 'internal', label: 'Internal only', description: 'Validate with support before broader exposure.' },
    { id: 'public', label: 'Public', description: 'Wider reach and more rollout risk.' },
  ],
  recommendation: { optionId: 'internal', reason: 'A smaller pilot reduces risk.' },
};
const approval = {
  id: 'implementation', purpose: 'approval', title: 'Implement the plan', question: 'Approve this scope?',
  scope: { action: 'Implement the three tasks; no deployment or publishing.', artifactPath: 'docs/计划.md', revision: 'r42' },
};
const kittyEnter = {
  press: '\x1b[13;1u', repeat: '\x1b[13;1:2u', release: '\x1b[13;1:3u',
};
const kittySpaceRelease = '\x1b[32;1:3u';

function setup(input = decision, rows = 48) {
  const results = [], colors = [], backgrounds = [];
  const theme = {
    fg(kind, text) { colors.push(kind); return text; },
    bg(kind, text) { backgrounds.push(kind); return text; },
    bold: (text) => text,
  };
  const tui = { terminal: { rows }, renders: 0, requestRender() { this.renders++; } };
  const card = new AskCard(normalizeQuestion(input), tui, theme, bindings, (result) => results.push(result));
  return { card, results, colors, backgrounds, tui, keys: (...keys) => keys.forEach((key) => card.handleInput(key)) };
}
function lines(card, width = 80) { return card.render(width); }
function view(card, width = 80) { return lines(card, width).join('\n'); }
function rowOf(card, text, width = 80) {
  const rendered = lines(card, width);
  const row = rendered.findIndex((line) => line.includes(text));
  assert.notEqual(row, -1, `missing row containing ${JSON.stringify(text)}\n${rendered.join('\n')}`);
  return row;
}
function mouse(type, x, y, extra = {}) {
  return { type, button: type === 'move' ? 'none' : 'left', x, y, screenX: extra.screenX ?? x, screenY: extra.screenY ?? y,
    width: extra.width ?? 80, height: extra.height ?? 40, shift: false, alt: false, ctrl: false, ...extra };
}
function click(card, x, y, extra = {}) {
  card.handleMouse(mouse('press', x, y, extra));
  card.handleMouse(mouse('release', x, y, extra));
  return card.handleMouse(mouse('click', x, y, extra));
}
function armAndSendApproval(h) { h.keys(kittyEnter.release, kittyEnter.press); }

test('accepted entry presentation has only real alternatives and a stable inline editor', () => {
  const h = setup(); h.card.focused = true;
  const first = view(h.card);
  assert.match(first, /Rollout audience · Choose one/);
  assert.match(first, /Who should have access first\?/);
  assert.match(first, /Internal only · recommended/);
  assert.equal((first.match(/A smaller pilot reduces risk\./g) ?? []).length, 1);
  assert.match(first, /Your answer/);
  assert.doesNotMatch(first, /\([ x]\)|Write a different answer|Dismiss\n.*Public/);
  assert.equal(h.card.controller.state.answer, null);
  assert.equal(h.results.length, 0);
  assert.ok(h.backgrounds.includes('selectedBg'), 'focused row uses theme selected background');
  assert.equal(h.card.wantsKeyRelease, true);
});

test('arrows, Tab, typing, Back and review retain the same native Editor and caret', () => {
  const h = setup(); h.card.focused = true;
  const editor = h.card.editor;
  h.keys(token.down, token.down);
  assert.equal(editor.focused, true);
  h.keys('Hello 🦊', '\x1b[D');
  assert.ok(view(h.card).includes(CURSOR_MARKER), 'focused native Editor emits the IME cursor anchor');
  const caret = editor.getCursor();
  assert.deepEqual(caret, { line: 0, col: 'Hello '.length });
  h.keys(token.submit);
  assert.equal(h.card.controller.state.step, 'review');
  assert.match(view(h.card), /Hello 🦊/);
  h.keys(token.cancel);
  assert.equal(h.card.editor, editor);
  assert.equal(editor.focused, true);
  assert.deepEqual(editor.getCursor(), caret);
  h.keys(token.cancel);
  assert.equal(editor.focused, false);
  h.keys(token.tab);
  assert.equal(editor.focused, true);
  assert.deepEqual(editor.getCursor(), caret);
  h.keys('\x1b[Z');
  assert.equal(editor.focused, false);
  assert.equal(h.results.length, 0);
});

test('typing and bracketed paste from an option focus the native editor without truncating expanded text', () => {
  const h = setup(); h.card.focused = true;
  h.keys('不同 🦊');
  assert.equal(h.card.editor.focused, true);
  assert.equal(h.card.editor.getExpandedText(), '不同 🦊');
  h.keys(token.cancel, token.up); // option focus
  const pasted = 'Full pasted answer. '.repeat(50).trim();
  h.keys(`\x1b[200~${pasted}\x1b[201~`);
  assert.equal(h.card.editor.focused, true);
  assert.equal(h.card.editor.getExpandedText(), `不同 🦊${pasted}`);
  h.keys(token.submit);
  assert.equal(h.card.controller.state.answer.text, `不同 🦊${pasted}`);
  assert.ok(h.card.controller.state.answer.text.length > 700);
});

test('real Editor validation preserves an oversized draft and renders no fake cursor when unfocused', () => {
  const h = setup(); h.card.focused = true;
  const oversized = '界'.repeat(2001);
  h.keys(`\x1b[200~${oversized}\x1b[201~`, token.submit);
  assert.equal(h.card.controller.state.step, 'custom');
  assert.match(view(h.card, 40), /answer must be/);
  assert.equal(h.card.editor.getExpandedText(), oversized);
  h.keys(token.cancel);
  const rendered = view(h.card, 40);
  assert.doesNotMatch(rendered, /\x1b\[7m/);
  assert.doesNotMatch(rendered, new RegExp(CURSOR_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('ordinary decisions keep a separate optional note editor and neutral Back review', () => {
  const h = setup(); h.card.focused = true;
  assert.notEqual(h.card.editor, h.card.noteEditor);
  h.keys(token.confirm);
  assert.equal(h.card.controller.state.step, 'review');
  h.keys(token.confirm); // initial neutral Back
  assert.equal(h.card.controller.state.step, 'choose');
  assert.equal(h.results.length, 0);
  h.keys(token.confirm, token.tab);
  assert.equal(h.card.noteEditor.focused, true);
  h.keys('Support first', token.newLine, 'Then public', token.cancel);
  assert.equal(h.card.controller.state.answer.note, 'Support first\nThen public');
  assert.equal(h.card.controller.state.step, 'review');
  assert.equal(h.card.noteEditor.focused, false);
  h.keys(token.tab);
  assert.equal(h.card.noteEditor.focused, true);
  assert.deepEqual(h.card.noteEditor.getCursor(), { line: 1, col: 'Then public'.length });
  h.keys(token.submit);
  h.keys('\x1b[13;5u'); // Ctrl+Enter explicit Send
  assert.equal(h.results.length, 1);
  assert.deepEqual(h.results[0].details.answer, { kind: 'option', optionId: 'internal', label: 'Internal only', note: 'Support first\nThen public' });
});

test('approval presents distinct intents, feedback has no generic note and returns needs_discussion', () => {
  const h = setup(approval); h.card.focused = true;
  const initial = view(h.card);
  assert.match(initial, /Approve as written/);
  assert.match(initial, /Request changes/);
  assert.match(initial, /Not now/);
  assert.doesNotMatch(initial, /Add \/ edit note|\([ x]\)/);
  h.keys(token.down, token.confirm, 'Run a dry run first', kittyEnter.press);
  assert.equal(h.card.controller.state.step, 'review');
  const review = view(h.card);
  assert.match(review, /Request changes/);
  assert.match(review, /Run a dry run first/);
  assert.doesNotMatch(review, /Note · optional|No approval granted|warning/i);
  armAndSendApproval(h);
  assert.equal(h.results[0].details.status, 'needs_discussion');
  assert.equal(h.results[0].details.approved, false);
});

test('pending approval feedback must be explicitly cleared before bare approval', () => {
  const h = setup(approval); h.card.focused = true;
  h.keys('Please change it', token.cancel, token.up, token.up, token.confirm);
  assert.equal(h.card.controller.state.step, 'custom');
  assert.match(view(h.card), /Clear your feedback first/);
  assert.equal(h.results.length, 0);
  h.keys(token.cancel, token.up, token.up, token.clear);
  assert.equal(h.card.editor.getExpandedText(), '');
  h.keys(token.cancel, token.up, token.up, kittyEnter.press);
  assert.equal(h.card.controller.state.answer.optionId, 'approve');
  armAndSendApproval(h);
  assert.equal(h.results[0].details.approved, true);
  assert.equal(h.results[0].details.answer.note, '');
});

test('approval Enter is release-aware, ignores repeats/releases as actions and fails closed on raw CR', () => {
  const h = setup(approval); h.card.focused = true;
  h.keys(token.confirm); // opens review but no enhanced-key release observed
  assert.match(view(h.card), /TAB then GO send approval/);
  h.keys(token.confirm, '\r', kittyEnter.repeat, kittySpaceRelease);
  assert.equal(h.results.length, 0);
  h.keys(kittyEnter.release);
  assert.match(view(h.card), /send approval/);
  h.keys(kittyEnter.repeat);
  assert.equal(h.results.length, 0);
  h.keys(kittyEnter.press);
  assert.equal(h.results.length, 1);
  assert.equal(h.results[0].details.approved, true);
});

test('long Unicode scope scrolls in bounded rows while fixed controls remain visible', () => {
  const long = { ...approval, scope: { ...approval.scope, action: `${'Unicode 中文 🦊 scope detail. '.repeat(30)}END_SCOPE` } };
  const h = setup(long, 24); h.card.focused = true;
  let visited = '';
  for (const width of [1, 20, 36, 80, 20]) {
    h.card.invalidate();
    const rendered = lines(h.card, width);
    assert.ok(rendered.every((line) => visibleWidth(line) <= width), `line exceeded width ${width}`);
    assert.ok(rendered.length <= 18, `height exceeded at width ${width}`);
  }
  for (let i = 0; i < 80; i++) {
    const rendered = view(h.card, 36);
    visited += rendered;
    assert.match(rendered, /ESC dismiss/);
    h.keys(token.pageDown);
  }
  assert.match(visited, /END_SCOPE/);
  assert.match(visited, /PGUP\/PGDOWN scroll/);
  assert.match(view(h.card, 36), /↓0/);
  assert.equal(h.card.controller.state.answer, null);
});

test('mouse hover never focuses or selects; native editor click geometry places the caret', () => {
  const h = setup(); h.card.focused = true;
  const optionRow = rowOf(h.card, 'Public');
  const before = h.card.controller.state;
  const hover = h.card.handleMouse(mouse('move', 5, optionRow));
  assert.equal(hover.render, true);
  assert.equal(h.card.controller.state.answer, before.answer);
  assert.equal(h.card.editor.focused, false);
  h.keys(token.confirm);
  assert.equal(h.card.controller.state.answer.optionId, 'internal', 'hover did not steal keyboard focus');
  h.keys(token.cancel);

  h.keys('abcdef');
  const caption = rowOf(h.card, 'Your answer');
  const contentRow = caption + 1;
  h.keys(token.cancel);
  click(h.card, 4, contentRow);
  assert.equal(h.card.editor.focused, true);
  assert.deepEqual(h.card.editor.getCursor(), { line: 0, col: 2 });
  h.keys('Z');
  assert.equal(h.card.editor.getExpandedText(), 'abZcdef');

  h.keys(token.cancel);
  click(h.card, 0, contentRow); // prefix/padding is part of the editor hit area
  assert.equal(h.card.editor.focused, true);
  assert.deepEqual(h.card.editor.getCursor(), { line: 0, col: 0 });
  h.keys('\x1b[C', '\x1b[C', '\x1b[C');
  h.keys(token.cancel);
  click(h.card, 0, caption); // label is clickable and focuses without moving caret
  assert.equal(h.card.editor.focused, true);
  assert.deepEqual(h.card.editor.getCursor(), { line: 0, col: 3 });
});

test('editor press/drag stays unhandled for fullscreen selection and reflow invalidates clicks', () => {
  const h = setup(); h.card.focused = true;
  h.keys('drag me');
  const y = rowOf(h.card, 'Your answer') + 1;
  assert.equal(h.card.handleMouse(mouse('press', 3, y)), undefined);
  assert.equal(h.card.handleMouse(mouse('drag', 8, y, { screenX: 8 })), undefined);
  assert.equal(h.card.handleMouse(mouse('release', 8, y, { screenX: 8 })), undefined);

  h.keys(token.cancel);
  const optionY = rowOf(h.card, 'Internal only', 80);
  h.card.handleMouse(mouse('press', 1, optionY));
  h.card.render(36); // width/reflow changes rendered-row provenance
  h.card.handleMouse(mouse('click', 1, optionY, { width: 36 }));
  assert.equal(h.card.controller.state.answer, null);
});

test('pointer continuation, double-click and drag cannot hit a relocated Send', () => {
  const h = setup(); h.card.focused = true;
  const optionY = rowOf(h.card, 'Internal only');
  click(h.card, 1, optionY, { screenX: 10, screenY: 100 });
  assert.equal(h.card.controller.state.step, 'review');
  const rendered = lines(h.card);
  const sendY = rowOf(h.card, 'Ctrl+Enter send answer');
  const sendX = rendered[sendY].indexOf('Ctrl+Enter') + 1;

  // Same absolute cell after reflow is a continuation even if clickCount resets.
  click(h.card, sendX, sendY, { screenX: 10, screenY: 100 });
  assert.equal(h.results.length, 0);
  h.card.handleMouse(mouse('move', sendX + 1, sendY, { screenX: 11, screenY: 100 }));

  h.card.handleMouse(mouse('press', sendX, sendY, { screenX: 10, screenY: 100 }));
  h.card.handleMouse(mouse('release', sendX, sendY, { screenX: 10, screenY: 100 }));
  h.card.handleMouse(mouse('click', sendX, sendY, { screenX: 10, screenY: 100, clickCount: 2 }));
  assert.equal(h.results.length, 0);

  h.card.handleMouse(mouse('press', sendX, sendY, { screenX: 10, screenY: 100 }));
  h.card.handleMouse(mouse('drag', sendX + 1, sendY, { screenX: 11, screenY: 100 }));
  h.card.handleMouse(mouse('release', sendX + 1, sendY, { screenX: 11, screenY: 100 }));
  h.card.handleMouse(mouse('click', sendX + 1, sendY, { screenX: 11, screenY: 100 }));
  assert.equal(h.results.length, 0);

  click(h.card, sendX, sendY, { screenX: 12, screenY: 100 });
  assert.equal(h.results.length, 1);
});

test('option and footer hit regions come from rendered rows and disposal is final', () => {
  const h = setup(); h.card.focused = true;
  const optionY = rowOf(h.card, 'Public');
  click(h.card, 20, optionY);
  assert.equal(h.card.controller.state.answer.optionId, 'public');
  assert.equal(h.results.length, 0);
  h.keys(token.cancel, token.cancel);
  assert.equal(h.results.length, 1);
  assert.equal(h.results[0].details.status, 'dismissed');
  h.card.focused = true;
  h.card.handleInput('late');
  h.card.handleMouse(mouse('click', 1, 1));
  assert.equal(h.card.focused, false);
  assert.equal(h.card.editor.focused, false);
  assert.equal(h.card.noteEditor.focused, false);
  assert.equal(h.results.length, 1);
  assert.deepEqual(h.card.render(80), []);
});

test('native editing repeats remain useful; Ctrl+Enter in editors only reviews', () => {
  const h = setup(); h.card.focused = true;
  h.keys('a', '\x1b[97;1:2u');
  assert.equal(h.card.editor.getExpandedText(), 'aa');
  h.keys('\x1b[127;1:2u');
  assert.equal(h.card.editor.getExpandedText(), 'a');
  h.keys('\x1b[13;5u', '\x1b[13;5:2u');
  assert.equal(h.card.controller.state.step, 'review');
  assert.equal(h.results.length, 0);
  h.keys(token.tab, 'note', '\x1b[13;5u', '\x1b[13;5:2u');
  assert.equal(h.card.controller.state.answer.note, 'note');
  assert.equal(h.card.noteEditor.focused, false);
  assert.equal(h.results.length, 0);
});

test('changing to a custom decision synchronizes the visible note with the submitted answer', () => {
  const h = setup(); h.card.focused = true;
  h.keys(token.confirm, token.tab, 'old note', token.submit, token.cancel, 'replacement', token.submit);
  assert.equal(h.card.controller.state.answer.note, '');
  assert.equal(h.card.noteEditor.getExpandedText(), '');
  assert.doesNotMatch(view(h.card), /old note/);
  h.keys('\x1b[13;5u');
  assert.equal(h.results[0].details.answer.text, 'replacement');
  assert.equal(h.results[0].details.answer.note, '');
});

test('clicking review note has the same result as Enter, not Back-to-options', () => {
  const h = setup(); h.card.focused = true;
  h.keys(token.confirm, token.tab, 'retained note');
  const y = rowOf(h.card, 'GO review note');
  click(h.card, 1, y);
  assert.equal(h.card.controller.state.step, 'review');
  assert.equal(h.card.controller.state.answer.note, 'retained note');
  assert.equal(h.card.noteEditor.focused, false);
  assert.equal(h.results.length, 0);
});

test('the Ctrl+Enter opening release arms the next plain Enter even when Ctrl is released first', () => {
  for (const release of ['\x1b[13;5:3u', kittyEnter.release]) {
    const h = setup(approval); h.card.focused = true;
    h.keys('Dry run first', '\x1b[13;5u', '\x1b[13;5:2u');
    assert.equal(h.results.length, 0);
    h.keys(release, kittyEnter.press);
    assert.equal(h.results.length, 1);
    assert.equal(h.results[0].details.status, 'needs_discussion');
  }
});

test('long approval and decision review can be scrolled with host-accessible arrows', () => {
  for (const purpose of ['approval', 'decision']) {
    const text = `START_SCOPE ${'Unicode 中文 scope detail. '.repeat(30)} END_SCOPE`;
    const h = setup(purpose === 'approval' ? { ...approval, scope: { action: text } } : decision, 24);
    h.tui.mode = 'fullscreen'; h.card.focused = true;
    if (purpose === 'decision') h.keys(text);
    h.keys(token.confirm);
    let seen = view(h.card, 36);
    for (let i = 0; i < 20; i++) { h.keys(token.up); seen += view(h.card, 36); }
    assert.match(seen, /START_SCOPE/);
    assert.match(seen, /END_SCOPE/);
    assert.match(view(h.card, 36), /at edges/);
    assert.equal(h.card.controller.state.step, 'review');
    assert.equal(h.results.length, 0);
  }
});

test('component focus loss disarms approval and unfocused input cannot submit', () => {
  const h = setup(approval); h.card.focused = true;
  h.keys(kittyEnter.press, kittyEnter.release);
  h.card.focused = false;
  h.keys(kittyEnter.press, kittyEnter.release);
  assert.equal(h.results.length, 0);
  h.card.focused = true;
  h.keys(kittyEnter.press);
  assert.equal(h.results.length, 0);
  armAndSendApproval(h);
  assert.equal(h.results[0].details.approved, true);
});

test('terminal refocus discards the activating pointer gesture even after hover', () => {
  const h = setup(approval); h.card.focused = true;
  h.keys(kittyEnter.press, kittyEnter.release);
  h.card.invalidateInputOrigin();
  const rendered = lines(h.card), y = rowOf(h.card, 'send approval');
  const x = rendered[y].indexOf('GO') + 1;
  h.card.handleMouse(mouse('move', x, y));
  click(h.card, x, y);
  click(h.card, x, y, { clickCount: 2 });
  assert.equal(h.results.length, 0);
  const sent = click(h.card, x, y, { clickCount: 1 });
  assert.equal(h.results[0].details.approved, true);
  assert.equal(sent.focus, false, 'completed click must not steal focus from the restored host editor');
});

test('mouse gestures do not request a redundant host focus reset', () => {
  const h = setup(); h.card.focused = true;
  const y = rowOf(h.card, 'Public');
  const press = h.card.handleMouse(mouse('press', 3, y));
  assert.equal(press.focus, false);
  h.card.handleMouse(mouse('release', 3, y));
  const activated = h.card.handleMouse(mouse('click', 3, y));
  assert.equal(activated.focus, false);
  assert.equal(h.card.controller.state.answer.optionId, 'public');
});

test('narrow validation stays visible, preserves the whole draft, and remains cancellable', () => {
  const h = setup(decision, 24); h.card.focused = true; h.tui.mode = 'fullscreen';
  const draft = 'x'.repeat(2001);
  h.keys(`\x1b[200~${draft}\x1b[201~`, token.submit);
  assert.match(view(h.card, 36), /answer must be/);
  assert.equal(h.card.editor.getExpandedText(), draft);
  h.keys('y');
  assert.doesNotMatch(view(h.card, 36), /answer must be/);
  h.keys(token.dismiss);
  assert.equal(h.results[0].details.status, 'dismissed');

  const note = setup(decision, 24); note.card.focused = true;
  note.keys(token.confirm, token.tab, `\x1b[200~${'n'.repeat(1001)}\x1b[201~`, token.submit);
  assert.match(view(note.card, 36), /note must be/);
  note.keys(token.dismiss);
  assert.equal(note.results[0].details.status, 'dismissed');
});

test('remapped selector confirm does not consume printable text inside native editors', () => {
  const results = [];
  const customBindings = {
    ...bindings,
    matches(data, action) { return action === 'tui.select.confirm' ? data === ' ' : bindings.matches(data, action); },
  };
  const card = new AskCard(normalizeQuestion(decision), { terminal: { rows: 40 }, requestRender() {} },
    { fg: (_, text) => text, bg: (_, text) => text, bold: (text) => text }, customBindings, (result) => results.push(result));
  card.focused = true;
  for (const key of [token.down, token.down, 'Hello', ' ', 'world', token.submit, token.tab, 'A', ' ', 'note', token.submit, '\x1b[13;5u']) card.handleInput(key);
  assert.equal(results[0].details.answer.text, 'Hello world');
  assert.equal(results[0].details.answer.note, 'A note');
});

test('accepted legacy fallback requires Tab then Enter and resets on Back or refocus', () => {
  const h = setup(approval); h.card.focused = true;
  h.keys('\r', '\r', '\r', '\x1b[9;1:2u', '\r');
  assert.equal(h.results.length, 0, 'raw Enter and reported Tab repeats cannot arm');
  h.keys('\t', token.cancel, '\r', '\r');
  assert.equal(h.results.length, 0, 'Back resets the fallback');
  h.keys('\t'); h.card.invalidateInputOrigin(); h.keys('\r');
  assert.equal(h.results.length, 0, 'refocus resets the fallback');
  h.keys('\t');
  assert.doesNotMatch(view(h.card), /TAB then/);
  h.keys('\r');
  assert.equal(h.results.length, 1);
  assert.equal(h.results[0].details.approved, true);
});

test('remapped CSI-tilde confirmation releases arm without treating repeats as fresh presses', () => {
  const results = [];
  const customBindings = {
    ...bindings,
    matches(data, action) { return action === 'tui.select.confirm' ? matchesKey(data, 'f6') : bindings.matches(data, action); },
  };
  const card = new AskCard(normalizeQuestion(approval), { terminal: { rows: 40 }, requestRender() {} },
    { fg: (_, text) => text, bg: (_, text) => text, bold: (text) => text }, customBindings, (result) => results.push(result));
  card.focused = true;
  card.handleInput('\x1b[17~'); card.handleInput('\x1b[17;1:3~'); card.handleInput('\x1b[17;1:2~');
  assert.equal(results.length, 0);
  card.handleInput('\x1b[17~');
  assert.equal(results[0].details.approved, true);
});
