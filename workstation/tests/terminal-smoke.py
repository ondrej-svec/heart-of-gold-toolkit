"""Opt-in macOS PTY smoke. Real tools, disposable HOME, denied network.

Run after reviewing the installed tldr C client 1.6.1:
  uv run --no-project --no-config workstation/tests/terminal-smoke.py --tldr-c-1.6.1 /absolute/path/to/tldr
No dependencies; requires already installed Node, fzf, Glow and macOS sandbox-exec.
"""
import os, pty, select, time, tempfile, subprocess, pathlib, json, hashlib, shutil, fcntl, termios, struct, signal, argparse
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--tldr-c-1.6.1', dest='tldr', required=True, help='Absolute path to the explicitly reviewed C 1.6.1 client, not another tldr client')
args = parser.parse_args()
assert pathlib.Path(args.tldr).is_absolute(), 'tldr path must be absolute'
ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = shutil.which('node')
FZF, GLOW = shutil.which('fzf'), shutil.which('glow')
assert NODE and FZF and GLOW and pathlib.Path('/usr/bin/sandbox-exec').exists(), 'Required smoke tools are missing; nothing is installed automatically'
CLI = str(ROOT / 'bin/workstation-guide.mjs')
SANDBOX = ['/usr/bin/sandbox-exec', '-p', '(version 1)(allow default)(deny network*)']

def terminal(env, args, stages):
    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(env['HOME'])
        os.execve(SANDBOX[0], SANDBOX + [NODE, CLI] + args, env)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 36, 120, 0, 0))
    data = b''
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
                assert os.waitstatus_to_exitcode(status) == 0, status
                return
            if select.select([fd], [], [], .1)[0]:
                try:
                    chunk = os.read(fd, 65536)
                    if b'\x1b[6n' in chunk: os.write(fd, b'\x1b[1;1R')
                except OSError: pass
        raise AssertionError('terminal did not exit')
    finally:
        try: os.kill(pid, signal.SIGKILL)
        except ProcessLookupError: pass
        try: os.waitpid(pid, 0)
        except ChildProcessError: pass
        os.close(fd)

with tempfile.TemporaryDirectory(prefix='workstation-real-tools-') as home:
    bindir = pathlib.Path(home) / 'bin'; bindir.mkdir()
    for name, target in [('node', NODE), ('fzf', FZF), ('glow', GLOW), ('tldr', args.tldr)]:
        (bindir / name).symlink_to(target)
    marker = str(pathlib.Path(home) / 'injected')
    env = {'HOME': home, 'PATH': str(bindir), 'TERM':'xterm-256color', 'LANG':'en_US.UTF-8',
           'FZF_DEFAULT_OPTS': '--bind=start:execute(touch '+marker+')', 'PAGER': 'touch '+marker}
    terminal(env, ['--plain'], [('Number or task', b'return to my workspace\n'), ('# Return to a workspace', b'\n'), ('Number or task', b'q\n')])
    print('PASS numbered intention search/read/back/quit, network denied')
    terminal(env, ['--glow'], [('How do I', b'find a file'), ('find a file', b'\r'), ('Enter or q: back', b'q\n'), ('Type a task', b'\x1b')])
    terminal(env, [], [('How do I', b'get back to my session'), ('get back to my session', b'\r'), ('# Return to a workspace', b'q\n'), ('Type a task', b'\x1b')])
    assert not pathlib.Path(marker).exists()
    print('PASS real fzf + Glow selection/synonym search/read/back/Esc, hostile hooks absent, network denied')
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
