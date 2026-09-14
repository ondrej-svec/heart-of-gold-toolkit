# /// script
# requires-python = ">=3.12"
# dependencies = ["pyte==0.8.2"]
# ///
"""Offline, real-Pi PTY proof for the native hog_ask UI.

uv run scripts/pi-hog-ask-proof.py --output /tmp/hog-ask-native-proof

This starts only temporary offline Pi processes and records real terminal cells,
not a synthetic rendering.  ``verification.json`` is intentionally bounded and
records failures rather than concealing them.
"""
import argparse
import codecs
import fcntl
import html
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
KITTY_ENTER_PRESS = "\x1b[13;1u"
KITTY_ENTER_REPEAT = "\x1b[13;1:2u"
KITTY_ENTER_RELEASE = "\x1b[13;1:3u"


class Terminal:
    def __init__(self, directory: Path, mode: str, result_file: Path, modern: bool, keybindings=None, theme="dark", extra_extensions=()):
        self.directory, self.mode, self.modern, self.theme = directory, mode, modern, theme
        self.result_file = result_file
        self.screen = pyte.Screen(80, 40)
        self.stream = pyte.Stream(self.screen)
        self.decoder = codecs.getincrementaldecoder("utf-8")("replace")
        self.raw = ""
        self.kitty_replies = 0
        self.query_tail = ""
        agent = directory / "agent"
        agent.mkdir()
        (agent / "settings.json").write_text(json.dumps({
            "packages": [{"source": str(ROOT), "extensions": []}],
            "extensions": [str(ROOT / "tests/fixtures/pi-hog-ask-proof.ts"), *map(str, extra_extensions)],
            "quietStartup": True, "tuiMode": mode, "theme": theme,
        }))
        if keybindings: (agent / "keybindings.json").write_text(json.dumps(keybindings))
        self.pid, self.fd = pty.fork()
        if not self.pid:
            os.chdir(directory)
            env = {**os.environ, "PI_CODING_AGENT_DIR": str(agent), "PI_OFFLINE": "1",
                   "PI_SKIP_VERSION_CHECK": "1", "TERM": "xterm-kitty" if modern else "xterm-256color",
                   "HOG_ASK_PROOF_OUTPUT": str(result_file)}
            cli = shutil.which(os.environ.get("PI_BIN", "pi"))
            os.execve(cli, [cli, "--no-session", "--offline", "--no-context-files"], env)
        self.resize(80, 40)

    def write(self, data: str):
        os.write(self.fd, data.encode())

    def resize(self, columns: int, rows: int):
        fcntl.ioctl(self.fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))
        self.screen.resize(lines=rows, columns=columns)
        os.kill(self.pid, signal.SIGWINCH)
        self.pump(.25)

    def _respond(self, text: str):
        # Pi asks for a Kitty keyboard capability report.  Flag 7 includes event
        # type reporting, allowing real press/repeat/release proof packets.
        combined = self.query_tail + text
        self.query_tail = next((prefix for prefix in ["\x1b[?", "\x1b[", "\x1b"] if combined.endswith(prefix)), "")
        if self.modern and "\x1b[?u" in combined:
            self.write("\x1b[?7u")
            self.kitty_replies += 1
        if "\x1b[6n" in text:
            self.write(f"\x1b[{self.screen.cursor.y + 1};{self.screen.cursor.x + 1}R")

    def pump(self, duration=.15):
        end = time.monotonic() + duration
        while time.monotonic() < end:
            ready, _, _ = select.select([self.fd], [], [], max(0, end - time.monotonic()))
            if not ready:
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
            self._respond(text)

    def text(self):
        return "\n".join(line.rstrip() for line in self.screen.display)

    def wait(self, needle: str, seconds=8):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            self.pump()
            if needle in self.text():
                return
        raise AssertionError(f"missing {needle!r}\n{self.text()}")

    def wait_ready(self):
        end = time.monotonic() + 15
        while time.monotonic() < end:
            self.pump(.15)
            if "\x1b[?2004h" in self.raw and "0.0%/0" in self.text():
                return
        raise AssertionError("Pi did not enter raw input mode and render its initial editor")

    def reveal_custom(self):
        for _ in range(8):
            if "Your answer" in self.text():
                x, y = self.find("Your answer")
                # The caption alone can be the viewport's last body row. Do not
                # mistake the fixed separator below it for editable padding.
                if y < self.screen.lines and self.screen.display[y].lstrip().startswith("›"):
                    return x, y
            x, y = self.find("esc cancel")
            self.keys(f"\x1b[<65;{x};{y}M")
        raise AssertionError("custom editor content did not become visible after scrolling")

    def keys(self, *keys):
        for key in keys:
            self.write(key)
            self.pump(.2 if key == ESC else .08)

    def result_count(self):
        if not self.result_file.exists():
            return 0
        return len([line for line in self.result_file.read_text().splitlines() if line.strip()])

    def await_result(self, before: int, seconds=8):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            self.pump()
            lines = self.result_file.read_text().splitlines() if self.result_file.exists() else []
            if len(lines) > before:
                return json.loads(lines[-1])
        raise AssertionError("no fresh HOG_ASK_PROOF_OUTPUT result")

    def open_demo(self, kind: str):
        # Frame the command paste and wait for it to render before its separate
        # activation. Under CPU load, unframed text+CR can coalesce into a paste.
        command = f"/hog-ask-proof {kind}"
        self.keys(f"\x1b[200~{command}\x1b[201~")
        self.wait(command)
        self.keys(ENTER)
        # Wait for the focused first choice, not a title or final custom row:
        # long scope hides the header, and a narrow decision can scroll its last row.
        self.wait("> 1. Internal only" if kind == "decision" else "1. Approve as written")

    def find(self, needle: str):
        for y, line in reversed(list(enumerate(self.screen.display))):
            x = line.find(needle)
            if x >= 0:
                return x + 1, y + 1
        raise AssertionError(f"could not derive screen coordinate for {needle!r}\n{self.text()}")

    def sgr_click(self, x: int, y: int, *, drag=False):
        # Actual SGR mouse bytes.  The screen coordinates are derived from Pi's
        # current render, not guessed component-local coordinates.
        self.write(f"\x1b[<0;{x};{y}M")
        if drag:
            self.write(f"\x1b[<32;{x + 1};{y}M")
            self.write(f"\x1b[<0;{x + 1};{y}m")
        else:
            self.write(f"\x1b[<0;{x};{y}m")
        self.pump(.25)

    def capture(self, output: Path, name: str):
        self.pump(.12)
        (output / f"{name}.txt").write_text(self.text() + "\n")
        # Native cell capture: pyte attributes from actual PTY escape sequences.
        rows = []
        default_fg, default_bg = ("#222222", "#ffffff") if self.theme == "light" else ("#dddddd", "#111111")
        def color(value, default):
            if value == "default": return default
            if len(value) == 6 and all(c in "0123456789abcdefABCDEF" for c in value): return "#" + value
            return {"brown": "#aa5500", "brightblack": "#555555", "brightwhite": "#ffffff"}.get(value, value)
        for y in range(self.screen.lines):
            cells = []
            for x in range(self.screen.columns):
                char = self.screen.buffer[y][x]
                fg, bg = color(char.fg, default_fg), color(char.bg, default_bg)
                if char.reverse: fg, bg = bg, fg
                style = f"color:{fg};background:{bg}"
                if char.bold: style += ";font-weight:bold"
                if char.italics: style += ";font-style:italic"
                cells.append(f'<span style="{html.escape(style)}">{html.escape(char.data)}</span>')
            rows.append("".join(cells))
        (output / f"{name}.html").write_text(f"<!doctype html><meta charset=utf-8><style>body{{background:{default_bg};color:{default_fg}}}pre{{font:14px/1.4 monospace}}span{{display:inline-block;height:1.4em;vertical-align:top}}</style><pre>" + "\n".join(rows) + "</pre>")

    def close(self):
        try:
            os.kill(self.pid, signal.SIGTERM)
            end = time.monotonic() + 3
            while time.monotonic() < end:
                if os.waitpid(self.pid, os.WNOHANG)[0]: break
                self.pump(.05)
            else:
                os.kill(self.pid, signal.SIGKILL); os.waitpid(self.pid, 0)
        finally:
            os.close(self.fd)


def proof_case(report, name, terminal, output, body):
    try:
        body()
        terminal.capture(output, name)
        report.append({"case": name, "status": "passed"})
    except Exception as error:
        terminal.capture(output, name + "-FAILED")
        report.append({"case": name, "status": "failed", "error": str(error)[:1200]})
        # Stop this profile rather than guessing its modal state. Sending Esc
        # after an already-completed result opens Pi's session tree and poisons
        # subsequent scenarios. The profile's finally owns process cleanup.
        raise


def run_profile(output: Path, mode: str, modern: bool, report):
    with tempfile.TemporaryDirectory(prefix="hog-ask-pty-") as tmp:
        result_file = Path(tmp) / "outcomes.jsonl"
        t = Terminal(Path(tmp), mode, result_file, modern, theme="light" if mode == "regular" and modern else "dark")
        try:
            t.wait_ready()
            profile = f"{mode}-{'modern' if modern else 'legacy'}"
            if modern: assert t.kitty_replies > 0, "Pi did not negotiate the emulated Kitty transport"

            def preset():
                before = t.result_count(); t.open_demo("decision")
                t.capture(output, profile + "-decision-entry")
                t.keys(ENTER)  # Exactly one action, no review or compensating keys.
                result = t.await_result(before)
                assert result["answer"]["optionId"] == "internal" and result["status"] == "answered", result
            proof_case(report, profile + "-one-enter-preset", t, output, preset)

            def decision():
                before = t.result_count(); t.open_demo("decision")
                t.keys(DOWN, DOWN, "\x1b[200~Support + internal 🦊\x1b[201~")
                t.capture(output, profile + "-decision-custom")
                t.keys("\t"); t.wait("Note for: Support + internal 🦊")
                t.keys("Include support")
                t.capture(output, profile + "-decision-note")
                assert t.result_count() == before
                t.keys(ENTER)
                result = t.await_result(before)
                assert result["status"] == "answered", result
                assert result["answer"]["text"] == "Support + internal 🦊" and result["answer"]["note"] == "Include support", result
            proof_case(report, profile + "-decision-custom-notes", t, output, decision)

            def retained_note():
                before = t.result_count(); t.open_demo("decision")
                t.keys("\t", "Support first", ESC, DOWN)
                t.wait("Note draft · ready · for: Public")
                t.capture(output, profile + "-retained-note-before-send")
                assert t.result_count() == before
                t.keys(ENTER)
                result = t.await_result(before)
                assert result["answer"]["optionId"] == "public" and result["answer"]["note"] == "Support first", result
            proof_case(report, profile + "-note-back-and-one-enter-changed-answer", t, output, retained_note)

            def feedback():
                before = t.result_count(); t.open_demo("approval")
                t.capture(output, profile + "-approval-entry")
                t.keys(KITTY_ENTER_REPEAT); t.wait("1. Approve as written")
                t.keys(DOWN, ENTER, "Dry run first", "\x1b[13;5u"); t.wait("send feedback")
                # Ctrl+Enter only reviews. Releasing Ctrl first means the key-up
                # reports ordinary Enter; it still releases the opening key.
                # Release arms, repeat does not submit, then fresh Enter sends.
                t.keys(KITTY_ENTER_RELEASE, KITTY_ENTER_REPEAT); assert t.result_count() == before
                t.capture(output, profile + "-feedback-review")
                t.keys(KITTY_ENTER_PRESS)
                result = t.await_result(before)
                assert result["status"] == "needs_discussion" and not result["approved"], result
                assert result["answer"]["text"] == "Dry run first", result
            if modern:
                proof_case(report, profile + "-approval-feedback-release-repeat", t, output, feedback)

            def bare_approval():
                before = t.result_count(); t.open_demo("approval")
                t.keys(KITTY_ENTER_PRESS); t.wait("send approval")
                t.keys(KITTY_ENTER_RELEASE, KITTY_ENTER_REPEAT); assert t.result_count() == before
                t.capture(output, profile + "-approval-review")
                t.keys(KITTY_ENTER_PRESS)
                result = t.await_result(before)
                assert result["status"] == "answered" and result["approved"], result
                assert result["question"]["scope"]["revision"] == "demo-r1", result
            if modern:
                proof_case(report, profile + "-bare-approval-fresh-press", t, output, bare_approval)

            def legacy_raw_cr_closed():
                before = t.result_count(); t.open_demo("approval")
                # Raw CR has no observed release/fresh-press provenance.
                t.keys(ENTER, ENTER, ENTER); t.wait("send approval")
                assert t.result_count() == before, "legacy raw CR unexpectedly submitted approval"
                t.keys(ESC); t.pump(.3); t.keys(ESC); t.pump(.3)
                assert t.await_result(before)["status"] == "dismissed"
            if not modern:
                proof_case(report, profile + "-raw-cr-approval-fails-closed", t, output, legacy_raw_cr_closed)

                def legacy_tab_enter():
                    before = t.result_count(); t.open_demo("approval")
                    t.keys(ENTER); t.wait("tab then enter send approval")
                    t.capture(output, profile + "-approval-before-tab")
                    t.keys("\t"); t.wait("enter send approval")
                    if mode == "fullscreen":
                        t.keys("\x1b[O\x1b[I" + ENTER)
                        assert t.result_count() == before, "refocus retained legacy arming"
                        t.keys("\t")
                    t.capture(output, profile + "-approval-after-tab")
                    t.keys(ENTER)
                    assert t.await_result(before)["approved"]
                proof_case(report, profile + "-approved-tab-enter-fallback", t, output, legacy_tab_enter)

            def pause_and_escape():
                before = t.result_count(); t.open_demo("approval")
                t.keys(DOWN, DOWN, KITTY_ENTER_PRESS); t.wait("send pause")
                t.keys(KITTY_ENTER_RELEASE, KITTY_ENTER_PRESS)
                result = t.await_result(before); assert result["status"] == "answered" and result["answer"]["optionId"] == "pause" and not result["approved"], result
                before = t.result_count(); t.open_demo("decision"); t.keys(ESC)
                result = t.await_result(before); assert result["status"] == "dismissed", result
            if modern:
                proof_case(report, profile + "-pause-and-escape", t, output, pause_and_escape)

            def pending_feedback():
                before = t.result_count(); t.open_demo("approval")
                t.keys("Do not publish", ESC, UP, ENTER)
                t.wait("Clear your feedback first.")
                assert t.result_count() == before
                t.capture(output, profile + "-pending-feedback-blocks-approval")
                t.keys(ESC, "\x15", ESC, UP, ENTER)
                t.wait("send approval")
                if modern: t.keys(KITTY_ENTER_RELEASE, KITTY_ENTER_PRESS)
                else: t.keys("\t", ENTER)
                result = t.await_result(before)
                assert result["approved"] and result["answer"]["note"] == "", result
            proof_case(report, profile + "-explicit-feedback-clear-before-approval", t, output, pending_feedback)

            def narrow_scope():
                t.resize(36, 24); before = t.result_count(); t.open_demo("long"); t.wait("Approve as written")
                seen = t.text()
                for _ in range(10): t.keys(UP); seen += t.text()
                assert "START_SCOPE" in seen and "END_SCOPE" in seen, "entry scope boundaries were not reachable"
                assert "esc cancel" in t.text(), "fixed entry footer was lost"
                t.capture(output, profile + "-narrow-entry-scope")
                t.keys(ENTER); t.wait("esc back")
                if modern: t.keys(KITTY_ENTER_RELEASE)
                t.capture(output, profile + "-narrow-review-end")
                seen = t.text()
                for _ in range(10): t.keys(UP); seen += t.text()
                assert "START_SCOPE" in seen and "END_SCOPE" in seen, "review scope boundaries were not reachable"
                assert "esc back" in t.text(), "fixed review footer was lost"
                t.capture(output, profile + "-narrow-review-start")
                t.keys(ESC); t.pump(.2); t.keys(ESC)
                assert t.await_result(before)["status"] == "dismissed"
            proof_case(report, profile + "-36x24-long-scope", t, output, narrow_scope)

            def validation():
                before = t.result_count(); t.open_demo("decision")
                t.keys(DOWN, DOWN, "\x1b[200~" + "x" * 2001 + "\x1b[201~", ENTER)
                t.wait("answer must be"); t.capture(output, profile + "-narrow-invalid-draft")
                t.keys("\x03")
                assert t.await_result(before)["status"] == "dismissed"
                before = t.result_count(); t.open_demo("decision")
                t.keys("\t", "\x1b[200~" + "n" * 1001 + "\x1b[201~", ENTER)
                t.wait("note must be")
                t.keys(ESC, DOWN); t.wait("Note draft · needs editing")
                t.keys(ENTER); t.wait("note must be")
                assert t.result_count() == before
                t.keys("\x03")
                assert t.await_result(before)["status"] == "dismissed"
            proof_case(report, profile + "-narrow-validation-and-cancel", t, output, validation)

            if mode == "fullscreen" and modern:
                def mouse():
                    t.resize(80, 40); before = t.result_count(); t.open_demo("decision"); t.wait("Public")
                    x, y = t.find("Public")
                    t.sgr_click(x, y, drag=True); assert t.result_count() == before
                    # A fresh whole-row click submits an ordinary answer directly.
                    t.sgr_click(x, y)
                    assert t.await_result(before)["answer"]["optionId"] == "public"
                    before = t.result_count(); t.open_demo("approval")
                    x, y = t.find("Approve as written"); t.sgr_click(x, y); t.wait("send approval")
                    # Continuing/reflowed clicks still cannot confirm approval.
                    t.sgr_click(x, y); assert t.result_count() == before
                    sx, sy = t.find("send approval")
                    t.sgr_click(sx, sy, drag=True); assert t.result_count() == before
                    t.sgr_click(sx + 2, sy); assert t.await_result(before)["approved"]
                proof_case(report, profile + "-sgr-mouse-option-send-guard", t, output, mouse)

                def pointer_editor():
                    before = t.result_count(); t.open_demo("decision")
                    t.keys(DOWN, DOWN, "abcdef", ESC)
                    x, y = t.find("Your answer")
                    t.sgr_click(x + 4, y + 1); t.keys("Z", "\t"); t.wait("Note for:")
                    t.capture(output, profile + "-mouse-caret-note")
                    t.keys(ESC, "Q", ESC)
                    # Drag remains terminal selection, not answer activation or editing.
                    x, y = t.find("Your answer")
                    t.sgr_click(x + 2, y + 1, drag=True)
                    assert t.result_count() == before
                    t.wait("Type something…")
                    # Marker/padding click is the same native field. Type at start.
                    t.sgr_click(x, y + 1); t.keys("M", ENTER)
                    result = t.await_result(before)
                    assert result["answer"]["text"] == "MabZQcdef", result
                proof_case(report, profile + "-sgr-editor-caret-back-drag-padding", t, output, pointer_editor)

                def resize_gesture():
                    before = t.result_count(); t.open_demo("decision")
                    t.resize(36, 24)
                    t.keys(DOWN, DOWN, "abc", ESC, UP)
                    x, y = t.reveal_custom()
                    t.keys(f"\x1b[<35;{x};{y + 1}M", ENTER)
                    assert t.await_result(before)["answer"]["optionId"] == "public", "hover stole keyboard focus"
                    before = t.result_count(); t.open_demo("decision")
                    t.keys(DOWN, DOWN, "abc", ESC)
                    x, y = t.reveal_custom()
                    t.sgr_click(x, y + 1); t.keys("N", "\t"); t.wait("Note for:")
                    sx, sy = t.find("enter send")
                    t.keys(f"\x1b[<0;{sx};{sy}M")
                    t.resize(80, 40)
                    t.keys(f"\x1b[<0;{sx};{sy}m")
                    assert t.result_count() == before, "resize completed an old press as Send"
                    t.capture(output, profile + "-resize-interrupted-gesture")
                    sx, sy = t.find("enter send"); t.sgr_click(sx, sy)
                    result = t.await_result(before)
                    assert result["answer"]["text"] == "Nabc", result
                proof_case(report, profile + "-sgr-hover-resize-and-stale-gesture", t, output, resize_gesture)

                def refocus_keyboard():
                    before = t.result_count(); t.open_demo("approval")
                    t.keys(KITTY_ENTER_PRESS, KITTY_ENTER_RELEASE)
                    # One write forces focus+activation through the actual raw
                    # stream boundary; a late public listener would miss this.
                    t.keys("\x1b[O\x1b[I" + KITTY_ENTER_PRESS)
                    assert t.result_count() == before, "refocus chunk authorized"
                    t.keys(KITTY_ENTER_RELEASE, KITTY_ENTER_REPEAT)
                    assert t.result_count() == before
                    t.keys(KITTY_ENTER_PRESS)
                    assert t.await_result(before)["approved"]
                proof_case(report, profile + "-raw-refocus-before-key-dispatch", t, output, refocus_keyboard)

                def refocus_pointer():
                    before = t.result_count(); t.open_demo("approval")
                    t.keys(KITTY_ENTER_PRESS, KITTY_ENTER_RELEASE)
                    x, y = t.find("enter send approval")
                    t.keys(f"\x1b[O\x1b[I\x1b[<0;{x};{y}M\x1b[<0;{x};{y}m")
                    assert t.result_count() == before, "refocusing click authorized"
                    t.pump(.6)
                    x, y = t.find("send approval")
                    t.sgr_click(x, y)
                    assert t.await_result(before)["approved"]
                proof_case(report, profile + "-raw-refocus-before-pointer-dispatch", t, output, refocus_pointer)
        finally:
            t.close()


def run_remapped(output, report):
    with tempfile.TemporaryDirectory(prefix="hog-ask-keys-pty-") as tmp:
        t = Terminal(Path(tmp), "fullscreen", Path(tmp) / "results.jsonl", True,
                     keybindings={"tui.select.confirm": "f6", "tui.select.cancel": "f7"})
        try:
            t.wait_ready()
            def remapped():
                before = t.result_count(); t.open_demo("approval")
                t.keys(ENTER); t.wait("1. Approve as written")
                t.keys("\x1b[17~"); t.wait("send approval")
                t.keys("\x1b[17;1:3~", "\x1b[17;1:2~")
                assert t.result_count() == before
                t.wait("f6 send approval")
                t.capture(output, "fullscreen-remapped-confirm-review")
                t.keys("\x1b[17~"); assert t.await_result(before)["approved"]
                before = t.result_count(); t.open_demo("decision")
                t.keys("\x1b[18~"); assert t.await_result(before)["status"] == "dismissed"
            proof_case(report, "fullscreen-remapped-confirm-release-cancel", t, output, remapped)
        finally:
            t.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
    report = []
    # Legacy proves both raw-CR fail-closed behavior and the accepted Tab→Enter
    # fallback. Never inject Kitty release events into those profiles.
    for mode, modern in [("regular", True), ("fullscreen", True), ("regular", False), ("fullscreen", False)]:
        try:
            run_profile(args.output, mode, modern, report)
        except Exception as error:
            if not report or report[-1]["status"] != "failed":
                report.append({"case": f"{mode}-{modern}-startup", "status": "failed", "error": str(error)[:1200]})
    try:
        run_remapped(args.output, report)
    except Exception as error:
        if not report or report[-1]["status"] != "failed": report.append({"case": "remapped-startup", "status": "failed", "error": str(error)[:1200]})
    (args.output / "verification.json").write_text(json.dumps({"cases": report,
        "transport": "real offline Pi CLI with emulated PTY keyboard/mouse packets",
        "themes": ["light (regular modern)", "dark (other profiles)"],
        "limits": "No physical terminal/OS IME or live-model usability claim"}, indent=2) + "\n")
    failures = [r for r in report if r["status"] == "failed"]
    print(json.dumps({"passed": len(report) - len(failures), "failed": failures}, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
