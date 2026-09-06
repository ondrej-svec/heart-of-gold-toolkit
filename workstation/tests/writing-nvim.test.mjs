import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { fixture } from './writing-fixture.mjs';
import { executable } from '../src/process.mjs';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url))), NVIM = executable('nvim'), q = JSON.stringify;
const opts = { skip: !NVIM, timeout: 15000 };
function editor(t, script, scenario = {}, guideFake) {
  const f = fixture(t, scenario);
  const source = 'First paragraph.\nStill the first.\n\nSecond paragraph.\n';
  writeFileSync(join(f.home, 'source.txt'), source);
  script = script.replaceAll(q('CAPTURE_PLACEHOLDER'), q(join(f.root, 'capture.json')))
    .replaceAll(q('__GRANDCHILD__'), q(join(f.root, 'grandchild')));
  const entry = guideFake ? join(f.root, 'fake-guide.mjs') : join(ROOT, 'bin/workstation-guide.mjs');
  if (guideFake) writeFileSync(entry, guideFake);
  const lua = join(f.root, 'test.lua');
  writeFileSync(lua, `local ok,err=xpcall(function()
    local ai=dofile(${q(join(ROOT, 'integrations/nvim/workstation-ai.lua'))})
    local options={node=${q(process.execPath)},entry=${q(entry)}}
    local notices={}; vim.notify=function(s) table.insert(notices,s) end
    local function wait(fn) assert(vim.wait(5000,fn,10),'timed out') end
    local function owned() local bs={} for _,b in ipairs(vim.api.nvim_list_bufs()) do
      if vim.api.nvim_buf_get_name(b):match('^workstation%-ai://') then table.insert(bs,b) end end return bs end
    local function shown(s) return table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\\n'):find(s,1,true)~=nil end
    local function preview() wait(function() return #owned()>0 and shown('WorkstationAISend') end) end
    local function result() wait(function() return #owned()>0 and shown('Result ready') end) end
    vim.cmd('edit '..vim.fn.fnameescape(vim.env.HOME..'/source.txt'))
    local source=vim.api.nvim_get_current_buf(); local sourcewin=vim.api.nvim_get_current_win()
    local original=vim.api.nvim_buf_get_lines(source,0,-1,false); local tick=vim.api.nvim_buf_get_changedtick(source)
    local function capture() return vim.json.decode(table.concat(vim.fn.readfile(${q(join(f.root, 'capture.json'))}),'\\n')) end
    ${script}
  end,debug.traceback)
  if ok then vim.cmd('qall!') else io.stderr:write(err..'\\n'); vim.cmd('cquit 1') end`);
  const env = { ...f.env, XDG_CONFIG_HOME: join(f.home, 'config'), XDG_DATA_HOME: join(f.home, 'data'),
    XDG_STATE_HOME: join(f.home, 'state'), XDG_CACHE_HOME: join(f.home, 'cache'), NVIM_LOG_FILE: '/dev/null',
    NODE_OPTIONS: '--require /must-not-run', OPENAI_API_KEY: 'synthetic', PI_SESSION_ID: 'synthetic',
    PI_MODEL: 'must-not-use', PI_PROVIDER: 'other', PI_REASONING_LEVEL: 'off', TERM: 'xterm-256color' };
  const args = ['-u', 'NONE', '-i', 'NONE', '-n', '--noplugin', '--headless', '-l', lua];
  const run = process.platform === 'darwin' ? spawnSync('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)(deny network*)', NVIM, ...args], { env, cwd: f.home, encoding: 'utf8', timeout: 12000 })
    : spawnSync(NVIM, args, { env, cwd: f.home, encoding: 'utf8', timeout: 12000 });
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.equal(readFileSync(join(f.home, 'source.txt'), 'utf8'), source, 'adapter never saves');
  return f;
}

test('paragraph preview sends nothing; explicit Send reviews, Apply is one undo and never saves', opts, t => {
  const f = editor(t, `
    vim.g.colors_name='synthetic-existing-theme'; vim.o.background='light'; vim.cmd('highlight Normal ctermfg=7 ctermbg=0')
    local highlight=vim.api.nvim_get_hl(0,{name='Normal'})
    local mappings=vim.api.nvim_get_keymap('n'); local theme=vim.g.colors_name; local native=vim.fn.exists(':help')
    local hooks=0; vim.api.nvim_create_autocmd({'FileType','BufReadPost'},{callback=function() hooks=hooks+1 end})
    assert(ai.setup(options)); assert(ai.setup(options)); vim.cmd('WorkstationAI improve-writing'); preview()
    assert(vim.bo.buftype=='nofile' and vim.bo.readonly and not vim.bo.modifiable)
    assert(not vim.bo.swapfile and not vim.bo.undofile and not vim.bo.modeline and not vim.bo.buflisted)
    assert(shown('Lines 1–2') and shown('openai-codex') and shown('gpt-6-astra') and shown('xhigh') and shown('98288d12'))
    assert(shown('First paragraph.') and not shown('Second paragraph.'))
    assert(vim.fn.filereadable(${q('CAPTURE_PLACEHOLDER')})==0)
    assert(vim.api.nvim_buf_get_changedtick(source)==tick and not vim.bo[source].modified)
    vim.cmd('WorkstationAISend'); result()
    assert(vim.api.nvim_buf_get_changedtick(source)==tick and not vim.bo[source].modified)
    local sent=vim.json.decode(vim.split(capture().input,'\\n',{plain=true})[2]).input
    assert(sent=='First paragraph.\\nStill the first.')
    assert(capture().env.NODE_OPTIONS==nil and capture().env.OPENAI_API_KEY==nil and capture().env.PI_SESSION_ID==nil)
    local review=vim.api.nvim_get_current_buf(); local reviewwin=vim.api.nvim_get_current_win()
    local before=vim.api.nvim_buf_call(source,vim.fn.undotree).seq_cur
    vim.cmd('WorkstationAIApply'); assert(vim.api.nvim_get_current_win()==sourcewin)
    assert(vim.bo[source].modified and vim.api.nvim_buf_get_lines(source,0,-1,false)[1]=='A better paragraph.')
    assert(vim.api.nvim_buf_get_lines(source,0,-1,false)[3]=='Second paragraph.')
    assert(vim.fn.undotree().seq_cur==before+1)
    vim.cmd('undo'); assert(vim.deep_equal(vim.api.nvim_buf_get_lines(source,0,-1,false),original))
    vim.api.nvim_set_current_win(reviewwin); vim.cmd('WorkstationAIApply')
    assert(vim.deep_equal(vim.api.nvim_buf_get_lines(source,0,-1,false),original))
    vim.cmd('WorkstationAI!'); assert(#owned()==0 and #vim.api.nvim_list_wins()==1)
    assert(hooks==0 and vim.fn.exists(':help')==native and vim.g.colors_name==theme)
    assert(vim.o.background=='light' and vim.deep_equal(highlight,vim.api.nvim_get_hl(0,{name='Normal'})))
    vim.cmd('doautocmd FileType markdown'); assert(hooks==1) -- suppression positive control
    assert(vim.deep_equal(mappings,vim.api.nvim_get_keymap('n')))
  `, { text: 'A better paragraph.\n' });
  assert.ok(existsSync(join(f.root, 'capture.json')));
});

test('native character/block Visual ranges are rejected; linewise Visual is explicit', opts, t => {
  editor(t, `
    assert(ai.setup(options))
    local function keys(s) vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes(s,true,false,true),'xt',false) end
    for _,selection in ipairs({'gg0vl','gg0<C-v>j'}) do
      local count=#notices
      keys(selection..':WorkstationAI improve-writing<CR>')
      assert(vim.wait(1000,function() return #notices>count end,10),'unsupported selection was not rejected')
      assert(#owned()==0 and vim.fn.filereadable(${q('CAPTURE_PLACEHOLDER')})==0)
    end
    keys('ggVj:WorkstationAI improve-writing<CR>'); preview()
    assert(shown('Lines 1–2') and shown('Explicit linewise range.'))
  `);
});

test('explicit ranges are linewise; feedback and summary never offer Apply', opts, t => {
  for (const action of ['analyze-prose', 'summarize-micro']) editor(t, `
    assert(ai.setup(options)); vim.cmd('2,4WorkstationAI ${action}'); preview()
    assert(shown('Lines 2–4')); vim.cmd('WorkstationAISend'); result()
    local sent=vim.json.decode(vim.split(capture().input,'\\n',{plain=true})[2]).input
    assert(sent=='Still the first.\\n\\nSecond paragraph.')
    assert(vim.fn.exists(':WorkstationAIApply')==0)
    assert(vim.api.nvim_buf_get_changedtick(source)==tick and not vim.bo[source].modified)
    vim.cmd('quit'); assert(#owned()==0 and vim.api.nvim_get_current_win()==sourcewin)
  `, { text: '# Feedback\nA synthetic observation.' });
});

test('blank, special, readonly, disabled-undo or changed sources cannot be sent/applied', opts, t => {
  editor(t, `
    assert(ai.setup(options)); vim.api.nvim_win_set_cursor(0,{3,0}); vim.cmd('WorkstationAI improve-writing')
    assert(#owned()==0 and #notices>0)
    vim.api.nvim_win_set_cursor(0,{1,0}); vim.bo.buftype='nofile'; vim.cmd('WorkstationAI improve-writing'); assert(#owned()==0)
    vim.bo.buftype=''; vim.cmd('WorkstationAI improve-writing'); preview()
    vim.api.nvim_buf_set_lines(source,0,1,false,{'changed before send'}); vim.cmd('WorkstationAISend')
    assert(shown('WorkstationAISend') and vim.fn.filereadable(${q('CAPTURE_PLACEHOLDER')})==0); vim.cmd('WorkstationAI!')
    vim.api.nvim_set_current_win(sourcewin); vim.cmd('WorkstationAI improve-writing'); preview(); vim.cmd('WorkstationAISend'); result()
    vim.bo[source].readonly=true; vim.cmd('WorkstationAIApply'); assert(vim.api.nvim_get_current_win()~=sourcewin)
    vim.bo[source].readonly=false; vim.bo[source].undolevels=-1; vim.cmd('WorkstationAIApply')
    assert(vim.api.nvim_buf_get_lines(source,0,-1,false)[1]=='changed before send')
  `);
});

test('changedtick refuses stale Apply even after source undo; result remains readable', opts, t => {
  editor(t, `
    assert(ai.setup(options)); vim.cmd('WorkstationAI improve-writing'); preview(); vim.cmd('WorkstationAISend'); result()
    local reviewwin=vim.api.nvim_get_current_win()
    vim.api.nvim_set_current_win(sourcewin); vim.api.nvim_buf_set_lines(source,0,1,false,{'intervening edit'}); vim.cmd('undo')
    vim.api.nvim_set_current_win(reviewwin); vim.cmd('WorkstationAIApply')
    assert(shown('Result ready') and vim.deep_equal(vim.api.nvim_buf_get_lines(source,0,-1,false),original))
    assert(table.concat(notices):find('changed',1,true))
  `);
});

test('late chooser callbacks, replacement, source destruction and command collisions are safe', opts, t => {
  editor(t, `
    local ran=false; vim.api.nvim_create_user_command('WorkstationAI',function() ran=true end,{})
    assert(not ai.setup(options)); vim.cmd('WorkstationAI'); assert(ran); vim.api.nvim_del_user_command('WorkstationAI')
    vim.api.nvim_create_user_command('WorkstationAIApply',function() end,{})
    assert(not ai.setup(options)); vim.api.nvim_del_user_command('WorkstationAIApply')
    assert(ai.setup(options)); local choices,callback; vim.ui.select=function(items,_,cb) choices=items; callback=cb end
    vim.cmd('WorkstationAI'); wait(function() return callback~=nil end)
    vim.cmd('WorkstationAI!'); callback(choices[1]); assert(#owned()==0)
    vim.cmd('WorkstationAI improve-writing'); preview(); vim.cmd('WorkstationAI!'); assert(#owned()==0)
    callback=nil; vim.api.nvim_set_current_win(sourcewin); vim.cmd('WorkstationAI'); wait(function() return callback~=nil end)
    vim.api.nvim_buf_delete(source,{force=true}); callback(choices[1]); assert(#owned()==0)
  `);
});

test('Apply preserves an earlier unsaved undo entry and supports explicit whole-buffer disclosure', opts, t => {
  editor(t, `
    vim.api.nvim_buf_set_lines(source,0,1,false,{'Earlier unsaved edit.'})
    local before=vim.api.nvim_buf_get_lines(source,0,-1,false)
    assert(ai.setup(options)); vim.cmd('%WorkstationAI improve-writing'); preview()
    assert(shown('every line in this buffer') and shown('Lines 1–4'))
    vim.cmd('WorkstationAISend'); result(); vim.cmd('WorkstationAIApply')
    vim.cmd('undo'); assert(vim.deep_equal(vim.api.nvim_buf_get_lines(source,0,-1,false),before) and vim.bo[source].modified)
    vim.cmd('undo'); assert(vim.deep_equal(vim.api.nvim_buf_get_lines(source,0,-1,false),original))
  `, { text: 'A rewritten whole buffer.' });
});

test('delayed results do not steal focus or close a foreign buffer', opts, t => {
  for (const foreign of [false, true]) editor(t, `
    assert(ai.setup(options)); vim.cmd('WorkstationAI improve-writing'); preview()
    local reviewwin=vim.api.nvim_get_current_win(); local review=vim.api.nvim_get_current_buf()
    vim.cmd('WorkstationAISend')
    ${foreign ? "vim.cmd('enew'); vim.api.nvim_buf_set_lines(0,0,-1,false,{'Keep foreign buffer.'})" : 'vim.api.nvim_set_current_win(sourcewin)'}
    local activewin=vim.api.nvim_get_current_win(); local activebuf=vim.api.nvim_get_current_buf()
    wait(function() return #notices>0 or table.concat(vim.api.nvim_buf_get_lines(review,0,-1,false),'\\n'):find('Result ready',1,true) end)
    assert(vim.api.nvim_get_current_win()==activewin and vim.api.nvim_get_current_buf()==activebuf)
    vim.cmd('WorkstationAI!'); assert(vim.api.nvim_win_is_valid(activewin))
    assert(vim.api.nvim_buf_get_changedtick(source)==tick)
    ${foreign ? "assert(vim.api.nvim_buf_get_lines(activebuf,0,-1,false)[1]=='Keep foreign buffer.')" : ''}
  `, { closeDelay: 250 });
});

test('replacement and source deletion during generation reap the old job without applying late output', opts, t => {
  for (const replacement of [false, true]) {
    const f = editor(t, `
      assert(ai.setup(options)); vim.cmd('WorkstationAI improve-writing'); preview(); vim.cmd('WorkstationAISend')
      wait(function() return vim.fn.filereadable(${q('CAPTURE_PLACEHOLDER')})==1 end)
      local pid=capture().pid
      vim.api.nvim_set_current_win(sourcewin)
      ${replacement ? "vim.cmd('WorkstationAI analyze-prose'); preview(); assert(shown('Analyze prose')); vim.cmd('WorkstationAI!')" : "vim.api.nvim_buf_delete(source,{force=true})"}
      wait(function() return not vim.uv.kill(pid,0) end)
      assert(#owned()==0)
    `, { hang: true, grandchild: true });
    assert.throws(() => process.kill(f.capture().pid, 0), { code: 'ESRCH' });
  }
});

test('invalid or excessive guide responses stay generic and leave source untouched', opts, t => {
  for (const fake of [
    'console.log("PRIVATE malformed");',
    'console.log(JSON.stringify({schemaVersion:999,ok:true,actions:[]}));',
    'console.error("PRIVATE stderr");process.exitCode=1;',
    'process.stdout.write("PRIVATE".repeat(350000));setInterval(()=>{},1000);',
  ]) editor(t, `
    assert(ai.setup(options)); vim.cmd('WorkstationAI')
    wait(function() return #notices>0 end)
    assert(#owned()==0 and vim.api.nvim_buf_get_changedtick(source)==tick)
    assert(not table.concat(notices):find('PRIVATE',1,true))
  `, {}, fake);
});

test('oversized selected text is rejected before preparation', opts, t => {
  editor(t, `
    vim.api.nvim_buf_set_lines(source,0,-1,false,{string.rep('x',131073)})
    assert(ai.setup(options)); vim.cmd('WorkstationAI improve-writing')
    assert(#notices>0 and #owned()==0 and vim.fn.filereadable(${q('CAPTURE_PLACEHOLDER')})==0)
  `);
});

test('closing a running review or exiting Neovim cancels and reaps the owned Pi group', opts, t => {
  for (const closing of ["vim.cmd('quit'); wait(function() return #owned()==0 end)", '']) {
    const f = editor(t, `
      assert(ai.setup(options)); vim.cmd('WorkstationAI improve-writing'); preview(); vim.cmd('WorkstationAISend')
      wait(function() return vim.fn.filereadable(${q('GRANDCHILD_PLACEHOLDER')})==1 end)
      ${closing}
    `.replace(q('GRANDCHILD_PLACEHOLDER'), q('__GRANDCHILD__')), { hang: true, grandchild: true });
    // Filled by the fixture helper before execution. Both processes must be gone.
    for (const pid of [f.capture().pid, Number(readFileSync(join(f.root, 'grandchild'), 'utf8'))]) {
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    }
  }
});
