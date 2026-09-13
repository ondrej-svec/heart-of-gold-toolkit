import { answerText, createController, outcome, questionText } from './hog-ask-core.mjs';

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
    let title = `${questionText(question)}\n\n${answerText(state.answer)}`;
    if (state.step === 'custom' || state.step === 'note') {
      // Pi 0.85.1 editor() cannot be cancelled. input() can; always review text.
      title += `\n${state.step === 'custom' ? 'Write a different answer' : 'Optional note (blank clears it)'}`;
      if (state.textDraft) title += `\nPrevious draft: ${state.textDraft}`;
      if (state.error) title += `\n${state.error}`;
      const value = await abortable(ui.input(title, 'Your text; reviewed before sending', { signal }), signal);
      if (signal.aborted) break;
      if (value === undefined) return outcome(question, 'dismissed');
      controller.saveText(value);
      continue;
    }
    // Never persist display labels or use a guessed array index. Prefix generated
    // actions separately, even when a model's label is literally "Send answer".
    const choices = new Map();
    if (state.step === 'choose') {
      for (const option of question.options) {
        choices.set(`Option [${option.id}]: ${option.label} — ${option.description}`, { action: 'choose', id: option.id });
      }
      choices.set('Action: Write a different answer', { action: 'custom' });
    } else {
      title += '\nReview before sending. Nothing is submitted yet.';
      if (question.purpose === 'approval' && (state.answer.kind === 'custom' || state.answer.note)) {
        title += '\nThis qualification needs discussion. No approval will be granted.';
      }
      // Neutral first action. Repeated Enter cannot silently approve a scope.
      choices.set('Action: Back / change answer', { action: 'back' });
      choices.set('Action: Add / edit note', { action: 'note' });
      choices.set('Action: Send answer', { action: 'send' });
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
    else if (choice.action === 'custom') controller.custom();
    else if (choice.action === 'back') controller.back();
    else controller.editNote();
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
