#!/usr/bin/env python3
"""Checkpoint reminder (plan 2026-05-13, task 3.C.4).

When PostToolUse fires and more than N minutes have elapsed since the
last git commit, emit a single short reminder line. Throttle so the
reminder fires at most once per N-minute interval.

Config (in `.quellis/config.toml`):

    [architect]
    checkpoint_minutes = 20      # default

Setting `checkpoint_minutes = 0` disables the reminder entirely.

Pure stdlib. State persists in `.quellis/state/last-checkpoint-reminder`
(a single Unix timestamp). Failures are silent — the reminder is a
helpful nudge, not a gate.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pretool_match import _load_toml  # type: ignore  # noqa: E402


DEFAULT_THRESHOLD_MINUTES = 20
STATE_REL = ".quellis/state/last-checkpoint-reminder"
GIT_TIMEOUT_SECS = 2


def read_threshold_minutes(repo_root: Path) -> int:
    """Read `architect.checkpoint_minutes` from .quellis/config.toml.

    Returns the default when absent or malformed. Returns 0 when the
    value is explicitly 0 — that disables the reminder.
    """
    config = repo_root / ".quellis" / "config.toml"
    if not config.is_file():
        return DEFAULT_THRESHOLD_MINUTES
    try:
        data = _load_toml(config)
    except (OSError, ValueError):
        return DEFAULT_THRESHOLD_MINUTES
    architect = data.get("architect") or {}
    if not isinstance(architect, dict):
        return DEFAULT_THRESHOLD_MINUTES
    value = architect.get("checkpoint_minutes", DEFAULT_THRESHOLD_MINUTES)
    if isinstance(value, int) and value >= 0:
        return value
    return DEFAULT_THRESHOLD_MINUTES


def last_commit_unix_time(repo_root: Path) -> int | None:
    """Best-effort timestamp of the last commit on HEAD. None on failure."""
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), "log", "-1", "--format=%ct"],
            capture_output=True,
            text=True,
            timeout=GIT_TIMEOUT_SECS,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    try:
        return int(result.stdout.strip())
    except ValueError:
        return None


def last_reminder_unix_time(repo_root: Path) -> int | None:
    path = repo_root / STATE_REL
    if not path.is_file():
        return None
    try:
        return int(path.read_text().strip())
    except (OSError, ValueError):
        return None


def write_last_reminder(repo_root: Path, ts: int) -> None:
    path = repo_root / STATE_REL
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(str(ts))
    except OSError:
        pass  # state write best-effort; never break the hook


def should_emit(
    *,
    threshold_minutes: int,
    last_commit_ts: int | None,
    last_reminder_ts: int | None,
    now_ts: int,
) -> bool:
    """Decide whether the reminder should fire on this PostToolUse.

    Rules:
      - Threshold of 0 disables.
      - No git history → no reminder (fresh repo).
      - Time since last commit must exceed the threshold.
      - Throttle: previous reminder must be older than threshold too —
        otherwise we'd repeat-fire on every subsequent tool call.
    """
    if threshold_minutes <= 0:
        return False
    if last_commit_ts is None:
        return False
    threshold_secs = threshold_minutes * 60
    if (now_ts - last_commit_ts) < threshold_secs:
        return False
    if last_reminder_ts is not None and (now_ts - last_reminder_ts) < threshold_secs:
        return False
    return True


def format_reminder(threshold_minutes: int, seconds_since_commit: int) -> str:
    minutes_since = max(1, seconds_since_commit // 60)
    return (
        f"Checkpoint reminder — {minutes_since} minutes since the last commit "
        f"(threshold {threshold_minutes}). Consider committing your progress."
    )


def maybe_render(repo_root: Path, *, now_ts: int | None = None) -> str:
    """Return the reminder text to inject, or empty string when none."""
    threshold = read_threshold_minutes(repo_root)
    if threshold <= 0:
        return ""
    now = now_ts if now_ts is not None else int(time.time())
    last_commit = last_commit_unix_time(repo_root)
    last_reminder = last_reminder_unix_time(repo_root)
    if not should_emit(
        threshold_minutes=threshold,
        last_commit_ts=last_commit,
        last_reminder_ts=last_reminder,
        now_ts=now,
    ):
        return ""
    write_last_reminder(repo_root, now)
    seconds = now - (last_commit or now)
    return format_reminder(threshold, seconds) + "\n"


def main() -> int:  # pragma: no cover — small CLI for manual checks
    repo_root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    out = maybe_render(repo_root)
    if out:
        sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
