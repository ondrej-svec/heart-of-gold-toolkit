import { createInterface } from 'node:readline';
import { CHAPTERS, TOOLS, loadCatalog, search } from './catalog.mjs';
import { BINDINGS, loadProfile, bindingStatus, interpolate, readBounded, sha256 } from './profile.mjs';
import { executable, toolEnv, runProcess } from './process.mjs';
import { pick, present } from './presentation.mjs';
import { colorEnabled, colorText } from './theme.mjs';
import { readLesson, renderCard, renderIndex, EDITOR_READING } from './reader.mjs';

const VERSION = '0.1.0-proof';
const USAGE = `workstation-guide — Learn your whole workstation, offline

Usage: workstation-guide [task query]
  list [--json]                   All reference cards (also -l or --list)
  show <id> [--json]              Read a card; never execute its examples
  learn [id] [--hint N]           Manual practice; no tracking
  doctor [--json]                 Read-only presence/profile checks
  cmd <command> [subcommand]      Reviewed tldr C 1.6.1, cache-only

Options: --plain (terminal text; no picker/editor/Glow), --glow (terminal formatting),
         --profile /absolute/profile.json, --json, --help, --version
Use -- to treat remaining arguments as literal search text.
Interactive lessons open as Markdown files in an isolated Neovim reader.
Use j/k, /word, gf on a filename, Ctrl-O to go back; :q returns to the picker.
Colors follow the active terminal palette (Rosé Pine when configured).
--plain, NO_COLOR or TERM=dumb selects uncolored terminal presentation.
Non-TTY/JSON output never opens an editor or waits. Esc quits the picker.
No live editor configuration, AI runner or shell alias is installed.
`;
function parse(argv) {
  const options = { words: [], json: false, plain: false, glow: false, hint: 0 };
  let literal = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (literal) { options.words.push(arg); continue; }
    if (arg === '--') { literal = true; options.queryOnly = options.words.length === 0; continue; }
    if (arg === '-l' || arg === '--list') options.list = true;
    else if (['--json', '--plain', '--glow'].includes(arg)) options[arg.slice(2)] = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version') options.version = true;
    else if (arg === '--profile') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('--profile requires an absolute filename');
      options.profile = argv[++i];
    } else if (arg === '--hint') {
      if (!/^\d+$/.test(argv[i + 1] ?? '') || Number(argv[i + 1]) > 10) throw new Error('--hint needs a number from 0 to 10');
      options.hint = Number(argv[++i]); options.hintSet = true;
    } else if (arg.startsWith('-')) throw new Error('Unknown option; use --help or -- before a literal query');
    else options.words.push(arg);
  }
  if (options.list) {
    if (options.words.length) throw new Error('-l/--list takes no query or subcommand; use list by itself');
    options.words.push('list');
  }
  if (options.plain) options.glow = false;
  return options;
}
const output = value => process.stdout.write(value.endsWith('\n') ? value : value + '\n');
const json = data => output(JSON.stringify({ schemaVersion: 1, ok: true, ...data }, null, 2));
function tools(env) {
  return Object.entries(TOOLS).map(([name, role]) => ({ name, role, status: name === 'node' || executable(name, env) ? 'present' : 'missing' }));
}
function viewCard(card, state, installed) {
  const view = { ...card, content: interpolate(card.content, state.profile, state.configRoot),
    tools: installed.filter(tool => card.requirements.includes(tool.name)) };
  return { ...view, markdown: renderCard(view, { files: true, reading: EDITOR_READING }) };
}
function rootText(cards) {
  let number = 0;
  return `HEART OF GOLD — Your workstation\nHow do I…?\nNothing runs when you open a guide.\n\n` + CHAPTERS.map(chapter =>
    `${chapter.title}\n` + cards.filter(card => card.chapter === chapter.id).map(card => `  ${++number}. ${card.title}  (${card.id})`).join('\n')
  ).join('\n\n') + `\n\nPractise a workflow: learn · Check my setup: doctor · Command examples: cmd\nSearch by intention: workstation-guide "find a file"\nRead: workstation-guide show <id> · Options: --help\n`;
}
function listText(cards) {
  return cards.length ? cards.map((card, i) => `${i + 1}. ${card.title}  (${card.id})`).join('\n') : 'No matching cards. Try "find a file", "return to my workspace", or list.';
}
function exerciseText(card, count) {
  return `# Practise: ${card.title}\n\n${card.exercise.goal}\n\n` + card.exercise.hints.slice(0, count).map((hint, i) => `Hint ${i + 1}: ${hint}`).join('\n') +
    `\n\nSelf-check: ${card.exercise.success}\nNo tracking. Stop whenever you like; nothing has been launched.\nRead the steps: workstation-guide show ${card.id}\nNext hint: workstation-guide learn ${card.id} --hint ${Math.min(count + 1, card.exercise.hints.length)}\n`;
}
function ask(prompt) {
  return new Promise(resolve => {
    const reader = createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;
    reader.once('close', () => { if (!answered) resolve(null); });
    reader.once('SIGINT', () => { process.exitCode = 130; reader.close(); });
    reader.question(prompt, answer => { answered = true; reader.close(); resolve(answer.trim()); });
  });
}
async function commandExamples(words, options, state, env) {
  if (options.json || !words.length || words.length > 3 || words.some(word => !/^[a-z0-9][a-z0-9-]*$/.test(word))) {
    throw new Error('cmd takes a command name and up to two subcommand words, not options; JSON is unavailable for external examples');
  }
  const binary = executable('tldr', env);
  if (!binary) throw new Error('tldr is missing. The bundled guide works without it; see list. No installation was attempted.');
  if (!state.profile.tldr || sha256(readBounded(binary, 64 * 1024 * 1024)) !== state.profile.tldr.sha256) {
    throw new Error('tldr client is unreviewed or changed. Cache-only delegation requires a profile-pinned tldr C 1.6.1. Use tldr directly only if you accept its network/cache behavior.');
  }
  const result = await runProcess(binary, [words.join('-')], { env: { ...toolEnv(env), TLDR_AUTO_UPDATE_DISABLED: '1' } });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.code && !result.interrupted) console.error('Cached command examples unavailable; no update was requested.');
  return result.code;
}
export async function main(argv = process.argv.slice(2), env = process.env) {
  let options;
  try {
    options = parse(argv);
    // An explicit color opt-out uses terminal text, not a nested colored UI.
    if (env.NO_COLOR || env.TERM === 'dumb') { options.plain = true; options.glow = false; }
    const print = value => output(colorEnabled(env, process.stdout.isTTY, options.plain)
      ? colorText(value, CHAPTERS.map(chapter => chapter.title)) : value);
    if (options.help) { print(USAGE); return 0; }
    if (options.version) { output(VERSION); return 0; }
    const data = loadCatalog();
    const state = loadProfile(env, options.profile);
    const installed = tools(env);
    // The numbered root and its offered records must use the same chapter order,
    // even when authors append a card elsewhere in the catalog file.
    const cards = CHAPTERS.flatMap(chapter => data.cards.filter(card => card.chapter === chapter.id))
      .map(card => viewCard(card, state, installed));
    const byId = id => {
      const card = cards.find(card => card.id === id);
      if (!card) throw new Error('Unknown card ID; use list to see stable IDs');
      return card;
    };
    const [first, ...rest] = options.words;
    const command = options.queryOnly && first !== undefined ? '__literal_query__' : first;
    const tty = !!(process.stdin.isTTY && process.stdout.isTTY);
    const display = async card => {
      if (tty && !options.plain && !options.glow) {
        const result = await readLesson(cards, card.id, { env, tty });
        if (result.interrupted) { process.exitCode = result.code; return true; }
        if (result.opened) return true;
        console.error(result.reason === 'missing'
          ? 'Neovim is unavailable; showing terminal text. Use --plain to keep this mode.'
          : 'Neovim could not display the guide; showing terminal text instead.');
      }
      if (options.glow) output(await present(renderCard(card), { env, glow: true, tty }));
      else print(renderCard(card));
      return false;
    };
    const diagnosis = () => ({ profile: state.status, tools: installed,
      bindings: Object.keys(BINDINGS).map(name => ({ name, ...bindingStatus(name, state.profile, state.configRoot) })),
      notice: 'Presence and recorded fingerprints only; no tool execution, auth checks, shell sourcing or runtime integration verification.' });
    const doctor = () => {
      const status = diagnosis();
      if (options.json) json(status);
      else print(`SETUP CHECK — read only\nProfile: ${status.profile}\n\n${status.tools.map(tool => `${tool.name}: ${tool.status} — ${tool.role}`).join('\n')}\n\n${status.bindings.map(binding => `${binding.name}: ${binding.status}`).join('\n')}\n\n${status.notice}\n`);
    };
    if (options.hintSet && command !== 'learn') throw new Error('--hint is only for learn');
    if (['list', 'doctor'].includes(command) && rest.length) throw new Error(`${command} takes no positional arguments`);
    if (command === 'doctor') { doctor(); return 0; }
    if (command === 'cmd') return await commandExamples(rest, options, state, env);
    if (command === 'ai') throw new Error('AI execution is not implemented in this offline proof. Read: show writing.review');
    if (command === 'show') {
      if (rest.length !== 1) throw new Error('show requires exactly one card ID');
      const card = byId(rest[0]);
      if (options.json) json({ card }); else await display(card);
      return process.exitCode || 0;
    }
    if (command === 'learn') {
      if (rest.length > 1) throw new Error('learn takes at most one card ID');
      if (!rest.length) {
        const exercises = cards.filter(card => card.exercise);
        if (options.json) json({ cards: exercises });
        else print('MANUAL PRACTICE — opt in; nothing launches or records progress\n\n' + listText(exercises) + '\n\nStart: workstation-guide learn <id> · Reveal: --hint 1');
      } else {
        const card = byId(rest[0]);
        if (!card.exercise) throw new Error('This card has no exercise yet');
        if (options.json) json({ id: card.id, ...card.exercise, hints: card.exercise.hints.slice(0, options.hint) });
        else print(exerciseText(card, options.hint));
      }
      return 0;
    }
    const matches = command === 'list' ? cards : search({ cards }, options.words.join(' '));
    if (options.json) {
      json({ chapters: CHAPTERS, cards: matches, indexMarkdown: renderIndex(cards, { reading: EDITOR_READING }),
        documents: Object.fromEntries(cards.map(card => [card.id, card.markdown])) });
      return 0;
    }
    if (command === 'list') { print(listText(matches)); return 0; }
    if (!tty) { print(command ? listText(matches) : rootText(cards)); return 0; }
    if (command && matches.length === 1) { await display(matches[0]); return process.exitCode || 0; }
    if (!matches.length) { print(listText(matches)); return 0; }
    // Reuse the same authored cards in both the optional picker and numbered UI.
    let offered = matches;
    while (!process.exitCode) {
      print(!command && offered === matches ? rootText(cards) : listText(offered));
      let chosen;
      if (!options.plain) chosen = await pick([...offered,
        { id: 'menu.learn', title: 'Practise a workflow', chapter: 'guide' },
        { id: 'menu.doctor', title: 'Check my setup', chapter: 'guide' },
      ], env);
      if (chosen === null) break;
      if (chosen?.id === 'menu.doctor' || chosen?.id === 'menu.learn') {
        if (chosen.id === 'menu.doctor') doctor();
        else print(listText(cards.filter(card => card.exercise)) + '\nUse: workstation-guide learn <id>');
        if (await ask('Enter: back · Ctrl-C: quit > ') === null) break;
        continue;
      }
      if (!chosen) {
        const answer = await ask('Number or task · l: practise · d: doctor · q/Esc: quit > ');
        if (answer === null || answer === 'q' || answer === '\x1b') break;
        if (answer === 'd' || answer === 'doctor') { doctor(); continue; }
        if (answer === 'l' || answer === 'learn') { print(listText(cards.filter(card => card.exercise)) + '\nUse: workstation-guide learn <id>'); continue; }
        if (/^\d+$/.test(answer)) chosen = offered[Number(answer) - 1];
        else {
          offered = search({ cards }, answer);
          if (offered.length === 1) chosen = offered[0];
          else { print(listText(offered)); if (!offered.length) offered = matches; continue; }
        }
        if (!chosen) { output('Choose a listed number or search by task.'); continue; }
      }
      const openedInEditor = await display(chosen);
      if (process.exitCode || !openedInEditor && await ask('Enter or q: back to guide · Ctrl-C: quit > ') === null) break;
      offered = matches;
    }
    return process.exitCode || 0;
  } catch (error) {
    // Errors from authored runtime operations are intentionally generic where
    // private files are involved. No raw child stderr/profile snippets are saved.
    const message = error.code ? 'A required local file could not be read; check the installation and profile.' : error.message;
    if (options?.json || argv.includes('--json')) output(JSON.stringify({ schemaVersion: 1, ok: false, error: { code: 'GUIDE_ERROR', message } }));
    else console.error(`workstation-guide: ${message}`);
    return 1;
  }
}
