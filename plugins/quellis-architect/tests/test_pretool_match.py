"""Unit tests for the PreToolUse matcher and trigger-pack validator.

Run from the plugin root:
    python3 -m unittest discover -s tests

Pure stdlib (no pytest dep). Each test creates an isolated tempdir with
its own .quellis/packs/core/ structure so they parallelize cleanly.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
HOOKS_LIB = PLUGIN_ROOT / "hooks" / "lib"

sys.path.insert(0, str(HOOKS_LIB))
import pretool_match  # type: ignore  # noqa: E402
import stop_match  # type: ignore  # noqa: E402
import validate_pack  # type: ignore  # noqa: E402


def make_repo(tmp: Path, pretool_toml: str | None = None, stop_toml: str | None = None,
              config_toml: str | None = None) -> Path:
    repo = tmp
    pack_dir = repo / ".quellis" / "packs" / "core"
    pack_dir.mkdir(parents=True, exist_ok=True)
    if pretool_toml is not None:
        (pack_dir / "pretool-triggers.toml").write_text(pretool_toml)
    if stop_toml is not None:
        (pack_dir / "stop-triggers.toml").write_text(stop_toml)
    if config_toml is not None:
        (repo / ".quellis" / "config.toml").write_text(config_toml)
    return repo


# A safe sample pack used across tests. Avoids any content that might match
# real CI scanners or look like a real attack — just a benign placeholder.
SAMPLE_PRETOOL_PACK = '''schema_version = "pretool.v1"

[[trigger]]
id = "sample.bash-banana"
type = "non-negotiable"
match_tool = "Bash"
match_regex = "\\\\bbanana\\\\b"
block_reason = "Banana detected in Bash input — fictional trigger used only by the test fixture."
'''

SAMPLE_STOP_PACK = '''schema_version = "stop.v1"

[[trigger]]
id = "sample.claim-banana-without-evidence"
type = "non-negotiable"
claim_regex = "\\\\bbanana\\\\b"
block_reason = "Claim mentions banana with no evidence — fictional trigger used only by the test fixture."
'''


class TestPretoolMatcher(unittest.TestCase):

    def test_no_pack_returns_zero(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "ls"}})
            code, msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)
            self.assertEqual(msg, "")

    def test_no_match_returns_zero(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=SAMPLE_PRETOOL_PACK)
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "ls -la"}})
            code, msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)
            self.assertEqual(msg, "")

    def test_match_returns_block_with_message(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=SAMPLE_PRETOOL_PACK)
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "eat a banana"}})
            code, msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("sample.bash-banana", msg)
            self.assertIn("Banana detected", msg)

    def test_wrong_tool_does_not_match(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=SAMPLE_PRETOOL_PACK)
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"content": "banana"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)

    def test_chill_intensity_suppresses_convention_triggers(self) -> None:
        pack = '''schema_version = "pretool.v1"

[[trigger]]
id = "conv.always-mango"
type = "convention"
match_tool = "Bash"
match_regex = "mango"
block_reason = "Convention trigger — fires at standard+ intensity only."
'''
        config = '''[architect]
intensity = "chill"
schema_version = "v2.0"
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=pack, config_toml=config)
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "fetch mango"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0, "chill must suppress convention triggers")

    def test_chill_does_not_suppress_non_negotiables(self) -> None:
        config = '''[architect]
intensity = "chill"
schema_version = "v2.0"
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=SAMPLE_PRETOOL_PACK, config_toml=config)
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "banana"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2, "non-negotiables fire regardless of intensity")

    def test_malformed_pack_fails_open(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml="this is not valid toml = = = ")
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "anything"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0, "malformed pack must fail open")

    def test_bad_regex_in_trigger_is_skipped_not_fatal(self) -> None:
        pack = '''schema_version = "pretool.v1"

[[trigger]]
id = "bad-regex"
type = "non-negotiable"
match_tool = "Bash"
match_regex = "[unclosed"
block_reason = "This pattern is broken; matcher must skip it gracefully."

[[trigger]]
id = "good-regex"
type = "non-negotiable"
match_tool = "Bash"
match_regex = "\\\\bbanana\\\\b"
block_reason = "Good pattern fires after the broken one is skipped."
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=pack)
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "banana"}})
            code, msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("good-regex", msg)


class TestStopMatcher(unittest.TestCase):

    def test_no_pack_returns_zero(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            stdin = json.dumps({"message": "all done"})
            code, msg = stop_match.run(stdin, repo)
            self.assertEqual(code, 0)
            self.assertEqual(msg, "")

    def test_claim_match_returns_block(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), stop_toml=SAMPLE_STOP_PACK)
            stdin = json.dumps({"message": "I delivered a banana."})
            code, msg = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("sample.claim-banana-without-evidence", msg)

    def test_no_claim_returns_zero(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), stop_toml=SAMPLE_STOP_PACK)
            stdin = json.dumps({"message": "nothing of note."})
            code, _msg = stop_match.run(stdin, repo)
            self.assertEqual(code, 0)

    def test_extracts_text_from_message_content_blocks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), stop_toml=SAMPLE_STOP_PACK)
            stdin = json.dumps({
                "message": {
                    "content": [
                        {"type": "thinking", "thinking": "let me see"},
                        {"type": "text", "text": "Got a banana out of it."},
                    ]
                }
            })
            code, _msg = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)


class TestValidator(unittest.TestCase):

    def _validate(self, toml_text: str) -> list[str]:
        with tempfile.NamedTemporaryFile("w", suffix=".toml", delete=False) as fh:
            fh.write(toml_text)
            path = Path(fh.name)
        try:
            return validate_pack.validate_pack(path)
        finally:
            path.unlink()

    def test_clean_pretool_pack_validates(self) -> None:
        self.assertEqual(self._validate(SAMPLE_PRETOOL_PACK), [])

    def test_clean_stop_pack_validates(self) -> None:
        self.assertEqual(self._validate(SAMPLE_STOP_PACK), [])

    def test_block_reason_over_200_chars_fails(self) -> None:
        overlong = "x" * 250
        pack = f'''schema_version = "pretool.v1"

[[trigger]]
id = "sample.long"
type = "non-negotiable"
match_tool = "Bash"
match_regex = "x"
block_reason = "{overlong}"
'''
        findings = self._validate(pack)
        self.assertTrue(
            any("exceeds 200-char limit" in f for f in findings),
            f"expected length finding, got: {findings}",
        )

    def test_block_reason_with_emoji_fails(self) -> None:
        # Embedding the emoji as an escape so test source has no actual non-ASCII.
        emoji = "\U0001F389"  # party popper
        pack = f'''schema_version = "pretool.v1"

[[trigger]]
id = "sample.cute"
type = "non-negotiable"
match_tool = "Bash"
match_regex = "."
block_reason = "Cute message {emoji}"
'''
        findings = self._validate(pack)
        self.assertTrue(
            any("non-ASCII" in f for f in findings),
            f"emoji must be flagged as non-ASCII, got: {findings}",
        )

    def test_duplicate_ids_flagged(self) -> None:
        pack = '''schema_version = "pretool.v1"

[[trigger]]
id = "dup"
type = "non-negotiable"
match_tool = "Bash"
match_regex = "a"
block_reason = "first"

[[trigger]]
id = "dup"
type = "non-negotiable"
match_tool = "Bash"
match_regex = "b"
block_reason = "second"
'''
        findings = self._validate(pack)
        self.assertTrue(
            any("duplicate id" in f for f in findings),
            f"expected duplicate-id finding, got: {findings}",
        )

    def test_bad_regex_in_pretool_flagged(self) -> None:
        pack = '''schema_version = "pretool.v1"

[[trigger]]
id = "bad"
type = "non-negotiable"
match_tool = "Bash"
match_regex = "[unclosed"
block_reason = "ok"
'''
        findings = self._validate(pack)
        self.assertTrue(
            any("does not compile" in f for f in findings),
            f"expected bad-regex finding, got: {findings}",
        )

    def test_unknown_type_flagged(self) -> None:
        pack = '''schema_version = "pretool.v1"

[[trigger]]
id = "wat"
type = "totally-made-up"
match_tool = "Bash"
match_regex = "x"
block_reason = "ok"
'''
        findings = self._validate(pack)
        self.assertTrue(
            any("type" in f for f in findings),
            f"expected unknown-type finding, got: {findings}",
        )


class TestPretoolShWiring(unittest.TestCase):
    """Smoke-tests for the pretool.sh wrapper invoking python3."""

    def test_pretool_sh_exits_zero_when_no_pack(self) -> None:
        if not shutil.which("bash") or not shutil.which("python3"):
            self.skipTest("bash + python3 required")
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            env["CLAUDE_PROJECT_DIR"] = tmp
            result = subprocess.run(
                [str(PLUGIN_ROOT / "hooks" / "pretool.sh")],
                env=env,
                input=json.dumps({"tool_name": "Bash", "tool_input": {"command": "ls"}}),
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0)

    def test_pretool_sh_exits_two_on_match(self) -> None:
        if not shutil.which("bash") or not shutil.which("python3"):
            self.skipTest("bash + python3 required")
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=SAMPLE_PRETOOL_PACK)
            env = os.environ.copy()
            env["CLAUDE_PROJECT_DIR"] = str(repo)
            result = subprocess.run(
                [str(PLUGIN_ROOT / "hooks" / "pretool.sh")],
                env=env,
                input=json.dumps({"tool_name": "Bash", "tool_input": {"command": "banana"}}),
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 2)
            self.assertIn("sample.bash-banana", result.stderr)


if __name__ == "__main__":
    unittest.main()
