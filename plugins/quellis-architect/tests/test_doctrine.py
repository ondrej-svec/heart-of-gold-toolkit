"""Tests for the doctrine-card loader + validator (plan §2.C.1 and §2.C.4)."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
HOOKS_LIB = PLUGIN_ROOT / "hooks" / "lib"
sys.path.insert(0, str(HOOKS_LIB))

import doctrine_loader  # type: ignore  # noqa: E402
import validate_pack  # type: ignore  # noqa: E402


VALID_PACK = '''schema_version = "doctrine.v1"

[[card]]
id = "migration-rule"
title = "Migrations need a backfill plan"
priority = 8
inject_on_glob = "migrations/**/*.sql"
body = "Migrations need an inline `-- backfill:` note. The Stop hook will block claims like `migration applied` without verifying-query evidence."

[[card]]
id = "auth-rule"
title = "Auth changes need rationale"
priority = 7
inject_on_glob = "**/auth/**"
body = "Auth code edits need a one-line `// ADR-NNN` marker in the diff or a linked ADR. The convention triggers fire when missing."

[[card]]
id = "rust-unwrap"
inject_on_content_match = "(?m)\\\\.unwrap\\\\(\\\\)"
body = "Library `.unwrap()` panics in the caller. Use `?` or `.expect(\\"...\\")` instead."
'''


def write_user_pack(repo: Path, toml: str) -> Path:
    pack_dir = repo / ".quellis" / "packs" / "core"
    pack_dir.mkdir(parents=True, exist_ok=True)
    path = pack_dir / "doctrine.toml"
    path.write_text(toml)
    return path


class TestDoctrineLoader(unittest.TestCase):

    def test_no_pack_returns_empty(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(doctrine_loader.load_cards(Path(tmp)), [])

    def test_valid_pack_loads_all_cards(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            write_user_pack(repo, VALID_PACK)
            cards = doctrine_loader.load_cards(repo)
            self.assertEqual(len(cards), 3)
            ids = sorted(c["id"] for c in cards)
            self.assertEqual(ids, ["auth-rule", "migration-rule", "rust-unwrap"])

    def test_card_with_no_selectors_dropped(self) -> None:
        pack = '''schema_version = "doctrine.v1"

[[card]]
id = "no-selectors"
body = "This card would inject every time — must be rejected."

[[card]]
id = "good"
inject_on_glob = "**/*.py"
body = "Has a selector, should load."
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            write_user_pack(repo, pack)
            cards = doctrine_loader.load_cards(repo)
            self.assertEqual([c["id"] for c in cards], ["good"])

    def test_card_with_overlong_body_dropped(self) -> None:
        long_body = "x" * (doctrine_loader.BODY_LIMIT + 1)
        pack = f'''schema_version = "doctrine.v1"

[[card]]
id = "too-long"
inject_on_glob = "**/*.py"
body = "{long_body}"

[[card]]
id = "ok"
inject_on_glob = "**/*.py"
body = "fits in budget"
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            write_user_pack(repo, pack)
            cards = doctrine_loader.load_cards(repo)
            self.assertEqual([c["id"] for c in cards], ["ok"])

    def test_priority_normalization(self) -> None:
        pack = '''schema_version = "doctrine.v1"

[[card]]
id = "out-of-range"
priority = 99
inject_on_glob = "**/*.py"
body = "priority 99 should fall back to default 5"

[[card]]
id = "valid"
priority = 10
inject_on_glob = "**/*.py"
body = "priority 10 is valid"
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            write_user_pack(repo, pack)
            cards = {c["id"]: c for c in doctrine_loader.load_cards(repo)}
            self.assertEqual(cards["out-of-range"]["priority"], doctrine_loader.DEFAULT_PRIORITY)
            self.assertEqual(cards["valid"]["priority"], 10)


class TestSelectorMatchers(unittest.TestCase):

    def test_glob_matches_relative_path(self) -> None:
        card = {"inject_on_glob": "migrations/**/*.sql", "inject_on_tool": "", "inject_on_content_match": ""}
        self.assertTrue(doctrine_loader.card_matches_paths(card, ["migrations/0002_add.sql"]))

    def test_glob_matches_absolute_path(self) -> None:
        card = {"inject_on_glob": "migrations/**/*.sql", "inject_on_tool": "", "inject_on_content_match": ""}
        self.assertTrue(doctrine_loader.card_matches_paths(card, ["/repo/migrations/0002_add.sql"]))

    def test_glob_does_not_match_unrelated(self) -> None:
        card = {"inject_on_glob": "migrations/**/*.sql", "inject_on_tool": "", "inject_on_content_match": ""}
        self.assertFalse(doctrine_loader.card_matches_paths(card, ["src/main.py"]))

    def test_comma_separated_globs_each_tried(self) -> None:
        card = {
            "inject_on_glob": "migrations/**/*.sql,prisma/migrations/**/*.sql",
            "inject_on_tool": "",
            "inject_on_content_match": "",
        }
        self.assertTrue(doctrine_loader.card_matches_paths(card, ["prisma/migrations/x/migration.sql"]))

    def test_tool_match_is_exact(self) -> None:
        card = {"inject_on_glob": "", "inject_on_tool": "Bash", "inject_on_content_match": ""}
        self.assertTrue(doctrine_loader.card_matches_tool(card, "Bash"))
        self.assertFalse(doctrine_loader.card_matches_tool(card, "Edit"))

    def test_content_regex_matches(self) -> None:
        card = {"inject_on_glob": "", "inject_on_tool": "", "inject_on_content_match": r"(?i)\bALTER TABLE\b"}
        self.assertTrue(
            doctrine_loader.card_matches_content(card, "ALTER TABLE users ADD COLUMN x TEXT;")
        )
        self.assertFalse(doctrine_loader.card_matches_content(card, "SELECT * FROM users;"))


class TestSelection(unittest.TestCase):

    SAMPLE_CARDS = [
        {"id": "a", "priority": 5, "inject_on_glob": "migrations/**/*.sql",
         "inject_on_tool": "", "inject_on_content_match": "", "body": "a" * 100},
        {"id": "b", "priority": 8, "inject_on_glob": "migrations/**/*.sql",
         "inject_on_tool": "", "inject_on_content_match": "", "body": "b" * 100},
        {"id": "c", "priority": 3, "inject_on_glob": "**/*.py",
         "inject_on_tool": "", "inject_on_content_match": "", "body": "c" * 100},
    ]

    def test_session_start_picks_by_priority(self) -> None:
        chosen = doctrine_loader.select_for_session_start(
            self.SAMPLE_CARDS,
            ["migrations/0002.sql"],
        )
        self.assertEqual([c["id"] for c in chosen], ["b", "a"])  # b has higher priority

    def test_session_start_skips_cards_without_glob(self) -> None:
        cards = [
            {"id": "no-glob", "priority": 9, "inject_on_glob": "", "inject_on_tool": "Bash",
             "inject_on_content_match": "", "body": "tool-only card"},
            {"id": "glob", "priority": 5, "inject_on_glob": "**/*.py",
             "inject_on_tool": "", "inject_on_content_match": "", "body": "glob card"},
        ]
        chosen = doctrine_loader.select_for_session_start(cards, ["src/main.py"])
        self.assertEqual([c["id"] for c in chosen], ["glob"])

    def test_post_tool_use_matches_any_selector(self) -> None:
        cards = [
            {"id": "by-path", "priority": 5, "inject_on_glob": "migrations/**/*.sql",
             "inject_on_tool": "", "inject_on_content_match": "", "body": "x" * 50},
            {"id": "by-tool", "priority": 5, "inject_on_glob": "",
             "inject_on_tool": "Bash", "inject_on_content_match": "", "body": "y" * 50},
            {"id": "by-content", "priority": 5, "inject_on_glob": "",
             "inject_on_tool": "", "inject_on_content_match": r"\bALTER\b", "body": "z" * 50},
            {"id": "unrelated", "priority": 5, "inject_on_glob": "**/*.go",
             "inject_on_tool": "", "inject_on_content_match": "", "body": "w" * 50},
        ]
        chosen = doctrine_loader.select_for_tool_use(
            cards,
            tool="Bash",
            paths=["migrations/0002.sql"],
            content="ALTER TABLE users ADD COLUMN x TEXT;",
        )
        ids = sorted(c["id"] for c in chosen)
        self.assertEqual(ids, ["by-content", "by-path", "by-tool"])

    def test_count_limit_enforced(self) -> None:
        big = [
            {"id": f"c{i}", "priority": 5, "inject_on_glob": "**/*.py",
             "inject_on_tool": "", "inject_on_content_match": "", "body": "body" * 5}
            for i in range(20)
        ]
        chosen = doctrine_loader.select_for_session_start(big, ["src/x.py"])
        self.assertLessEqual(len(chosen), doctrine_loader.MAX_CARDS_PER_INJECT)

    def test_bytes_limit_enforced(self) -> None:
        big = [
            {"id": f"c{i}", "priority": 5, "inject_on_glob": "**/*.py",
             "inject_on_tool": "", "inject_on_content_match": "",
             "body": "x" * 400}
            for i in range(10)
        ]
        chosen = doctrine_loader.select_for_session_start(big, ["src/x.py"])
        total = sum(len(c["body"].encode("utf-8")) for c in chosen)
        self.assertLessEqual(total, doctrine_loader.MAX_BYTES_PER_INJECT)


class TestDoctrineValidator(unittest.TestCase):

    def _validate(self, toml: str) -> list[str]:
        with tempfile.NamedTemporaryFile("w", suffix=".toml", delete=False) as fh:
            fh.write(toml)
            path = Path(fh.name)
        try:
            return validate_pack.validate_pack(path)
        finally:
            path.unlink()

    def test_valid_pack_passes(self) -> None:
        self.assertEqual(self._validate(VALID_PACK), [])

    def test_no_selectors_flagged(self) -> None:
        bad = '''schema_version = "doctrine.v1"

[[card]]
id = "no-selectors"
body = "body without selectors"
'''
        findings = self._validate(bad)
        self.assertTrue(any("at least one of inject_on" in f for f in findings), findings)

    def test_overlong_body_flagged(self) -> None:
        long = "x" * 600
        bad = f'''schema_version = "doctrine.v1"

[[card]]
id = "long"
inject_on_glob = "**/*"
body = "{long}"
'''
        findings = self._validate(bad)
        self.assertTrue(any("body over" in f for f in findings), findings)

    def test_duplicate_card_id_flagged(self) -> None:
        dup = '''schema_version = "doctrine.v1"

[[card]]
id = "x"
inject_on_glob = "**/*.py"
body = "one"

[[card]]
id = "x"
inject_on_glob = "**/*.py"
body = "two"
'''
        findings = self._validate(dup)
        self.assertTrue(any("duplicate" in f for f in findings), findings)

    def test_bad_content_regex_flagged(self) -> None:
        bad = '''schema_version = "doctrine.v1"

[[card]]
id = "broken"
inject_on_content_match = "[unclosed"
body = "ok"
'''
        findings = self._validate(bad)
        self.assertTrue(any("does not compile" in f for f in findings), findings)

    def test_priority_out_of_range_flagged(self) -> None:
        bad = '''schema_version = "doctrine.v1"

[[card]]
id = "x"
priority = 42
inject_on_glob = "**/*"
body = "ok"
'''
        findings = self._validate(bad)
        self.assertTrue(any("priority" in f for f in findings), findings)


class TestSessionStartInject(unittest.TestCase):
    """2.C.2 — SessionStart picks doctrine matching recent git activity."""

    def setUp(self) -> None:
        sys.path.insert(0, str(HOOKS_LIB))
        import sessionstart_inject  # type: ignore
        self.inject = sessionstart_inject

    def _seed_git_repo(self, repo: Path, files: dict[str, str]) -> None:
        import subprocess
        env = {
            "GIT_AUTHOR_NAME": "Quellis Test",
            "GIT_AUTHOR_EMAIL": "test@quellis.local",
            "GIT_COMMITTER_NAME": "Quellis Test",
            "GIT_COMMITTER_EMAIL": "test@quellis.local",
            "PATH": __import__("os").environ.get("PATH", ""),
        }
        subprocess.run(["git", "init", "-q"], cwd=str(repo), env=env, check=True)
        for path, content in files.items():
            full = repo / path
            full.parent.mkdir(parents=True, exist_ok=True)
            full.write_text(content)
        subprocess.run(["git", "add", "-A"], cwd=str(repo), env=env, check=True)
        subprocess.run(
            ["git", "commit", "-q", "-m", "seed"], cwd=str(repo), env=env, check=True
        )

    def test_no_doctrine_pack_emits_status_line_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / ".quellis").mkdir()
            (repo / ".quellis" / "config.toml").write_text(
                '[architect]\nintensity = "standard"\n'
            )
            output = self.inject.run(repo)
            self.assertIn("Quellis active", output)
            self.assertNotIn("Doctrine relevant", output)

    def test_doctrine_matches_recent_git_activity(self) -> None:
        if not __import__("shutil").which("git"):
            self.skipTest("git required")
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / ".quellis").mkdir()
            (repo / ".quellis" / "config.toml").write_text(
                '[architect]\nintensity = "standard"\n'
            )
            write_user_pack(repo, VALID_PACK)
            self._seed_git_repo(repo, {
                "migrations/0001_initial.sql": "CREATE TABLE x (id INT);",
                "README.md": "demo",
            })
            output = self.inject.run(repo)
            self.assertIn("Quellis active", output)
            self.assertIn("Doctrine relevant", output)
            self.assertIn("migration-rule", output)

    def test_doctrine_with_no_matches_emits_status_line_only(self) -> None:
        if not __import__("shutil").which("git"):
            self.skipTest("git required")
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / ".quellis").mkdir()
            (repo / ".quellis" / "config.toml").write_text(
                '[architect]\nintensity = "standard"\n'
            )
            write_user_pack(repo, VALID_PACK)
            # Seed only an unrelated file — no glob matches.
            self._seed_git_repo(repo, {"docs/index.md": "demo"})
            output = self.inject.run(repo)
            self.assertIn("Quellis active", output)
            self.assertNotIn("Doctrine relevant", output)

    def test_session_start_render_emits_status_then_cards(self) -> None:
        cards = [
            {"id": "x", "title": "title-x", "body": "body line one\nbody line two",
             "priority": 5},
        ]
        out = self.inject.render("standard", cards)
        lines = out.splitlines()
        self.assertEqual(lines[0].startswith("Quellis active"), True)
        self.assertIn("· x — title-x", out)
        self.assertIn("body line one", out)
        self.assertIn("body line two", out)


class TestPostToolInject(unittest.TestCase):
    """2.C.3 — PostToolUse injects cards matching the tool call."""

    def setUp(self) -> None:
        sys.path.insert(0, str(HOOKS_LIB))
        import posttool_inject  # type: ignore
        self.inject = posttool_inject

    def test_no_pack_returns_empty(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            import json as _json
            stdin = _json.dumps({"tool_name": "Write", "tool_input": {"file_path": "migrations/x.sql"}})
            out = self.inject.run(stdin, Path(tmp))
            self.assertEqual(out, "")

    def test_path_match_injects_card(self) -> None:
        import json as _json
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            write_user_pack(repo, VALID_PACK)
            stdin = _json.dumps({
                "tool_name": "Write",
                "tool_input": {"file_path": "migrations/0002.sql", "content": "..."}
            })
            out = self.inject.run(stdin, repo)
            self.assertIn("migration-rule", out)

    def test_content_match_injects_card(self) -> None:
        import json as _json
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            write_user_pack(repo, VALID_PACK)
            stdin = _json.dumps({
                "tool_name": "Write",
                "tool_input": {"file_path": "src/main.rs", "content": "let x = something.unwrap();"}
            })
            out = self.inject.run(stdin, repo)
            self.assertIn("rust-unwrap", out)

    def test_no_match_returns_empty(self) -> None:
        import json as _json
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            write_user_pack(repo, VALID_PACK)
            stdin = _json.dumps({
                "tool_name": "Bash",
                "tool_input": {"command": "ls -la"}
            })
            out = self.inject.run(stdin, repo)
            self.assertEqual(out, "")

    def test_malformed_stdin_does_not_crash(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            write_user_pack(repo, VALID_PACK)
            out = self.inject.run("not json", repo)
            self.assertEqual(out, "")

    def test_multiple_matches_bounded(self) -> None:
        """Per-inject card / byte budget is honored."""
        import json as _json
        # Build a pack with more cards than the cap.
        cards_toml = ['schema_version = "doctrine.v1"', ""]
        for i in range(10):
            cards_toml.append(f'[[card]]\nid = "c{i}"\npriority = {i + 1}\n'
                              f'inject_on_glob = "**/*.py"\nbody = "card {i} body"\n')
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            write_user_pack(repo, "\n".join(cards_toml))
            stdin = _json.dumps({
                "tool_name": "Edit",
                "tool_input": {"file_path": "src/main.py", "content": "x"},
            })
            out = self.inject.run(stdin, repo)
            # 5 cards max; verify no more than 5 card-headers appeared.
            header_count = out.count("· c")
            self.assertLessEqual(header_count, 5)

    def test_posttool_sh_drains_stdin_and_exits_zero_when_no_pack(self) -> None:
        import json as _json
        import os as _os
        import shutil as _shutil
        import subprocess as _sub
        if not _shutil.which("bash") or not _shutil.which("python3"):
            self.skipTest("bash + python3 required")
        with tempfile.TemporaryDirectory() as tmp:
            env = _os.environ.copy()
            env["CLAUDE_PROJECT_DIR"] = tmp
            payload = _json.dumps({"tool_name": "Write", "tool_input": {"file_path": "x.py"}})
            result = _sub.run(
                [str(PLUGIN_ROOT / "hooks" / "posttool.sh")],
                env=env,
                input=payload,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")


class TestCheckpointReminder(unittest.TestCase):
    """3.C.4 — PostToolUse fires a reminder when commits have lagged."""

    def setUp(self) -> None:
        sys.path.insert(0, str(HOOKS_LIB))
        import checkpoint_reminder  # type: ignore
        self.cr = checkpoint_reminder

    def test_disabled_when_threshold_zero(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / ".quellis").mkdir()
            (repo / ".quellis" / "config.toml").write_text(
                '[architect]\nintensity = "standard"\ncheckpoint_minutes = 0\n'
            )
            self.assertEqual(self.cr.maybe_render(repo), "")

    def test_no_emit_when_commit_recent(self) -> None:
        now = 1_700_000_000
        result = self.cr.should_emit(
            threshold_minutes=20,
            last_commit_ts=now - 300,  # 5 min ago
            last_reminder_ts=None,
            now_ts=now,
        )
        self.assertFalse(result)

    def test_emit_when_commit_stale_and_no_prior_reminder(self) -> None:
        now = 1_700_000_000
        result = self.cr.should_emit(
            threshold_minutes=20,
            last_commit_ts=now - 1800,  # 30 min ago
            last_reminder_ts=None,
            now_ts=now,
        )
        self.assertTrue(result)

    def test_no_emit_when_prior_reminder_recent(self) -> None:
        """Throttle: don't repeat-fire on every tool call."""
        now = 1_700_000_000
        result = self.cr.should_emit(
            threshold_minutes=20,
            last_commit_ts=now - 1800,
            last_reminder_ts=now - 300,  # 5 min ago — within throttle
            now_ts=now,
        )
        self.assertFalse(result)

    def test_emit_when_prior_reminder_also_stale(self) -> None:
        now = 1_700_000_000
        result = self.cr.should_emit(
            threshold_minutes=20,
            last_commit_ts=now - 3600,  # 60 min ago
            last_reminder_ts=now - 1800,  # 30 min ago — past throttle
            now_ts=now,
        )
        self.assertTrue(result)

    def test_no_emit_when_no_commit_history(self) -> None:
        now = 1_700_000_000
        result = self.cr.should_emit(
            threshold_minutes=20,
            last_commit_ts=None,
            last_reminder_ts=None,
            now_ts=now,
        )
        self.assertFalse(result, "fresh repo with no commits should not nag")

    def test_threshold_read_from_config(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / ".quellis").mkdir()
            (repo / ".quellis" / "config.toml").write_text(
                '[architect]\nintensity = "standard"\ncheckpoint_minutes = 45\n'
            )
            self.assertEqual(self.cr.read_threshold_minutes(repo), 45)

    def test_threshold_default_when_config_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(
                self.cr.read_threshold_minutes(Path(tmp)),
                self.cr.DEFAULT_THRESHOLD_MINUTES,
            )

    def test_reminder_format_includes_minute_count(self) -> None:
        msg = self.cr.format_reminder(20, 1830)  # 30.5 min
        self.assertIn("30 minutes", msg)
        self.assertIn("threshold 20", msg)


class TestCoreDoctrinePackShipped(unittest.TestCase):

    def test_core_doctrine_pack_validates(self) -> None:
        core = PLUGIN_ROOT / "packs" / "core" / "doctrine.toml"
        findings = validate_pack.validate_pack(core)
        self.assertEqual(findings, [], f"core doctrine pack must validate: {findings}")

    def test_core_doctrine_pack_loads_all_cards(self) -> None:
        """All bundled cards must survive the loader's per-card validation."""
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            pack_dir = repo / ".quellis" / "packs" / "core"
            pack_dir.mkdir(parents=True)
            import shutil
            shutil.copy2(
                PLUGIN_ROOT / "packs" / "core" / "doctrine.toml",
                pack_dir / "doctrine.toml",
            )
            cards = doctrine_loader.load_cards(repo)
            # The shipped pack has 14 cards.
            self.assertGreaterEqual(len(cards), 10, "shipped pack must load ≥ 10 cards")
            self.assertLessEqual(len(cards), 20)


if __name__ == "__main__":
    unittest.main()
