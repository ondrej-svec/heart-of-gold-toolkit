import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Creates/closes its own isolated target. Pointer tests use actual CDP coordinates.
const [url, output] = process.argv.slice(2);
if (!url || !output || !process.env.BROWSER_CDP_MODULE) throw new Error('Usage: BROWSER_CDP_MODULE=/path/to/cdp.js BROWSER_DEBUG_PORT=9337 node verify-browser.mjs URL OUTPUT_DIRECTORY');
const { connect } = await import(pathToFileURL(process.env.BROWSER_CDP_MODULE).href);
const cdp = await connect();
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const session = await cdp.attachToPage(targetId);
const errors = [], checks = [];
const off = cdp.on('Runtime.exceptionThrown', (event, origin) => { if (origin === session) errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text); });
const evaluate = expr => cdp.evaluate(session, expr);
const setup = name => evaluate(`document.querySelector('[data-scenario="${name}"]').click()`);
const snapshot = () => evaluate('window.previewSnapshot()');
const check = (name, fn) => { fn(); checks.push(name); };
const rect = selector => evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
const keycodes = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, PageDown: 34, PageUp: 33 };
async function key(key, { shift = false, ctrl = false, repeat = false } = {}) {
  const text = key === 'Enter' ? '\r' : key.length === 1 && !ctrl ? key : undefined;
  const params = { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, windowsVirtualKeyCode: keycodes[key] || key.toUpperCase().charCodeAt(0), modifiers: (shift ? 8 : 0) | (ctrl ? 2 : 0) };
  await cdp.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...params, autoRepeat: repeat, ...(text ? { text, unmodifiedText: text } : {}) }, session);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...params }, session);
}
const type = text => cdp.send('Input.insertText', { text }, session);
async function replace(text) { await evaluate('document.activeElement.select()'); await type(text); }
async function mouse(type, x, y, extra = {}) { await cdp.send('Input.dispatchMouseEvent', { type, x, y, ...extra }, session); }
async function point(selector, { click = true, padding = false } = {}) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);
  const r = await rect(selector), x = r.x + (padding ? r.width - 2 : r.width / 2), y = r.y + (padding ? r.height - 2 : r.height / 2);
  await mouse('mouseMoved', x, y);
  if (click) { await mouse('mousePressed', x, y, { button: 'left', clickCount: 1 }); await mouse('mouseReleased', x, y, { button: 'left', clickCount: 1 }); }
}
async function drag(selector, from, to) {
  const r = await rect(selector), y = r.y + 11;
  await mouse('mousePressed', r.x + from, y, { button: 'left', clickCount: 1 });
  await mouse('mouseMoved', r.x + to, y, { buttons: 1, button: 'left' });
  await mouse('mouseReleased', r.x + to, y, { button: 'left', clickCount: 1 });
}
async function capture(name) {
  await mouse('mouseMoved', 3, 3); // Don't confuse incidental hover with the initial keyboard focus.
  await evaluate('document.fonts.ready');
  const clip = await evaluate('(() => {const r=document.querySelector(".terminal").getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()');
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true }, session);
  fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(data, 'base64'));
}
async function setting(id, value) { await evaluate(`(() => {const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change'));})()`); }
fs.mkdirSync(output, { recursive: true });
try {
  await cdp.send('Runtime.enable', {}, session);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false }, session);
  await cdp.navigate(session, url);
  for (let i = 0; i < 100; i++) { if (await evaluate('typeof window.previewSnapshot === "function"')) break; await new Promise(r => setTimeout(r, 50)); }
  let s = await snapshot();
  check('Initial focus is not an answer', () => { assert.equal(s.focused, 'internal'); assert.equal(s.state.answer, null); assert.equal(s.result, null); });
  const count = await evaluate('document.querySelectorAll(".choices .choice").length');
  check('Only real decision alternatives occupy the list', () => assert.equal(count, 2));
  const visible = await evaluate('document.querySelector("#custom-answer").getBoundingClientRect().bottom<=document.querySelector("#terminal-body").getBoundingClientRect().bottom');
  check('Custom input visible in normal initial view', () => assert.ok(visible));
  await capture('01-choice-dawn');
  await evaluate('window.originalInput=document.querySelector("#custom-answer")');
  const before = await rect('#custom-answer');
  await key('Enter', { ctrl: true }); s = await snapshot();
  check('Send chord cannot skip initial choice', () => { assert.equal(s.view, 'entry'); assert.equal(s.result, null); assert.equal(s.state.answer, null); });
  await key('ArrowDown'); s = await snapshot();
  check('Down moves focus without selecting', () => { assert.equal(s.focused, 'public'); assert.equal(s.state.answer, null); });
  await key('ArrowDown'); s = await snapshot();
  const after = await rect('#custom-answer'), same = await evaluate('window.originalInput===document.querySelector("#custom-answer")');
  check('Down enters the same editor without geometry jump or answer', () => { assert.equal(s.focused, 'custom-answer'); assert.deepEqual(after, before); assert.ok(same); assert.equal(s.state.answer, null); });
  await key('ArrowUp'); s = await snapshot();
  check('Up at text start returns to the last alternative', () => assert.equal(s.focused, 'public'));
  await key('Tab'); s = await snapshot();
  check('Tab shares the options-to-input route', () => assert.equal(s.focused, 'custom-answer'));
  await key('Tab', { shift: true }); s = await snapshot();
  check('Shift-Tab returns to the preceding option', () => assert.equal(s.focused, 'public'));
  await point('.write-area', { click: false, padding: true }); s = await snapshot();
  check('Hover does not take typing focus or answer', () => { assert.equal(s.focused, 'public'); assert.equal(s.state.answer, null); assert.equal(s.result, null); });
  await point('.write-area .prompt-marker'); s = await snapshot();
  const markerAfter = await rect('#custom-answer');
  check('Marker click focuses the stable editor, without answering', () => { assert.equal(s.focused, 'custom-answer'); assert.deepEqual(markerAfter, before); assert.equal(s.state.answer, null); });
  await type('abcdef'); await key('Escape'); await point('.write-area', { padding: true }); s = await snapshot();
  check('Padding click permits immediate typing without a replacement form', () => { assert.equal(s.focused, 'custom-answer'); assert.equal(s.entryDraft, 'abcdef'); });
  const inputRect = await rect('#custom-answer');
  const char = await evaluate('(() => {const c=document.createElement("canvas").getContext("2d");c.font=getComputedStyle(document.querySelector("#custom-answer")).font;return c.measureText("M").width;})()');
  await mouse('mousePressed', inputRect.x + char * 3.1, inputRect.y + 11, { button: 'left', clickCount: 1 });
  await mouse('mouseReleased', inputRect.x + char * 3.1, inputRect.y + 11, { button: 'left', clickCount: 1 });
  await type('X'); s = await snapshot();
  check('Direct text click places the caret rather than jumping to the end', () => assert.equal(s.entryDraft, 'abcXdef'));
  await drag('#custom-answer', char, char * 4);
  const selection = await evaluate('({start:document.querySelector("#custom-answer").selectionStart,end:document.querySelector("#custom-answer").selectionEnd})');
  s = await snapshot();
  check('Dragging selects text without review or submission', () => { assert.ok(selection.end > selection.start); assert.equal(s.view, 'entry'); assert.equal(s.result, null); });
  await key('Enter', { ctrl: true }); await key('Enter');
  const restored = await evaluate('({start:document.querySelector("#custom-answer").selectionStart,end:document.querySelector("#custom-answer").selectionEnd})');
  check('Back restores the draft selection, not just its text', () => assert.deepEqual(restored, selection));
  await setup('decision'); await key('x'); await type('yz'); await key('Enter'); await key('Enter'); await type('Q'); s = await snapshot();
  check('Continuing after Back appends at the retained caret', () => assert.equal(s.entryDraft, 'xyzQ'));
  await key('Enter', { shift: true }); await type('Next line'); s = await snapshot();
  check('Real Shift+Enter inserts a newline without reviewing', () => { assert.equal(s.entryDraft, 'xyzQ\nNext line'); assert.equal(s.view, 'entry'); });
  await setup('custom'); await type(' More.'); s = await snapshot();
  check('Prefilled examples start with their caret at the end', () => assert.ok(s.entryDraft.endsWith('leads. More.')));
  await setup('decision'); await drag('[data-option="internal"]', 40, 140); s = await snapshot();
  check('Drag over an option does not activate it', () => { assert.equal(s.view, 'entry'); assert.equal(s.state.answer, null); });
  await point('[data-option="public"]'); s = await snapshot();
  check('Real option click opens review, not Send, with Back focus', () => { assert.equal(s.state.answer.optionId, 'public'); assert.equal(s.view, 'review'); assert.equal(s.focused, 'back'); assert.equal(s.result, null); });
  await key('Enter'); s = await snapshot();
  check('Enter on initial review focus goes Back', () => { assert.equal(s.view, 'entry'); assert.equal(s.result, null); });
  await key('I'); await type('nternal + support.\nŽluťoučký kůň — 日本語 🐈 <script>not code</script>'); s = await snapshot();
  check('Type-to-write preserves its first character and literal Unicode', () => { assert.ok(s.entryDraft.startsWith('Internal')); assert.ok(s.entryDraft.includes('<script>not code</script>')); assert.equal(s.focused, 'custom-answer'); });
  await capture('02-custom-dawn');
  await key('Enter', { ctrl: true }); s = await snapshot();
  check('Editor send chord only opens review', () => { assert.equal(s.view, 'review'); assert.equal(s.result, null); assert.equal(s.focused, 'back'); });
  await key('Enter', { ctrl: true, repeat: true }); s = await snapshot();
  check('Held send chord cannot carry through to submission', () => assert.equal(s.result, null));
  await key('Enter'); s = await snapshot();
  check('Back retains custom text and returns to its editor', () => { assert.ok(s.entryDraft.includes('日本語')); assert.equal(s.focused, 'custom-answer'); });
  await key('Enter'); await key('Tab'); await type('Keep the pilot small.'); await key('Enter', { ctrl: true }); s = await snapshot();
  check('Decision note editor reviews without sending', () => { assert.equal(s.focused, 'back'); assert.equal(s.state.answer.note, 'Keep the pilot small.'); assert.equal(s.result, null); });
  await key('Enter', { ctrl: true }); s = await snapshot();
  check('Explicit Send records custom decision and note literally', () => { assert.equal(s.result.status, 'answered'); assert.ok(s.result.answer.text.includes('日本語')); assert.equal(s.result.answer.note, 'Keep the pilot small.'); });

  await setup('approval'); await capture('03-approval-dawn');
  const labels = await evaluate('[...document.querySelectorAll(".choice strong")].map(el=>el.textContent)');
  check('Approval exposes three distinct intents', () => assert.deepEqual(labels, ['Approve as written', 'Request changes', 'Not now']));
  await evaluate('window.originalInput=document.querySelector("#custom-answer")');
  await point('[data-option="revise"]'); s = await snapshot();
  const retained = await evaluate('window.originalInput===document.querySelector("#custom-answer")');
  check('Request changes focuses existing editor without a blank answer', () => { assert.equal(s.focused, 'custom-answer'); assert.equal(s.state.answer, null); assert.ok(retained); });
  await type('Yes, but let me review the final wording first.'); await key('Enter');
  await capture('04-feedback-dawn');
  const feedbackView = await evaluate('({title:document.querySelector(".answer-summary .field-label").textContent,note:!!document.querySelector("#note"),policy:!!document.querySelector("#policy"),send:document.querySelector("#send").textContent})');
  check('Feedback review has its own intent, no approval note or policy warning', () => { assert.equal(feedbackView.title, 'Request changes'); assert.equal(feedbackView.note, false); assert.equal(feedbackView.policy, false); assert.ok(feedbackView.send.includes('send feedback')); });
  await key('Enter', { ctrl: true }); s = await snapshot();
  check('Feedback records discussion, never approval', () => { assert.equal(s.result.status, 'needs_discussion'); assert.equal(s.result.approved, false); assert.equal(s.result.answer.kind, 'custom'); assert.equal(s.result.answer.text, 'Yes, but let me review the final wording first.'); });
  await setup('bare'); await key('Enter');
  const noNote = await evaluate('!document.querySelector("#note")');
  check('Bare approval review has no generic optional note', () => assert.ok(noNote));
  await capture('05-bare-review-dawn');
  await point('#send', { click: false }); s = await snapshot();
  check('Hovering Send does not change focus or authorize', () => { assert.equal(s.focused, 'back'); assert.equal(s.result, null); });
  await point('.scope'); s = await snapshot();
  check('Pointer refocus on scope cannot authorize', () => assert.equal(s.result, null));
  await evaluate('document.querySelector("#back").focus()'); await key('Tab'); s = await snapshot();
  check('Approval has a Tab-to-Send fallback without Ctrl+Enter', () => { assert.equal(s.focused, 'send'); assert.equal(s.result, null); });
  await key('Enter'); s = await snapshot();
  check('Explicit bare approval preserves exact scope and canonical ID', () => { assert.equal(s.result.approved, true); assert.equal(s.result.answer.optionId, 'approve'); assert.equal(s.result.question.scope.revision, 'demo-r1'); });
  await setup('feedback'); await point('[data-option="approve"]'); s = await snapshot();
  const disabled = await evaluate('document.querySelector("[data-option=approve]").getAttribute("aria-disabled")');
  check('Pending feedback cannot be silently discarded to approve', () => { assert.equal(disabled, 'true'); assert.equal(s.view, 'entry'); assert.ok(s.entryDraft.includes('wording')); assert.equal(s.result, null); });
  await point('#clear'); s = await snapshot();
  check('Clearing feedback is explicit and leaves no answer', () => { assert.equal(s.entryDraft, ''); assert.equal(s.state.answer, null); assert.equal(s.result, null); });
  await point('[data-option="approve"]'); await new Promise(r => setTimeout(r, 550)); await point('#send'); s = await snapshot();
  check('Explicit pointer Send can approve only after feedback is cleared', () => assert.equal(s.result.approved, true));
  await setup('approval'); await key('t'); await type('hanks'); await key('Enter'); await key('Enter', { ctrl: true }); s = await snapshot();
  check('Even courtesy text is feedback, not inferred approval', () => { assert.equal(s.result.status, 'needs_discussion'); assert.equal(s.result.approved, false); });
  await setup('approval'); await key('ArrowDown'); await key('ArrowDown'); await key('Enter'); await key('Enter', { ctrl: true }); s = await snapshot();
  check('Not now retains pause semantics and never approves', () => { assert.equal(s.result.answer.optionId, 'pause'); assert.equal(s.result.approved, false); });
  await setup('approval'); await key('ArrowDown'); await key('Enter'); await type('Draft changes'); await key('Enter'); await key('Escape'); s = await snapshot();
  check('Feedback survives review and Back', () => { assert.equal(s.entryDraft, 'Draft changes'); assert.equal(s.focused, 'custom-answer'); assert.equal(s.result, null); });
  await key('Escape'); await key('Escape'); s = await snapshot();
  check('Dismissal does not submit retained feedback or approval', () => { assert.equal(s.result.status, 'dismissed'); assert.equal(s.result.answer, null); assert.equal(s.result.approved, false); });

  await setup('custom'); await replace(''); await key('Enter'); s = await snapshot();
  check('Blank custom text cannot advance', () => { assert.equal(s.view, 'entry'); assert.ok(s.entryError); assert.equal(s.result, null); });
  await replace(Array.from({ length: 33 }, (_, i) => `Line ${i}`).join('\n')); await key('Enter'); s = await snapshot();
  check('The 32-line bound remains enforced', () => { assert.equal(s.view, 'entry'); assert.ok(s.entryError); });
  await replace('bad\u202Ehidden'); await key('Enter'); s = await snapshot();
  check('Bidi override is rejected instead of concealing text', () => { assert.equal(s.view, 'entry'); assert.match(s.entryError, /plain text/); });
  await setup('feedback'); await replace('x'.repeat(2001)); await key('Enter'); s = await snapshot();
  check('Oversize feedback is preserved and rejected, never truncated', () => { assert.equal(s.entryDraft.length, 2001); assert.equal(s.view, 'entry'); assert.ok(s.entryError); assert.equal(s.result, null); });
  await replace('x'.repeat(2000)); await key('Enter'); await key('Enter', { ctrl: true }); s = await snapshot();
  check('Feedback retains the full 2000-character custom answer capacity', () => { assert.equal(s.result.answer.text.length, 2000); assert.equal(s.result.approved, false); });
  await setup('decision'); await key('Enter'); await key('Tab'); await type('n'.repeat(1001)); await key('Tab'); s = await snapshot();
  check('Invalid decision note cannot reach Send', () => { assert.equal(s.focused, 'note'); assert.ok(s.state.error); assert.equal(s.result, null); });
  await replace('A valid note.'); await key('Tab'); s = await snapshot();
  check('Decision note-to-Send keyboard fallback remains available', () => { assert.equal(s.focused, 'send'); assert.equal(s.result, null); });
  await key('Enter'); s = await snapshot();
  check('Decision fallback sends only on explicit activation', () => assert.equal(s.result.answer.note, 'A valid note.'));

  for (const width of [1280, 390]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false }, session);
    await setting('width', 'narrow'); await setup('approval');
    const row = await rect('[data-option="approve"]'), x = row.x + row.width / 2, y = row.y + row.height - 5;
    await mouse('mousePressed', x, y, { button: 'left', clickCount: 1 });
    await mouse('mouseReleased', x, y, { button: 'left', clickCount: 1 });
    const sendRect = await rect('#send');
    check(`${width}px double-click regression hits the actual reflow overlap`, () => { assert.ok(x >= sendRect.x && x <= sendRect.x + sendRect.width && y >= sendRect.y && y <= sendRect.y + sendRect.height); });
    for (const count of [2, 3, 1]) {
      await mouse('mousePressed', x, y, { button: 'left', clickCount: count });
      await mouse('mouseReleased', x, y, { button: 'left', clickCount: count });
      s = await snapshot();
      check(`${width}px continued/rapid click ${count} cannot authorize after reflow`, () => { assert.equal(s.view, 'review'); assert.equal(s.result, null); });
    }
    await new Promise(r => setTimeout(r, 550));
    await mouse('mousePressed', x, y, { button: 'left', clickCount: 2 });
    await mouse('mouseReleased', x, y, { button: 'left', clickCount: 2 }); s = await snapshot();
    check(`${width}px continuing double-click stays blocked after pointer arming`, () => assert.equal(s.result, null));
    await mouse('mousePressed', x, y, { button: 'left', clickCount: 1 });
    await mouse('mouseReleased', x, y, { button: 'left', clickCount: 1 }); s = await snapshot();
    check(`${width}px fresh explicit pointer Send works after review`, () => assert.equal(s.result.approved, true));
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false }, session);
  await setting('width', 'normal'); await setup('decision'); await point('[data-option="public"]'); await point('#send'); s = await snapshot();
  check('Rapid reset-detail pointer Send is also blocked for ordinary decisions', () => assert.equal(s.result, null));
  await new Promise(r => setTimeout(r, 550)); await point('#send'); s = await snapshot();
  check('Fresh deliberate decision pointer Send remains usable', () => assert.equal(s.result.status, 'answered'));

  await setting('theme', 'dark'); await setup('decision'); await capture('06-choice-moon');
  await setup('approval'); await capture('07-approval-moon');
  await setup('feedback'); await key('Enter'); await capture('08-feedback-moon');
  await setting('theme', 'light'); await setting('width', 'narrow'); await setup('decision'); await capture('09-choice-narrow');
  await key('ArrowDown'); await key('ArrowDown'); s = await snapshot();
  const narrowVisible = await evaluate('document.querySelector("#custom-answer").getBoundingClientRect().bottom<=document.querySelector("#terminal-body").getBoundingClientRect().bottom');
  check('Narrow navigation brings custom input into view', () => { assert.equal(s.focused, 'custom-answer'); assert.ok(narrowVisible); });
  await setup('approval'); await capture('10-approval-narrow');
  await setup('feedback'); await key('Enter'); await capture('11-feedback-narrow');
  const height = await evaluate('document.querySelector(".terminal").getBoundingClientRect().height');
  check('Narrow feedback fits the 24-row-style height budget', () => assert.ok(height <= 528));
  await setup('long'); await key('PageDown');
  const paged = await evaluate('document.querySelector("#terminal-body").scrollTop');
  check('Preview paging keys reach long content', () => assert.ok(paged > 0));
  const footerBefore = await rect('.terminal-footer');
  const scroll = await evaluate('(() => {const b=document.querySelector("#terminal-body");b.scrollTop=b.scrollHeight;return {top:b.scrollTop,max:b.scrollHeight-b.clientHeight,horizontal:b.scrollWidth>b.clientWidth};})()');
  const footerAfter = await rect('.terminal-footer');
  check('Long scope scrolls without moving controls or horizontal overflow', () => { assert.ok(scroll.top > 0); assert.equal(scroll.top, scroll.max); assert.equal(scroll.horizontal, false); assert.deepEqual(footerAfter, footerBefore); });
  await capture('12-long-scope-scrolled');
  await setup('four'); for (let i = 0; i < 4; i++) await key('ArrowDown'); s = await snapshot();
  check('Four-alternative navigation includes custom entry', () => { assert.equal(s.focused, 'custom-answer'); assert.equal(s.state.answer, null); });
  await setting('width', 'normal'); await setup('decision');
  await mouse('mouseMoved', 3, 3);
  fs.writeFileSync(path.join(output, 'overview.png'), await cdp.screenshot(session));
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false }, session);
  const overflow = await evaluate('document.documentElement.scrollWidth>innerWidth');
  check('Small browser viewport has no horizontal overflow', () => assert.equal(overflow, false));
  await capture('13-small-browser');
  check('No runtime exceptions', () => assert.deepEqual(errors, []));
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ url, revision: '03', type: 'browser-preview-only', nativeTerminalProof: false, pointerEvents: 'CDP coordinates, not element.click()', checks, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, output }, null, 2));
} catch (error) { console.error('Passed before failure:', checks.length, '\nState:', await snapshot()); throw error; }
finally { off(); await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close(); }
