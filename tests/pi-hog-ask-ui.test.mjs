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
const kittyEnter = { press: '\x1b[13;1u', repeat: '\x1b[13;1:2u', release: '\x1b[13;1:3u' };
const kittySpaceRelease = '\x1b[32;1:3u';

function setup(input = decision, rows = 48, customBindings = bindings) {
  const results = [], colors = [], backgrounds = [];
  let inputCount = 0;
  const theme = {
    fg(kind, text) { colors.push(kind); return text; },
    bg(kind, text) { backgrounds.push(kind); return text; },
    bold: (text) => text,
  };
  const tui = { terminal: { rows }, renders: 0, requestRender() { this.renders++; } };
  const card = new AskCard(normalizeQuestion(input), tui, theme, customBindings, (result) => results.push(result));
  return {
    card, results, colors, backgrounds, tui,
    get inputCount() { return inputCount; },
    keys: (...keys) => keys.forEach((key) => { inputCount++; card.handleInput(key); }),
  };
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

// Ordinary question flow and reference-like structure.
test('decision entry mirrors bundled question structure without a title stack or selected background', () => {
  const h = setup(); h.card.focused = true;
  const rendered = lines(h.card);
  const text = rendered.join('\n');
  assert.equal(rendered[0], '─'.repeat(80));
  assert.equal(rendered.at(-1), '─'.repeat(80));
  assert.equal(rendered[1], ' Who should have access first?');
  assert.match(text, /^> 1\. Internal only · recommended$/m);
  assert.match(text, /^     Validate with support before broader exposure\.$/m);
  assert.match(text, /^  2\. Public$/m);
  assert.match(text, /^  3\. Type something…\n\nUP\/DOWN choose/m);
  assert.match(text, /^UP\/DOWN choose · GO send · TAB add note · ESC cancel$/m);
  assert.doesNotMatch(text, /Rollout audience|Choose one|Review|Your answer|\([ x]\)/);
  assert.equal((text.match(/A smaller pilot reduces risk\./g) ?? []).length, 1);
  assert.deepEqual(h.backgrounds, [], 'simple focus marker replaces full-width selected backgrounds');
  assert.equal(h.card.controller.state.answer, null);
  assert.equal(h.card.wantsKeyRelease, true);
});

test('one ordinary Enter submits the highlighted preset with one input action', () => {
  const h = setup(); h.card.focused = true;
  h.keys(token.confirm);
  assert.equal(h.inputCount, 1);
  assert.equal(h.results.length, 1);
  assert.deepEqual(h.results[0].details.answer, { kind: 'option', optionId: 'internal', label: 'Internal only', note: '' });
  assert.equal(h.results[0].details.status, 'answered');
  assert.deepEqual(h.card.render(80), []);
});

test('arrows enter the inline custom Editor; Escape and re-entry retain its text and caret', () => {
  const h = setup(); h.card.focused = true;
  const editor = h.card.editor;
  h.keys(token.down, token.down, 'Hello 🦊', '\x1b[D');
  assert.equal(editor.focused, true);
  assert.match(view(h.card), /^  3\. Type something… ✎$/m);
  assert.match(view(h.card), /^Your answer$/m);
  assert.match(view(h.card), /^GO send · TAB add note · NL new line · ESC back$/m);
  assert.ok(view(h.card).includes(CURSOR_MARKER));
  const caret = editor.getCursor();
  assert.deepEqual(caret, { line: 0, col: 'Hello '.length });
  h.keys(token.cancel);
  assert.equal(h.card.controller.state.step, 'choose');
  assert.equal(editor.focused, false);
  assert.match(view(h.card), /Hello 🦊/);
  assert.doesNotMatch(view(h.card), new RegExp(CURSOR_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  h.keys(token.confirm);
  assert.equal(editor.focused, true);
  assert.deepEqual(editor.getCursor(), caret);
  h.keys(token.submit);
  assert.equal(h.results.length, 1);
  assert.equal(h.results[0].details.answer.text, 'Hello 🦊');
});

test('typing and bracketed paste from a preset focus the same native Editor without truncating expanded text', () => {
  const h = setup(); h.card.focused = true;
  const pasted = 'Full pasted answer. '.repeat(50).trim();
  h.keys('不同 🦊', `\x1b[200~${pasted}\x1b[201~`);
  assert.equal(h.card.editor.focused, true);
  assert.equal(h.card.editor.getExpandedText(), `不同 🦊${pasted}`);
  h.keys(token.submit);
  assert.equal(h.results.length, 1);
  assert.equal(h.results[0].details.answer.text, `不同 🦊${pasted}`);
  assert.ok(h.results[0].details.answer.text.length > 700);
});

test('invalid custom text blocks direct submit, stays editable, and Ctrl+C still cancels', () => {
  const h = setup(decision, 24); h.card.focused = true; h.tui.mode = 'fullscreen';
  const oversized = '界'.repeat(2001);
  h.keys(`\x1b[200~${oversized}\x1b[201~`, token.submit);
  assert.equal(h.results.length, 0);
  assert.equal(h.card.controller.state.step, 'custom');
  assert.equal(h.card.editor.getExpandedText(), oversized);
  assert.match(view(h.card, 36), /answer must be/);
  h.keys('x');
  assert.doesNotMatch(view(h.card, 36), /answer must be/);
  h.keys(token.dismiss);
  assert.equal(h.results[0].details.status, 'dismissed');
});

test('Tab from a preset opens an answer-labelled note and Enter submits answer plus note', () => {
  const h = setup(); h.card.focused = true;
  h.keys(token.tab);
  assert.equal(h.card.controller.state.step, 'note');
  assert.equal(h.card.noteEditor.focused, true);
  const noteView = view(h.card);
  assert.match(noteView, /^> Answer: Internal only$/m);
  assert.match(noteView, /^Note for: Internal only · optional$/m);
  assert.match(noteView, /^GO send · NL new line · TAB\/ESC back$/m);
  assert.doesNotMatch(noteView, /Review|Ctrl\+Enter/);
  h.keys('Support first', token.newLine, 'Then public', token.submit);
  assert.equal(h.inputCount, 5);
  assert.equal(h.results.length, 1);
  assert.deepEqual(h.results[0].details.answer, { kind: 'option', optionId: 'internal', label: 'Internal only', note: 'Support first\nThen public' });
});

test('Escape and Tab leave note entry without validation and retain its draft and caret', () => {
  for (const back of [token.cancel, token.tab]) {
    const h = setup(); h.card.focused = true;
    h.keys(token.tab, 'draft note', '\x1b[D');
    const caret = h.card.noteEditor.getCursor();
    h.keys(back);
    assert.equal(h.card.controller.state.step, 'choose');
    assert.equal(h.card.noteEditor.focused, false);
    assert.equal(h.card.noteEditor.getExpandedText(), 'draft note');
    assert.match(view(h.card), /Note draft · ready · for: Internal only/);
    h.keys(token.tab);
    assert.equal(h.card.noteEditor.focused, true);
    assert.deepEqual(h.card.noteEditor.getCursor(), caret);
  }
});

test('a retained valid note follows an explicitly changed answer and submits in one Enter', () => {
  const h = setup(); h.card.focused = true;
  h.keys(token.tab, 'Use the public wording', token.cancel, token.down);
  assert.match(view(h.card), /Note draft · ready · for: Public/);
  const before = h.inputCount;
  h.keys(token.confirm);
  assert.equal(h.inputCount - before, 1);
  assert.equal(h.results.length, 1);
  assert.deepEqual(h.results[0].details.answer, { kind: 'option', optionId: 'public', label: 'Public', note: 'Use the public wording' });
});

test('an invalid retained note remains visible, blocks a changed choice, and stays cancellable', () => {
  const h = setup(decision, 24); h.card.focused = true;
  const oversized = 'n'.repeat(1001);
  h.keys(token.tab, `\x1b[200~${oversized}\x1b[201~`, token.submit);
  assert.equal(h.results.length, 0);
  assert.match(view(h.card, 36), /note must be/);
  h.keys(token.cancel, token.down);
  assert.match(view(h.card, 36), /Note draft · needs editing · for:/);
  assert.equal(h.card.noteEditor.getExpandedText(), oversized);
  h.keys(token.confirm);
  assert.equal(h.results.length, 0);
  assert.equal(h.card.controller.state.step, 'note');
  assert.match(view(h.card, 36), /Note for: Public/);
  assert.match(view(h.card, 36), /note must be/);
  h.keys(token.dismiss);
  assert.equal(h.results[0].details.status, 'dismissed');
});

test('a custom answer can open its note before sending and note Back restores custom caret', () => {
  const h = setup(); h.card.focused = true;
  h.keys('Custom route', '\x1b[D');
  const customCaret = h.card.editor.getCursor();
  h.keys(token.tab, 'because', token.cancel);
  assert.equal(h.card.controller.state.step, 'custom');
  assert.equal(h.card.editor.focused, true);
  assert.deepEqual(h.card.editor.getCursor(), customCaret);
  assert.match(view(h.card), /Note draft · ready · for: Custom route/);
  h.keys(token.tab);
  assert.match(view(h.card), /Note for: Custom rout/);
  h.keys(token.submit);
  assert.equal(h.results.length, 1);
  assert.equal(h.results[0].details.answer.text, 'Custom route');
  assert.equal(h.results[0].details.answer.note, 'because');
});

// Pointer geometry, native editor behavior, and disposal.
test('hover never selects while one fresh option click submits immediately', () => {
  const h = setup(); h.card.focused = true;
  const y = rowOf(h.card, 'Public');
  const hover = h.card.handleMouse(mouse('move', 5, y));
  assert.equal(hover.render, true);
  assert.equal(h.card.controller.state.answer, null);
  assert.equal(h.card.editor.focused, false);
  const activated = click(h.card, 5, y);
  assert.equal(h.results.length, 1);
  assert.equal(h.results[0].details.answer.optionId, 'public');
  assert.equal(activated.focus, false, 'completed click cannot steal focus from restored host editor');
});

test('native editor click geometry places the caret in a retained inline draft', () => {
  const h = setup(); h.card.focused = true;
  h.keys('abcdef', token.cancel);
  const caption = rowOf(h.card, 'Your answer');
  const contentRow = caption + 1;
  click(h.card, 4, contentRow);
  assert.equal(h.card.editor.focused, true);
  assert.deepEqual(h.card.editor.getCursor(), { line: 0, col: 2 });
  h.keys('Z');
  assert.equal(h.card.editor.getExpandedText(), 'abZcdef');
  h.keys(token.cancel);
  click(h.card, 0, contentRow);
  assert.equal(h.card.editor.focused, true);
  assert.deepEqual(h.card.editor.getCursor(), { line: 0, col: 0 });
  h.keys('\x1b[C', '\x1b[C', '\x1b[C', token.cancel);
  click(h.card, 0, caption);
  assert.deepEqual(h.card.editor.getCursor(), { line: 0, col: 3 });
});

test('editor press/drag stays unhandled for fullscreen selection and reflow invalidates clicks', () => {
  const h = setup(); h.card.focused = true;
  h.keys('drag me');
  const y = rowOf(h.card, 'Your answer') + 1;
  assert.equal(h.card.handleMouse(mouse('press', 3, y)), undefined);
  assert.equal(h.card.handleMouse(mouse('drag', 8, y, { screenX: 8 })), undefined);
  assert.equal(h.card.handleMouse(mouse('release', 8, y, { screenX: 8 })), undefined);

  h.keys(token.cancel, token.up);
  const optionY = rowOf(h.card, 'Public', 80);
  h.card.handleMouse(mouse('press', 1, optionY));
  h.card.render(36);
  h.card.handleMouse(mouse('click', 1, optionY, { width: 36 }));
  assert.equal(h.results.length, 0);
});

test('double-click, drag, and a stale pointer cannot submit an ordinary option', () => {
  const h = setup(); h.card.focused = true;
  const y = rowOf(h.card, 'Public');
  h.card.handleMouse(mouse('press', 3, y));
  h.card.handleMouse(mouse('release', 3, y));
  h.card.handleMouse(mouse('click', 3, y, { clickCount: 2 }));
  assert.equal(h.results.length, 0);

  h.card.handleMouse(mouse('press', 3, y, { screenX: 10, screenY: 100 }));
  h.card.handleMouse(mouse('drag', 4, y, { screenX: 11, screenY: 100 }));
  h.card.handleMouse(mouse('release', 4, y, { screenX: 11, screenY: 100 }));
  h.card.handleMouse(mouse('click', 4, y, { screenX: 11, screenY: 100 }));
  assert.equal(h.results.length, 0);

  h.card.handleMouse(mouse('press', 3, y));
  h.card.render(36);
  h.card.handleMouse(mouse('click', 3, y, { width: 36 }));
  assert.equal(h.results.length, 0);
});

test('footer hit regions open and submit a note using the same visible answer', () => {
  const h = setup(); h.card.focused = true;
  let rendered = lines(h.card);
  let y = rowOf(h.card, 'TAB add note');
  let x = rendered[y].indexOf('TAB add note') + 1;
  click(h.card, x, y);
  assert.equal(h.card.controller.state.step, 'note');
  h.keys('pointer note');
  rendered = lines(h.card);
  y = rowOf(h.card, 'GO send');
  x = rendered[y].indexOf('GO send') + 1;
  click(h.card, x, y, { screenX: 40, screenY: 100 });
  assert.equal(h.results.length, 1);
  assert.equal(h.results[0].details.answer.optionId, 'internal');
  assert.equal(h.results[0].details.answer.note, 'pointer note');
});

test('disposal is final and post-disposal focus/input/mouse cannot revive the card', () => {
  const h = setup(); h.card.focused = true;
  h.keys(token.confirm);
  assert.equal(h.results.length, 1);
  h.card.focused = true;
  h.card.handleInput('late');
  h.card.handleMouse(mouse('click', 1, 1));
  assert.equal(h.card.focused, false);
  assert.equal(h.card.editor.focused, false);
  assert.equal(h.card.noteEditor.focused, false);
  assert.equal(h.results.length, 1);
  assert.deepEqual(h.card.render(80), []);
});

test('native edit repeats work but repeated activation does not cross submission boundaries', () => {
  const h = setup(); h.card.focused = true;
  h.keys('a', '\x1b[97;1:2u');
  assert.equal(h.card.editor.getExpandedText(), 'aa');
  h.keys('\x1b[127;1:2u');
  assert.equal(h.card.editor.getExpandedText(), 'a');
  h.keys(kittyEnter.repeat);
  assert.equal(h.results.length, 0);
  h.keys('\x1b[13;5u');
  assert.equal(h.results.length, 1, 'Ctrl+Enter may submit but is never required');
  assert.equal(h.results[0].details.answer.text, 'a');
});

test('remapped selector confirm remains printable inside native custom and note editors', () => {
  const customBindings = {
    ...bindings,
    matches(data, action) { return action === 'tui.select.confirm' ? data === ' ' : bindings.matches(data, action); },
  };
  const h = setup(decision, 48, customBindings); h.card.focused = true;
  h.keys(token.down, token.down, 'Hello', ' ', 'world', token.tab, 'A', ' ', 'note', token.submit);
  assert.equal(h.results.length, 1);
  assert.equal(h.results[0].details.answer.text, 'Hello world');
  assert.equal(h.results[0].details.answer.note, 'A note');
});

// Approval remains reviewed, guarded, and exact-scope.
test('approval uses the quieter question structure while keeping distinct intents and exact scope', () => {
  const h = setup(approval); h.card.focused = true;
  const rendered = lines(h.card);
  const text = rendered.join('\n');
  assert.equal(rendered[0], '─'.repeat(80));
  assert.equal(rendered[1], ' Approve this scope?');
  assert.match(text, /Implement the three tasks; no deployment or publishing\./);
  assert.match(text, /docs\/计划\.md · r42/);
  assert.match(text, /^> 1\. Approve as written$/m);
  assert.match(text, /^  2\. Request changes$/m);
  assert.match(text, /^  3\. Not now$/m);
  assert.match(text, /^UP\/DOWN choose · GO review · ESC cancel$/m);
  assert.doesNotMatch(text, /Implement the plan|Approval|Choose one|\([ x]\)|Note · optional/);
  assert.deepEqual(h.backgrounds, []);
});

test('approval navigation follows visible rows and feedback Back returns to Request changes', () => {
  const h = setup(approval); h.card.focused = true;
  h.keys(token.down);
  assert.match(view(h.card), /^> 2\. Request changes$/m);
  assert.match(view(h.card), /GO edit/);
  h.keys(token.confirm, 'Keep this draft', token.cancel);
  assert.match(view(h.card), /^> 2\. Request changes$/m);
  assert.equal(h.card.editor.getExpandedText(), 'Keep this draft');
  h.keys(token.down, token.down);
  assert.equal(h.card.controller.state.step, 'choose');
  assert.match(view(h.card), /^> 3\. Not now$/m);
  assert.equal(h.card.editor.focused, false, 'Down at the final visible row must not open a hidden fourth choice');
  h.keys(token.up, token.confirm, '\x01', token.up);
  assert.match(view(h.card), /^> 2\. Request changes$/m);
  assert.equal(h.results.length, 0);
});

test('approval feedback has no generic note and returns needs_discussion', () => {
  const h = setup(approval); h.card.focused = true;
  h.keys(token.down, token.confirm, 'Run a dry run first', kittyEnter.press);
  assert.equal(h.card.controller.state.step, 'review');
  const review = view(h.card);
  assert.match(review, /^> Request changes$/m);
  assert.match(review, /Run a dry run first/);
  assert.match(review, /^TAB then GO send feedback · ESC back$/m);
  assert.doesNotMatch(review, /Note .*optional|No approval granted|warning/i);
  armAndSendApproval(h);
  assert.equal(h.results[0].details.status, 'needs_discussion');
  assert.equal(h.results[0].details.approved, false);
});

test('any pending approval feedback, including whitespace, must be explicitly cleared before bare approval', () => {
  for (const feedback of ['Please change it', '   ']) {
    const h = setup(approval); h.card.focused = true;
    h.keys(feedback, token.cancel, token.up, token.confirm);
    assert.equal(h.results.length, 0);
    assert.equal(h.card.controller.state.step, 'custom');
    assert.match(view(h.card), /Clear your feedback first/);
    h.keys(token.cancel, token.up);
    assert.match(view(h.card), /CLEAR clear feedback/);
    h.keys(token.clear);
    assert.equal(h.card.editor.getExpandedText(), '');
    h.keys(token.cancel, token.up, kittyEnter.press);
    assert.equal(h.card.controller.state.answer.optionId, 'approve');
    armAndSendApproval(h);
    assert.equal(h.results[0].details.approved, true);
    assert.equal(h.results[0].details.answer.note, '');
  }
});

test('approval Enter is release-aware, rejects repeats and unrelated releases, and fails closed on raw CR', () => {
  const h = setup(approval); h.card.focused = true;
  h.keys(token.confirm);
  assert.match(view(h.card), /^TAB then GO send approval · ESC back$/m);
  h.keys(token.confirm, '\r', kittyEnter.repeat, kittySpaceRelease);
  assert.equal(h.results.length, 0);
  h.keys(kittyEnter.release);
  assert.match(view(h.card), /^GO send approval · ESC back$/m);
  h.keys(kittyEnter.repeat);
  assert.equal(h.results.length, 0);
  h.keys(kittyEnter.press);
  assert.equal(h.results.length, 1);
  assert.equal(h.results[0].details.approved, true);
});

test('Ctrl+Enter opening release arms a fresh plain Enter even if Ctrl is released first', () => {
  for (const release of ['\x1b[13;5:3u', kittyEnter.release]) {
    const h = setup(approval); h.card.focused = true;
    h.keys('Dry run first', '\x1b[13;5u', '\x1b[13;5:2u');
    assert.equal(h.results.length, 0);
    h.keys(release, kittyEnter.press);
    assert.equal(h.results.length, 1);
    assert.equal(h.results[0].details.status, 'needs_discussion');
  }
});

test('accepted approval fallback requires Tab then Enter and resets on Back or refocus', () => {
  const h = setup(approval); h.card.focused = true;
  h.keys('\r', '\r', '\r', '\x1b[9;1:2u', '\r');
  assert.equal(h.results.length, 0);
  h.keys('\t', token.cancel, '\r', '\r');
  assert.equal(h.results.length, 0, 'Back resets the fallback');
  h.keys('\t'); h.card.invalidateInputOrigin(); h.keys('\r');
  assert.equal(h.results.length, 0, 'refocus resets the fallback');
  h.keys('\t');
  assert.match(view(h.card), /^GO send approval · ESC back$/m);
  h.keys('\r');
  assert.equal(h.results.length, 1);
  assert.equal(h.results[0].details.approved, true);
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

test('terminal refocus discards activating pointer gestures before a fresh approval click', () => {
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
  assert.equal(sent.focus, false);
});

test('approval option-to-review pointer continuation, resize, double click, and drag cannot authorize', () => {
  const h = setup(approval); h.card.focused = true;
  const optionY = rowOf(h.card, 'Approve as written');
  click(h.card, 1, optionY, { screenX: 10, screenY: 100 });
  assert.equal(h.card.controller.state.step, 'review');
  let rendered = lines(h.card);
  let y = rowOf(h.card, 'send approval');
  let x = rendered[y].indexOf('GO') + 1;

  click(h.card, x, y, { screenX: 10, screenY: 100 });
  assert.equal(h.results.length, 0, 'the continuing absolute click cannot hit relocated Send');
  h.card.handleMouse(mouse('move', x + 1, y, { screenX: 11, screenY: 100 }));

  h.card.handleMouse(mouse('press', x, y));
  h.card.render(36);
  h.card.handleMouse(mouse('click', x, y, { width: 36 }));
  assert.equal(h.results.length, 0, 'resize invalidates the pending rendered-cell target');

  rendered = lines(h.card);
  y = rowOf(h.card, 'send approval');
  x = rendered[y].indexOf('GO') + 1;
  h.card.handleMouse(mouse('press', x, y));
  h.card.handleMouse(mouse('release', x, y));
  h.card.handleMouse(mouse('click', x, y, { clickCount: 2 }));
  assert.equal(h.results.length, 0);
  h.card.handleMouse(mouse('press', x, y));
  h.card.handleMouse(mouse('drag', x + 1, y, { screenX: x + 1 }));
  h.card.handleMouse(mouse('release', x + 1, y, { screenX: x + 1 }));
  h.card.handleMouse(mouse('click', x + 1, y, { screenX: x + 1 }));
  assert.equal(h.results.length, 0);

  const sent = click(h.card, x, y, { screenX: x + 20, screenY: y + 20 });
  assert.equal(h.results[0].details.approved, true);
  assert.equal(sent.focus, false);
});

test('remapped CSI-tilde approval confirmation requires release and rejects repeat as fresh press', () => {
  const customBindings = {
    ...bindings,
    matches(data, action) { return action === 'tui.select.confirm' ? matchesKey(data, 'f6') : bindings.matches(data, action); },
  };
  const h = setup(approval, 48, customBindings); h.card.focused = true;
  h.keys('\x1b[17~', '\x1b[17;1:3~', '\x1b[17;1:2~');
  assert.equal(h.results.length, 0);
  h.keys('\x1b[17~');
  assert.equal(h.results[0].details.approved, true);
});

test('long approval review remains scrollable with arrows while guarded actions stay fixed', () => {
  const scope = `START_SCOPE ${'Unicode 中文 scope detail. '.repeat(30)} END_SCOPE`;
  const h = setup({ ...approval, scope: { action: scope } }, 24); h.card.focused = true; h.tui.mode = 'fullscreen';
  h.keys(token.confirm);
  let visited = view(h.card, 36);
  for (let index = 0; index < 30; index++) { h.keys(token.down); visited += view(h.card, 36); }
  for (let index = 0; index < 30; index++) { h.keys(token.up); visited += view(h.card, 36); }
  assert.match(visited, /START_SCOPE/);
  assert.match(visited, /END_SCOPE/);
  assert.match(view(h.card, 36), /at edges scroll/);
  assert.match(view(h.card, 36), /send approval/);
  assert.equal(h.results.length, 0);
});

test('long Unicode scope scrolls within bounds while controls remain reachable across widths', () => {
  const long = { ...approval, scope: { ...approval.scope, action: `${'Unicode 中文 🦊 scope detail. '.repeat(30)}END_SCOPE` } };
  const h = setup(long, 24); h.card.focused = true;
  for (const width of [1, 20, 36, 80, 20]) {
    h.card.invalidate();
    const rendered = lines(h.card, width);
    assert.ok(rendered.every((line) => visibleWidth(line) <= width), `line exceeded width ${width}`);
    assert.ok(rendered.length <= 18, `height exceeded at width ${width}`);
  }
  let visited = '';
  for (let i = 0; i < 80; i++) {
    const rendered = view(h.card, 36);
    visited += rendered;
    assert.match(rendered, /ESC cancel/);
    h.keys(token.pageDown);
  }
  assert.match(visited, /END_SCOPE/);
  assert.match(visited, /PGUP\/PGDOWN scroll/);
  assert.match(view(h.card, 36), /↓0/);
  assert.equal(h.results.length, 0);
});
