import { realpathSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BINDINGS, keys, text, readBounded } from './profile.mjs';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const CHAPTERS = Object.freeze([
  { id: 'shell', title: 'Shell & building commands' },
  { id: 'finding', title: 'Find files, text & past commands' },
  { id: 'tmux', title: 'Terminal & tmux workspaces' },
  { id: 'nvim', title: 'Neovim: editing & navigation' },
  { id: 'writing', title: 'AI-assisted writing' },
  { id: 'personal', title: 'My commands & cockpits' },
]);
export const TOOLS = Object.freeze({
  node: 'required runtime', zsh: 'optional shell', fzf: 'optional picker / shell integration',
  glow: 'optional presentation', tldr: 'optional command examples', tmux: 'optional workspaces',
  nvim: 'optional editor', pi: 'optional AI (not executed by reference)', cockpit: 'personal; access unverified',
});
const id = value => typeof value === 'string' && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(value) && value.length <= 80;
function strings(values, label) {
  if (!Array.isArray(values) || values.length > 40) throw new Error(`Invalid ${label}`);
  for (const value of values) text(value, label);
}
export function validateCatalog(data) {
  keys(data, ['schemaVersion', 'cards'], 'catalog');
  if (data.schemaVersion !== 1 || !Array.isArray(data.cards) || !data.cards.length || data.cards.length > 500) throw new Error('Invalid catalog schema');
  const ids = new Set();
  for (const card of data.cards) {
    keys(card, ['id', 'chapter', 'title', 'synonyms', 'kind', 'layer', 'requirements', 'body', 'content', 'effect', 'recovery', 'related', 'source', 'exercise'], 'card');
    if (!id(card.id) || ids.has(card.id)) throw new Error('Invalid or duplicate card ID');
    ids.add(card.id);
    if (!CHAPTERS.some(c => c.id === card.chapter)) throw new Error('Unknown chapter');
    if (!['reference', 'keys', 'command-example'].includes(card.kind)) throw new Error('Only reference cards are supported in this proof');
    for (const key of ['title', 'layer', 'effect', 'recovery']) text(card[key], key);
    for (const key of ['synonyms', 'requirements', 'related']) strings(card[key], key);
    if (card.requirements.some(tool => !Object.hasOwn(TOOLS, tool))) throw new Error('Unknown tool requirement');
    if (!/^cards\/[a-z0-9-]+\.md$/.test(card.body ?? '')) throw new Error('Invalid body path');
    keys(card.source, ['label', 'url', 'revision'], 'source');
    for (const key of ['label', 'url', 'revision']) text(card.source[key], key);
    if (!card.source.url.startsWith('https://')) throw new Error('Source must be an HTTPS reference');
    text(card.content, 'content', 32000, true);
    for (const heading of ['## When', '## Try', '## Why']) if (!card.content.includes(heading)) throw new Error('Missing teaching section');
    for (const match of card.content.matchAll(/\{\{([^}]+)\}\}/g)) {
      if (!match[1].startsWith('binding.') || !Object.hasOwn(BINDINGS, match[1].slice(8))) throw new Error('Unknown interpolation token');
    }
    if (card.content.replace(/\{\{binding\.[a-z.-]+\}\}/g, '').match(/\{\{|\}\}/)) throw new Error('Malformed interpolation');
    if (card.exercise !== undefined) {
      keys(card.exercise, ['goal', 'hints', 'success'], 'exercise');
      text(card.exercise.goal, 'exercise goal'); text(card.exercise.success, 'exercise success');
      strings(card.exercise.hints, 'exercise hints');
    }
  }
  for (const card of data.cards) if (card.related.some(other => !ids.has(other))) throw new Error('Broken related-card link');
  return data;
}
export function loadCatalog(root = ROOT) {
  const catalogRoot = realpathSync(join(root, 'catalog'));
  const data = JSON.parse(readBounded(join(catalogRoot, 'index.json')));
  if (!Array.isArray(data.cards)) throw new Error('Invalid catalog');
  for (const card of data.cards) {
    if (!/^cards\/[a-z0-9-]+\.md$/.test(card.body ?? '')) throw new Error('Invalid body path');
    const file = realpathSync(join(catalogRoot, card.body));
    if (!file.startsWith(catalogRoot + sep)) throw new Error('Body escapes catalog');
    card.content = readBounded(file, 32000).toString('utf8');
  }
  return validateCatalog(data);
}
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const stops = new Set(['a', 'an', 'the', 'my', 'i', 'how', 'do', 'to', 'in', 'of']);
export function search(data, query = '') {
  const normalized = normalize(query);
  if (!query.trim()) return data.cards.slice();
  if (!normalized) return [];
  const terms = normalized.split(/\s+/).filter(term => !stops.has(term));
  if (!terms.length) return [];
  return data.cards.map((card, index) => {
    const title = normalize(card.title);
    const synonyms = card.synonyms.map(normalize);
    const body = normalize(`${card.content} ${card.effect} ${card.layer} ${card.id}`);
    if (!terms.every(term => [title, body, ...synonyms].some(field => field.includes(term)))) return { card, index, score: 0 };
    const score = (title === normalized ? 100 : 0) + (synonyms.includes(normalized) ? 80 : 0) +
      terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0) + (synonyms.some(s => s.includes(term)) ? 5 : 0) + (body.includes(term) ? 1 : 0), 1);
    return { card, index, score };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).map(result => result.card);
}
