import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/pi-runtime.mjs';
const { AskCard } = await import('../extensions/pi/hog-ask-ui.ts');
const { normalizeQuestion } = await import('../extensions/pi/hog-ask-core.mjs');
const { visibleWidth } = await import('@earendil-works/pi-tui');

const actions = {
  'tui.select.up': 'UP', 'tui.select.down': 'DOWN', 'tui.select.pageUp': 'PGUP', 'tui.select.pageDown': 'PGDOWN',
  'tui.select.confirm': 'GO', 'tui.select.cancel': 'ESC', 'app.interrupt': 'ABORT', 'tui.input.submit': 'SEND', 'tui.input.newLine': 'NL',
};
const bindings = { matches: (data, action) => data === actions[action], getKeys: (action) => actions[action] ? [actions[action]] : [] };
const decision = { id: 'audience', purpose: 'decision', title: 'Rollout audience', question: 'Who should have access first?', context: 'One pilot release.', options: [
  { id: 'internal', label: 'Internal only', description: 'Validate with support before broader exposure.' },
  { id: 'public', label: 'Public', description: 'Wider reach and more rollout risk.' },
], recommendation: { optionId: 'internal', reason: 'A smaller pilot reduces risk.' } };
const approval = { id: 'implementation', purpose: 'approval', title: 'Implement the plan', question: 'Approve this scope?', scope: { action: 'Implement the three tasks; no deployment or publishing.', artifactPath: 'docs/计划.md', revision: 'r42' } };
function setup(input = decision, rows = 48) {
  const results = [], calls = [];
  const theme = { fg: (kind, text) => { calls.push(kind); return text; } };
  const tui = { terminal: { rows }, renders: 0, requestRender() { this.renders++; } };
  const card = new AskCard(normalizeQuestion(input), tui, theme, bindings, (result) => results.push(result));
  return { card, results, calls, tui, keys: (...keys) => keys.forEach((key) => card.handleInput(key)) };
}
const view = (card, width = 80) => card.render(width).join('\n');
const send = (h) => h.keys('DOWN', 'DOWN', 'GO'); // review starts on Back, not Send

test('recommendation, focus and draft selection cannot submit an answer', () => {
  const h = setup();
  assert.equal(h.card.controller.state.answer, null);
  assert.match(view(h.card), /\( \) Internal only \[recommended\]/);
  h.keys('DOWN');
  assert.match(view(h.card), /> \( \) Public/);
  assert.equal(h.card.controller.state.answer, null);
  h.keys('\r'); // default Enter does not bypass injected keybindings
  assert.equal(h.card.controller.state.step, 'choose');
  h.keys('GO');
  assert.match(view(h.card), /Review answer — not yet submitted/);
  assert.equal(h.results.length, 0);
  h.keys('GO'); // neutral Back
  assert.match(view(h.card), /\(x\) Public/);
  assert.equal(h.results.length, 0);
});

test('plain approval requires selection, review, and explicit Send', () => {
  const h = setup(approval);
  assert.doesNotMatch(view(h.card), /\(x\)|recommended/);
  h.keys('GO', 'GO'); // choose -> Back, not approve
  assert.equal(h.results.length, 0);
  h.keys('GO'); send(h);
  assert.equal(h.results[0].details.approved, true);
  assert.equal(h.results[0].details.answer.optionId, 'approve');
});

test('blank custom text stays editable; custom draft survives Back; qualification is reviewed', () => {
  const h = setup(); h.card.focused = true;
  h.keys('DOWN', 'DOWN', 'GO', 'SEND');
  assert.equal(h.card.controller.state.step, 'custom');
  assert.match(view(h.card), /answer must be/);
  h.keys('不同的答案 🦊', 'ESC');
  assert.equal(h.card.editor.focused, false);
  h.keys('GO');
  assert.equal(h.card.editor.getExpandedText(), '不同的答案 🦊');
  h.keys('NL', 'with support', 'SEND');
  assert.match(view(h.card), /Answer: 不同的答案 🦊/);
  h.keys('DOWN', 'GO', 'Include the support team', 'SEND');
  assert.match(view(h.card), /Note: Include the support team/);
  assert.equal(h.results.length, 0);
  send(h);
  assert.deepEqual(h.results[0].details.answer, { kind: 'custom', text: '不同的答案 🦊\nwith support', note: 'Include the support team' });
});

test('native bracketed paste returns full text, not a collapsed paste marker', () => {
  const h = setup();
  h.keys('DOWN', 'DOWN', 'GO');
  const text = 'Full pasted answer. '.repeat(50).trim();
  h.keys(`\x1b[200~${text}\x1b[201~`, 'SEND');
  send(h);
  assert.equal(h.results[0].details.answer.text, text);
});

test('approval notes and custom answers visibly need discussion before Send', () => {
  for (const custom of [false, true]) {
    const h = setup(approval);
    if (custom) h.keys('DOWN', 'DOWN', 'DOWN', 'GO', 'Only after a dry run', 'SEND');
    else h.keys('GO', 'DOWN', 'GO', 'thanks', 'SEND');
    assert.match(view(h.card), /No approval granted.*needs discussion/);
    assert.equal(h.results.length, 0);
    send(h);
    assert.equal(h.results[0].details.status, 'needs_discussion');
    assert.equal(h.results[0].details.approved, false);
  }
});

test('clearing a note is explicit, and changing options does not transfer its meaning', () => {
  const h = setup(); h.keys('GO', 'DOWN', 'GO', 'Only internal', 'SEND');
  h.keys('DOWN', 'GO'); h.card.editor.setText(''); h.keys('SEND');
  assert.equal(h.card.controller.state.answer.note, '');
  h.keys('GO', 'DOWN', 'GO'); // back/change to public
  assert.equal(h.card.controller.state.answer.optionId, 'public');
  assert.equal(h.card.controller.state.answer.note, '');
});

test('focus reaches native Editor only while editing and cannot revive after disposal', () => {
  const h = setup(); h.card.focused = true;
  assert.equal(h.card.editor.focused, false);
  h.keys('DOWN', 'DOWN', 'GO'); assert.equal(h.card.editor.focused, true);
  h.card.focused = false; assert.equal(h.card.editor.focused, false);
  h.card.focused = true; assert.equal(h.card.editor.focused, true);
  h.card.dispose(); h.card.focused = true;
  h.keys('late answer', 'SEND', 'ESC');
  assert.equal(h.card.focused, false);
  assert.equal(h.card.editor.focused, false);
  assert.deepEqual(h.results, []);
});

test('dismissal and late inputs emit exactly once, without approval', () => {
  for (const state of ['choose', 'review']) {
    const h = setup(approval); if (state === 'review') h.keys('GO');
    h.keys('ESC', 'GO', 'DOWN', 'DOWN', 'GO');
    assert.equal(h.results.length, 1);
    assert.equal(h.results[0].details.status, 'dismissed');
    assert.equal(h.results[0].details.approved, false);
  }
});

test('resize/Unicode/theme render stays bounded; long content remains reachable by configured paging', () => {
  const h = setup({ ...approval, scope: { ...approval.scope, action: `${'Unicode 中文 🦊 scope. '.repeat(40)}END_SCOPE` } }, 26);
  for (const width of [1, 20, 40, 80, 20]) {
    h.card.invalidate();
    const lines = h.card.render(width);
    assert.ok(lines.every((line) => visibleWidth(line) <= width), `width ${width}`);
    assert.ok(lines.length <= 20);
  }
  h.keys('PGUP');
  let visited = '';
  for (let i = 0; i < 50; i++) { visited += view(h.card, 40); h.keys('PGDOWN'); }
  assert.match(visited, /END_SCOPE/);
  assert.match(visited, /PGUP\/PGDOWN scroll/);
  assert.match(visited, /ESC\s+dismiss/); // final line is not permanently hidden
  assert.match(view(h.card, 40), /↓ 0 below/);
  h.keys('GO', 'DOWN', 'GO', 'qualified', 'SEND');
  visited = '';
  for (let i = 0; i < 50; i++) { visited += view(h.card, 40); h.keys('PGDOWN'); }
  assert.match(visited, /No approval granted/);
  assert.ok(h.calls.includes('warning'));
});

test('menu-edge arrows expose long scope and review when fullscreen owns page keys', () => {
  const h = setup({ ...approval, scope: { action: `${'A long scope detail. '.repeat(50)}END_SCOPE` } }, 24);
  view(h.card, 36);
  h.keys('DOWN');
  assert.match(view(h.card, 36), /Revise the scope/);
  h.keys('UP');
  let visited = view(h.card, 36);
  for (let i = 0; i < 12; i++) { h.keys('UP'); visited += view(h.card, 36); }
  assert.match(visited, /END_SCOPE/);
  assert.match(visited, /Approval: Implement the plan/);
  assert.equal(h.card.controller.state.answer, null);
  assert.equal(h.results.length, 0);
  h.keys('GO', 'DOWN'); view(h.card, 36);
  h.keys('UP');
  visited = view(h.card, 36);
  for (let i = 0; i < 12; i++) { h.keys('UP'); visited += view(h.card, 36); }
  assert.match(visited, /END_SCOPE/);
  assert.equal(h.results.length, 0);
});
