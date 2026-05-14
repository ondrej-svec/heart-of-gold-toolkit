"""Smoke tests for the shipped `core` pack (plan 2026-05-13, task 1.D).

These exercise the actual TOML files at `packs/core/` — the real ones the
plugin reads, not a fixture. Each test:
  - copies the production pack into a temp .quellis/packs/core/ dir
  - runs the matcher with a representative input
  - asserts the right trigger fired (or did not fire)

If you change a trigger pattern in `packs/core/*.toml`, update the
expectation here.
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

CORE_PACK = PLUGIN_ROOT / "packs" / "core"


def make_repo_with_core_pack(tmp: Path) -> Path:
    """Copy the production core pack into a fresh `.quellis/packs/core/`."""
    quellis = tmp / ".quellis"
    target = quellis / "packs" / "core"
    target.mkdir(parents=True)
    for src in CORE_PACK.iterdir():
        shutil.copy2(src, target / src.name)
    return tmp


class TestCorePackPretoolNonNegotiables(unittest.TestCase):
    """Three non-negotiables. Each must fire exactly when it should."""

    def test_git_reset_hard_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "git reset --hard HEAD~2"}})
            code, msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("git-reset-hard-unpushed", msg)

    def test_git_reset_hard_origin_also_fires(self) -> None:
        """Per the review: even reset to origin/<branch> blocks."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "git reset --hard origin/main"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_git_reset_soft_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "git reset HEAD~1"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)

    def test_env_write_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "/repo/.env"}})
            code, msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("env-file-write", msg)

    def test_env_production_write_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Write", "tool_input": {"file_path": "apps/web/.env.production"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_env_example_does_not_fire(self) -> None:
        """Negative lookahead exempts placeholders."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            for example in (".env.example", ".env.template", ".env.sample"):
                stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": example}})
                code, _msg, _ = pretool_match.run(stdin, repo)
                self.assertEqual(code, 0, f"{example} should not fire")

    def test_npm_publish_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "npm publish"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_cargo_publish_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "cargo publish"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_npm_publish_dry_run_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "npm publish --dry-run"}})
            # The regex `\bpublish\b` matches "publish" before " --dry-run"
            # so this DOES fire. That's an intentional V1.0 false-positive
            # bias: better to block dry-runs and have the user override than
            # let `publish --dry-run` slip past via a bypass typo.
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)


class TestCorePackPretoolConventions(unittest.TestCase):
    """Four conventions. Each fires at standard intensity (the default)."""

    def test_auth_folder_edit_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "apps/web/src/auth/session.ts"}})
            code, msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("auth-without-rationale", msg)

    def test_clerk_folder_edit_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "clerk/middleware.ts"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_auth_test_file_does_not_fire(self) -> None:
        """Test files under tests/auth/ should NOT match the auth/ regex."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            # The pattern `(?:^|/)auth/` matches `tests/auth/session.test.ts`
            # because of the inner /auth/. This is a known V1.0 limitation
            # noted in the convention mockup. Asserting current behavior
            # so future tightening is visible.
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "tests/auth/session.test.ts"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2, "V1.0: tests/auth/* DOES fire — calibrate in 1.D.6")

    def test_migration_edit_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "migrations/2026_05_13_add_column.sql"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_prisma_migration_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Write", "tool_input": {"file_path": "prisma/migrations/20260513_x/migration.sql"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_scoring_folder_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "apps/api/src/scoring/rank.ts"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_billing_folder_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Write", "tool_input": {"file_path": "billing/stripe-webhook.ts"}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_sql_unwrapped_interpolation_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            content = "const q = sql`SELECT * FROM users WHERE id = ${userId}`;"
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"content": content}})
            code, msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("sql-template-interpolation", msg)

    def test_sql_identifier_wrapper_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            content = "const q = sql`SELECT * FROM ${sql.identifier(tableName)}`;"
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"content": content}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0, "sql.identifier(...) is exempted")

    def test_sql_raw_wrapper_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            content = "const q = sql`${sql.raw(dynamicClause)}`;"
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"content": content}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)

    def test_parameterized_sql_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            content = "const q = sql`SELECT * FROM users WHERE id = ?`;"
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"content": content}})
            code, _msg, _ = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)


class TestCorePackStop(unittest.TestCase):
    """Three Stop-time evidence gates."""

    def _write_transcript(self, dir_path: Path, events: list[dict]) -> Path:
        path = dir_path / "transcript.jsonl"
        with path.open("w") as fh:
            for event in events:
                fh.write(json.dumps(event) + "\n")
        return path

    def test_completion_claim_without_test_run_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            transcript = self._write_transcript(repo, [
                {"type": "assistant", "message": {"content": [
                    {"type": "tool_use", "name": "Bash", "input": {"command": "ls"}}
                ]}},
            ])
            stdin = json.dumps({"transcript_path": str(transcript), "message": "All tests passing. Done."})
            code, msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("completion-without-test-run", msg)

    def test_bare_done_no_longer_fires(self) -> None:
        """2.D.5 calibration: `done` alone is too noisy (agents say it constantly)."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"message": "Done."})
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 0, "bare 'done' must not fire post-calibration")

    def test_bare_finished_no_longer_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"message": "Finished refactoring the matcher."})
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 0)

    def test_tested_claim_still_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"message": "The matcher is tested."})
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_verified_claim_still_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"message": "Behavior verified on macOS."})
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_hedged_tested_does_not_fire(self) -> None:
        """2.D.5: hedge-aware lookbehind — agent's own uncertainty markers skip the block."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"message": "I think tested but worth a second look."})
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 0, "hedge 'I think tested' must not fire")

    def test_hedged_safe_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"message": "probably safe to merge — please review"})
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 0)

    def test_strict_intensity_fires_on_bare_done(self) -> None:
        """§3.B.2: strict drops the §2.D.5 narrowing and the hedge lookbehinds."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            (repo / ".quellis" / "config.toml").write_text(
                '[architect]\nintensity = "strict"\nschema_version = "v2.0"\n'
            )
            stdin = json.dumps({"message": "Done."})
            code, msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 2, "strict mode must fire on bare 'done'")
            self.assertIn("completion-without-test-run", msg)

    def test_strict_intensity_fires_on_hedged_tested(self) -> None:
        """Strict mode ignores hedge lookbehinds."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            (repo / ".quellis" / "config.toml").write_text(
                '[architect]\nintensity = "strict"\nschema_version = "v2.0"\n'
            )
            stdin = json.dumps({"message": "I think tested but worth a second look."})
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 2, "strict mode fires even when standard would skip via hedge")

    def test_standard_still_skips_bare_done(self) -> None:
        """Regression: the §2.D.5 narrowing still holds at standard intensity."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            (repo / ".quellis" / "config.toml").write_text(
                '[architect]\nintensity = "standard"\nschema_version = "v2.0"\n'
            )
            stdin = json.dumps({"message": "Done."})
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 0)

    def test_completion_claim_with_test_run_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            transcript = self._write_transcript(repo, [
                {"type": "assistant", "message": {"content": [
                    {"type": "tool_use", "name": "Bash", "input": {"command": "cargo test --offline"}}
                ]}},
            ])
            stdin = json.dumps({"transcript_path": str(transcript), "message": "All tests passing. Done."})
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 0, "test-run evidence suppresses the block")

    def test_migration_applied_without_verification_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"message": "Migration applied successfully."})
            code, msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("migration-applied", msg)

    def test_secret_removed_claim_without_scan_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"message": "Secrets removed from the repo."})
            code, msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("secret-removed", msg)

    def test_secret_removed_with_scan_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            transcript = self._write_transcript(repo, [
                {"type": "assistant", "message": {"content": [
                    {"type": "tool_use", "name": "Bash", "input": {"command": "gitleaks detect --no-banner"}}
                ]}},
            ])
            stdin = json.dumps({"transcript_path": str(transcript), "message": "All secrets removed."})
            code, _msg, _ = stop_match.run(stdin, repo)
            self.assertEqual(code, 0, "gitleaks evidence suppresses the block")


class TestSchemaMigrationDemoReplay(unittest.TestCase):
    """2.D.6 mechanical replay of the V1.0 demo (schema-migration footgun).

    This is the hermetic verification of §2.D fixes — the live recorded
    demo on a real Claude Code session is still required to formally
    close §2.D.6, but this test asserts the pipeline behaves correctly
    given the exact PreToolUse payloads that demo will produce.
    """

    def _payload(self, file_path: str, content: str, session_id: str = "demo-retry") -> dict:
        return {
            "tool_name": "Write",
            "tool_input": {"file_path": file_path, "content": content},
            "session_id": session_id,
        }

    def _bash_payload(self, command: str, session_id: str = "demo-retry") -> dict:
        return {"tool_name": "Bash", "tool_input": {"command": command}, "session_id": session_id}

    def _read_log(self, repo: Path) -> list[dict]:
        log = repo / ".quellis" / "acceptance-log.jsonl"
        if not log.is_file():
            return []
        return [json.loads(line) for line in log.read_text().splitlines() if line.strip()]

    def test_write_path_first_noncompliant_then_compliant(self) -> None:
        """First Write blocks (fire). Agent reads the message, adds the
        `-- backfill:` marker, retries — suppressed_compliant, no block."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))

            # First attempt: no backfill note.
            naive = "ALTER TABLE users ADD COLUMN intensity TEXT NOT NULL DEFAULT 'standard';\n"
            stdin = json.dumps(self._payload("migrations/0002_add_intensity.sql", naive))
            code1, msg1, ev1 = pretool_match.run(stdin, repo)
            self.assertEqual(code1, 2, "first attempt must block")
            self.assertIn("migration-write-without-backfill-note", msg1)
            assert ev1 is not None
            self.assertEqual(ev1["event_type"], "fire")

            # Second attempt: agent added the backfill note as the block_reason
            # asked. Must NOT block, and must record suppressed_compliant.
            compliant = (
                "-- backfill: existing rows default to 'standard'\n"
                "ALTER TABLE users ADD COLUMN intensity TEXT NOT NULL DEFAULT 'standard';\n"
            )
            stdin = json.dumps(self._payload("migrations/0002_add_intensity.sql", compliant))
            code2, _msg2, ev2 = pretool_match.run(stdin, repo)
            self.assertEqual(code2, 0, "compliant retry must succeed")
            assert ev2 is not None
            self.assertEqual(ev2["event_type"], "suppressed_compliant")

    def test_bash_bypass_attempt_is_also_caught(self) -> None:
        """An agent that tries `cat <<EOF > migrations/...` to dodge the
        Edit/Write trigger hits the §2.D.2 Bash trigger instead."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            cmd = (
                "cat > migrations/0002_add_intensity.sql <<EOF\n"
                "ALTER TABLE users ADD COLUMN intensity TEXT NOT NULL DEFAULT 'standard';\n"
                "EOF"
            )
            stdin = json.dumps(self._bash_payload(cmd))
            code, msg, ev = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2, "Bash heredoc bypass must fire")
            self.assertIn("migration-write-via-bash", msg)
            assert ev is not None
            self.assertEqual(ev["event_type"], "fire")

    def test_bash_compliant_heredoc_is_suppressed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            cmd = (
                "cat > migrations/0002_add_intensity.sql <<EOF\n"
                "-- backfill: existing rows default to 'standard'\n"
                "ALTER TABLE users ADD COLUMN intensity TEXT NOT NULL DEFAULT 'standard';\n"
                "EOF"
            )
            stdin = json.dumps(self._bash_payload(cmd))
            code, _msg, ev = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)
            assert ev is not None
            self.assertEqual(ev["event_type"], "suppressed_compliant")

    def test_full_demo_sequence_via_main_writes_correct_log(self) -> None:
        """End-to-end: run the actual hook scripts as Claude Code would,
        verify the resulting acceptance-log.jsonl matches the §2.D.6 spec
        (exactly one fire + exactly one suppressed_compliant)."""
        if not shutil.which("bash") or not shutil.which("python3"):
            self.skipTest("bash + python3 required")
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            env = os.environ.copy()
            env["CLAUDE_PROJECT_DIR"] = str(repo)

            pretool = PLUGIN_ROOT / "hooks" / "pretool.sh"

            # First: non-compliant Write.
            r1 = subprocess.run(
                [str(pretool)],
                env=env,
                input=json.dumps({
                    "tool_name": "Write",
                    "tool_input": {
                        "file_path": "migrations/0002_add_intensity.sql",
                        "content": "ALTER TABLE users ADD COLUMN intensity TEXT;",
                    },
                    "session_id": "demo-retry",
                }),
                capture_output=True,
                text=True,
            )
            self.assertEqual(r1.returncode, 2)
            self.assertIn("migration-write-without-backfill-note", r1.stderr)

            # Second: compliant Write (agent added backfill note).
            r2 = subprocess.run(
                [str(pretool)],
                env=env,
                input=json.dumps({
                    "tool_name": "Write",
                    "tool_input": {
                        "file_path": "migrations/0002_add_intensity.sql",
                        "content": (
                            "-- backfill: existing rows default to 'standard'\n"
                            "ALTER TABLE users ADD COLUMN intensity TEXT NOT NULL DEFAULT 'standard';\n"
                        ),
                    },
                    "session_id": "demo-retry",
                }),
                capture_output=True,
                text=True,
            )
            self.assertEqual(r2.returncode, 0, f"compliant Write must pass: {r2.stderr}")

            # Acceptance log: 1 fire + 1 suppressed_compliant, both with the
            # same session_id and trigger id.
            entries = self._read_log(repo)
            self.assertEqual(len(entries), 2, f"log should have 2 entries: {entries}")
            kinds = [e["event_type"] for e in entries]
            self.assertEqual(sorted(kinds), ["fire", "suppressed_compliant"])
            for entry in entries:
                self.assertEqual(entry["trigger_id"], "convention.migration-write-without-backfill-note")
                self.assertEqual(entry["session_id"], "demo-retry")
                self.assertEqual(entry["schema_version"], "log.v1")


if __name__ == "__main__":
    unittest.main()
