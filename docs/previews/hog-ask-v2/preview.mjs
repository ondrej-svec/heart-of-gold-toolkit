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
  id: 'preview-approval', purpose: 'approval', title: 'Example release note', question: 'Approve this example scope?',
  scope: { action: 'Publish the example release note to the internal team only. Excludes public posting and product deployment.', artifactPath: 'examples/release-note.md', revision: 'demo-r1' },
};
const descriptions = {
  decision: ['01', 'Hands stay on the keyboard.', 'Move with the arrows. Enter reviews the focused option. Or just start typing your own answer.', 'No checkbox, no button tour. The footer shows the keys that work here.'],
  custom: ['02', 'A reply, not a form.', 'A plain text cursor, room to write, and Enter to review. No input box to resize or buttons to hunt for.', 'Back keeps your draft. Sending remains a separate, deliberate action.'],
  approval: ['03', 'Feedback is a normal answer.', 'A note can change what happens next. Say that quietly, without making the response look like an error.', 'Ctrl+Enter sends feedback from review. While editing, it only returns to review.'],
  bare: ['03', 'Approve only this scope.', 'An unqualified approval still requires an explicit send from review.', 'The shortcut is a browser proposal. Native terminal key transport still needs verification.'],
  long: ['03', 'Read at your own pace.', 'Content scrolls without taking the keyboard hints with it.', 'All scope text stays available. Native Pi fullscreen paging remains a separate proof.'],
  four: ['01', 'One list. Real alternatives.', 'Arrows move focus without answering. Typing starts your own reply instead of filtering or selecting an option.', 'There are no single-letter Send shortcuts to collide with your words.'],
};
let scenario = 'decision', question, controller, result = null;
const isEditor = () => document.activeElement?.matches('textarea');
const focus = selector => $(selector)?.focus({ preventScroll: true });
const sendChord = event => event.key === 'Enter' && event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
const plainEnter = event => event.key === 'Enter' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;

function header(review = false) {
  return `<div class="meta"><span>${escape(question.title)}</span><span>${review ? 'Review' : 'Choose one'}</span></div><h2 class="question">${escape(question.question)}</h2>
    ${question.context ? `<p class="context">${escape(question.context)}</p>` : ''}
    ${question.scope ? `<section class="scope" aria-label="Exact example scope"><div class="scope-label">Scope</div><p>${escape(question.scope.action)}</p><p class="scope-meta">${escape(question.scope.artifactPath)} · ${escape(question.scope.revision)}</p></section>` : ''}`;
}
function hint(key, label, id) {
  const text = `<kbd>${escape(key)}</kbd> <span>${escape(label)}</span>`;
  return id ? `<button class="key-action" id="${id}">${text}</button>` : `<span>${text}</span>`;
}
function help(parts) { return `<div class="help">${parts.map(([key, label, id]) => hint(key, label, id)).join('')}</div>`; }
function editor(id, label, value, placeholder, rows) {
  return `<label class="field-label" for="${id}">${escape(label)}</label><div class="editor-line"><span class="prompt-marker" aria-hidden="true">›</span><textarea id="${id}" rows="${rows}" maxlength="${id === 'note' ? 1000 : 2000}" placeholder="${escape(placeholder)}">${escape(value)}</textarea></div>`;
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
function actionLabel() {
  const { answer, error } = controller.state;
  if (error) return 'fix note first';
  if (question.purpose !== 'approval') return 'send answer';
  return answer.kind === 'custom' || answer.note || answer.optionId === 'revise' ? 'send feedback' : answer.optionId === 'approve' ? 'send approval' : 'send pause';
}
function updateReview() {
  const { answer, error, step } = controller.state;
  $('#policy').textContent = question.purpose === 'approval' && (answer.kind === 'custom' || answer.note) ? 'Let’s resolve your note first.' : '';
  $('#error').textContent = error;
  $('#send').disabled = !!error || step !== 'review' || isEditor();
  $('#send span').textContent = actionLabel();
}
function footerHelp() {
  const editing = isEditor();
  if ($('#edit-help')) $('#edit-help').hidden = !editing;
  if ($('#review-help')) $('#review-help').hidden = editing;
  if ($('#policy')) updateReview();
}
function openCustom(text = '') {
  controller.custom();
  if (text) controller.draft(controller.state.textDraft + text);
  render('#custom-answer');
}
function reviewCustom() {
  if (controller.saveText($('#custom-answer').value)) render('#back');
  else { $('#error').textContent = controller.state.error; focus('#custom-answer'); }
}
function focusReview(target = '#back') {
  $('#review-help').hidden = false; $('#edit-help').hidden = true;
  $('#send').disabled = !!controller.state.error || controller.state.step !== 'review';
  focus(target); footerHelp();
}
function reviewNote(target = '#back') {
  controller.editNote();
  if (controller.saveText($('#note').value)) focusReview(target);
  else { focus('#note'); updateReview(); }
}
function send() {
  // A shortcut in an editor may REVIEW, but may never also SEND that draft.
  if (result || isEditor() || controller.state.step !== 'review' || controller.state.error) return;
  result = controller.submit(); render();
}
function render(focusTarget) {
  const state = controller.state, screen = $('#screen'), footer = $('#terminal-footer');
  $('#terminal-body').classList.toggle('is-review', !result && ['review', 'note'].includes(state.step));
  if (result) {
    const d = result.details;
    screen.innerHTML = `<div class="meta">Local simulation</div><h2 class="result-heading">${d.status === 'dismissed' ? 'Dismissed. Nothing sent.' : d.status === 'needs_discussion' ? 'Feedback sent.' : 'Demo response sent.'}</h2><p class="context">No real action was taken.</p><details class="result-details"><summary>Result details</summary><pre class="result-data">${escape(JSON.stringify({ status: d.status, approved: d.approved, answer: d.answer }, null, 2))}</pre></details>`;
    footer.innerHTML = help([['Enter', 'try again', 'again']]); $('#again').onclick = () => load(scenario); focus('#again');
  } else if (state.step === 'choose') {
    screen.innerHTML = `${header()}<div class="choices" role="group" aria-label="Choose one answer">${question.options.map((o, i) => `<button class="choice" data-option="${escape(o.id)}" tabindex="${i ? -1 : 0}" aria-label="${escape(o.label + '. ' + o.description)}"><span class="pointer" aria-hidden="true">›</span><span><span class="choice-title"><strong>${escape(o.label)}</strong>${question.recommendation?.optionId === o.id ? '<span class="recommendation">· recommended</span>' : ''}</span><span class="consequence">${escape(o.description)}</span>${question.recommendation?.optionId === o.id && question.recommendation.reason !== o.description ? `<span class="reason">Why: ${escape(question.recommendation.reason)}</span>` : ''}</span></button>`).join('')}</div>
      <div class="write-area">${editor('custom-answer', 'Your answer', state.customDraft, 'Or just start typing…', 1)}</div>`;
    footer.innerHTML = help([['↑↓', 'move'], ['Enter', 'review'], ['Type / Tab', 'write'], ['Esc', 'dismiss']]);
    screen.querySelectorAll('[data-option]').forEach(button => {
      button.onclick = () => { controller.choose(button.dataset.option); render('#back'); };
      button.onkeydown = event => {
        if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
        const buttons = [...screen.querySelectorAll('[data-option]')];
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault(); const delta = event.key === 'ArrowDown' ? 1 : -1;
          const next = buttons[Math.max(0, Math.min(buttons.length - 1, buttons.indexOf(button) + delta))];
          buttons.forEach(b => b.tabIndex = b === next ? 0 : -1); next.focus({ preventScroll: true }); keepVisible(next);
        } else if (event.key.length === 1) { event.preventDefault(); openCustom(event.key); }
      };
      button.onpaste = event => { const text = event.clipboardData?.getData('text/plain'); if (text) { event.preventDefault(); openCustom(text); } };
    });
    $('#custom-answer').onfocus = () => openCustom(); focus(focusTarget || '[data-option]');
  } else if (state.step === 'custom') {
    screen.innerHTML = `${header()}<div class="compose">${editor('custom-answer', 'Your answer', state.textDraft, 'Write your answer…', 3)}<p id="error" class="error" role="alert">${escape(state.error)}</p></div>`;
    footer.innerHTML = help([['Enter', 'review', 'review'], ['Shift+Enter', 'new line'], ['Esc', 'back', 'back']]);
    const input = $('#custom-answer'); input.oninput = () => controller.draft(input.value);
    $('#back').onclick = back; $('#review').onclick = reviewCustom;
    input.onkeydown = event => { if (plainEnter(event) && !event.isComposing) { event.preventDefault(); if (!event.repeat) reviewCustom(); } };
    focus(focusTarget || '#custom-answer'); input.setSelectionRange(input.value.length, input.value.length);
  } else {
    const a = state.answer;
    screen.innerHTML = `${header(true)}<div class="answer-summary"><span class="field-label">Answer</span><p>${escape(a.kind === 'custom' ? a.text : a.label)}</p></div><div class="note-area">${editor('note', 'Note · optional', a.note, 'Tab to add a note…', 2)}<p id="error" class="error" role="alert"></p></div>`;
    footer.innerHTML = `<p class="policy" id="policy" role="status"></p><div id="review-help">${help([['Ctrl+Enter', actionLabel(), 'send'], ['Tab', 'note', 'note-shortcut'], ['Esc', 'back', 'back']])}</div><div id="edit-help" hidden>${help([['Enter', 'review note'], ['Shift+Enter', 'new line'], ['Esc', 'back']])}</div>`;
    $('#back').onclick = back; $('#send').onclick = send;
    $('#note-shortcut').tabIndex = -1; $('#note-shortcut').onclick = () => { focus('#note'); keepVisible($('#note')); };
    const note = $('#note');
    note.oninput = () => { controller.editNote(); controller.saveText(note.value); updateReview(); };
    note.onfocus = footerHelp; note.onblur = footerHelp;
    note.onkeydown = event => { if (plainEnter(event) && !event.isComposing) { event.preventDefault(); if (!event.repeat) reviewNote(); } };
    focus(focusTarget || '#back'); footerHelp();
  }
  footer.insertAdjacentHTML('afterbegin', '<div class="scroll-hint" id="scroll-hint"></div>');
  $('#terminal-body').scrollTop = 0; updateScrollHint();
  if (isEditor()) keepVisible(document.activeElement);
}
function back() { if (controller.state.step === 'note') controller.back(); controller.back(); render(); }
function dismiss() { result = outcome(question, 'dismissed'); render(); }
function load(name = 'decision') {
  scenario = name; result = null;
  const q = structuredClone(['approval', 'bare', 'long'].includes(name) ? approval : decision);
  if (name === 'long') q.scope.action = 'Internal preview only. No deployment, publication, settings change, or live authorization.\n' + Array.from({ length: 8 }, (_, i) => `${i + 1}. Preserve review notes, exact artifact identity, cancellation, and ownership for this fictional example.`).join('\n');
  if (name === 'four') q.options.push({ id: 'partners', label: 'Partner teams', description: 'Representative feedback from a bounded external group.' }, { id: 'wait', label: 'Not yet', description: 'Validate the remaining risks before opening access.' });
  question = normalizeQuestion(q); controller = createController(question);
  if (name === 'custom') { controller.custom(); controller.draft('Internal team + a few support leads.'); }
  if (name === 'approval') { controller.choose('approve'); controller.editNote(); controller.saveText('Yes, but let me review the final wording first.'); }
  const [number, title, first, second] = descriptions[name];
  $('#design-note').innerHTML = `<span class="note-number">${escape(number)}</span><h2>${escape(title)}</h2><p>${escape(first)}</p><p>${escape(second)}</p>`;
  document.querySelectorAll('[data-scenario]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scenario === name))); render();
}
$('#terminal-body').addEventListener('scroll', updateScrollHint);
new ResizeObserver(updateScrollHint).observe($('#terminal-body'));
$('#terminal').addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (sendChord(event)) {
    event.preventDefault(); if (event.repeat || result) return;
    if (controller.state.step === 'custom') reviewCustom();
    else if (document.activeElement?.id === 'note') reviewNote();
    else send();
    return;
  }
  if (['PageUp', 'PageDown'].includes(event.key)) { event.preventDefault(); $('#terminal-body').scrollTop += (event.key === 'PageUp' ? -1 : 1) * $('#terminal-body').clientHeight * 0.8; return; }
  if (result) return;
  if (event.key === 'Tab' && ['review', 'note'].includes(controller.state.step)) {
    // Roving focus order is Back → note → explicit Send, not DOM/button order.
    event.preventDefault(); const id = document.activeElement?.id;
    if (id === 'note') reviewNote(event.shiftKey ? '#back' : '#send');
    else if ((id === 'back' && !event.shiftKey) || (id === 'send' && event.shiftKey)) { focus('#note'); keepVisible($('#note')); }
    else { focus(id === 'send' ? '#back' : '#send'); footerHelp(); }
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    if (document.activeElement?.id === 'note') focusReview();
    else if (controller.state.step === 'choose') dismiss();
    else back();
  }
});
document.querySelectorAll('[data-scenario]').forEach(button => button.onclick = () => load(button.dataset.scenario));
$('#reset').onclick = () => load(scenario);
$('#width').onchange = () => $('#terminal').classList.toggle('narrow', $('#width').value === 'narrow');
const appearance = window.matchMedia('(prefers-color-scheme: dark)');
function setTheme() { document.documentElement.dataset.theme = $('#theme').value === 'auto' ? appearance.matches ? 'dark' : 'light' : $('#theme').value; }
$('#theme').onchange = setTheme; appearance.addEventListener('change', setTheme);
Object.defineProperty(window, 'previewSnapshot', { value: () => ({ scenario, state: controller.state, result: result?.details || null, focused: document.activeElement?.id || document.activeElement?.dataset.option || null }) });
load();
