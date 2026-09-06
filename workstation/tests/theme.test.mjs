import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { colorEnabled, colorText, FZF_COLORS, READER_THEME, GLOW_STYLE } from '../src/theme.mjs';
import { executable } from '../src/process.mjs';

test('color opt-out and semantic terminal styles do not require a theme file or appearance command', () => {
  assert.equal(colorEnabled({ TERM: 'xterm-256color' }, true), true);
  for (const [env, tty, plain] of [[{}, false], [{ NO_COLOR: '1' }, true], [{ TERM: 'dumb' }, true], [{}, true, true]]) {
    assert.equal(colorEnabled(env, tty, plain), false);
  }
  const text = 'HEART OF GOLD — Your workstation\nTerminal & tmux workspaces\n  6. Split terminal panes  (tmux.panes)\n# Title\nUse `:q` to return.';
  const colored = colorText(text, ['Terminal & tmux workspaces']);
  assert.match(colored, /\x1b\[1;35m/);
  assert.match(colored, /\x1b\[34m/);
  assert.match(colored, /\x1b\[90m/);
  assert.equal(colored.replace(/\x1b\[[0-9;]*m/g, ''), text);
  assert.doesNotMatch(colored, /\x1b\[[^m]*(?:38;|48;)/);
  assert.match(FZF_COLORS, /^--color=fg:-1,bg:-1,/);
  assert.doesNotMatch(FZF_COLORS, /#|execute|reload|preview|\$|`/);
  assert.equal(GLOW_STYLE.heading.color, '5');
  assert.equal(GLOW_STYLE.link.color, '4');
  assert.equal(GLOW_STYLE.document.color, '7');
  assert.match(READER_THEME, /notermguicolors/);
  assert.doesNotMatch(READER_THEME, /#[a-fA-F0-9]{6}|source |runtime |dofile|system\(/);
});

const nvim = executable('nvim');
test('real isolated reader highlights use terminal slots in dark and light modes, not fixed RGB', { skip: !nvim }, t => {
  const home = mkdtempSync(join(tmpdir(), 'guide palette '));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, 'config'));
  for (const background of ['dark', 'light']) {
    const lua = `local ok,err=pcall(function()
      assert(not vim.o.termguicolors)
      local n=vim.api.nvim_get_hl(0,{name='Normal',link=false})
      local h=vim.api.nvim_get_hl(0,{name='markdownH1',link=false})
      local c=vim.api.nvim_get_hl(0,{name='markdownCode',link=false})
      assert(n.ctermfg==7 and n.bg==nil)
      assert(h.ctermfg==5 and c.ctermfg==4)
      assert(vim.api.nvim_get_hl(0,{name='StatusLine',link=false}).ctermbg==0)
      assert(vim.api.nvim_get_hl(0,{name='Search',link=false}).ctermbg==3)
      vim.o.background=vim.o.background=='light' and 'dark' or 'light'
      assert(vim.api.nvim_get_hl(0,{name='markdownH1',link=false}).ctermfg==5)
      assert(vim.api.nvim_get_hl(0,{name='StatusLine',link=false}).ctermbg==0)
    end); if ok then vim.cmd('qa!') else print(err); vim.cmd('cquit 1') end`;
    const result = spawnSync(nvim, ['-u', 'NONE', '-i', 'NONE', '-n', '--noplugin', '--headless',
      '--cmd', `set background=${background}`, '--cmd', 'syntax enable', '--cmd', READER_THEME, '-c', `lua ${lua}`],
    { env: { HOME: home, XDG_CONFIG_HOME: join(home, 'config'), NVIM_LOG_FILE: '/dev/null', TERM: 'xterm-256color' },
      cwd: home, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
  }
});
