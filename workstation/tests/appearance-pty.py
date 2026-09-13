"""Real Neovim TUI with a synthetic terminal; no global appearance changes.

uv run --offline --no-project --no-config workstation/tests/appearance-pty.py /path/to/nvim
"""
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
import errno
import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import signal
import struct
import sys
import tempfile
import termios
import time

ADAPTER = Path(__file__).resolve().parents[1] / 'integrations/nvim/workstation-appearance.lua'
NVIM = sys.argv[1]
QUERY = re.compile(rb'\x1b\]11;\?(?:\x07|\x1b\\)')

with tempfile.TemporaryDirectory(prefix='nvim-appearance-') as home:
    root = Path(home)
    state_file, control = root / 'state.json', root / 'control'
    colors = root / 'colors'
    colors.mkdir()
    (colors / 'appearance-test.lua').write_text("""
vim.g.colors_name='appearance-test'
vim.api.nvim_set_hl(0,'Normal',{fg=0x908caa,
  bg=vim.o.background=='light' and 0xfaf4ed or 0x232136})
""")
    init = root / 'init.lua'
    init.write_text(f"""
vim.opt.runtimepath:append({json.dumps(home)})
vim.opt.termguicolors=true
vim.opt.swapfile=false
vim.opt.undofile=false
vim.cmd.colorscheme('appearance-test')
vim.api.nvim_create_autocmd('VimEnter',{{once=true, callback=function()
  vim.api.nvim_buf_set_lines(0,0,-1,false,{{'Unsaved draft', 'Keep this text.'}})
  vim.api.nvim_win_set_cursor(0,{{2,3}})
  local appearance=dofile({json.dumps(str(ADAPTER))})
  local timer=vim.uv.new_timer()
  timer:start(50,50,vim.schedule_wrap(function()
    if vim.fn.filereadable({json.dumps(str(control))})==1 then
      local action=vim.fn.readfile({json.dumps(str(control))})[1]
      vim.fn.delete({json.dumps(str(control))})
      if action=='start' then assert(appearance.setup()) end
      if action=='stop' then appearance.stop() end
      if action=='quit' then timer:stop(); timer:close(); vim.cmd('qa!'); return end
    end
    local state={{bg=vim.o.background, normal=vim.api.nvim_get_hl(0,{{name='Normal'}}),
      text=vim.api.nvim_buf_get_lines(0,0,-1,false), tick=vim.api.nvim_buf_get_changedtick(0),
      modified=vim.bo.modified, undo=vim.fn.undotree(), view=vim.fn.winsaveview(),
      windows=vim.api.nvim_list_wins(), mode=vim.api.nvim_get_mode().mode}}
    vim.fn.writefile({{vim.json.encode(state)}},{json.dumps(str(state_file) + '.tmp')})
    vim.uv.fs_rename({json.dumps(str(state_file) + '.tmp')},{json.dumps(str(state_file))})
  end))
end}})
""")
    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(home)
        env = {k: home for k in ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME']}
        env.update(TERM='xterm-256color', COLORTERM='truecolor', NVIM_LOG_FILE='/dev/null')
        os.execve(NVIM, [NVIM, '--noplugin', '-u', str(init), '-i', 'NONE', '-n'], env)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 30, 100, 0, 0))
    pending = b''
    current = 'dark'
    stale = 0
    queries = 0
    reaped = False

    def pump(duration):
        global pending, stale, queries
        deadline = time.monotonic() + duration
        while time.monotonic() < deadline:
            if not select.select([fd], [], [], min(.02, max(0, deadline-time.monotonic())))[0]:
                continue
            try:
                chunk = os.read(fd, 65536)
            except OSError as exc:
                if exc.errno == errno.EIO:
                    return
                raise
            if not chunk:
                return
            pending += chunk
            while match := QUERY.search(pending):
                queries += 1
                color = 'dark' if stale else current
                stale = max(0, stale-1)
                rgb = b'2323/2121/3636' if color == 'dark' else b'fafa/f4f4/eded'
                os.write(fd, b'\x1b]11;rgb:' + rgb + b'\x07')
                pending = pending[match.end():]
            # Bound captured screen output while retaining split queries.
            pending = pending[-128:]

    def state():
        return json.loads(state_file.read_text()) if state_file.exists() else None

    def until(predicate, timeout=3):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            pump(.05)
            value = state()
            if value and predicate(value):
                return value
        raise AssertionError(f'terminal did not converge: queries={queries}, state={state()}')

    def unchanged(value, baseline):
        for key in ['text', 'tick', 'modified', 'undo', 'view', 'windows', 'mode']:
            assert value[key] == baseline[key], (key, baseline[key], value[key])

    try:
        baseline = until(lambda s: s['bg'] == 'dark' and s['normal']['bg'] == 0x232136)
        pump(.2)  # Let native startup queries finish before the negative control.
        assert baseline['modified'] and baseline['mode'] == 'n'
        current = 'light'
        pump(1.4)
        assert state()['bg'] == 'dark', 'negative control unexpectedly followed a silent change'
        unchanged(state(), baseline)
        stale = 1  # First refresh sees old palette, like a notification/palette race.
        control.write_text('start\n')
        light = until(lambda s: s['bg'] == 'light' and s['normal']['bg'] == 0xfaf4ed)
        unchanged(light, baseline)
        current = 'dark'
        dark = until(lambda s: s['bg'] == 'dark' and s['normal']['bg'] == 0x232136)
        unchanged(dark, baseline)
        control.write_text('stop\n')
        pump(.2)
        stopped_queries = queries
        current = 'light'
        pump(1.3)
        assert queries == stopped_queries and state()['bg'] == 'dark', 'stop left polling alive'
        control.write_text('start\n')
        unchanged(until(lambda s: s['bg'] == 'light'), baseline)
        control.write_text('quit\n')
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            pump(.05)
            done, status = os.waitpid(pid, os.WNOHANG)
            if done:
                reaped = True
                assert os.waitstatus_to_exitcode(status) == 0, status
                break
        assert reaped, 'owned editor did not exit'
        print('PASS: no-notification negative control, stale reply, dark/light/dark, stop/restart, source/undo/view preserved')
    finally:
        if not reaped:
            # Only this fixture's pty.fork-created process group is ours.
            try:
                os.killpg(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            os.waitpid(pid, 0)
        os.close(fd)
