"""Opt-in macOS PTY smoke. Real tools, disposable HOME, denied network.

Run after reviewing the installed tldr C client 1.6.1:
  uv run --no-project --no-config workstation/tests/terminal-smoke.py --tldr-c-1.6.1 /absolute/path/to/tldr
No dependencies; requires already installed Node, fzf, Glow, Neovim and macOS sandbox-exec.
"""
import os, pty, select, time, tempfile, subprocess, pathlib, json, hashlib, shutil, fcntl, termios, struct, signal, argparse
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
    reaped = False
    try:
        for needle, response in stages:
            deadline = time.monotonic() + 6
            while needle.encode() not in data:
                if time.monotonic() > deadline:
                    raise AssertionError('terminal stage not reached: ' + needle + '\n' + repr(data[-1500:]))
                if select.select([fd], [], [], .1)[0]:
                    chunk = os.read(fd, 65536)
                    if not chunk: raise AssertionError('terminal closed early')
                    data += chunk
                    if b'\x1b[6n' in chunk: os.write(fd, b'\x1b[1;1R')
            time.sleep(.2)
            os.write(fd, response)
            data = b''
        until = time.monotonic() + 5
        while time.monotonic() < until:
            done, status = os.waitpid(pid, os.WNOHANG)
            if done:
                reaped = True
                assert os.waitstatus_to_exitcode(status) == 0, status
                return
            if select.select([fd], [], [], .1)[0]:
                try:
                    chunk = os.read(fd, 65536)
                    if b'\x1b[6n' in chunk: os.write(fd, b'\x1b[1;1R')
                except OSError: pass
        raise AssertionError('terminal did not exit')
    finally:
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

with tempfile.TemporaryDirectory(prefix='workstation-real-tools-') as home:
    bindir = pathlib.Path(home) / 'bin'; bindir.mkdir()
    for name, target in [('node', NODE), ('fzf', FZF), ('glow', GLOW), ('nvim', NVIM), ('tldr', args.tldr)]:
        (bindir / name).symlink_to(target)
    marker = str(pathlib.Path(home) / 'injected')
    env = {'HOME': home, 'PATH': str(bindir), 'TERM':'xterm-256color', 'LANG':'en_US.UTF-8',
           'FZF_DEFAULT_OPTS': '--bind=start:execute(touch '+marker+')', 'PAGER': 'touch '+marker}
    terminal(env, ['--plain'], [('Number or task', b'return to my workspace\n'), ('# Return to a workspace', b'\n'), ('Number or task', b'q\n')])
    print('PASS numbered intention search/read/back/quit, network denied')
    terminal(env, ['--glow'], [('How do I', b'find a file'), ('find a file', b'\r'), ('Enter or q: back', b'q\n'), ('Type a task', b'\x1b')])
    terminal(env, [], [('How do I', b'get back to my session'), ('get back to my session', b'\r'), ('Read-only guide copy', b':q\r'), ('Type a task', b'\x1b')])
    terminal(env, [], [('How do I', b'find a file'), ('find a file', b'\r'), ('Read-only guide copy', b'/shell.history.md\r'), ('/shell.history.md', b'gf'), ('Recall a command', b'\x0f'), ('find-file.md', b':q\r'), ('Type a task', b'\x1b')])
    terminal(env, ['show', 'nvim.modes'], [('Read-only guide copy', b':q\r')])
    bun = shutil.which('bun')
    if bun:
        terminal(env, ['show', 'nvim.modes'], [('Read-only guide copy', b':q\r')], launcher=[bun, '--no-env-file', str(ROOT.parent / 'src/index.ts'), 'workstation'])
    # Without the editor, TTY reading still falls back. --plain and --glow above
    # are tested while Neovim is present, so neither may accidentally launch it.
    (bindir / 'nvim').unlink()
    terminal(env, [], [('How do I', b'find a file'), ('find a file', b'\r'), ('Enter or q: back', b'q\n'), ('Type a task', b'\x1b')])
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
