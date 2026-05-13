#!/usr/bin/env python3
"""Evidence-search helper (plan 2026-05-13, task 1.E.2).

Walks a Claude Code session transcript (JSONL) and reports whether evidence
of a named kind is present. Used by `stop_match.py` to narrow false
positives: a claim like "tests pass" only blocks if the transcript shows no
matching test invocation.

This module is pure stdlib. It reads JSONL line-by-line, never loading the
whole transcript into memory — sessions can be tens of MB.

The schema audit (`docs/decisions/2026-05-13-quellis-v2-jsonl-schema-audit.md`)
documents the event types this walker reads:
  - `assistant` events with `message.content[*].type == "tool_use"` (the agent's
    tool calls — where `cargo test`, `pytest`, `gitleaks`, etc. show up)
  - `user` events with `message.content[*].type == "tool_result"` (the output)
  - `system` subtype `local_command` (slash commands the user ran)
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterable

# ─── Evidence kinds ──────────────────────────────────────────────────────────

# Each kind maps to a set of patterns and tool names that count as evidence.
# Patterns match the rendered command/content; tools match the tool_use.name.
EVIDENCE_KINDS: dict[str, dict] = {
    "test-run": {
        "tools": {"Bash"},
        # Commands that look like a test invocation. Order: most precise first.
        "command_patterns": [
            r"\bcargo test\b",
            r"\bcargo nextest\b",
            r"\bnpm (?:run )?test\b",
            r"\byarn (?:run )?test\b",
            r"\bpnpm (?:run )?test\b",
            r"\bbun test\b",
            r"\bpytest\b",
            r"\bpython -m pytest\b",
            r"\bpython -m unittest\b",
            r"\bgo test\b",
            r"\brake test\b",
            r"\brspec\b",
            r"\bmix test\b",
            r"\bphpunit\b",
            r"\bjest\b",
            r"\bvitest\b",
        ],
        # If a tool_result for one of the above shows obvious failure shape,
        # we still count it as evidence (failures are still test runs). The
        # claim verifier elsewhere can distinguish "tests run + passed"
        # from "tests run + failed" via the assistant's own follow-up.
    },
    "verification-query": {
        "tools": {"Bash"},
        "command_patterns": [
            r"\binformation_schema\b",
            r"\bSELECT .* FROM .* WHERE .*\b",  # broad; over-fires okay
            r"\b\\d \w+",  # psql \d describe
            r"\bEXPLAIN\b",
            r"\bDESCRIBE\b",
        ],
    },
    "scan-output": {
        "tools": {"Bash"},
        "command_patterns": [
            r"\bgitleaks\b",
            r"\btrufflehog\b",
            r"\bdetect-secrets\b",
            r"\bgrep -r\b",
            r"\brg --files-with-matches\b",
            r"\brg -l\b",
        ],
    },
    "diff-confirmation": {
        "tools": {"Bash", "Read"},
        "command_patterns": [
            r"\bgit diff\b",
            r"\bgit show\b",
            r"\bgit log\b.*--patch",
        ],
    },
}


# ─── Reader ──────────────────────────────────────────────────────────────────


def iter_transcript_events(transcript_path: Path) -> Iterable[dict]:
    """Yield parsed events from a session JSONL, skipping malformed lines."""
    if not transcript_path.is_file():
        return
    try:
        with transcript_path.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue
    except OSError:
        return


def has_evidence(
    transcript_path: Path,
    kind: str,
    *,
    tail_events: int = 2000,
) -> bool:
    """Return True if the named evidence kind appears in the transcript.

    `tail_events` caps how far back we look. Most claim-bearing turns are
    within the last 50 events; 2000 is generous slack. Reading more events
    is cheap but unnecessary, and bounding the walk keeps the hook fast.
    """
    if kind not in EVIDENCE_KINDS:
        # Unknown kind: conservative — assume evidence is present, do not block.
        # The validator should have caught this already.
        return True

    spec = EVIDENCE_KINDS[kind]
    tool_filter = spec.get("tools") or set()
    patterns = [re.compile(p, re.IGNORECASE) for p in spec.get("command_patterns", [])]

    # Buffer last `tail_events` then scan in reverse for early-exit.
    buffered: list[dict] = []
    for event in iter_transcript_events(transcript_path):
        buffered.append(event)
        if len(buffered) > tail_events:
            buffered.pop(0)

    for event in reversed(buffered):
        if event.get("type") != "assistant":
            continue
        message = event.get("message")
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") != "tool_use":
                continue
            tool_name = block.get("name") or ""
            if tool_filter and tool_name not in tool_filter:
                continue
            command = _stringify_tool_input(block.get("input"))
            if not command:
                continue
            if any(pattern.search(command) for pattern in patterns):
                return True
    return False


def _stringify_tool_input(tool_input) -> str:
    if isinstance(tool_input, str):
        return tool_input
    if isinstance(tool_input, dict):
        # The keys that carry command-shaped strings for our purposes.
        parts: list[str] = []
        for key in ("command", "file_path", "path", "pattern"):
            value = tool_input.get(key)
            if isinstance(value, str):
                parts.append(value)
        return "\n".join(parts)
    return ""


# ─── CLI form (for testing + debugging) ──────────────────────────────────────


def main() -> int:
    import sys
    if len(sys.argv) != 3:
        print("usage: evidence_search.py KIND TRANSCRIPT_PATH", file=sys.stderr)
        return 64
    kind, path = sys.argv[1], Path(sys.argv[2])
    if has_evidence(path, kind):
        print(f"{kind}: present")
        return 0
    print(f"{kind}: not found")
    return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
