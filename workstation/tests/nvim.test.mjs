import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executable } from '../src/process.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const NVIM = executable('nvim');
const ADAPTER = join(ROOT, 'integrations/nvim/workstation-help.lua');
const CLI = join(ROOT, 'bin/workstation-guide.mjs');
const q = JSON.stringify;
function fixture(t, script, { fake, extraEnv = {} } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'guide editor '));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  let entry = CLI;
  if (fake) { entry = join(home, 'fake guide.mjs'); writeFileSync(entry, fake); }
  const env = { HOME: home, PATH: dirname(process.execPath), XDG_CONFIG_HOME: join(home, 'config'),
    XDG_DATA_HOME: join(home, 'data'), XDG_STATE_HOME: join(home, 'state'), XDG_CACHE_HOME: join(home, 'cache'),
    NVIM_LOG_FILE: '/dev/null', TERM: 'xterm-256color', ...extraEnv };
  mkdirSync(env.XDG_CONFIG_HOME);
  const lua = join(home, 'test.lua');
  writeFileSync(lua, `local ok,err=xpcall(function()
    local guide=dofile(${q(ADAPTER)})
    local options={node=${q(process.execPath)},entry=${q(entry)}}
    local notices={}; vim.notify=function(message) table.insert(notices,message) end
    local function wait(fn) assert(vim.wait(5000,fn,10),'timed out') end
    local function owned() local list={} for _,b in ipairs(vim.api.nvim_list_bufs()) do
      if vim.api.nvim_buf_get_name(b):match('^workstation%-guide://') then table.insert(list,b) end end return list end
    ${script}
  end,debug.traceback)
  if ok then vim.cmd('qall!') else io.stderr:write(err..'\\n'); vim.cmd('cquit 1') end`);
  const args = ['-u', 'NONE', '-i', 'NONE', '-n', '--noplugin', '--headless', '-l', lua];
  const result = process.platform === 'darwin' && existsSync('/usr/bin/sandbox-exec')
    ? spawnSync('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)(deny network*)', NVIM, ...args], { env, cwd: home, encoding: 'utf8', timeout: 12000 })
    : spawnSync(NVIM, args, { env, cwd: home, encoding: 'utf8', timeout: 12000 });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  return { home, env };
}

const opts = { skip: !NVIM, timeout: 15000 };
test('in-editor shared lessons preserve source, native help, links and cleanup without startup hooks', opts, t => {
  fixture(t, `
    local source=vim.api.nvim_get_current_buf(); local win=vim.api.nvim_get_current_win()
    vim.api.nvim_buf_set_lines(source,0,-1,false,{'unsaved source','second line'})
    vim.api.nvim_win_set_cursor(win,{2,3}); local tick=vim.api.nvim_buf_get_changedtick(source)
    local view=vim.fn.winsaveview(); local undo=vim.fn.undotree(); local maps=vim.api.nvim_get_keymap('n')
    local native=vim.fn.exists(':help'); local hooks=0
    vim.api.nvim_create_autocmd({'BufReadPost','FileType'}, {callback=function() hooks=hooks+1 end})
    assert(guide.setup(options)); assert(guide.setup(options))
    vim.cmd('WorkstationHelp shell.build-command')
    wait(function() return #vim.api.nvim_list_wins()==2 end)
    assert(vim.api.nvim_get_current_win()~=win)
    assert(vim.bo.buftype=='nofile' and vim.bo.readonly and not vim.bo.modifiable)
    assert(not vim.bo.swapfile and not vim.bo.undofile and not vim.bo.modeline)
    assert(vim.bo.filetype=='markdown' and not vim.bo.buflisted)
    assert(hooks==0 and vim.fn.exists(':help')==native)
    assert(vim.deep_equal(maps,vim.api.nvim_get_keymap('n')))
    assert(vim.fn.search('shell.history.md','w')>0)
    vim.cmd('normal! gf'); assert(vim.api.nvim_buf_get_name(0):match('shell.history.md$'))
    vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes('<C-o>',true,false,true),'nx',false)
    assert(vim.api.nvim_buf_get_name(0):match('shell.build%-command.md$'))
    assert(vim.fn.search('index.md','w')>0); vim.cmd('normal! gf')
    assert(vim.api.nvim_buf_get_name(0):match('/index.md$'))
    vim.cmd('quit'); wait(function() return #owned()==0 end)
    assert(vim.api.nvim_get_current_win()==win)
    assert(vim.deep_equal(vim.api.nvim_buf_get_lines(source,0,-1,false),{'unsaved source','second line'}))
    assert(vim.api.nvim_buf_get_changedtick(source)==tick and vim.bo[source].modified, 'source tick/modified changed')
    assert(vim.deep_equal(view,vim.fn.winsaveview()), vim.inspect({before=view,after=vim.fn.winsaveview()}))
    local after=vim.fn.undotree()
    undo.synced=nil; after.synced=nil -- Native window changes finish the current undo block, not an edit.
    assert(vim.deep_equal(undo,after), 'source undo entries changed')
    vim.cmd('doautocmd FileType markdown'); assert(hooks==1) -- positive control
  `, { extraEnv: { NODE_OPTIONS: '--require /not-allowed', OPENAI_API_KEY: 'synthetic', PI_SESSION_ID: 'synthetic' } });
});

test('selection cancellation, replacement and late callbacks cannot reopen guides', opts, t => {
  fixture(t, `
    assert(guide.setup(options))
    local callbacks={}; vim.ui.select=function(items,settings,callback) table.insert(callbacks,{callback,items}) end
    vim.cmd('WorkstationHelp'); wait(function() return #callbacks==1 end)
    assert(#owned()==0); callbacks[1][1](nil); assert(#owned()==0)
    vim.cmd('WorkstationHelp'); wait(function() return #callbacks==2 end)
    vim.cmd('WorkstationHelp!'); callbacks[2][1](callbacks[2][2][1]); assert(#owned()==0)
    vim.cmd('WorkstationHelp'); wait(function() return #callbacks==3 end)
    vim.cmd('WorkstationHelp nvim.modes'); wait(function() return #owned()>0 end)
    local current=vim.api.nvim_get_current_buf()
    callbacks[3][1](callbacks[3][2][1]); assert(vim.api.nvim_get_current_buf()==current)
    vim.cmd('WorkstationHelp!'); wait(function() return #owned()==0 end)
    assert(#vim.api.nvim_list_wins()==1)
  `);
});

test('missing executable, bad configuration and command collisions fail without replacing user commands', opts, t => {
  fixture(t, `
    local ran=false; vim.api.nvim_create_user_command('WorkstationHelp',function() ran=true end,{})
    assert(not guide.setup(options)); vim.cmd('WorkstationHelp'); assert(ran)
    vim.api.nvim_del_user_command('WorkstationHelp')
    assert(not guide.setup({node='node',entry=options.entry}))
    assert(not guide.setup({node='/missing-node',entry=options.entry}))
    vim.api.nvim_buf_create_user_command(0,'WorkstationHelp',function() end,{})
    assert(not guide.setup(options)); vim.api.nvim_buf_del_user_command(0,'WorkstationHelp')
    assert(guide.setup(options)); assert(#owned()==0)
  `);
});

test('malformed, invalid-schema and oversized child output stays generic and creates no buffers', opts, t => {
  for (const fake of [
    'console.log("malformed-private-fixture")',
    'console.log(JSON.stringify({schemaVersion:999,ok:true,cards:[]}))',
    'process.stdout.write("sensitive".repeat(400000));setInterval(()=>{},1000)',
    'console.log(JSON.stringify({schemaVersion:1,ok:true,cards:[],indexMarkdown:"index",documents:{"../escape":"text"}}))',
    'console.error("private stderr"); process.exitCode=2',
  ]) {
    fixture(t, `assert(guide.setup(options)); vim.cmd('WorkstationHelp'); wait(function() return #notices>0 end)
      assert(#owned()==0 and #vim.api.nvim_list_wins()==1)
      assert(not table.concat(notices):match('private') and not table.concat(notices):match('sensitive'))`, { fake });
  }
});

test('async invocation is shell-free and sanitized; cancellation kills only its owned Node child', opts, t => {
  const { home } = fixture(t, `
    assert(guide.setup(options)); vim.cmd([[WorkstationHelp --help; $(never-run)]])
    wait(function() return vim.fn.filereadable(vim.env.HOME..'/invocation.json')==1 end)
    local record=vim.json.decode(table.concat(vim.fn.readfile(vim.env.HOME..'/invocation.json'),'\\n'))
    assert(vim.deep_equal(record.args,{'--json','--','--help; $(never-run)'}))
    assert(record.stdin=='' and record.env.NODE_OPTIONS==nil and record.env.OPENAI_API_KEY==nil and record.env.PI_SESSION_ID==nil)
    assert(record.env.XDG_CONFIG_HOME==vim.env.XDG_CONFIG_HOME)
    vim.api.nvim_buf_set_lines(0,0,-1,false,{'editor stays usable'})
    vim.cmd('WorkstationHelp!')
    wait(function() return not vim.uv.kill(record.pid,0) end)
    assert(#owned()==0 and #notices==0)
  `, { fake: `import fs from 'node:fs'; let input='';process.stdin.on('data',s=>input+=s);process.stdin.on('end',()=>{
      fs.writeFileSync(process.env.HOME+'/invocation.json',JSON.stringify({pid:process.pid,args:process.argv.slice(2),env:process.env,stdin:input}));});
      setInterval(()=>{},1000);`, extraEnv: { NODE_OPTIONS: '--require /not-allowed', OPENAI_API_KEY: 'synthetic', PI_SESSION_ID: 'synthetic' } });
  const { pid } = JSON.parse(readFileSync(join(home, 'invocation.json')));
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

test('edits made during lookup survive; closing preserves a foreign buffer in the former help window', opts, t => {
  fixture(t, `
    assert(guide.setup(options)); vim.cmd('WorkstationHelp nvim.modes')
    local source=vim.api.nvim_get_current_buf()
    vim.api.nvim_buf_set_lines(source,0,-1,false,{'edited during lookup'})
    local tick=vim.api.nvim_buf_get_changedtick(source)
    wait(function() return #owned()>0 end)
    assert(vim.api.nvim_buf_get_changedtick(source)==tick)
    assert(vim.api.nvim_buf_get_lines(source,0,-1,false)[1]=='edited during lookup')
    vim.cmd('enew'); local foreign=vim.api.nvim_get_current_buf(); local window=vim.api.nvim_get_current_win()
    vim.api.nvim_buf_set_lines(foreign,0,-1,false,{'keep this too'})
    vim.cmd('WorkstationHelp!'); assert(#owned()==0)
    assert(vim.api.nvim_win_is_valid(window) and vim.api.nvim_win_get_buf(window)==foreign)
    assert(vim.api.nvim_buf_get_lines(foreign,0,-1,false)[1]=='keep this too')
  `);
});

test('a hanging lookup times out and is reaped', { ...opts, timeout: 15000 }, t => {
  fixture(t, `
    assert(guide.setup(options)); vim.cmd('WorkstationHelp')
    wait(function() return vim.fn.filereadable(vim.env.HOME..'/pid')==1 end)
    local pid=tonumber(vim.fn.readfile(vim.env.HOME..'/pid')[1])
    assert(vim.wait(11000,function() return #notices>0 end,20))
    wait(function() return not vim.uv.kill(pid,0) end); assert(#owned()==0)
  `, { fake: `import fs from 'node:fs'; fs.writeFileSync(process.env.HOME+'/pid',String(process.pid)); setInterval(()=>{},1000);` });
});

test('editor exit terminates a pending owned lookup', opts, async t => {
  const { home } = fixture(t, `
    assert(guide.setup(options)); vim.cmd('WorkstationHelp')
    wait(function() return vim.fn.filereadable(vim.env.HOME..'/pid')==1 end)
  `, { fake: `import fs from 'node:fs'; fs.writeFileSync(process.env.HOME+'/pid',String(process.pid)); setInterval(()=>{},1000);` });
  const pid = Number(readFileSync(join(home, 'pid')));
  const until = Date.now() + 2000;
  while (Date.now() < until) {
    try { process.kill(pid, 0); } catch (error) { assert.equal(error.code, 'ESRCH'); return; }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  process.kill(pid, 'SIGKILL');
  assert.fail('owned lookup survived editor exit');
});

test('source closure and focus changes discard delayed picker results without editing another buffer', opts, t => {
  fixture(t, `
    assert(guide.setup(options)); local callback,items
    vim.ui.select=function(choices,_,done) callback=done; items=choices end
    vim.cmd('WorkstationHelp'); wait(function() return callback~=nil end)
    vim.cmd('enew'); local buffer=vim.api.nvim_get_current_buf()
    callback(items[1]); assert(#owned()==0 and vim.api.nvim_get_current_buf()==buffer)
    callback=nil; vim.cmd('WorkstationHelp'); wait(function() return callback~=nil end)
    vim.cmd('vsplit'); local window=vim.api.nvim_get_current_win()
    callback(items[1]); assert(#owned()==0 and vim.api.nvim_get_current_win()==window)
  `);
});
