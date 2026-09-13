import { normalizeQuestion, createController, outcome } from './hog-ask-core.js';

// Browser-only design adapter. No Pi bridge, network, storage, or real actions.
const $ = (selector) => document.querySelector(selector);
const escape = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const decision = {
  id: 'preview-audience', purpose: 'decision', title: 'Rollout audience',
  question: 'Who should get access first?',
  options: [
    { id: 'internal', label: 'Internal only', description: 'A small pilot limits early exposure.' },
    { id: 'public', label: 'Public', description: 'Broader feedback, with greater rollout risk.' },
  ],
  recommendation: { optionId: 'internal', reason: 'A small pilot limits early exposure.' },
};
const approval = {
  id: 'preview-approval', purpose: 'approval', title: 'Example release note',
  question: 'Approve this example scope?',
  scope: {
    action: 'Publish the example release note to the internal team only. Excludes public posting and product deployment.',
    artifactPath: 'examples/release-note.md', revision: 'demo-r1',
  },
};
const descriptions = {
  decision: ['01', 'Focus, not a tick.', 'A filled row says where your keyboard is. Enter opens review; moving never answers.', 'Your own answer lives below the alternatives. Dismissal lives in the footer.'],
  custom: ['02', 'Your words belong here.', 'Not “Other” at the bottom of a checklist. A proper answer field, with room to qualify what you mean.', 'Enter opens review. Back keeps your draft. Nothing is sent while you type.'],
  approval: ['03', 'A qualification changes the result.', '“Approve, but…” is not a clean approval. The note stays with the answer, and the warning names the actual outcome.', 'Back has initial focus. Sending requires moving to an explicit Send control.'],
  bare: ['03', 'Approve only this scope.', 'Only an unqualified Approve response can produce approved: true in the simulator.', 'The example scope is always available. This page never records a real authorization.'],
  long: ['03', 'The content moves. Controls stay.', 'A long scope scrolls inside the answer area, not past the keyboard controls.', 'All scope text stays available. This browser layout is not proof of native Pi scrolling.'],
  four: ['01', 'Same shape, more alternatives.', 'Real alternatives share one list. Other actions do not pretend to be choices.', 'The highlighted row still means focus—not a tick or an answer.'],
};
let scenario = 'decision', question, controller, result = null;

function header(review = false) {
  return `<div class="meta"><span>${escape(question.title)}</span><span>${review ? 'Review · not sent' : question.purpose === 'approval' ? 'Approval · choose one' : 'Choose one'}</span></div>
    <h2 class="question">${escape(question.question)}</h2>
    ${question.context ? `<p class="context">${escape(question.context)}</p>` : ''}
    ${question.scope ? `<section class="scope" aria-label="Exact example scope"><div class="scope-label">Exact scope</div><p>${escape(question.scope.action)}</p><p class="scope-meta">${escape(question.scope.artifactPath)} · ${escape(question.scope.revision)}</p></section>` : ''}`;
}
function help(parts) { return `<div class="help">${parts.map(([key, text]) => `<span><kbd>${escape(key)}</kbd> ${escape(text)}</span>`).join('')}</div>`; }
function focus(selector) { $(selector)?.focus({ preventScroll: true }); }
function keepVisible(element) {
  const body = $('#terminal-body'), box = body.getBoundingClientRect(), rect = element.getBoundingClientRect();
  if (rect.bottom > box.bottom) body.scrollTop += rect.bottom - box.bottom + 12;
  if (rect.top < box.top) body.scrollTop -= box.top - rect.top + 12;
}
function updateScrollHint() {
  const body = $('#terminal-body'), hint = $('#scroll-hint');
  if (!hint) return;
  const above = body.scrollTop > 1, below = body.scrollHeight - body.scrollTop - body.clientHeight > 1;
  hint.textContent = above && below ? 'More above / below · PgUp/Dn' : below ? 'More below · PgDn scroll' : above ? 'More above · PgUp scroll' : '';
}
function footerHelp(editing = false) {
  const state = controller.state;
  $('#keyboard-help').innerHTML = editing
    ? help([['Enter', 'review'], ['Shift+Enter', 'new line'], ['Esc', 'back']])
    : state.step === 'choose'
      ? help([['↑↓', 'options'], ['Tab', 'write'], ['Enter', 'review'], ['Esc', 'dismiss']])
      : help([['Tab', 'move'], ['Enter', 'activate'], ['Esc', 'dismiss']]);
}
function policyText() {
  if (question.purpose !== 'approval') return '';
  const a = controller.state.answer;
  if (a.kind === 'custom' || a.note) return 'This sends a discussion response.\nNo approval will be granted.';
  if (a.optionId === 'approve') return 'Only Send approval confirms this exact scope.';
  return 'No approval will be granted.';
}
function updateReview() {
  const { answer, error, step } = controller.state;
  $('#policy').textContent = policyText();
  $('#error').textContent = error;
  const send = $('#send');
  send.disabled = !!error || step !== 'review';
  send.textContent = question.purpose === 'approval'
    ? answer.kind === 'custom' || answer.note || step === 'note' ? 'Send for discussion' : answer.optionId === 'approve' ? 'Send approval' : 'Send response'
    : 'Send answer';
}
function render(focusTarget) {
  const state = controller.state;
  const screen = $('#screen'), footer = $('#terminal-footer');
  $('#terminal-body').classList.toggle('is-review', !result && ['review', 'note'].includes(state.step));
  $('#draft-status').textContent = result ? 'Simulation only' : 'Draft · nothing sent';
  if (result) {
    const d = result.details;
    screen.innerHTML = `<div class="meta">Simulated result · no real action</div><h2 class="result-heading">${d.status === 'dismissed' ? 'Dismissed. No answer sent.' : d.status === 'needs_discussion' ? 'Sent for discussion. Not approved.' : 'Demo response sent.'}</h2><p class="context">This result exists only on this page.</p><pre class="result-data">${escape(JSON.stringify({ status: d.status, approved: d.approved, answer: d.answer }, null, 2))}</pre>`;
    footer.innerHTML = '<div class="action-bar"><button id="again">Try again</button></div>';
    $('#again').onclick = () => load(scenario);
    focus('#again');
  } else if (state.step === 'choose') {
    screen.innerHTML = `${header()}<div class="choices" role="group" aria-label="Choose one answer">${question.options.map((o, i) => `<button class="choice" data-option="${escape(o.id)}" tabindex="${i === 0 ? 0 : -1}" aria-label="${escape(o.label + '. ' + o.description)}"><span class="pointer" aria-hidden="true">›</span><span><span class="choice-title"><strong>${escape(o.label)}</strong>${question.recommendation?.optionId === o.id ? '<span class="recommendation">· recommended</span>' : ''}</span><span class="consequence">${escape(o.description)}</span>${question.recommendation?.optionId === o.id && question.recommendation.reason !== o.description ? `<span class="reason">Why: ${escape(question.recommendation.reason)}</span>` : ''}</span></button>`).join('')}</div>
      <div class="write-area"><label class="field-label" for="custom-answer">Or answer in your own words</label><textarea id="custom-answer" rows="2" maxlength="2000" placeholder="Write your answer…">${escape(state.customDraft)}</textarea></div>`;
    footer.innerHTML = '<div id="keyboard-help"></div>';
    screen.querySelectorAll('[data-option]').forEach(button => {
      button.onclick = () => { controller.choose(button.dataset.option); render('#back'); };
      button.onkeydown = event => {
        const buttons = [...screen.querySelectorAll('[data-option]')];
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault(); const at = buttons.indexOf(button), delta = event.key === 'ArrowDown' ? 1 : -1;
          const next = buttons[Math.max(0, Math.min(buttons.length - 1, at + delta))];
          buttons.forEach(b => b.tabIndex = b === next ? 0 : -1); next.focus({ preventScroll: true }); keepVisible(next);
        }
      };
    });
    $('#custom-answer').onfocus = () => { controller.custom(); render('#custom-answer'); };
    footerHelp(); focus(focusTarget || '[data-option]');
  } else if (state.step === 'custom') {
    screen.innerHTML = `${header()}<div class="compose"><label class="field-label" for="custom-answer">Your answer</label><textarea id="custom-answer" rows="5" maxlength="2000" placeholder="Write your answer…">${escape(state.textDraft)}</textarea><p id="error" class="error" role="alert">${escape(state.error)}</p></div>`;
    footer.innerHTML = '<div class="action-bar"><button id="back">Back</button><button id="review">Review answer →</button></div><div id="keyboard-help"></div>';
    const editor = $('#custom-answer');
    editor.oninput = () => controller.draft(editor.value);
    $('#back').onclick = back;
    $('#review').onclick = () => { if (controller.saveText(editor.value)) render('#back'); else { $('#error').textContent = controller.state.error; focus('#custom-answer'); } };
    editor.onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('#review').click(); } };
    footerHelp(true); focus(focusTarget || '#custom-answer');
  } else {
    const a = state.answer;
    screen.innerHTML = `${header(true)}<div class="answer-summary"><span class="field-label">Your answer</span><p>${escape(a.kind === 'custom' ? a.text : a.label)}</p></div><div class="note-area"><label class="field-label" for="note">Add a note <span>(optional)</span></label><textarea id="note" rows="2" maxlength="1000" placeholder="Any condition or context to include?">${escape(a.note)}</textarea><p id="error" class="error" role="alert"></p></div>`;
    footer.innerHTML = '<p class="policy" id="policy" role="status"></p><div class="action-bar"><div class="action-group"><button id="back">← Back</button><button class="dismiss" id="dismiss">Dismiss</button></div><button class="send" id="send">Send answer</button></div><div id="keyboard-help"></div>';
    $('#back').onclick = back;
    $('#dismiss').onclick = dismiss;
    const note = $('#note');
    note.oninput = () => { controller.editNote(); controller.saveText(note.value); updateReview(); };
    note.onfocus = () => footerHelp(true);
    note.onblur = () => footerHelp(false);
    note.onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); focus('#back'); } };
    $('#send').onclick = () => { if (!$('#send').disabled) { result = controller.submit(); render(); } };
    updateReview(); footerHelp(); focus(focusTarget || '#back');
  }
  footer.insertAdjacentHTML('afterbegin', '<div class="scroll-hint" id="scroll-hint"></div>');
  $('#terminal-body').scrollTop = 0;
  updateScrollHint();
  // Keep the intended input visible, without scrolling the outer review page.
  if (document.activeElement?.matches('textarea')) keepVisible(document.activeElement);
}
function back() {
  if (controller.state.step === 'note') controller.back();
  controller.back(); render();
}
function dismiss() { result = outcome(question, 'dismissed'); render(); }
function load(name = 'decision') {
  scenario = name; result = null;
  const q = structuredClone(['approval', 'bare', 'long'].includes(name) ? approval : decision);
  if (name === 'long') q.scope.action = 'Internal preview only. No deployment, publication, settings change, or live authorization.\n' + Array.from({ length: 8 }, (_, i) => `${i + 1}. Preserve review notes, exact artifact identity, cancellation, and ownership for this fictional example.`).join('\n');
  if (name === 'four') q.options.push(
    { id: 'partners', label: 'Partner teams', description: 'Representative feedback from a bounded external group.' },
    { id: 'wait', label: 'Not yet', description: 'Validate the remaining risks before opening access.' },
  );
  question = normalizeQuestion(q); controller = createController(question);
  if (name === 'custom') { controller.custom(); controller.draft('Internal team + a few support leads.'); }
  if (name === 'approval') { controller.choose('approve'); controller.editNote(); controller.saveText('Yes, but let me review the final wording first.'); }
  const [number, title, first, second] = descriptions[name];
  $('#design-note').innerHTML = `<span class="note-number">${escape(number)}</span><h2>${escape(title)}</h2><p>${escape(first)}</p><p>${escape(second)}</p>`;
  document.querySelectorAll('[data-scenario]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scenario === name)));
  render();
}
$('#terminal-body').addEventListener('scroll', updateScrollHint);
new ResizeObserver(updateScrollHint).observe($('#terminal-body'));
$('#terminal').addEventListener('keydown', event => {
  if (['PageUp', 'PageDown'].includes(event.key) && !event.isComposing) {
    event.preventDefault(); $('#terminal-body').scrollTop += (event.key === 'PageUp' ? -1 : 1) * $('#terminal-body').clientHeight * 0.8; return;
  }
  if (event.key !== 'Escape' || event.isComposing || result) return;
  event.preventDefault();
  if (controller.state.step === 'custom') back();
  else if (document.activeElement?.id === 'note') focus('#back');
  else dismiss();
});
document.querySelectorAll('[data-scenario]').forEach(button => button.onclick = () => load(button.dataset.scenario));
$('#reset').onclick = () => load(scenario);
$('#width').onchange = () => $('#terminal').classList.toggle('narrow', $('#width').value === 'narrow');
const appearance = window.matchMedia('(prefers-color-scheme: dark)');
function setTheme() { document.documentElement.dataset.theme = $('#theme').value === 'auto' ? appearance.matches ? 'dark' : 'light' : $('#theme').value; }
$('#theme').onchange = setTheme; appearance.addEventListener('change', setTheme);
// Read-only snapshots for offline browser proof. No command execution endpoint.
Object.defineProperty(window, 'previewSnapshot', { value: () => ({ scenario, state: controller.state, result: result?.details || null, focused: document.activeElement?.id || document.activeElement?.dataset.option || null }) });
load();
