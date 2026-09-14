// Shared display vocabulary only. IDs, validation and approval policy stay in core.
const approvalLabels = Object.freeze({ approve: 'Approve as written', revise: 'Request changes', pause: 'Not now' });
const approvalDescriptions = Object.freeze({ approve: 'Only this scope.', revise: 'Write what should change first.', pause: 'Pause this action.' });
export function optionLabel(question, option) {
  return question.purpose === 'approval' ? approvalLabels[option.id] : option.label;
}
export function optionDescription(question, option) {
  return question.purpose === 'approval' ? approvalDescriptions[option.id] : option.description;
}
export function answerLabel(question, answer) {
  if (question.purpose !== 'approval') return 'Answer';
  return answer.kind === 'custom' ? 'Request changes' : approvalLabels[answer.optionId];
}
export function sendLabel(question, answer) {
  if (question.purpose !== 'approval') return 'send answer';
  if (answer.kind === 'custom' || answer.note || answer.optionId === 'revise') return 'send feedback';
  return answer.optionId === 'approve' ? 'send approval' : 'send pause';
}
