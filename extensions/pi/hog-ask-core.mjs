// Pure question/response contract. No Pi, model, UI, I/O, or global decision ledger.
export const LIMITS = Object.freeze({ id: 64, title: 96, question: 400, context: 800, description: 240, scope: 1200, answer: 2000, note: 1000 });
export const APPROVAL_OPTIONS = Object.freeze([
  Object.freeze({ id: 'approve', label: 'Approve this scope', description: 'Approve only the named action and scope.' }),
  Object.freeze({ id: 'revise', label: 'Revise the scope', description: 'Discuss changes before proceeding.' }),
  Object.freeze({ id: 'pause', label: 'Pause', description: 'Do not proceed with this action.' }),
]);

function object(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new Error(`${name} has unknown fields`);
}

export function boundedText(value, name, max, optional = false) {
  if (value === undefined && optional) return '';
  // Reject terminal controls/bidi overrides rather than concealing scope or labels.
  if (typeof value !== 'string' || /[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/u.test(value)) throw new Error(`${name} must be plain text`);
  const text = value.trim();
  if ((!text && !optional) || text.length > max || text.split('\n').length > 32) throw new Error(`${name} must be ${optional ? '0' : '1'}–${max} characters and at most 32 lines`);
  return text;
}

function id(value, name) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(value)) throw new Error(`${name} must be a stable 1–64 character ID`);
  return value;
}

export function normalizeQuestion(input) {
  object(input, ['id', 'purpose', 'title', 'question', 'context', 'options', 'recommendation', 'scope'], 'question');
  if (!['decision', 'approval'].includes(input.purpose)) throw new Error('purpose must be decision or approval');
  const q = {
    id: id(input.id, 'question id'), purpose: input.purpose,
    title: boundedText(input.title, 'title', LIMITS.title),
    question: boundedText(input.question, 'question', LIMITS.question),
    context: boundedText(input.context, 'context', LIMITS.context, true),
  };
  if (q.purpose === 'approval') {
    if (input.options !== undefined || input.recommendation !== undefined) throw new Error('Approval uses fixed options and no recommendation');
    object(input.scope, ['action', 'artifactPath', 'revision'], 'scope');
    q.scope = {
      action: boundedText(input.scope.action, 'scope action', LIMITS.scope),
      artifactPath: boundedText(input.scope.artifactPath, 'artifact path', 400, true),
      revision: boundedText(input.scope.revision, 'revision', 120, true),
    };
    q.options = APPROVAL_OPTIONS;
  } else {
    if (input.scope !== undefined) throw new Error('scope is only used for approval');
    if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 4) throw new Error('Decision needs 2–4 alternatives');
    const ids = new Set(), labels = new Set();
    q.options = input.options.map((option) => {
      object(option, ['id', 'label', 'description'], 'option');
      const result = {
        id: id(option.id, 'option id'),
        label: boundedText(option.label, 'option label', 96),
        description: boundedText(option.description, 'option consequence', LIMITS.description),
      };
      const label = result.label.normalize('NFKC').replace(/\s+/gu, ' ').toLowerCase();
      if (ids.has(result.id) || labels.has(label)) throw new Error('Option IDs and normalized labels must be unique');
      ids.add(result.id); labels.add(label);
      return Object.freeze(result);
    });
    if (input.recommendation !== undefined) {
      object(input.recommendation, ['optionId', 'reason'], 'recommendation');
      if (!ids.has(input.recommendation.optionId)) throw new Error('Recommendation must reference an option ID');
      q.recommendation = Object.freeze({ optionId: input.recommendation.optionId, reason: boundedText(input.recommendation.reason, 'recommendation reason', 400) });
    }
  }
  if (q.scope) Object.freeze(q.scope);
  Object.freeze(q.options);
  return Object.freeze(q);
}

export function questionText(q) {
  return [
    `${q.purpose === 'approval' ? 'Approval' : 'Decision'}: ${q.title}`,
    q.question,
    q.context,
    ...(q.scope ? [`Scope: ${q.scope.action}`, q.scope.artifactPath && `Artifact: ${q.scope.artifactPath}`, q.scope.revision && `Revision: ${q.scope.revision}`] : []),
    ...(q.recommendation ? [`Recommended: ${q.options.find((o) => o.id === q.recommendation.optionId).label} — ${q.recommendation.reason}`] : []),
  ].filter(Boolean).join('\n');
}

export function answerText(answer) {
  if (!answer) return 'No answer selected.';
  return `Answer: ${answer.kind === 'custom' ? answer.text : answer.label}${answer.note ? `\nNote: ${answer.note}` : ''}`;
}

export function outcome(q, status, answer = null, reason) {
  const approved = q.purpose === 'approval' && status === 'answered' && answer?.kind === 'option' && answer.optionId === 'approve' && !answer.note;
  const details = { question: q, status, answer, approved, ...(reason ? { reason } : {}) };
  const text = [questionText(q), `Outcome: ${status}${reason ? ` (${reason})` : ''}`, answerText(answer),
    ...(q.purpose === 'approval' ? [approved ? 'Approval recorded for this named scope only.' : 'No approval granted.'] : []),
  ].join('\n');
  return {
    content: [{ type: 'text', text }], details,
    ...(['dismissed', 'unavailable', 'aborted'].includes(status) || (q.purpose === 'approval' && answer?.optionId === 'pause') ? { terminate: true } : {}),
  };
}

export function createController(q) {
  let step = 'choose', answer = null, customDraft = '', textDraft = '', error = '';
  return {
    get state() { return { step, answer: answer && { ...answer }, customDraft, textDraft, error }; },
    choose(optionId) {
      const option = q.options.find((o) => o.id === optionId);
      if (!option) throw new Error('Unknown option ID');
      answer = { kind: 'option', optionId, label: option.label, note: answer?.kind === 'option' && answer.optionId === optionId ? answer.note : '' };
      step = 'review'; error = '';
    },
    custom() { step = 'custom'; textDraft = customDraft; error = ''; },
    editNote() {
      if (!answer) throw new Error('Select an answer before adding a note');
      step = 'note'; textDraft = answer.note; error = '';
    },
    draft(value) { textDraft = value; if (step === 'custom') customDraft = value; },
    saveText(value) {
      if (!['custom', 'note'].includes(step)) throw new Error('Not editing text');
      this.draft(value);
      try {
        const text = boundedText(value, step === 'custom' ? 'answer' : 'note', step === 'custom' ? LIMITS.answer : LIMITS.note, step === 'note');
        if (step === 'custom') { customDraft = text; answer = { kind: 'custom', text, note: '' }; }
        else answer = { ...answer, note: text };
        step = 'review'; error = ''; return true;
      } catch (err) { error = err.message; return false; }
    },
    back() { step = step === 'note' ? 'review' : 'choose'; error = ''; },
    submit() {
      if (step !== 'review' || !answer) throw new Error('An explicit answer must be reviewed before submission');
      const status = q.purpose === 'approval' && (answer.kind === 'custom' || answer.note) ? 'needs_discussion' : 'answered';
      return outcome(q, status, { ...answer });
    },
  };
}
