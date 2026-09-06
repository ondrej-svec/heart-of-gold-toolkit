"""Opt-in macOS PTY smoke. Real tools, disposable HOME, denied network.

Run after reviewing the installed tldr C client 1.6.1:
  uv run --no-project --no-config workstation/tests/terminal-smoke.py --tldr-c-1.6.1 /absolute/path/to/tldr
No dependencies; requires already installed Node, fzf, Glow, Neovim and macOS sandbox-exec.
"""
import os, pty, select, time, tempfile, subprocess, pathlib, json, hashlib, shutil, fcntl, termios, struct, signal, argparse, re
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--tldr-c-1.6.1', dest='tldr', required=True, help='Absolute path to the explicitly reviewed C 1.6.1 client, not another tldr client')
args = parser.parse_args()
assert pathlib.Path(args.tldr).is_absolute(), 'tldr path must be absolute'
ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = shutil.which('node')
FZF, GLOW, NVIM = shutil.which('fzf'), shutil.which('glow'), shutil.which('nvim')
assert NODE and FZF and GLOW and NVIM and pathlib.Path('/usr/bin/sandbox-exec').exists(), 'Required smoke tools are missing; nothing is installed automatically'
CLI = str(ROOT / 'bin/workstation-guide.mjs')
SANDBOX = ['/usr/bin/sandbox-exec', '-p', '(version 1)(allow default)(deny network*)']

def terminal(env, args, stages, launcher=None):
    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(env['HOME'])
        os.execve(SANDBOX[0], SANDBOX + (launcher or [NODE, CLI]) + args, env)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 36, 120, 0, 0))
    data = b''
    transcript = bytearray()
    reaped = False
    try:
        for needle, response in stages:
            deadline = time.monotonic() + 6
            while needle.encode() not in data:
                if time.monotonic() > deadline:
                    raise AssertionError('terminal stage not reached: ' + needle + '\n' + repr(data[-1500:]))
                if select.select([fd], [], [], .1)[0]:
                    chunk = os.read(fd, 65536)
                    if not chunk: raise AssertionError('terminal closed before stage: ' + needle + '\n' + repr(data[-2000:]))
                    data += chunk
                    transcript.extend(chunk)
                    if b'\x1b[6n' in chunk: os.write(fd, b'\x1b[1;1R')
            time.sleep(.2)
            if response: os.write(fd, response)
            data = b''
        until = time.monotonic() + 5
        while time.monotonic() < until:
            done, status = os.waitpid(pid, os.WNOHANG)
            if done:
                reaped = True
                assert os.waitstatus_to_exitcode(status) == 0, status
                return bytes(transcript)
            if select.select([fd], [], [], .1)[0]:
                try:
                    chunk = os.read(fd, 65536)
                    transcript.extend(chunk)
                    if b'\x1b[6n' in chunk: os.write(fd, b'\x1b[1;1R')
                except OSError: pass
        raise AssertionError('terminal did not exit')
    finally:
        if not reaped:
            done, _ = os.waitpid(pid, os.WNOHANG)
            reaped = bool(done)
        if not reaped:
            # pty.fork owns a new session/process group. Allow the CLI to reap
            # its editor and remove private files before escalating a failed test.
            try: os.killpg(pid, signal.SIGTERM)
            except ProcessLookupError: pass
            deadline = time.monotonic() + 2
            while time.monotonic() < deadline:
                done, _ = os.waitpid(pid, os.WNOHANG)
                if done:
                    reaped = True
                    break
                time.sleep(.05)
            if not reaped:
                try: os.killpg(pid, signal.SIGKILL)
                except ProcessLookupError: pass
                os.waitpid(pid, 0)
        os.close(fd)

def assert_terminal_palette(output, allow_nvim_probe=False):
    if allow_nvim_probe:
        # Neovim's startup DECRQSS capability probe draws no text. Permit only
        # this exact set-color/query pair, never arbitrary RGB rendering.
        output = output.replace(b'\x1b[48;2;1;2;3m\x1bP$qm\x1b\\', b'')
    sgr = re.findall(rb'\x1b\[([0-9;:]*)m', output)
    assert sgr, 'expected actual rendered terminal colors'
    for params in sgr:
        parts = params.replace(b':', b';').split(b';')
        for index, part in enumerate(parts):
            if part in (b'38', b'48', b'58') and index + 1 < len(parts):
                assert parts[index + 1] != b'2', 'unexpected fixed RGB output: ' + repr(params)
                if parts[index + 1] == b'5':
                    assert int(parts[index + 2]) < 16, 'color escaped terminal palette: ' + repr(params)

# Positive controls: the palette assertion must reject actual RGB and extended colors.
for forbidden in [b'\x1b[38;2;1;2;3mtext', b'\x1b[48;5;42mtext']:
    try: assert_terminal_palette(forbidden, allow_nvim_probe=True)
    except AssertionError: pass
    else: raise AssertionError('palette check accepted forbidden rendering')

with tempfile.TemporaryDirectory(prefix='workstation-real-tools-') as home:
    bindir = pathlib.Path(home) / 'bin'; bindir.mkdir()
    for name, target in [('node', NODE), ('fzf', FZF), ('glow', GLOW), ('nvim', NVIM), ('tldr', args.tldr)]:
        (bindir / name).symlink_to(target)
    marker = str(pathlib.Path(home) / 'injected')
    env = {'HOME': home, 'PATH': str(bindir), 'TERM':'xterm-256color', 'LANG':'en_US.UTF-8',
           'FZF_DEFAULT_OPTS': '--bind=start:execute(touch '+marker+')', 'PAGER': 'touch '+marker}
    terminal(env, ['--plain'], [('Number or task', b'return to my workspace\n'), ('# Return to a workspace', b'\n'), ('Number or task', b'q\n')])
    terminal(env, ['--plain'], [('Number or task', b'6\n'), ('# Split terminal panes', b'\n'), ('Number or task', b'q\n')])
    print('PASS numbered intention search and expanded tmux card/read/back/quit, network denied')
    colored = terminal(env, ['list'], [('nvim.quick-reference', b'')])
    assert b'\x1b[35m' in colored and b'\x1b[90m' in colored
    assert_terminal_palette(colored)
    for overrides, flags in [({}, ['list', '--plain']), ({'NO_COLOR': '1'}, ['list']), ({'TERM': 'dumb'}, ['list']), ({}, ['list', '--json'])]:
        plain = terminal({**env, **overrides}, flags, [('nvim.quick-reference', b'')])
        assert b'\x1b[' not in plain, 'plain/JSON output gained ANSI escapes'
    for overrides in [{'NO_COLOR': '1'}, {'TERM': 'dumb'}]:
        plain = terminal({**env, **overrides}, ['show', 'nvim.modes', '--glow'], [('Read another card:', b'')])
        assert b'\x1b[' not in plain, 'color opt-out launched a colored presentation'
    # Wait for fzf's own ready header, not the earlier Node root heading.
    colored = terminal(env, ['--glow'], [('Type a task', b'find a file'), ('find a file', b'\r'), ('Enter or q: back', b'q\n'), ('Type a task', b'\x1b')])
    assert_terminal_palette(colored)
    fenced = terminal(env, ['show', 'shell.build-command', '--glow'], [('Read another card:', b'')])
    assert_terminal_palette(fenced)  # Includes actual Chroma-highlighted shell code.
    terminal(env, [], [('Type a task', b'get back to my session'), ('get back to my session', b'\r'), ('Read-only guide copy', b':q\r'), ('Type a task', b'\x1b')])
    terminal(env, [], [('Type a task', b'find a file'), ('find a file', b'\r'), ('Read-only guide copy', b'/shell.history.md\r'), ('/shell.history.md', b'gf'), ('Recall a command', b'\x0f'), ('find-file.md', b':q\r'), ('Type a task', b'\x1b')])
    colored = terminal(env, ['show', 'nvim.modes'], [('Read-only guide copy', b':q\r')])
    assert_terminal_palette(colored, allow_nvim_probe=True)
    print('PASS adaptive ANSI colors in root/fzf/Glow/reader; plain/NO_COLOR/dumb/JSON uncolored')
    bun = shutil.which('bun')
    if bun:
        terminal(env, ['show', 'nvim.modes'], [('Read-only guide copy', b':q\r')], launcher=[bun, '--no-env-file', str(ROOT.parent / 'src/index.ts'), 'workstation'])
    editor_init = pathlib.Path(home) / 'editor-help.lua'
    editor_init.write_text('local guide=dofile(' + json.dumps(str(ROOT / 'integrations/nvim/workstation-help.lua')) + ')\n'
        + 'assert(guide.setup({node=' + json.dumps(NODE) + ',entry=' + json.dumps(CLI) + '}))\n'
        + 'vim.api.nvim_buf_set_name(0,"synthetic-source.txt")\n'
        + 'vim.api.nvim_buf_set_lines(0,0,-1,false,{"source-fixture unchanged"})\n'
        + 'vim.o.laststatus=2; vim.o.statusline="%t"\n')
    terminal(env, ['-u', 'NONE', '-i', 'NONE', '-n', '--noplugin', '-c', 'luafile ' + str(editor_init)],
        [('source-fixture', b':WorkstationHelp\r'), ('Type number and <Enter>', b'1\r'),
         ('shell.build-command.md', b':q\r'), ('synthetic-source.txt', b':lua assert(vim.api.nvim_buf_get_lines(0,0,-1,false)[1]=="source-fixture unchanged"); vim.cmd("qall!")\r')],
        launcher=[NVIM])
    print('PASS real in-editor native chooser/read-only split/:q/source preservation; network denied')
    # Without the editor, TTY reading still falls back. --plain and --glow above
    # are tested while Neovim is present, so neither may accidentally launch it.
    (bindir / 'nvim').unlink()
    terminal(env, [], [('Type a task', b'find a file'), ('find a file', b'\r'), ('Enter or q: back', b'q\n'), ('Type a task', b'\x1b')])
    assert not pathlib.Path(marker).exists()
    print('PASS real fzf/Neovim search/gf/Ctrl-O/:q/return, host handoff, missing-editor/plain/Glow fallbacks; network denied')
    binary = pathlib.Path(args.tldr).resolve()
    profile = pathlib.Path(home) / 'profile.json'
    profile.write_text(json.dumps({'schemaVersion':1,'tldr':{'client':'tldr-c-1.6.1','sha256':hashlib.sha256(binary.read_bytes()).hexdigest()}}))
    def cmd():
        return subprocess.run(SANDBOX + [NODE, CLI, '--profile',str(profile),'cmd','fzf'],env=env,cwd=home,capture_output=True,text=True,timeout=5)
    empty = cmd()
    assert empty.returncode != 0 and 'Cached command examples unavailable' in empty.stderr, (empty.returncode, empty.stdout, empty.stderr)
    cache = pathlib.Path(home) / '.tldrc' / 'tldr' / 'pages' / 'common'
    cache.mkdir(parents=True, exist_ok=True)
    page = cache / 'fzf.md'; page.write_text('# fzf\n\n> Synthetic offline page.\n\n- Print a synthetic example:\n\n`printf hello`\n')
    stamp = pathlib.Path(home) / '.tldrc' / 'date'; stamp.write_text('1')
    before = {str(p.relative_to(home)):(p.read_bytes(),p.stat().st_mtime_ns) for p in pathlib.Path(home).rglob('*') if p.is_file() and not p.is_symlink()}
    stale = cmd()
    assert stale.returncode == 0 and 'Synthetic offline page' in stale.stdout, (stale.returncode,stale.stdout,stale.stderr)
    after = {str(p.relative_to(home)):(p.read_bytes(),p.stat().st_mtime_ns) for p in pathlib.Path(home).rglob('*') if p.is_file() and not p.is_symlink()}
    assert before == after, 'cache changed during cache-only lookup'
    print('PASS actual tldr C 1.6.1: empty cache fails, stale synthetic cache renders unchanged, network denied')
