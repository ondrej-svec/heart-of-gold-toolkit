import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executable } from '../src/process.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ADAPTER = join(ROOT, 'integrations/nvim/workstation-appearance.lua');
const NVIM = executable('nvim');
const UV = executable('uv');
function fixture(t, source) {
  const home = mkdtempSync(join(tmpdir(), 'appearance '));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const script = join(home, 'test.lua');
  writeFileSync(script, `local ok,err=xpcall(function()
    local path=${JSON.stringify(ADAPTER)}
    ${source}
  end, debug.traceback)
  if ok then vim.cmd('qa!') else io.stderr:write(err..'\\n'); vim.cmd('cquit 1') end`);
  const result = spawnSync(NVIM, ['--headless', '--noplugin', '-u', 'NONE', '-i', 'NONE', '-n', '-l', script], {
    cwd: home, env: { HOME: home, XDG_CONFIG_HOME: home, NVIM_LOG_FILE: '/dev/null', TERM: 'xterm-256color' },
    encoding: 'utf8', timeout: 5000,
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(result.stdout, '', 'raw terminal output escaped into a pipe');
}

test('appearance helper is opt-in and never writes into headless, GUI or RPC stdout', { skip: !NVIM }, t => {
  fixture(t, `
    local bg=vim.o.background
    local new_timer=vim.uv.new_timer
    vim.uv.new_timer=function() error('must not create a timer') end
    local appearance=dofile(path)
    assert(not appearance.setup())
    vim.api.nvim_list_uis=function() return {{chan=1, stdout_tty=true}} end
    assert(not appearance.setup(), 'a UI flag alone cannot make stdout safe')
    vim.uv.guess_handle=function() return 'tty' end
    vim.api.nvim_list_uis=function() return {{chan=2, stdout_tty=true}} end
    assert(not appearance.setup(), 'external UI is not the native TUI')
    appearance.stop(); appearance.stop()
    assert(vim.o.background==bg)
    assert(#vim.api.nvim_get_autocmds({event='FocusGained'})==0)
    vim.uv.new_timer=new_timer
  `);
});

test('appearance polling is singleton, cancellable, suspension-safe and only queries colours', { skip: !NVIM }, t => {
  fixture(t, `
    local writes, flushes, timers, queued = {}, 0, {}, {}
    local stdout=io.stdout
    io.stdout={write=function(_,s) table.insert(writes,s); return true end,
      flush=function() flushes=flushes+1; return true end}
    vim.uv.guess_handle=function() return 'tty' end
    vim.api.nvim_list_uis=function() return {{chan=1, stdout_tty=true}} end
    vim.schedule_wrap=function(fn) return function() table.insert(queued,fn) end end
    vim.uv.new_timer=function()
      local t={}
      function t:start(delay,interval,fn) assert(delay==1000 and interval==1000); self.fire=fn end
      function t:stop() self.stopped=true end
      function t:close() self.closed=true end
      table.insert(timers,t); return t
    end
    vim.api.nvim_buf_set_lines(0,0,-1,false,{'unsaved words'})
    local function state() return {tick=vim.api.nvim_buf_get_changedtick(0), modified=vim.bo.modified,
      text=vim.api.nvim_buf_get_lines(0,0,-1,false), undo=vim.fn.undotree(), view=vim.fn.winsaveview(),
      maps=vim.api.nvim_get_keymap('n'), bg=vim.o.background} end
    local before=state()
    local a=dofile(path); assert(#timers==0 and #writes==0)
    assert(a.setup()); assert(#timers==1 and #writes==1)
    timers[1].fire(); assert(#writes==1); table.remove(queued,1)(); assert(#writes==2)
    vim.api.nvim_exec_autocmds('VimSuspend',{}); timers[1].fire(); table.remove(queued,1)()
    assert(#writes==2)
    vim.api.nvim_exec_autocmds('VimResume',{}); assert(#writes==3)
    vim.api.nvim_exec_autocmds('FocusGained',{}); assert(#writes==4)
    timers[1].fire(); assert(a.setup()); assert(timers[1].stopped and timers[1].closed)
    table.remove(queued,1)(); assert(#writes==5, 'queued stale callback wrote after replacement')
    local b=dofile(path); assert(timers[2].closed); assert(b.setup())
    assert(#vim.api.nvim_get_autocmds({group='WorkstationTerminalAppearance'})==4)
    timers[3].fire(); b.stop(); table.remove(queued,1)(); assert(#writes==6)
    b.stop(); assert(timers[3].closed)
    assert(b.setup()); vim.api.nvim_exec_autocmds('VimLeavePre',{}); assert(timers[4].closed)
    assert(vim.deep_equal(before,state()), 'query helper changed editor state')
    assert(flushes==#writes)
    for _,s in ipairs(writes) do assert(s=='\\027]11;?\\007', vim.inspect(s)) end
    -- A closed/failing output stream stops rather than repeatedly raising errors.
    io.stdout.write=function() return nil,'closed' end
    assert(not b.setup()); assert(timers[5].closed)
    io.stdout=stdout
  `);
});

test('real TUI follows late terminal background changes without theme notifications', {
  skip: !NVIM || !UV || process.platform === 'win32', timeout: 25000,
}, () => {
  const result = spawnSync(UV, ['run', '--offline', '--no-project', '--no-config',
    join(ROOT, 'tests/appearance-pty.py'), NVIM], { encoding: 'utf8', timeout: 22000 });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /PASS/);
});
