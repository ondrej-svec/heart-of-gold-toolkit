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
import acceptance_log  # type: ignore  # noqa: E402
import evidence_search  # type: ignore  # noqa: E402
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
            code, msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)
            self.assertEqual(msg, "")

    def test_no_match_returns_zero(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=SAMPLE_PRETOOL_PACK)
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "ls -la"}})
            code, msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)
            self.assertEqual(msg, "")

    def test_match_returns_block_with_message(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=SAMPLE_PRETOOL_PACK)
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "eat a banana"}})
            code, msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("sample.bash-banana", msg)
            self.assertIn("Banana detected", msg)

    def test_wrong_tool_does_not_match(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=SAMPLE_PRETOOL_PACK)
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"content": "banana"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
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
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0, "chill must suppress convention triggers")

    def test_chill_does_not_suppress_non_negotiables(self) -> None:
        config = '''[architect]
intensity = "chill"
schema_version = "v2.0"
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=SAMPLE_PRETOOL_PACK, config_toml=config)
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "banana"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2, "non-negotiables fire regardless of intensity")

    def test_malformed_pack_fails_open(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml="this is not valid toml = = = ")
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "anything"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
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
            code, msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("good-regex", msg)


class TestStopMatcher(unittest.TestCase):

    def test_no_pack_returns_zero(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            stdin = json.dumps({"message": "all done"})
            code, msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 0)
            self.assertEqual(msg, "")

    def test_claim_match_returns_block(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), stop_toml=SAMPLE_STOP_PACK)
            stdin = json.dumps({"message": "I delivered a banana."})
            code, msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("sample.claim-banana-without-evidence", msg)

    def test_no_claim_returns_zero(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), stop_toml=SAMPLE_STOP_PACK)
            stdin = json.dumps({"message": "nothing of note."})
            code, _msg, _ = stop_match.run(stdin, repo)
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
            code, _msg, _ = stop_match.run(stdin, repo)
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


class TestEvidenceSearch(unittest.TestCase):
    """Phase 1.E — evidence-search helper."""

    def _write_transcript(self, dir_path: Path, events: list[dict]) -> Path:
        path = dir_path / "transcript.jsonl"
        with path.open("w") as fh:
            for event in events:
                fh.write(json.dumps(event) + "\n")
        return path

    def test_unknown_kind_returns_true_conservative(self) -> None:
        """Unknown kinds default to True so unknown triggers do not block."""
        with tempfile.TemporaryDirectory() as tmp:
            path = self._write_transcript(Path(tmp), [])
            self.assertTrue(evidence_search.has_evidence(path, "not-a-real-kind"))

    def test_missing_transcript_returns_false(self) -> None:
        path = Path("/nonexistent/transcript.jsonl")
        self.assertFalse(evidence_search.has_evidence(path, "test-run"))

    def test_test_run_evidence_detected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = self._write_transcript(Path(tmp), [
                {"type": "user", "message": {"role": "user", "content": "run tests"}},
                {
                    "type": "assistant",
                    "message": {
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool_use",
                                "name": "Bash",
                                "input": {"command": "cargo test --offline"},
                            }
                        ],
                    },
                },
            ])
            self.assertTrue(evidence_search.has_evidence(path, "test-run"))

    def test_no_test_evidence_returns_false(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = self._write_transcript(Path(tmp), [
                {
                    "type": "assistant",
                    "message": {
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool_use",
                                "name": "Bash",
                                "input": {"command": "ls -la"},
                            }
                        ],
                    },
                },
            ])
            self.assertFalse(evidence_search.has_evidence(path, "test-run"))

    def test_scan_output_evidence_detected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = self._write_transcript(Path(tmp), [
                {
                    "type": "assistant",
                    "message": {
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool_use",
                                "name": "Bash",
                                "input": {"command": "gitleaks detect --no-banner"},
                            }
                        ],
                    },
                },
            ])
            self.assertTrue(evidence_search.has_evidence(path, "scan-output"))

    def test_malformed_jsonl_lines_skipped(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "transcript.jsonl"
            path.write_text(
                "this is not json\n"
                + json.dumps({
                    "type": "assistant",
                    "message": {
                        "content": [
                            {"type": "tool_use", "name": "Bash", "input": {"command": "pytest"}}
                        ]
                    },
                })
                + "\n"
                "{partial\n"
            )
            self.assertTrue(evidence_search.has_evidence(path, "test-run"))


class TestStopMatchWithEvidence(unittest.TestCase):
    """Stop matcher with the Phase 1.E evidence-search wired in."""

    EVIDENCE_AWARE_PACK = '''schema_version = "stop.v1"

[[trigger]]
id = "evidence.banana-without-test-run"
type = "evidence"
claim_regex = "\\\\bbanana\\\\b"
requires = "test-run"
block_reason = "Banana claim without a test run — fictional fixture used only by the tests."
'''

    def _write_transcript(self, dir_path: Path, events: list[dict]) -> Path:
        path = dir_path / "transcript.jsonl"
        with path.open("w") as fh:
            for event in events:
                fh.write(json.dumps(event) + "\n")
        return path

    def test_evidence_present_suppresses_block(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), stop_toml=self.EVIDENCE_AWARE_PACK)
            transcript = self._write_transcript(repo, [
                {
                    "type": "assistant",
                    "message": {
                        "content": [
                            {"type": "tool_use", "name": "Bash", "input": {"command": "cargo test"}}
                        ]
                    },
                },
            ])
            stdin = json.dumps({
                "transcript_path": str(transcript),
                "message": "I delivered a banana."
            })
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 0, "evidence present must suppress block")

    def test_evidence_absent_still_blocks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), stop_toml=self.EVIDENCE_AWARE_PACK)
            transcript = self._write_transcript(repo, [
                {
                    "type": "assistant",
                    "message": {
                        "content": [
                            {"type": "tool_use", "name": "Bash", "input": {"command": "ls"}}
                        ]
                    },
                },
            ])
            stdin = json.dumps({
                "transcript_path": str(transcript),
                "message": "I delivered a banana."
            })
            code, msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 2, "evidence absent must block")
            self.assertIn("banana", msg.lower())

    def test_missing_transcript_path_still_blocks(self) -> None:
        """No transcript means we cannot verify; conservative — block on the claim."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), stop_toml=self.EVIDENCE_AWARE_PACK)
            stdin = json.dumps({"message": "I delivered a banana."})
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_block_message_quotes_the_claim(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), stop_toml=self.EVIDENCE_AWARE_PACK)
            stdin = json.dumps({"message": "All done. I delivered a banana and verified it."})
            code, msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("You wrote:", msg)


class TestValidatorRequiresField(unittest.TestCase):

    def _validate(self, toml_text: str) -> list[str]:
        with tempfile.NamedTemporaryFile("w", suffix=".toml", delete=False) as fh:
            fh.write(toml_text)
            path = Path(fh.name)
        try:
            return validate_pack.validate_pack(path)
        finally:
            path.unlink()

    def test_known_requires_kind_validates(self) -> None:
        pack = '''schema_version = "stop.v1"

[[trigger]]
id = "evidence.with-requires"
type = "evidence"
claim_regex = "tested"
requires = "test-run"
block_reason = "Tested claim needs a test run."
'''
        self.assertEqual(self._validate(pack), [])

    def test_unknown_requires_kind_fails(self) -> None:
        pack = '''schema_version = "stop.v1"

[[trigger]]
id = "evidence.bogus"
type = "evidence"
claim_regex = "x"
requires = "not-a-real-kind"
block_reason = "ok"
'''
        findings = self._validate(pack)
        self.assertTrue(
            any("requires" in f and "not a known evidence kind" in f for f in findings),
            f"expected unknown-evidence-kind finding, got: {findings}",
        )


class TestSuppressIfContentMatches(unittest.TestCase):
    """2.D.1 — content inspection suppresses path-class trigger fires.

    A convention trigger that matched on a path-based regex still fires
    by default. When the agent's tool_input.content already carries the
    compliance marker the trigger asks for, the fire is suppressed and
    recorded as `suppressed_compliant` in the log event.
    """

    PACK = '''schema_version = "pretool.v1"

[[trigger]]
id = "convention.migration-needs-backfill"
type = "convention"
match_tool = "Write"
match_regex = "(?:^|/)migrations/"
suppress_if_content_matches = "(?im)^--\\\\s*backfill:|<!--\\\\s*backfill:|@backfill:|ADR:"
block_reason = "Migration without backfill note — pause."
'''

    def test_compliant_content_suppresses_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=self.PACK)
            content = (
                "-- backfill: existing rows default to 'standard'\n"
                "ALTER TABLE users ADD COLUMN intensity TEXT NOT NULL DEFAULT 'standard';\n"
            )
            stdin = json.dumps({
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "migrations/0002_add_intensity.sql",
                    "content": content,
                },
            })
            code, msg, event = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0, "compliant content must suppress the fire")
            self.assertEqual(msg, "")
            self.assertIsNotNone(event)
            assert event is not None
            self.assertEqual(event["event_type"], "suppressed_compliant")
            self.assertEqual(event["trigger_id"], "convention.migration-needs-backfill")

    def test_non_compliant_content_still_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=self.PACK)
            content = (
                "ALTER TABLE users ADD COLUMN intensity TEXT NOT NULL DEFAULT 'standard';\n"
            )
            stdin = json.dumps({
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "migrations/0002_add_intensity.sql",
                    "content": content,
                },
            })
            code, msg, event = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("convention.migration-needs-backfill", msg)
            self.assertIsNotNone(event)
            assert event is not None
            self.assertEqual(event["event_type"], "fire")

    def test_marker_in_file_path_alone_does_not_suppress(self) -> None:
        """file_path is deliberately excluded from suppression matching."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=self.PACK)
            stdin = json.dumps({
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "migrations/backfill_users.sql",
                    "content": "SELECT 1;",
                },
            })
            code, _msg, event = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            assert event is not None
            self.assertEqual(event["event_type"], "fire")

    def test_bad_suppress_regex_does_not_crash(self) -> None:
        pack = '''schema_version = "pretool.v1"

[[trigger]]
id = "convention.broken-suppress"
type = "convention"
match_tool = "Write"
match_regex = "(?:^|/)migrations/"
suppress_if_content_matches = "[unclosed"
block_reason = "Migration without backfill note — pause."
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=pack)
            stdin = json.dumps({
                "tool_name": "Write",
                "tool_input": {"file_path": "migrations/x.sql", "content": "-- backfill: yes"},
            })
            code, _msg, event = pretool_match.run(stdin, repo)
            # Bad suppress regex → behave as if no suppression: fire.
            self.assertEqual(code, 2)
            assert event is not None
            self.assertEqual(event["event_type"], "fire")

    def test_validator_accepts_suppress_field(self) -> None:
        findings = self._validate(self.PACK)
        self.assertEqual(findings, [])

    def test_validator_flags_bad_suppress_regex(self) -> None:
        pack = '''schema_version = "pretool.v1"

[[trigger]]
id = "convention.broken"
type = "convention"
match_tool = "Write"
match_regex = "(?:^|/)migrations/"
suppress_if_content_matches = "[unclosed"
block_reason = "ok"
'''
        findings = self._validate(pack)
        self.assertTrue(
            any("suppress_if_content_matches does not compile" in f for f in findings),
            f"expected suppress-regex finding, got: {findings}",
        )

    def _validate(self, toml_text: str) -> list[str]:
        with tempfile.NamedTemporaryFile("w", suffix=".toml", delete=False) as fh:
            fh.write(toml_text)
            path = Path(fh.name)
        try:
            return validate_pack.validate_pack(path)
        finally:
            path.unlink()


class TestBashCoverageForPathFamilies(unittest.TestCase):
    """2.D.2 — Bash heredoc / redirection coverage for path-class triggers.

    An agent that hits an Edit/Write block can otherwise bypass via
    `cat <<EOF > migrations/...`. The Bash-tool trigger closes that hole.
    """

    PACK = '''schema_version = "pretool.v1"

[[trigger]]
id = "convention.migration-write-via-bash"
type = "convention"
path_family = "migration"
match_tool = "Bash"
match_regex = "(?:>>?|\\\\btee\\\\s+(?:-[a-z]+\\\\s+)?)(?:\\\\s|[\\"'])*/?(?:[\\\\w.-]+/)*(?:migrations|prisma/migrations)/"
suppress_if_content_matches = "(?im)^--\\\\s*backfill:|@backfill:"
block_reason = "Migration via Bash redirection — pause."
'''

    def test_bash_heredoc_to_migrations_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=self.PACK)
            cmd = "cat > migrations/0002_add_users.sql <<EOF\nALTER TABLE users ADD COLUMN x TEXT;\nEOF"
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": cmd}})
            code, msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2, "Bash heredoc into migrations/ must fire")
            self.assertIn("migration-write-via-bash", msg)

    def test_bash_append_to_migrations_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=self.PACK)
            cmd = "echo 'ALTER TABLE users ADD COLUMN y TEXT;' >> migrations/0002.sql"
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": cmd}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_bash_tee_to_migrations_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=self.PACK)
            cmd = "echo 'ALTER' | tee -a migrations/0002.sql"
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": cmd}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_bash_quoted_path_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=self.PACK)
            cmd = 'cat <<EOF > "prisma/migrations/x/migration.sql"\nALTER ...\nEOF'
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": cmd}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_bash_unrelated_redirect_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=self.PACK)
            cmd = "echo hello > /tmp/foo.txt"
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": cmd}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)

    def test_bash_heredoc_with_backfill_marker_is_suppressed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=self.PACK)
            cmd = (
                "cat > migrations/0002.sql <<EOF\n"
                "-- backfill: existing rows default to 'standard'\n"
                "ALTER TABLE users ADD COLUMN intensity TEXT NOT NULL DEFAULT 'standard';\n"
                "EOF"
            )
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": cmd}})
            code, _msg, event = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0, "compliant heredoc must suppress the fire")
            assert event is not None
            self.assertEqual(event["event_type"], "suppressed_compliant")

    def test_validator_flags_missing_bash_in_path_family(self) -> None:
        """An Edit/Write trigger declaring path_family without a Bash sibling is a hole."""
        pack = '''schema_version = "pretool.v1"

[[trigger]]
id = "convention.holey-edit"
type = "convention"
path_family = "holey"
match_tool = "Edit"
match_regex = "(?:^|/)holey/"
block_reason = "Editing the holey path — pause."
'''
        with tempfile.NamedTemporaryFile("w", suffix=".toml", delete=False) as fh:
            fh.write(pack)
            path = Path(fh.name)
        try:
            findings = validate_pack.validate_pack(path)
        finally:
            path.unlink()
        self.assertTrue(
            any("no Bash trigger" in f and "'holey'" in f for f in findings),
            f"expected Bash-coverage finding, got: {findings}",
        )

    def test_validator_accepts_path_family_with_bash_pair(self) -> None:
        pack = '''schema_version = "pretool.v1"

[[trigger]]
id = "convention.paired-edit"
type = "convention"
path_family = "paired"
match_tool = "Edit"
match_regex = "(?:^|/)paired/"
block_reason = "Editing — pause."

[[trigger]]
id = "convention.paired-bash"
type = "convention"
path_family = "paired"
match_tool = "Bash"
match_regex = ">>?\\\\s*[\\"']?[\\\\w./-]*?(?:^|/)paired/"
block_reason = "Bash redirect — pause."
'''
        with tempfile.NamedTemporaryFile("w", suffix=".toml", delete=False) as fh:
            fh.write(pack)
            path = Path(fh.name)
        try:
            findings = validate_pack.validate_pack(path)
        finally:
            path.unlink()
        self.assertEqual(findings, [])

    def test_core_pack_passes_validator(self) -> None:
        """The shipped pack must pass — guards against regression."""
        core = PLUGIN_ROOT / "packs" / "core" / "pretool-triggers.toml"
        findings = validate_pack.validate_pack(core)
        self.assertEqual(findings, [], f"core pack must validate: {findings}")


class TestAcceptanceLogWrite(unittest.TestCase):
    """2.D.3 — every PreToolUse / Stop fire and suppression writes a log.v1 line."""

    PACK = '''schema_version = "pretool.v1"

[[trigger]]
id = "convention.migration-needs-backfill"
type = "convention"
match_tool = "Write"
match_regex = "(?:^|/)migrations/"
suppress_if_content_matches = "(?im)^--\\\\s*backfill:"
block_reason = "Migration without backfill note — pause."
'''

    def _read_log(self, repo: Path) -> list[dict]:
        path = repo / acceptance_log.LOG_PATH
        if not path.is_file():
            return []
        return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

    def test_redact_strips_env_assignments(self) -> None:
        out = acceptance_log.redact("OPENAI_API_KEY=sk-abcdef1234567890abcdef")
        self.assertIn("<redacted>", out)
        self.assertNotIn("sk-abcdef", out)

    def test_redact_strips_bearer_tokens(self) -> None:
        out = acceptance_log.redact("Authorization: Bearer abc123def456ghi789")
        self.assertIn("<redacted>", out)
        self.assertNotIn("abc123def456", out)

    def test_redact_strips_aws_access_key(self) -> None:
        out = acceptance_log.redact("AKIAIOSFODNN7EXAMPLE in config")
        self.assertIn("<redacted>", out)
        self.assertNotIn("AKIAIOSFODNN7EXAMPLE", out)

    def test_redact_caps_match_text_length(self) -> None:
        long = "x" * (acceptance_log.MAX_MATCH_TEXT + 100)
        out = acceptance_log.redact(long)
        self.assertLessEqual(len(out), acceptance_log.MAX_MATCH_TEXT)

    def test_append_writes_log_v1_line(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            event = {
                "hook": "PreToolUse",
                "trigger_id": "convention.test",
                "tool": "Write",
                "match_text": "some content",
                "event_type": "fire",
                "session_id": "abc-123",
            }
            ok = acceptance_log.append_event(repo, event)
            self.assertTrue(ok)
            lines = self._read_log(repo)
            self.assertEqual(len(lines), 1)
            record = lines[0]
            self.assertEqual(record["schema_version"], "log.v1")
            self.assertEqual(record["hook"], "PreToolUse")
            self.assertEqual(record["trigger_id"], "convention.test")
            self.assertEqual(record["event_type"], "fire")
            self.assertEqual(record["session_id"], "abc-123")
            self.assertEqual(record["user_response"], "unknown")
            self.assertIn("timestamp", record)

    def test_append_redacts_secret_in_match_text(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            event = {
                "hook": "PreToolUse",
                "trigger_id": "convention.test",
                "tool": "Edit",
                "match_text": "SECRET_API_KEY=sk-realtoken1234567890abcdef",
                "event_type": "fire",
            }
            acceptance_log.append_event(repo, event)
            lines = self._read_log(repo)
            self.assertNotIn("sk-realtoken", lines[0]["match_text"])
            self.assertIn("<redacted>", lines[0]["match_text"])

    def test_append_creates_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            # No .quellis/ exists yet — append should create it.
            event = {"hook": "Stop", "trigger_id": "x", "match_text": "", "event_type": "fire"}
            ok = acceptance_log.append_event(repo, event)
            self.assertTrue(ok)
            self.assertTrue((repo / ".quellis").is_dir())

    def test_pretool_main_writes_log_line_on_fire(self) -> None:
        if not shutil.which("bash") or not shutil.which("python3"):
            self.skipTest("bash + python3 required")
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=self.PACK)
            env = os.environ.copy()
            env["CLAUDE_PROJECT_DIR"] = str(repo)
            payload = {
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "migrations/x.sql",
                    "content": "ALTER TABLE users ADD COLUMN x TEXT;",
                },
                "session_id": "test-fire-session",
            }
            result = subprocess.run(
                [str(PLUGIN_ROOT / "hooks" / "pretool.sh")],
                env=env,
                input=json.dumps(payload),
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 2)
            lines = self._read_log(repo)
            self.assertEqual(len(lines), 1)
            self.assertEqual(lines[0]["event_type"], "fire")
            self.assertEqual(lines[0]["session_id"], "test-fire-session")

    def test_pretool_main_writes_log_line_on_suppression(self) -> None:
        if not shutil.which("bash") or not shutil.which("python3"):
            self.skipTest("bash + python3 required")
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), pretool_toml=self.PACK)
            env = os.environ.copy()
            env["CLAUDE_PROJECT_DIR"] = str(repo)
            payload = {
                "tool_name": "Write",
                "tool_input": {
                    "file_path": "migrations/x.sql",
                    "content": "-- backfill: existing rows default to 'standard'\nALTER TABLE users ADD COLUMN x TEXT;",
                },
                "session_id": "test-suppress-session",
            }
            result = subprocess.run(
                [str(PLUGIN_ROOT / "hooks" / "pretool.sh")],
                env=env,
                input=json.dumps(payload),
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0)
            lines = self._read_log(repo)
            self.assertEqual(len(lines), 1)
            self.assertEqual(lines[0]["event_type"], "suppressed_compliant")

    def test_stop_main_writes_log_line_on_fire(self) -> None:
        if not shutil.which("bash") or not shutil.which("python3"):
            self.skipTest("bash + python3 required")
        stop_pack = '''schema_version = "stop.v1"

[[trigger]]
id = "evidence.banana-without-test"
type = "evidence"
claim_regex = "\\\\bbanana\\\\b"
requires = "test-run"
block_reason = "Banana claim — fictional fixture."
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(Path(tmp), stop_toml=stop_pack)
            env = os.environ.copy()
            env["CLAUDE_PROJECT_DIR"] = str(repo)
            payload = {"message": "I delivered a banana.", "session_id": "stop-session"}
            result = subprocess.run(
                [str(PLUGIN_ROOT / "hooks" / "stop.sh")],
                env=env,
                input=json.dumps(payload),
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 2)
            lines = self._read_log(repo)
            self.assertEqual(len(lines), 1)
            self.assertEqual(lines[0]["hook"], "Stop")
            self.assertEqual(lines[0]["event_type"], "fire")


if __name__ == "__main__":
    unittest.main()
