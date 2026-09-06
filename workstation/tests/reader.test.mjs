import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { loadCatalog, CHAPTERS } from '../src/catalog.mjs';
import { interpolate, emptyProfile } from '../src/profile.mjs';
import { executable } from '../src/process.mjs';
import { createDocuments, readerInvocation, readLesson, renderCard } from '../src/reader.mjs';

function fixture(t) {
  const home = mkdtempSync(join(tmpdir(), 'guide reader '));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, 'bin'));
  const env = { HOME: home, PATH: join(home, 'bin'), TERM: 'xterm-256color' };
  const cards = loadCatalog().cards.map(card => ({ ...card, content: interpolate(card.content, emptyProfile()), tools: [] }));
  return { home, env, cards };
}
function fake(home, code) {
  writeFileSync(join(home, 'bin/nvim'), `#!${process.execPath}\n${code}`, { mode: 0o755 });
}

test('regular Markdown files contain complete lessons, private bindings, and working sibling links', t => {
  const { home, cards } = fixture(t);
  cards[0].content += '\nRecorded private display label: synthetic-binding\n';
  const docs = createDocuments(cards, cards[0].id, home);
  assert.equal(statSync(docs.directory).mode & 0o777, 0o700);
  assert.equal(basename(docs.entry), cards[0].id + '.md');
  for (const card of cards) {
    const file = join(docs.directory, card.id + '.md');
    assert.equal(statSync(file).mode & 0o777, 0o600);
    const body = readFileSync(file, 'utf8');
    for (const part of [card.title, card.layer, card.effect, card.recovery, card.source.url, '## When', '## Try', '## Why', ':q', 'Ctrl-O']) assert.ok(body.includes(part), part);
    assert.doesNotMatch(body, /\{\{binding\./);
    for (const related of card.related) assert.ok(body.includes(related + '.md'));
    for (const link of body.matchAll(/\]\(([^)]+\.md)\)/g)) assert.ok(existsSync(join(docs.directory, link[1])), link[1]);
  }
  const index = readFileSync(join(docs.directory, 'index.md'), 'utf8');
  for (const chapter of CHAPTERS) assert.ok(index.includes(chapter.title));
  assert.ok(readFileSync(docs.entry, 'utf8').includes('synthetic-binding'));
});

test('document creation rejects escaping, colliding and missing IDs before leaving private copies', t => {
  const { home, cards } = fixture(t);
  for (const id of ['../outside', 'index', 'x/y', '-option']) {
    assert.throws(() => createDocuments([{ ...cards[0], id }], id, home));
  }
  assert.throws(() => createDocuments(cards, 'no-such-card', home));
  assert.throws(() => createDocuments([cards[0], cards[0]], cards[0].id, home));
  assert.deepEqual(readdirSync(home), ['bin']);
});

test('no TTY or missing Neovim means no reader process or files', async t => {
  const { home, env, cards } = fixture(t);
  const marker = join(home, 'ran');
  assert.equal((await readLesson(cards, cards[0].id, { env, tty: true })).opened, false);
  fake(home, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'bad')`);
  assert.equal((await readLesson(cards, cards[0].id, { env, tty: false })).opened, false);
  assert.equal(existsSync(marker), false);
  assert.deepEqual(readdirSync(home), ['bin']);
});

test('reader uses an isolated argv/environment, real files, and cleans after normal/failing exit', async t => {
  const { home, env, cards } = fixture(t);
  const marker = join(home, 'invocation.json');
  for (const code of [0, 2]) {
    fake(home, `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({args:process.argv.slice(2),env:process.env,cwd:process.cwd(),body:fs.readFileSync(process.argv.at(-1),'utf8')}));process.exit(${code});`);
    const result = await readLesson(cards, cards[0].id, { env: { ...env, VIMINIT: 'bad', EXINIT: 'bad', NVIM: '/private/socket', NVIM_LOG_FILE: '/private/log', NODE_OPTIONS: '--require /bad', XDG_DATA_HOME: '/private/state' }, tty: true });
    assert.equal(result.opened, code === 0);
    const info = JSON.parse(readFileSync(marker));
    assert.deepEqual(info.args.slice(0, 7), ['-u', 'NONE', '-i', 'NONE', '-n', '-R', '--noplugin']);
    assert.equal(info.args.at(-2), '--');
    assert.ok(info.args.includes('set nomodeline nomodelineexpr noexrc noundofile noswapfile'));
    assert.equal(info.env.VIMINIT, undefined);
    assert.equal(info.env.EXINIT, undefined);
    assert.equal(info.env.NVIM, undefined);
    assert.equal(info.env.NODE_OPTIONS, undefined);
    assert.equal(info.env.NVIM_LOG_FILE, '/dev/null');
    assert.notEqual(info.env.HOME, home);
    assert.equal(info.env.HOME, info.cwd);
    for (const key of ['XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'XDG_RUNTIME_DIR', 'TMPDIR']) assert.ok(info.env[key].startsWith(info.cwd + '/'));
    assert.equal(existsSync(info.cwd), false);
    assert.ok(info.body.includes(cards[0].recovery));
  }
});

test('external cancellation reaps the reader and removes its private documents', { timeout: 10000 }, async t => {
  const { home, env } = fixture(t);
  const marker = join(home, 'reader-pid.json');
  fake(home, `process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid,cwd:process.cwd()}));setInterval(()=>{},1000);`);
  const source = `import {loadCatalog} from ${JSON.stringify(new URL('../src/catalog.mjs', import.meta.url).href)};
    import {readLesson} from ${JSON.stringify(new URL('../src/reader.mjs', import.meta.url).href)};
    const cards=loadCatalog().cards.map(c=>({...c,tools:[]}));
    const result=await readLesson(cards,cards[0].id,{tty:true});process.exitCode=result.code;`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], { env, stdio: 'ignore' });
  const closed = new Promise(resolve => child.once('close', code => resolve(code)));
  t.after(() => { try { child.kill('SIGKILL'); } catch {} });
  const until = Date.now() + 4000;
  while (!existsSync(marker) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(existsSync(marker));
  const info = JSON.parse(readFileSync(marker));
  t.after(() => { try { process.kill(info.pid, 'SIGKILL'); } catch {} });
  child.kill('SIGTERM');
  assert.equal(await closed, 143);
  assert.equal(existsSync(info.cwd), false);
  assert.throws(() => process.kill(info.pid, 0), { code: 'ESRCH' });
});

const nvim = executable('nvim');
test('real isolated Neovim disables persistence/modelines and follows files with gf / Ctrl-O', { skip: !nvim, timeout: 10000 }, t => {
  const { home, env, cards } = fixture(t);
  // Put the synthetic modeline within the last five lines so it would be read.
  cards[0].source.revision = 'vim: set tabstop=13:';
  const docs = createDocuments(cards, cards[0].id, home);
  const request = readerInvocation(nvim, docs, { ...env, VIMINIT: 'let g:should_not_run=1' });
  const lua = `local ok,err=pcall(function()
    assert(vim.o.shadafile=='NONE'); assert(not vim.o.swapfile); assert(not vim.o.undofile)
    assert(not vim.o.modeline); assert(not vim.o.modelineexpr); assert(not vim.o.exrc)
    assert(vim.bo.readonly); assert(vim.bo.buftype==''); assert(vim.bo.filetype=='markdown')
    assert(vim.bo.tabstop~=13); assert(vim.g.should_not_run==nil)
    assert(vim.fn.search('shell.history.md','w')>0)
    vim.cmd('normal! gf'); assert(vim.fn.expand('%:t')=='shell.history.md')
    assert(vim.bo.readonly); assert(not vim.o.swapfile); assert(not vim.o.undofile)
    vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes('<C-o>',true,false,true),'nx',false)
    assert(vim.fn.expand('%:t')=='shell.build-command.md')
  end); if not ok then print(err); vim.cmd('cquit 1') else vim.cmd('qall!') end`;
  const args = [...request.args.slice(0, -2), '--headless', '-c', `lua ${lua}`, ...request.args.slice(-2)];
  const result = spawnSync(request.file, args, { ...request.options, encoding: 'utf8', timeout: 8000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(docs.entry, 'utf8'), renderCard(cards[0], { files: true }));
  const positive = spawnSync(request.file, [...request.args.slice(0, -2), '--headless',
    '--cmd', 'set modeline modelines=5', '-c', "lua if vim.bo.tabstop==13 then vim.cmd('qall!') else vim.cmd('cquit 1') end",
    ...request.args.slice(-2)], { ...request.options, encoding: 'utf8', timeout: 8000 });
  assert.equal(positive.status, 0, 'positive control: fixture modeline must take effect when deliberately enabled');
});
