import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Uses the workstation's existing isolated CDP helper. Never attaches to a user tab.
const [url, output] = process.argv.slice(2);
if (!url || !output || !process.env.BROWSER_CDP_MODULE) throw new Error('Usage: BROWSER_CDP_MODULE=/path/to/cdp.js BROWSER_DEBUG_PORT=9337 node verify-browser.mjs URL OUTPUT_DIRECTORY');
const { connect } = await import(pathToFileURL(process.env.BROWSER_CDP_MODULE).href);
const cdp = await connect();
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const session = await cdp.attachToPage(targetId);
const errors = [], checks = [];
const off = cdp.on('Runtime.exceptionThrown', (event, origin) => { if (origin === session) errors.push(event.exceptionDetails.text); });
const evaluate = expr => cdp.evaluate(session, expr);
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const snapshot = () => evaluate('window.previewSnapshot()');
const check = (name, fn) => { fn(); checks.push(name); };
const keycodes = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, PageDown: 34, PageUp: 33 };
async function key(key, { shift = false, ctrl = false, repeat = false } = {}) {
  const text = key === 'Enter' ? '\r' : key.length === 1 && !ctrl ? key : undefined;
  const params = { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, windowsVirtualKeyCode: keycodes[key] || key.toUpperCase().charCodeAt(0), modifiers: (shift ? 1 : 0) | (ctrl ? 2 : 0) };
  await cdp.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...params, autoRepeat: repeat, ...(text ? { text, unmodifiedText: text } : {}) }, session);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...params }, session);
}
async function type(text) { await cdp.send('Input.insertText', { text }, session); }
async function capture(name) {
  await evaluate('document.fonts.ready');
  const rect = await evaluate('(() => {const r=document.querySelector(".terminal").getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()');
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: rect, captureBeyondViewport: true }, session);
  fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(data, 'base64'));
}
async function setting(id, value) { await evaluate(`(() => {const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change'));})()`); }
async function note(text) { await key('Tab'); assert.equal((await snapshot()).focused, 'note'); await evaluate('document.querySelector("#note").value=""'); await type(text); }
fs.mkdirSync(output, { recursive: true });
try {
  await cdp.send('Runtime.enable', {}, session);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false }, session);
  await cdp.navigate(session, url);
  for (let i = 0; i < 100; i++) { if (await evaluate('typeof window.previewSnapshot === "function"')) break; await new Promise(r => setTimeout(r, 50)); }
  let s = await snapshot();
  check('Initial focus is not an answer', () => { assert.equal(s.focused, 'internal'); assert.equal(s.state.answer, null); assert.equal(s.result, null); });
  const choiceCount = await evaluate('document.querySelectorAll(".choices .choice").length');
  check('Only real alternatives inhabit the list', () => assert.equal(choiceCount, 2));
  await capture('01-choice-dawn');
  const ownVisible = await evaluate('(() => {const a=document.querySelector("#custom-answer").getBoundingClientRect();const b=document.querySelector("#terminal-body").getBoundingClientRect();return a.bottom<=b.bottom;})()');
  check('Custom entry visible in normal initial view', () => assert.equal(ownVisible, true));
  await key('Enter', { ctrl: true }); s = await snapshot();
  check('Send chord cannot skip initial choice', () => { assert.equal(s.state.step, 'choose'); assert.equal(s.state.answer, null); assert.equal(s.result, null); });
  await key('ArrowDown'); s = await snapshot();
  check('Arrow navigation does not select or send', () => { assert.equal(s.focused, 'public'); assert.equal(s.state.answer, null); assert.equal(s.result, null); });
  await key('Enter'); s = await snapshot();
  check('Choosing opens review with neutral Back focus', () => { assert.equal(s.state.answer.optionId, 'public'); assert.equal(s.state.step, 'review'); assert.equal(s.focused, 'back'); assert.equal(s.result, null); });
  await key('Enter'); s = await snapshot();
  check('Enter on initial review focus goes Back, not Send', () => { assert.equal(s.state.step, 'choose'); assert.equal(s.result, null); });
  await key('I'); s = await snapshot();
  check('Typing opens custom entry and preserves the first character', () => { assert.equal(s.state.step, 'custom'); assert.equal(s.state.textDraft, 'I'); assert.equal(s.result, null); });
  await type('nternal + support leads.\nŽluťoučký kůň — 日本語 🐈 <script>not code</script>');
  await capture('02-custom-dawn');
  await key('Enter', { ctrl: true }); s = await snapshot();
  check('Send chord from custom entry only opens review', () => { assert.equal(s.state.step, 'review'); assert.equal(s.result, null); });
  await key('Enter', { ctrl: true, repeat: true }); s = await snapshot();
  check('Held send chord cannot carry through from editing to submission', () => assert.equal(s.result, null));
  check('Custom text and Unicode reach review literally', () => { assert.equal(s.state.answer.kind, 'custom'); assert.ok(s.state.answer.text.includes('<script>not code</script>')); assert.equal(s.focused, 'back'); });
  await key('Enter'); s = await snapshot();
  check('Back retains custom draft', () => { assert.ok(s.state.customDraft.includes('日本語')); assert.equal(s.result, null); });
  await key('Tab'); await key('Enter');
  await note('Keep the pilot small.'); await key('Enter', { ctrl: true }); s = await snapshot();
  check('Send chord from note editing reviews without sending', () => { assert.equal(s.focused, 'back'); assert.equal(s.result, null); assert.equal(s.state.answer.note, 'Keep the pilot small.'); });
  await key('Enter', { ctrl: true }); s = await snapshot();
  check('Explicit Send records custom answer and note in simulator', () => { assert.equal(s.result.status, 'answered'); assert.equal(s.result.answer.note, 'Keep the pilot small.'); assert.equal(s.result.approved, false); });

  await click('[data-scenario="approval"]');
  await capture('03-qualified-dawn');
  const noteVisible = await evaluate('(() => {const n=document.querySelector("#note").getBoundingClientRect();const b=document.querySelector("#terminal-body").getBoundingClientRect();return n.bottom<=b.bottom;})()');
  check('Normal approval review shows the qualification without scrolling', () => assert.equal(noteVisible, true));
  const policyVisible = await evaluate('(() => {const p=document.querySelector("#policy").getBoundingClientRect();const f=document.querySelector(".terminal-footer").getBoundingClientRect();return p.top>=f.top && p.bottom<=f.bottom;})()');
  check('Quiet feedback cue stays with fixed controls', () => assert.equal(policyVisible, true));
  const cue = await evaluate('({text:document.querySelector("#policy").textContent,color:getComputedStyle(document.querySelector("#policy")).color,secondary:getComputedStyle(document.querySelector(".meta")).color,label:document.querySelector("#send").textContent})');
  check('Qualification is neutral feedback, not an error warning', () => { assert.equal(cue.text, 'Let’s resolve your note first.'); assert.equal(cue.color, cue.secondary); assert.ok(cue.label.includes('send feedback')); });
  await key('Enter', { ctrl: true }); s = await snapshot();
  check('Qualified Approve becomes discussion, not approval', () => { assert.equal(s.result.status, 'needs_discussion'); assert.equal(s.result.approved, false); assert.equal(s.result.answer.note, 'Yes, but let me review the final wording first.'); });
  await click('[data-scenario="bare"]'); await key('Enter'); await key('Enter', { ctrl: true }); s = await snapshot();
  check('Bare approval keeps exact scope in simulated outcome', () => { assert.equal(s.result.status, 'answered'); assert.equal(s.result.approved, true); assert.equal(s.result.question.scope.revision, 'demo-r1'); });
  await click('[data-scenario="bare"]'); await key('Enter'); await note('thanks'); await key('Enter'); await key('Enter', { ctrl: true }); s = await snapshot();
  check('Even a courtesy note prevents approval', () => { assert.equal(s.result.status, 'needs_discussion'); assert.equal(s.result.approved, false); });
  await click('[data-scenario="bare"]'); await key('Tab'); await type('Yes, but test first.'); await key('Enter'); await key('Enter', { ctrl: true }); s = await snapshot();
  check('Custom approval text cannot approve', () => { assert.equal(s.result.status, 'needs_discussion'); assert.equal(s.result.approved, false); });

  await click('[data-scenario="decision"]'); await key('Enter'); await key('Tab'); s = await snapshot();
  check('Tab goes directly to note editing', () => assert.equal(s.focused, 'note'));
  await key('Tab'); s = await snapshot();
  check('Explicit Send remains available without modified Enter', () => { assert.equal(s.focused, 'send'); assert.equal(s.result, null); });
  await key('Enter'); s = await snapshot();
  check('Keyboard fallback sends only on explicit activation', () => assert.equal(s.result.status, 'answered'));
  await click('[data-scenario="decision"]'); await key('Enter'); await key('Escape'); s = await snapshot();
  check('Escape goes back from review without answering', () => { assert.equal(s.state.step, 'choose'); assert.equal(s.result, null); });
  await key('Escape'); s = await snapshot();
  check('Escape dismisses with no answer', () => { assert.equal(s.result.status, 'dismissed'); assert.equal(s.result.answer, null); assert.equal(s.result.approved, false); });
  await click('[data-scenario="custom"]');
  await evaluate('document.querySelector("#custom-answer").value=""'); await key('Enter'); s = await snapshot();
  check('Blank custom answer cannot advance', () => { assert.equal(s.state.step, 'custom'); assert.ok(s.state.error); assert.equal(s.result, null); });
  await type(Array.from({length:33}, (_,i)=>`Line ${i}`).join('\n')); await key('Enter'); s = await snapshot();
  check('Multiline limit is enforced', () => { assert.equal(s.state.step, 'custom'); assert.ok(s.state.error); });

  await setting('theme', 'dark'); await click('[data-scenario="decision"]'); await capture('04-choice-moon');
  await click('[data-scenario="approval"]'); await capture('05-qualified-moon');
  await setting('theme', 'light'); await setting('width', 'narrow'); await click('[data-scenario="decision"]'); await capture('06-choice-narrow');
  await click('[data-scenario="long"]');
  await key('PageDown');
  const paged = await evaluate('document.querySelector("#terminal-body").scrollTop');
  check('Paging keys scroll content inside the preview', () => assert.ok(paged > 0));
  const before = await evaluate('document.querySelector(".terminal-footer").getBoundingClientRect().top');
  const scroll = await evaluate('(() => {const b=document.querySelector("#terminal-body");b.scrollTop=b.scrollHeight;return {top:b.scrollTop,max:b.scrollHeight-b.clientHeight,footer:document.querySelector(".terminal-footer").getBoundingClientRect().top,horizontal:b.scrollWidth>b.clientWidth};})()');
  check('Long narrow scope scrolls without moving footer or overflowing horizontally', () => { assert.ok(scroll.top > 0); assert.equal(scroll.top, scroll.max); assert.equal(scroll.footer, before); assert.equal(scroll.horizontal, false); });
  await capture('07-long-scope-scrolled');
  await click('[data-scenario="approval"]'); await capture('08-qualified-narrow');
  const boundedHeight = await evaluate('document.querySelector(".terminal").getBoundingClientRect().height');
  check('Narrow approval stays within the 24-row-style height budget', () => assert.ok(boundedHeight <= 528));
  await click('[data-scenario="four"]');
  const fourCount = await evaluate('document.querySelectorAll(".choice").length');
  check('Four real alternatives supported', () => assert.equal(fourCount, 4));
  await setting('width', 'normal'); await click('[data-scenario="decision"]');
  const full = await cdp.screenshot(session); fs.writeFileSync(path.join(output, 'overview.png'), full);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false }, session);
  const horizontalOverflow = await evaluate('document.documentElement.scrollWidth>innerWidth');
  check('Small browser viewport has no horizontal overflow', () => assert.equal(horizontalOverflow, false));
  await capture('09-small-browser');
  check('No runtime exceptions', () => assert.deepEqual(errors, []));
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ url, type: 'browser-preview-only', nativeTerminalProof: false, checks, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, output }, null, 2));
} finally {
  off(); await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); cdp.close();
}
