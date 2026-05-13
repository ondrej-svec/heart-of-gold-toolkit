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
import shutil
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
            code, msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("git-reset-hard-unpushed", msg)

    def test_git_reset_hard_origin_also_fires(self) -> None:
        """Per the review: even reset to origin/<branch> blocks."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "git reset --hard origin/main"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_git_reset_soft_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "git reset HEAD~1"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)

    def test_env_write_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "/repo/.env"}})
            code, msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("env-file-write", msg)

    def test_env_production_write_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Write", "tool_input": {"file_path": "apps/web/.env.production"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_env_example_does_not_fire(self) -> None:
        """Negative lookahead exempts placeholders."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            for example in (".env.example", ".env.template", ".env.sample"):
                stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": example}})
                code, _msg = pretool_match.run(stdin, repo)
                self.assertEqual(code, 0, f"{example} should not fire")

    def test_npm_publish_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "npm publish"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_cargo_publish_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "cargo publish"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_npm_publish_dry_run_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Bash", "tool_input": {"command": "npm publish --dry-run"}})
            # The regex `\bpublish\b` matches "publish" before " --dry-run"
            # so this DOES fire. That's an intentional V1.0 false-positive
            # bias: better to block dry-runs and have the user override than
            # let `publish --dry-run` slip past via a bypass typo.
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)


class TestCorePackPretoolConventions(unittest.TestCase):
    """Four conventions. Each fires at standard intensity (the default)."""

    def test_auth_folder_edit_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "apps/web/src/auth/session.ts"}})
            code, msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("auth-without-rationale", msg)

    def test_clerk_folder_edit_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "clerk/middleware.ts"}})
            code, _msg = pretool_match.run(stdin, repo)
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
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2, "V1.0: tests/auth/* DOES fire — calibrate in 1.D.6")

    def test_migration_edit_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "migrations/2026_05_13_add_column.sql"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_prisma_migration_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Write", "tool_input": {"file_path": "prisma/migrations/20260513_x/migration.sql"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_scoring_folder_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"file_path": "apps/api/src/scoring/rank.ts"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_billing_folder_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"tool_name": "Write", "tool_input": {"file_path": "billing/stripe-webhook.ts"}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)

    def test_sql_unwrapped_interpolation_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            content = "const q = sql`SELECT * FROM users WHERE id = ${userId}`;"
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"content": content}})
            code, msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("sql-template-interpolation", msg)

    def test_sql_identifier_wrapper_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            content = "const q = sql`SELECT * FROM ${sql.identifier(tableName)}`;"
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"content": content}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0, "sql.identifier(...) is exempted")

    def test_sql_raw_wrapper_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            content = "const q = sql`${sql.raw(dynamicClause)}`;"
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"content": content}})
            code, _msg = pretool_match.run(stdin, repo)
            self.assertEqual(code, 0)

    def test_parameterized_sql_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            content = "const q = sql`SELECT * FROM users WHERE id = ?`;"
            stdin = json.dumps({"tool_name": "Edit", "tool_input": {"content": content}})
            code, _msg = pretool_match.run(stdin, repo)
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
            code, msg = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("completion-without-test-run", msg)

    def test_completion_claim_with_test_run_does_not_fire(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            transcript = self._write_transcript(repo, [
                {"type": "assistant", "message": {"content": [
                    {"type": "tool_use", "name": "Bash", "input": {"command": "cargo test --offline"}}
                ]}},
            ])
            stdin = json.dumps({"transcript_path": str(transcript), "message": "All tests passing. Done."})
            code, _msg = stop_match.run(stdin, repo)
            self.assertEqual(code, 0, "test-run evidence suppresses the block")

    def test_migration_applied_without_verification_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"message": "Migration applied successfully."})
            code, msg = stop_match.run(stdin, repo)
            self.assertEqual(code, 2)
            self.assertIn("migration-applied", msg)

    def test_secret_removed_claim_without_scan_fires(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_core_pack(Path(tmp))
            stdin = json.dumps({"message": "Secrets removed from the repo."})
            code, msg = stop_match.run(stdin, repo)
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
            code, _msg = stop_match.run(stdin, repo)
            self.assertEqual(code, 0, "gitleaks evidence suppresses the block")


if __name__ == "__main__":
    unittest.main()
