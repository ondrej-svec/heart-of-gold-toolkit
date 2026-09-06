import { createHash } from 'node:crypto';

export const WRITING_LIMITS = Object.freeze({
  inputBytes: 128 * 1024, streamBytes: 16 * 1024 * 1024,
  // A final session event can contain both echoed input and substantial thinking.
  // Do not impose a small readline cap on otherwise valid Pi records.
  recordBytes: 16 * 1024 * 1024, stderrBytes: 1024 * 1024,
  responseBytes: 128 * 1024, timeoutMs: 180000,
});
const messages = Object.freeze({
  WRITING_ACTION: 'Choose a supported writing action.',
  WRITING_CHOICE: 'Save or select an explicit supported Pi provider, model and thinking level.',
  WRITING_CONFIG: 'Check the canonical Pi configuration; it could not be safely read.',
  WRITING_INSTALL: 'Writing requires a trusted local Pi 0.85.1 installation and Node 22.19 or newer on macOS or Linux.',
  WRITING_ROUTING: 'Writing supports only built-in OpenAI Codex routing. Remove custom model or routing overrides.',
  WRITING_PROMPT: 'The pinned writing prompts failed verification. Restore the workstation package.',
  WRITING_CONFIRMATION: 'Writing settings changed or were not confirmed. Review a fresh preview before sending again.',
  WRITING_INPUT: 'Provide nonempty valid Unicode text no larger than 128 KiB.',
  WRITING_OPTIONS: 'Use a positive timeout of at most 180 seconds and a valid AbortSignal.',
  WRITING_PROTOCOL: 'Pi did not produce a complete, matching, successful writing response. Nothing was applied.',
  WRITING_PROCESS: 'Pi could not complete writing. Check the supported installation and Pi login separately.',
  WRITING_LIMIT: 'Writing exceeded a safety size limit. Shorten the input or request a smaller result.',
  WRITING_TIMEOUT: 'Writing timed out and was stopped. Nothing was applied.',
  WRITING_CANCELLED: 'Writing was cancelled and stopped. Nothing was applied.',
  WRITING_CLEANUP: 'Writing could not safely clean up its temporary directory. Nothing was applied.',
});
export class WritingError extends Error {
  constructor(code) { super(messages[code]); this.name = 'WritingError'; this.code = code; }
}
export function fail(code) { throw new WritingError(code); }
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const digest = value => sha256(JSON.stringify(canonical(value)));
const requireProtocol = condition => { if (!condition) fail('WRITING_PROTOCOL'); };

function phase(block) {
  if (block.textSignature === undefined) return undefined;
  requireProtocol(typeof block.textSignature === 'string');
  if (!block.textSignature.startsWith('{')) return undefined; // Legacy plain message ID.
  let signature;
  try { signature = JSON.parse(block.textSignature); } catch { fail('WRITING_PROTOCOL'); }
  requireProtocol(object(signature) && signature.v === 1 && typeof signature.id === 'string');
  requireProtocol(signature.phase === undefined || ['commentary', 'final_answer'].includes(signature.phase));
  return signature.phase;
}
function validateAssistant(message, provider, model, final = false) {
  requireProtocol(object(message) && message.role === 'assistant' && message.provider === provider && message.model === model && message.api === 'openai-codex-responses');
  requireProtocol(Array.isArray(message.content) && message.errorMessage === undefined);
  for (const block of message.content) {
    requireProtocol(object(block) && ['text', 'thinking'].includes(block.type));
    requireProtocol(block.type === 'text' ? typeof block.text === 'string' && block.text.isWellFormed() : typeof block.thinking === 'string');
  }
  if (final) requireProtocol(message.stopReason === 'stop');
}
function responseText(message) {
  const blocks = message.content.filter(b => b.type === 'text').map(b => ({ text: b.text, phase: phase(b) }));
  const final = blocks.some(b => b.phase === 'final_answer');
  const selected = blocks.filter(b => final ? b.phase === 'final_answer' : b.phase !== 'commentary');
  const bytes = selected.reduce((n, b) => n + Buffer.byteLength(b.text), 0);
  if (bytes > WRITING_LIMITS.responseBytes) fail('WRITING_LIMIT');
  const text = selected.map(b => b.text).join('');
  requireProtocol(text.trim().length > 0);
  return text;
}

/** One successful, tool-free turn only. Deltas are checked but never accumulated or returned. */
export class WritingProtocol {
  constructor(provider, model, input) {
    this.provider = provider; this.model = model; this.input = input; this.state = 'header';
  }
  accept(event) {
    requireProtocol(object(event) && typeof event.type === 'string');
    const is = type => requireProtocol(event.type === type);
    switch (this.state) {
      case 'header':
        is('session'); requireProtocol(event.version === 3 && typeof event.id === 'string' && event.id.length > 0);
        this.state = 'agent'; break;
      case 'agent': is('agent_start'); this.state = 'turn'; break;
      case 'turn': is('turn_start'); this.state = 'user-start'; break;
      case 'user-start': {
        is('message_start'); const m = event.message;
        requireProtocol(object(m) && m.role === 'user' && Array.isArray(m.content) && m.content.length === 1 && m.content[0]?.type === 'text' && m.content[0].text === this.input);
        this.userHash = digest(m); this.input = undefined; this.state = 'user-end'; break;
      }
      case 'user-end':
        is('message_end'); requireProtocol(digest(event.message) === this.userHash); this.state = 'assistant-start'; break;
      case 'assistant-start':
        is('message_start'); validateAssistant(event.message, this.provider, this.model); this.state = 'assistant'; break;
      case 'assistant':
        if (event.type === 'message_update') {
          const update = event.assistantMessageEvent;
          requireProtocol(object(update) && ['text_start', 'text_delta', 'text_end', 'thinking_start', 'thinking_delta', 'thinking_end'].includes(update.type));
          requireProtocol(Number.isSafeInteger(update.contentIndex) && update.contentIndex >= 0);
          if (update.type.endsWith('_delta')) requireProtocol(typeof update.delta === 'string');
        } else {
          is('message_end'); validateAssistant(event.message, this.provider, this.model, true);
          this.text = responseText(event.message); this.assistantHash = digest(event.message); this.state = 'turn-end';
        }
        break;
      case 'turn-end':
        is('turn_end'); requireProtocol(Array.isArray(event.toolResults) && event.toolResults.length === 0 && digest(event.message) === this.assistantHash);
        this.state = 'agent-end'; break;
      case 'agent-end':
        is('agent_end'); requireProtocol(event.willRetry === false && Array.isArray(event.messages) && event.messages.length === 2);
        requireProtocol(digest(event.messages[0]) === this.userHash && digest(event.messages[1]) === this.assistantHash);
        this.state = 'settled'; break;
      case 'settled': is('agent_settled'); this.state = 'closed'; break;
      default: fail('WRITING_PROTOCOL'); // Includes any late failure/retry/compaction/extra turn.
    }
  }
  finish() { requireProtocol(this.state === 'closed'); return this.text; }
}
