# /// script
# requires-python = ">=3.12"
# dependencies = ["pyte==0.8.2"]
# ///
"""Benign offline real-Pi PTY proof; no live profile, credentials, or model calls.

uv run scripts/pi-hog-ask-proof.py --output /tmp/hog-ask-proof
Writes terminal screen captures (text), not a simulated component rendering.
"""
import argparse
import codecs
import fcntl
import json
import os
from pathlib import Path
import pty
import select
import shutil
import signal
import struct
import tempfile
import termios
import time

import pyte

ROOT = Path(__file__).resolve().parent.parent
DOWN, UP, ENTER, ESC = "\x1b[B", "\x1b[A", "\r", "\x1b"


class Terminal:
    def __init__(self, directory, mode):
        self.directory = directory
        self.screen = pyte.Screen(80, 40)
        self.stream = pyte.Stream(self.screen)
        self.decoder = codecs.getincrementaldecoder("utf-8")("replace")
        self.raw = ""
        agent = directory / "agent"
        agent.mkdir()
        (agent / "settings.json").write_text(json.dumps({
            "packages": [{"source": str(ROOT), "extensions": []}],
            "extensions": [str(ROOT / "tests/fixtures/pi-hog-ask-proof.ts")],
            "quietStartup": True, "tuiMode": mode,
        }))
        self.pid, self.fd = pty.fork()
        if not self.pid:
            os.chdir(directory)
            env = {**os.environ, "PI_CODING_AGENT_DIR": str(agent), "PI_OFFLINE": "1", "PI_SKIP_VERSION_CHECK": "1", "TERM": "xterm-256color"}
            cli = shutil.which(os.environ.get("PI_BIN", "pi"))
            os.execve(cli, [cli, "--no-session", "--offline", "--no-context-files"], env)
        self.resize(80, 40)

    def resize(self, columns, rows):
        fcntl.ioctl(self.fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))
        self.screen.resize(lines=rows, columns=columns)
        os.kill(self.pid, signal.SIGWINCH)
        self.pump(0.2)

    def pump(self, duration=0.15):
        end = time.monotonic() + duration
        while time.monotonic() < end:
            if not select.select([self.fd], [], [], max(0, end - time.monotonic()))[0]:
                break
            try:
                data = os.read(self.fd, 65536)
            except OSError:
                break
            if not data:
                break
            text = self.decoder.decode(data)
            self.raw += text
            self.stream.feed(text)
            if "\x1b[6n" in text:
                os.write(self.fd, f"\x1b[{self.screen.cursor.y+1};{self.screen.cursor.x+1}R".encode())

    def text(self):
        return "\n".join(line.rstrip() for line in self.screen.display)

    def wait(self, text):
        end = time.monotonic() + 8
        while time.monotonic() < end:
            self.pump()
            if text in self.text():
                return
        raise AssertionError(f"Missing {text!r}\n{self.text()}")

    def keys(self, *keys):
        for key in keys:
            os.write(self.fd, key.encode())
            self.pump()

    def capture(self, output, name):
        self.pump()
        (output / f"{name}.txt").write_text(self.text() + "\n")

    def close(self):
        # Only the child we created, not any Herdr pane or existing Pi process.
        os.kill(self.pid, signal.SIGTERM)
        end = time.monotonic() + 3
        while time.monotonic() < end:
            if os.waitpid(self.pid, os.WNOHANG)[0]:
                break
            self.pump(0.05)
        else:
            os.kill(self.pid, signal.SIGKILL)
            os.waitpid(self.pid, 0)
        os.close(self.fd)


def run(output, mode):
    with tempfile.TemporaryDirectory(prefix="hog-ask-pty-") as directory:
        terminal = Terminal(Path(directory), mode)
        try:
            terminal.pump(1)
            terminal.keys("/hog-ask-proof decision", ENTER)
            terminal.wait("No option selected.")
            terminal.capture(output, f"{mode}-decision")
            terminal.keys(DOWN, DOWN, ENTER)
            terminal.wait("Write a different answer")
            terminal.keys("\x1b[200~Support + internal\x1b[201~", ENTER)
            terminal.wait("Review answer")
            terminal.capture(output, f"{mode}-custom-review")
            terminal.keys(DOWN, ENTER, "Include support in the pilot", ENTER)
            terminal.wait("Note: Include support in the pilot")
            terminal.capture(output, f"{mode}-note-review")
            terminal.keys(DOWN, DOWN, ENTER)
            terminal.wait("Outcome: answered")

            terminal.keys("/hog-ask-proof approval", ENTER)
            terminal.wait("No option selected.")
            terminal.capture(output, f"{mode}-approval")
            terminal.keys(ENTER, DOWN, ENTER, "yes, but dry run first", ENTER)
            terminal.wait("No approval granted:")
            terminal.capture(output, f"{mode}-qualified-approval")
            terminal.keys(DOWN, DOWN, ENTER)
            terminal.wait("Outcome: needs_discussion")

            terminal.resize(36, 24)
            terminal.keys("/hog-ask-proof long", ENTER)
            terminal.wait("Record a demo approval")
            terminal.capture(output, f"{mode}-narrow")
            # The fullscreen transcript owns PageUp/Down. Menu-edge arrows must
            # still reveal hidden scope and review text without selecting it.
            terminal.keys(DOWN)
            terminal.wait("Revise the scope")
            terminal.wait("END_SCOPE")
            terminal.capture(output, f"{mode}-narrow-options")
            terminal.keys(UP, UP)
            terminal.wait("Demo verification")
            assert "Revise the scope" not in terminal.text(), "Menu-edge arrows did not scroll back into the scope"
            terminal.capture(output, f"{mode}-narrow-scrolled")
            terminal.keys(ESC)
            terminal.wait("Outcome: dismissed")
            terminal.capture(output, f"{mode}-dismissed")
            assert "Extension error" not in terminal.raw
        finally:
            terminal.close()
    print(f"{mode}: decision/custom/note/qualified approval/resize/dismiss passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for mode in ["regular", "fullscreen"]:
        run(args.output, mode)
