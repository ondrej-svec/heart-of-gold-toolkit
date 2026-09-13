import { normalizeQuestion, createController, outcome } from './hog-ask-core.js';

// Browser-only design adapter. No Pi bridge, network, storage, or real actions.
const $ = selector => document.querySelector(selector);
const escape = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const decision = {
  id: 'preview-audience', purpose: 'decision', title: 'Rollout audience', question: 'Who should get access first?',
  options: [
    { id: 'internal', label: 'Internal only', description: 'A small pilot limits early exposure.' },
    { id: 'public', label: 'Public', description: 'Broader feedback, with greater rollout risk.' },
  ],
  recommendation: { optionId: 'internal', reason: 'A small pilot limits early exposure.' },
};
const approval = {
  id: 'preview-approval', purpose: 'approval', title: 'Example release note', question: 'How should we proceed?',
  scope: { action: 'Publish the example release note to the internal team only. Excludes public posting and product deployment.', artifactPath: 'examples/release-note.md', revision: 'demo-r1' },
};
const approvalLabels = { approve: 'Approve as written', revise: 'Request changes', pause: 'Not now' };
const approvalDescriptions = { approve: 'Only this scope.', revise: 'Write what should change first.', pause: 'Pause this action.' };
const descriptions = {
  decision: ['01', 'One focus route.', 'Arrows and Tab reach the same input. Click its text, marker, or padding—or just start typing.', 'Hover shows the target without taking your cursor. The input stays where it is.'],
  custom: ['02', 'Stay in the conversation.', 'Your reply lives alongside the alternatives, not in a replacement form.', 'Enter reviews. Back keeps your draft. Sending is still a separate action.'],
  approval: ['03', 'Different intents. Clear paths.', 'Approve as written, request changes, or pause. Feedback has its own path—not an optional note attached to approval.', 'The scope stays visible. Nothing is authorized until an explicit send from review.'],
  feedback: ['03', 'Feedback, from the start.', 'Say what should change before proceeding. Your words are the response; there is no approval warning to decode.', 'A feedback draft cannot be silently dropped to approve. Clear it explicitly if you change your mind.'],
  bare: ['03', 'Approve only this scope.', 'No generic note field and no conditional approval. Review the exact scope, then explicitly send.', 'Ctrl+Enter has a Tab → Enter fallback. Native key transport still needs verification.'],
  long: ['03', 'Read at your own pace.', 'Content scrolls without taking the controls with it.', 'Native Pi fullscreen mouse regions and paging remain a separate proof obligation.'],
  four: ['01', 'One list. Real alternatives.', 'Move through every alternative and into your own reply using arrows or Tab.', 'No fake checkbox, single-letter Send shortcut, or selection caused by hovering.'],
};
let scenario = 'decision', question, controller, result = null;
let view = 'entry', entryDraft = '', entryError = '', returnFocus = '[data-option]';
let pointerStart = null, pointerDragged = false, entryTarget = '', pointerSendAfter = 0;
let entrySelection = { start: 0, end: 0, direction: 'none' };
const isApproval = () => question.purpose === 'approval';
const isEditor = () => document.activeElement?.matches('textarea');
const focus = selector => $(selector)?.focus({ preventScroll: true });
const sendChord = e => e.key === 'Enter' && e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
const plainEnter = e => e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
const feedbackPending = () => isApproval() && !!entryDraft.trim();
const label = option => isApproval() ? approvalLabels[option.id] : option.label;

function header(review = false) {
  return `<div class="meta"><span>${escape(question.title)}</span><span>${review ? 'Review' : isApproval() ? 'Approval' : 'Choose one'}</span></div><h2 class="question">${escape(question.question)}</h2>
    ${question.context ? `<p class="context">${escape(question.context)}</p>` : ''}
    ${question.scope ? `<section class="scope" aria-label="Exact example scope"><p>${escape(question.scope.action)}</p><p class="scope-meta">${escape([question.scope.artifactPath, question.scope.revision].filter(Boolean).join(' · '))}</p></section>` : ''}`;
}
function help(parts) {
  return `<div class="help">${parts.map(([key, text, id]) => {
    const content = `${key ? `<kbd>${escape(key)}</kbd> ` : ''}<span>${escape(text)}</span>`;
    return id ? `<button class="key-action" id="${id}">${content}</button>` : `<span>${content}</span>`;
  }).join('')}</div>`;
}
function editor(id, text, value, placeholder, rows) {
  // The controller validates full text. Never truncate pasted qualifications at a DOM maxlength.
  return `<label class="field-label" for="${id}">${escape(text)}</label><div class="editor-line"><span class="prompt-marker" aria-hidden="true">›</span><textarea id="${id}" rows="${rows}" spellcheck="false" placeholder="${escape(placeholder)}" aria-describedby="error">${escape(value)}</textarea></div>`;
}
function keepVisible(element) {
  const body = $('#terminal-body'), box = body.getBoundingClientRect(), rect = element.getBoundingClientRect();
  if (rect.bottom > box.bottom) body.scrollTop += rect.bottom - box.bottom + 8;
  if (rect.top < box.top) body.scrollTop -= box.top - rect.top + 8;
}
function updateScrollHint() {
  const body = $('#terminal-body'), hint = $('#scroll-hint');
  if (!hint) return;
  const above = body.scrollTop > 1, below = body.scrollHeight - body.scrollTop - body.clientHeight > 1;
  hint.textContent = above && below ? 'More above / below · PgUp/Dn' : below ? 'More below · PgDn scroll' : above ? 'More above · PgUp scroll' : '';
}
function activate(button, handler) {
  button.onclick = event => {
    if (event.detail > 0) {
      // A continuing click sequence may hit a different control after reflow.
      // Also guard rapid clicks whose detail resets when the target changes.
      if (pointerDragged || event.detail > 1 || (button.id === 'send' && performance.now() < pointerSendAfter)) return;
    }
    handler();
  };
}
function rememberCaret() {
  const input = $('#custom-answer');
  entrySelection = { start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection };
}
function actionLabel() {
  if (!isApproval()) return 'send answer';
  const answer = controller.state.answer;
  return answer.kind === 'custom' ? 'send feedback' : answer.optionId === 'approve' ? 'send approval' : 'send pause';
}
function updateEntry() {
  $('#error').textContent = entryError;
  const approve = $('[data-option="approve"]');
  if (approve) {
    approve.setAttribute('aria-disabled', String(feedbackPending()));
    approve.querySelector('.consequence').textContent = feedbackPending() ? 'Clear your feedback first.' : approvalDescriptions.approve;
    $('#clear').hidden = !entryDraft;
  }
}
function focusCustom() { focus('#custom-answer'); keepVisible($('#custom-answer')); }
function typeToWrite(text) {
  focusCustom(); const input = $('#custom-answer');
  input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
  entryDraft = input.value; entryError = ''; updateEntry();
}
function reviewEntry() {
  if (view !== 'entry') return;
  entryDraft = $('#custom-answer').value;
  controller.custom();
  if (!controller.saveText(entryDraft)) { entryError = controller.state.error; updateEntry(); focusCustom(); return; }
  // Approval feedback is a custom answer, not a disguised approval + note.
  rememberCaret(); view = 'review'; returnFocus = '#custom-answer'; render('#back');
}
function choose(id) {
  if (isApproval() && id === 'revise') { focusCustom(); return; }
  if (id === 'approve' && feedbackPending()) { focusCustom(); return; }
  rememberCaret(); controller.choose(id); view = 'review'; returnFocus = `[data-option="${id}"]`; render('#back');
}
function updateReview() {
  $('#error').textContent = controller.state.error;
  $('#send').disabled = !!controller.state.error || controller.state.step !== 'review' || isEditor();
  if ($('#edit-help')) {
    $('#edit-help').hidden = !isEditor(); $('#review-help').hidden = !!isEditor();
  }
}
function focusReview(target = '#back') {
  $('#review-help').hidden = false;
  if ($('#edit-help')) $('#edit-help').hidden = true;
  $('#send').disabled = !!controller.state.error || controller.state.step !== 'review';
  focus(target); updateReview();
}
function reviewNote(target = '#back') {
  controller.editNote();
  if (controller.saveText($('#note').value)) focusReview(target);
  else { focus('#note'); updateReview(); }
}
function send() {
  if (result || view !== 'review' || isEditor() || controller.state.step !== 'review' || controller.state.error) return;
  result = controller.submit(); render();
}
function renderEntry() {
  $('#screen').innerHTML = `${header()}<div class="choices${isApproval() ? ' approval-choices' : ''}" role="group" aria-label="${isApproval() ? 'How to proceed' : 'Choose one answer'}">${question.options.map(o => `<button class="choice" data-option="${escape(o.id)}"><span class="pointer" aria-hidden="true">›</span><span><span class="choice-title"><strong>${escape(label(o))}</strong>${question.recommendation?.optionId === o.id ? '<span class="recommendation">· recommended</span>' : ''}</span><span class="consequence">${escape(isApproval() ? approvalDescriptions[o.id] : o.description)}</span>${question.recommendation?.optionId === o.id && question.recommendation.reason !== o.description ? `<span class="reason">Why: ${escape(question.recommendation.reason)}</span>` : ''}</span></button>`).join('')}</div>
    <div class="write-area">${editor('custom-answer', isApproval() ? 'Changes or questions' : 'Your answer', entryDraft, isApproval() ? 'What should change first?' : 'Or write your own answer…', 2)}</div><p id="error" class="error" role="alert"></p>`;
  $('#terminal-footer').innerHTML = help([['↑↓ / Tab', 'move'], ['Enter', 'review', 'review'], ['Shift+Enter', 'new line'], ['Esc', 'back', 'back'], ...(isApproval() ? [['', 'clear feedback', 'clear']] : [])]);
  const input = $('#custom-answer'), buttons = [...document.querySelectorAll('[data-option]')];
  buttons.forEach((button, i) => {
    activate(button, () => choose(button.dataset.option));
    button.onfocus = () => {
      entryTarget = button.dataset.option;
      $('#back span').textContent = 'dismiss';
      $('#review span').textContent = isApproval() && entryTarget === 'revise' ? 'write feedback' : 'review';
      keepVisible(button);
    };
    button.onkeydown = event => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        const next = [...buttons, input][Math.max(0, Math.min(buttons.length, i + (event.key === 'ArrowDown' ? 1 : -1)))];
        next.focus({ preventScroll: true }); keepVisible(next);
      } else if (plainEnter(event)) { event.preventDefault(); if (!event.repeat) choose(button.dataset.option); }
      else if (event.key.length === 1) { event.preventDefault(); typeToWrite(event.key); }
    };
    button.onpaste = event => { const text = event.clipboardData?.getData('text/plain'); if (text) { event.preventDefault(); typeToWrite(text); } };
  });
  // Focus never renders/replaces the input, selects an answer, or moves its caret.
  input.setSelectionRange(entrySelection.start, entrySelection.end, entrySelection.direction);
  input.onfocus = () => { entryTarget = 'custom'; $('#back span').textContent = 'options'; $('#review span').textContent = 'review'; keepVisible(input); };
  input.oninput = () => { entryDraft = input.value; entryError = ''; updateEntry(); };
  input.onkeydown = event => {
    if (event.isComposing) return;
    if (plainEnter(event)) { event.preventDefault(); if (!event.repeat) reviewEntry(); }
    else if (event.key === 'ArrowUp' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && input.selectionStart === 0 && input.selectionEnd === 0) {
      event.preventDefault(); buttons.at(-1).focus({ preventScroll: true }); keepVisible(buttons.at(-1));
    }
  };
  activate($('.write-area'), () => { if (document.activeElement !== input) focusCustom(); });
  activate($('#review'), () => entryTarget === 'custom' ? reviewEntry() : choose(entryTarget));
  activate($('#back'), () => { if (entryTarget === 'custom') focus('[data-option]:last-child'); else dismiss(); });
  if ($('#clear')) activate($('#clear'), () => { entryDraft = ''; input.value = ''; entryError = ''; updateEntry(); focusCustom(); });
  updateEntry();
}
function renderReview() {
  // Keyboard Send remains deliberate and immediate. Pointer Send needs a fresh
  // click after review settles, not the tail of the gesture that opened it.
  pointerSendAfter = performance.now() + 500;
  const a = controller.state.answer;
  const title = isApproval() ? a.kind === 'custom' ? 'Request changes' : approvalLabels[a.optionId] : 'Answer';
  $('#screen').innerHTML = `${header(true)}<div class="answer-summary"><span class="field-label">${escape(title)}</span>${a.kind === 'custom' || !isApproval() ? `<p>${escape(a.kind === 'custom' ? a.text : a.label)}</p>` : ''}</div>
    ${!isApproval() ? `<div class="note-area">${editor('note', 'Note · optional', a.note, 'Tab to add a note…', 2)}</div>` : ''}<p id="error" class="error" role="alert"></p>`;
  $('#terminal-footer').innerHTML = `<div id="review-help">${help([['Ctrl+Enter', actionLabel(), 'send'], ...(!isApproval() ? [['Tab', 'note', 'note-shortcut']] : []), ['Esc', 'back', 'back']])}</div>${!isApproval() ? `<div id="edit-help" hidden>${help([['Enter', 'review note'], ['Shift+Enter', 'new line'], ['Esc', 'back']])}</div>` : ''}`;
  activate($('#back'), back); activate($('#send'), send);
  if ($('#note')) {
    const note = $('#note');
    $('#note-shortcut').tabIndex = -1;
    activate($('#note-shortcut'), () => { focus('#note'); keepVisible(note); });
    activate($('.note-area'), () => { if (document.activeElement !== note) { focus('#note'); keepVisible(note); } });
    note.oninput = () => { controller.editNote(); controller.saveText(note.value); updateReview(); };
    note.onfocus = updateReview; note.onblur = updateReview;
    note.onkeydown = e => { if (plainEnter(e) && !e.isComposing) { e.preventDefault(); if (!e.repeat) reviewNote(); } };
  }
}
function render(focusTarget) {
  $('#terminal-body').scrollTop = 0;
  $('#terminal-body').classList.toggle('is-review', !result && view === 'review');
  $('#terminal-body').classList.toggle('approval-entry', !result && view === 'entry' && isApproval());
  if (result) {
    const d = result.details;
    $('#screen').innerHTML = `<div class="meta">Local simulation</div><h2 class="result-heading">${d.status === 'dismissed' ? 'Dismissed. Nothing sent.' : d.status === 'needs_discussion' ? 'Feedback sent.' : 'Demo response sent.'}</h2><p class="context">No real action was taken.</p><details class="result-details"><summary>Result details</summary><pre class="result-data">${escape(JSON.stringify({ status: d.status, approved: d.approved, answer: d.answer }, null, 2))}</pre></details>`;
    $('#terminal-footer').innerHTML = help([['Enter', 'try again', 'again']]); activate($('#again'), () => load(scenario)); focus('#again');
  } else {
    if (view === 'entry') renderEntry(); else renderReview();
    focus(focusTarget || (view === 'entry' ? '[data-option]' : '#back'));
    if (view === 'review') updateReview();
  }
  $('#terminal-footer').insertAdjacentHTML('afterbegin', '<div class="scroll-hint" id="scroll-hint"></div>');
  if (isEditor()) keepVisible(document.activeElement);
  updateScrollHint();
}
function back() {
  if (controller.state.step === 'note') controller.back();
  controller.back(); view = 'entry'; entryError = ''; render(returnFocus);
}
function dismiss() { result = outcome(question, 'dismissed'); render(); }
function load(name = 'decision') {
  scenario = name; result = null; view = 'entry'; entryDraft = ''; entryError = ''; returnFocus = '[data-option]';
  const q = structuredClone(['approval', 'feedback', 'bare', 'long'].includes(name) ? approval : decision);
  if (name === 'long') q.scope.action = 'Internal preview only. No deployment, publication, settings change, or live authorization.\n' + Array.from({ length: 8 }, (_, i) => `${i + 1}. Preserve review notes, exact artifact identity, cancellation, and ownership for this fictional example.`).join('\n');
  if (name === 'four') q.options.push({ id: 'partners', label: 'Partner teams', description: 'Representative feedback from a bounded external group.' }, { id: 'wait', label: 'Not yet', description: 'Validate the remaining risks before opening access.' });
  question = normalizeQuestion(q); controller = createController(question);
  if (name === 'custom') entryDraft = 'Internal team + a few support leads.';
  if (name === 'feedback') entryDraft = 'Let me review the final wording before publishing.';
  entrySelection = { start: entryDraft.length, end: entryDraft.length, direction: 'none' };
  const [number, title, first, second] = descriptions[name];
  $('#design-note').innerHTML = `<span class="note-number">${escape(number)}</span><h2>${escape(title)}</h2><p>${escape(first)}</p><p>${escape(second)}</p>`;
  document.querySelectorAll('[data-scenario]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scenario === name)));
  $('#terminal-body').scrollTop = 0;
  render(['custom', 'feedback'].includes(name) ? '#custom-answer' : undefined);
}
$('#terminal-body').addEventListener('scroll', updateScrollHint);
new ResizeObserver(updateScrollHint).observe($('#terminal-body'));
$('#terminal').addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; pointerDragged = false; });
$('#terminal').addEventListener('pointermove', event => { if (event.buttons && pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 4) pointerDragged = true; });
$('#terminal').addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (event.repeat && event.key === 'Enter') { event.preventDefault(); return; }
  if (sendChord(event)) {
    event.preventDefault(); if (result) return;
    if (view === 'entry' && document.activeElement?.id === 'custom-answer') reviewEntry();
    else if (view === 'review' && document.activeElement?.id === 'note') reviewNote();
    else if (view === 'review') send();
    return;
  }
  if (['PageUp', 'PageDown'].includes(event.key)) { event.preventDefault(); $('#terminal-body').scrollTop += (event.key === 'PageUp' ? -1 : 1) * $('#terminal-body').clientHeight * 0.8; return; }
  if (result) return;
  if (event.key === 'Tab' && view === 'review') {
    event.preventDefault(); const id = document.activeElement?.id;
    if (id === 'note') reviewNote(event.shiftKey ? '#back' : '#send');
    else if ($('#note') && ((id === 'back' && !event.shiftKey) || (id === 'send' && event.shiftKey))) { focus('#note'); keepVisible($('#note')); }
    else focusReview(id === 'send' ? '#back' : '#send');
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    if (view === 'review') { if (document.activeElement?.id === 'note') focusReview(); else back(); }
    else if (document.activeElement?.id === 'custom-answer') { entryError = ''; updateEntry(); focus('[data-option]:last-child'); keepVisible(document.activeElement); }
    else dismiss();
  }
});
document.querySelectorAll('[data-scenario]').forEach(button => button.onclick = () => load(button.dataset.scenario));
$('#reset').onclick = () => load(scenario);
$('#width').onchange = () => $('#terminal').classList.toggle('narrow', $('#width').value === 'narrow');
const appearance = window.matchMedia('(prefers-color-scheme: dark)');
function setTheme() { document.documentElement.dataset.theme = $('#theme').value === 'auto' ? appearance.matches ? 'dark' : 'light' : $('#theme').value; }
$('#theme').onchange = setTheme; appearance.addEventListener('change', setTheme);
Object.defineProperty(window, 'previewSnapshot', { value: () => ({ scenario, view, entryDraft, entryError, state: controller.state, result: result?.details || null, focused: document.activeElement?.id || document.activeElement?.dataset.option || null }) });
load();
