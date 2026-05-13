#!/usr/bin/env python3
"""Acceptance log writer (plan 2026-05-13, task 2.D.3).

Appends one `log.v1` JSON line per hook fire (or compliant suppression)
to `.quellis/acceptance-log.jsonl` in the user's repo. V1.2 personalization
reads this file to compound user accept/dismiss patterns.

Schema (per `docs/coordination.md`):

    {
      "schema_version": "log.v1",
      "timestamp":      "2026-05-13T18:44:12.301Z",
      "hook":           "PreToolUse" | "Stop",
      "trigger_id":     "convention.migration-write-without-backfill-note",
      "tool":           "Write",            -- PreToolUse only
      "match_text":     "(redacted)",
      "event_type":     "fire" | "suppressed_compliant",
      "session_id":     "<claude-code-session-uuid>",
      "git_branch":     "<branch-at-fire-time>",
      "user_response":  "unknown"           -- V1.2 personalizer infers
    }

Pure stdlib. Append-only (`open(..., "a")`). POSIX lines under 4 KB are
atomic on macOS/Linux, which is enough to keep concurrent appends from
two Claude Code sessions safe without locks. Failures are swallowed —
the bias is *never break the host session*.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path


LOG_PATH = ".quellis/acceptance-log.jsonl"
SCHEMA_VERSION = "log.v1"
MAX_MATCH_TEXT = 400  # chars; redacted text capped to keep lines small
MAX_LINE_BYTES = 3500  # well under POSIX PIPE_BUF for atomic appends


# ─── Redaction ───────────────────────────────────────────────────────────────

# Patterns that look like secrets get scrubbed before the line lands on disk.
# This is intentionally crude — the goal is "no obvious tokens leak into a
# git-trackable log," not bulletproof DLP. The CLI's redaction.rs handles
# the heavyweight cases at `quellis personalize` time.
_REDACTION_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    # KEY=value style env assignments (env files, export lines, etc.)
    (re.compile(r"((?:[A-Z][A-Z0-9_]{2,})=)[^\s'\"]+", re.MULTILINE), r"\1<redacted>"),
    # Bearer tokens / Authorization headers
    (re.compile(r"(Bearer\s+)[A-Za-z0-9._\-]{8,}", re.IGNORECASE), r"\1<redacted>"),
    # Common token prefixes (sk-, pk-, ghp_, ghs_, github_pat_, etc.)
    (
        re.compile(
            r"\b(?:sk|pk|ghp|ghs|gho|github_pat)[_-][A-Za-z0-9_\-]{16,}",
            re.IGNORECASE,
        ),
        "<redacted>",
    ),
    # AWS access key id shape
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "<redacted>"),
    # JWT-shaped strings (three base64url segments separated by dots)
    (
        re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b"),
        "<redacted>",
    ),
)


def redact(text: str) -> str:
    if not isinstance(text, str) or not text:
        return ""
    out = text
    for pattern, repl in _REDACTION_PATTERNS:
        out = pattern.sub(repl, out)
    if len(out) > MAX_MATCH_TEXT:
        out = out[: MAX_MATCH_TEXT - 1] + "…"
    return out


# ─── Git branch sniff ────────────────────────────────────────────────────────


def _git_branch(repo_root: Path) -> str:
    """Best-effort branch read. Returns empty string on any failure."""
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    if result.returncode != 0:
        return ""
    branch = result.stdout.strip()
    if branch == "HEAD":
        return ""  # detached head
    return branch


# ─── Append ──────────────────────────────────────────────────────────────────


def append_event(repo_root: Path, event: dict) -> bool:
    """Append a single log event. Returns True on success, False on failure.

    Caller passes the partial event from `pretool_match.run()` /
    `stop_match.run()`. This function fills in the universal fields
    (schema_version, timestamp, git_branch, user_response, redacted
    match_text) and writes the line.
    """
    try:
        path = repo_root / LOG_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        line = build_line(event, repo_root)
        if len(line.encode("utf-8")) > MAX_LINE_BYTES:
            # Truncate match_text further if the line is suspiciously large.
            shrunken = dict(event)
            mt = shrunken.get("match_text") or ""
            if isinstance(mt, str) and mt:
                shrunken["match_text"] = mt[: MAX_MATCH_TEXT // 4] + "…"
            line = build_line(shrunken, repo_root)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
        return True
    except OSError:
        return False


def build_line(event: dict, repo_root: Path) -> str:
    """Compose the JSON line that will be appended. Public for tests."""
    record: dict = {
        "schema_version": SCHEMA_VERSION,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")[:-4]
        + "Z",
        "hook": event.get("hook", ""),
        "trigger_id": event.get("trigger_id", "unknown"),
        "event_type": event.get("event_type", "fire"),
        "match_text": redact(event.get("match_text", "") or ""),
        "session_id": event.get("session_id", "") or "",
        "git_branch": _git_branch(repo_root),
        "user_response": event.get("user_response", "unknown"),
    }
    if event.get("tool"):
        record["tool"] = event["tool"]
    return json.dumps(record, sort_keys=True)


def main() -> int:  # pragma: no cover — tiny CLI for manual tail-checks
    import sys

    if len(sys.argv) != 2:
        print("usage: acceptance_log.py REPO_ROOT", file=sys.stderr)
        return 64
    repo_root = Path(sys.argv[1])
    path = repo_root / LOG_PATH
    if not path.is_file():
        print(f"{path}: empty / not created yet", file=sys.stderr)
        return 0
    print(path.read_text(encoding="utf-8"), end="")
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
