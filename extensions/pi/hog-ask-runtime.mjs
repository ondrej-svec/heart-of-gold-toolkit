import { createController, outcome, questionText } from './hog-ask-core.mjs';
import { answerLabel, optionDescription, optionLabel, sendLabel } from './hog-ask-presentation.mjs';

// Race even non-cooperative adapters; consume late rejections, and never continue
// into another dialog after cancellation. Native RPC select/input also get signal.
export function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(new Error('Interaction aborted')); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    Promise.resolve(promise).then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

export async function askRpc(question, ui, signal) {
  const controller = createController(question);
  while (!signal.aborted) {
    const state = controller.state;
    const displayAnswer = state.answer && (state.answer.kind === 'custom'
      ? state.answer.text
      : optionLabel(question, question.options.find((option) => option.id === state.answer.optionId)));
    const summary = !state.answer ? 'No answer selected.'
      : question.purpose === 'approval' && state.answer.kind === 'option' ? answerLabel(question, state.answer)
      : `${answerLabel(question, state.answer)}: ${displayAnswer}${state.answer.note ? `\nNote: ${state.answer.note}` : ''}`;
    let title = `${questionText(question)}\n\n${summary}`;
    if (state.step === 'custom' || state.step === 'note') {
      const feedback = question.purpose === 'approval' && state.step === 'custom';
      title += `\n${feedback ? 'Describe the changes needed (required; up to 2000 characters).' : state.step === 'custom' ? 'Write a different answer' : 'Optional note (blank clears it)'}`;
      if (state.textDraft) title += `\nPrevious draft: ${state.textDraft}`;
      if (state.error) title += `\n${state.error}`;
      const value = await abortable(ui.input(title, feedback ? 'Feedback; reviewed before sending' : 'Your text; reviewed before sending', { signal }), signal);
      if (signal.aborted) break;
      if (value === undefined) return outcome(question, 'dismissed');
      const saved = controller.saveText(value);
      // Invalid feedback remains a draft, but return to choose so it can be
      // retried or explicitly cleared rather than being silently abandoned.
      if (!saved && feedback) controller.back();
      continue;
    }
    // Never persist display labels or use a guessed array index. Prefix generated
    // actions separately, even when a model's label is literally "Send answer".
    const choices = new Map();
    if (state.step === 'choose') {
      for (const option of question.options) {
        // A pending feedback draft must be deliberately cleared before an approval.
        if (question.purpose === 'approval' && state.customDraft && option.id === 'approve') continue;
        choices.set(`Option [${option.id}]: ${optionLabel(question, option)} — ${optionDescription(question, option)}`, {
          action: question.purpose === 'approval' && option.id === 'revise' ? 'feedback' : 'choose', id: option.id,
        });
      }
      if (question.purpose === 'approval') {
        if (state.customDraft) choices.set('Action: Clear feedback draft', { action: 'clear-feedback' });
      } else choices.set('Action: Write a different answer', { action: 'custom' });
    } else {
      title += '\nReview before sending. Nothing is submitted yet.';
      // Neutral first action. Repeated Enter cannot silently approve a scope.
      choices.set('Action: Back / change answer', { action: 'back' });
      if (question.purpose === 'decision') choices.set('Action: Add / edit note', { action: 'note' });
      choices.set(`Action: ${sendLabel(question, state.answer).replace(/^./, (letter) => letter.toUpperCase())}`, { action: 'send' });
    }
    choices.set('Action: Dismiss', { action: 'dismiss' });
    const value = await abortable(ui.select(title, [...choices.keys()], { signal }), signal);
    if (signal.aborted) break;
    if (value === undefined) return outcome(question, 'dismissed');
    const choice = choices.get(value);
    if (!choice) return outcome(question, 'unavailable', null, 'invalid_ui_response');
    if (choice.action === 'dismiss') return outcome(question, 'dismissed');
    if (choice.action === 'send') return controller.submit();
    if (choice.action === 'choose') controller.choose(choice.id);
    else if (choice.action === 'custom' || choice.action === 'feedback') controller.custom();
    else if (choice.action === 'back') controller.back();
    else if (choice.action === 'clear-feedback') {
      // Keep this presentation-only: the controller's existing validation resets
      // its draft, then Back returns to the normal explicit-choice state.
      controller.custom(); controller.saveText(''); controller.back();
    } else controller.editNote();
  }
  return outcome(question, 'aborted');
}

// One lock per extension instance/session. No global ledger; only its owner can
// release it. Invalidation synchronously frees the slot and aborts the old view.
export function createInteractions(showTui) {
  let active;
  return {
    invalidate(reason = 'session_changed') {
      const old = active;
      active = undefined;
      old?.abort.abort(reason);
    },
    async run(question, ctx, signal) {
      if (signal?.aborted || ctx.signal?.aborted) return outcome(question, 'aborted');
      if (active) return outcome(question, 'unavailable', null, 'interaction_in_progress');
      if (!ctx.hasUI || !['tui', 'rpc'].includes(ctx.mode)) return outcome(question, 'unavailable', null, 'ui_unavailable');
      const owner = { abort: new AbortController() };
      active = owner;
      const joined = AbortSignal.any([owner.abort.signal, signal, ctx.signal].filter(Boolean));
      let origin = { sessionId: null, leafId: null };
      let result;
      try {
        origin = {
          sessionId: ctx.sessionManager?.getSessionId?.() ?? null,
          leafId: ctx.sessionManager?.getLeafId?.() ?? null,
        };
        const operation = ctx.mode === 'rpc' ? askRpc(question, ctx.ui, joined) : showTui(question, ctx, joined);
        result = await abortable(operation, joined);
        if (joined.aborted || active !== owner) result = outcome(question, 'aborted');
        else if (!result) result = outcome(question, 'unavailable', null, 'ui_unavailable');
      } catch {
        result = joined.aborted || active !== owner
          ? outcome(question, 'aborted')
          : outcome(question, 'unavailable', null, 'ui_error');
      } finally {
        if (active === owner) active = undefined;
      }
      return { ...result, details: { ...result.details, origin } };
    },
  };
}
