#!/usr/bin/env python3
"""PreToolUse trigger matcher (plan 2026-05-13, task 1.D.1).

Reads Claude Code's PreToolUse hook JSON from stdin and the trigger pack at
`.quellis/packs/core/pretool-triggers.toml` (or `.quellis/baselines/core/...`
during the v1→v2 directory rename window). Matches each trigger against the
tool call. On the first match, emits the trigger's `block_reason` to stderr
and exits 2 (Claude Code's "block this tool call" signal).

Trigger pack schema (validated by `validate_pretool_pack.py`):

    schema_version = "pretool.v1"

    [[trigger]]
    id           = "non-negotiable.git-force-push-main"
    type         = "non-negotiable"     # or "convention"
    match_tool   = "Bash"               # exact tool name
    match_regex  = "^git push (--force|-f) .*(main|master)\\b"
    block_reason = "Up to 200 chars. Lead with the concern in 8 words or fewer."

This script is pure stdlib. tomllib (Python 3.11+) is used when available; a
minimal regex fallback handles older Pythons (only the subset of TOML the
trigger pack uses).
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path


# ─── TOML loading with graceful fallback ─────────────────────────────────────

try:
    import tomllib as _toml  # Python 3.11+

    def _load_toml(path: Path) -> dict:
        with path.open("rb") as fh:
            return _toml.load(fh)

except ImportError:  # pragma: no cover — exercised only on Python < 3.11

    def _load_toml(path: Path) -> dict:
        return _parse_minimal_toml(path.read_text(encoding="utf-8"))


def _parse_minimal_toml(text: str) -> dict:
    """Parse the subset of TOML used by pretool-triggers.toml.

    Supports:
      - top-level scalars: `key = "string"`
      - [[trigger]] arrays of tables
      - inside-table dotted keys are NOT supported (use flat keys)
      - `# comment` lines
      - basic-string escapes: \\n, \\t, \\", \\\\

    Anything outside this subset raises ValueError. Real TOML quirks (nested
    tables, multiline strings, datetimes, arrays of non-tables) are out of
    scope for this fallback path; users on 3.11+ get full tomllib.
    """
    out: dict = {}
    triggers: list = []
    current: dict | None = None
    for raw_lineno, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line == "[[trigger]]":
            current = {}
            triggers.append(current)
            continue
        if line.startswith("["):
            raise ValueError(
                f"line {raw_lineno}: only [[trigger]] sections supported, got: {line!r}"
            )
        m = re.match(r'^([A-Za-z0-9_]+)\s*=\s*"((?:[^"\\]|\\.)*)"$', line)
        if not m:
            raise ValueError(f"line {raw_lineno}: cannot parse: {line!r}")
        key, value = m.group(1), _unescape(m.group(2))
        target = current if current is not None else out
        target[key] = value
    if triggers:
        out["trigger"] = triggers
    return out


def _unescape(value: str) -> str:
    return (
        value.replace("\\n", "\n")
        .replace("\\t", "\t")
        .replace('\\"', '"')
        .replace("\\\\", "\\")
    )


# ─── Trigger pack location ───────────────────────────────────────────────────

PACK_PATHS = (
    ".quellis/packs/core/pretool-triggers.toml",   # v2 spec
    ".quellis/baselines/core/pretool-triggers.toml",  # v1→v2 transitional
)


def locate_pack(repo_root: Path) -> Path | None:
    for rel in PACK_PATHS:
        candidate = repo_root / rel
        if candidate.is_file():
            return candidate
    return None


# ─── Matching ────────────────────────────────────────────────────────────────

BLOCK_REASON_LIMIT = 200  # chars; Subjective Contract


def match_triggers(
    pack: dict, tool: str, tool_input: dict, intensity: str
) -> tuple[dict, str] | None:
    """Return the first matching trigger and the input string it matched, or None."""
    raw_triggers = pack.get("trigger", []) or []
    if not isinstance(raw_triggers, list):
        return None
    for trigger in raw_triggers:
        if not _trigger_applies_to_intensity(trigger, intensity):
            continue
        if trigger.get("match_tool") and trigger["match_tool"] != tool:
            continue
        pattern = trigger.get("match_regex")
        if not pattern:
            continue
        matched_input = _stringify_for_match(tool_input)
        try:
            if re.search(pattern, matched_input):
                return trigger, matched_input
        except re.error:
            # Bad regex in pack — skip this trigger, do not break the session.
            continue
    return None


def _trigger_applies_to_intensity(trigger: dict, intensity: str) -> bool:
    """Non-negotiables always fire. Convention triggers honor intensity."""
    ttype = (trigger.get("type") or "non-negotiable").lower()
    if ttype == "non-negotiable":
        return True
    # Convention triggers fire at standard+ by default; chill suppresses them.
    if intensity == "chill":
        return False
    if intensity in {"standard", "strict"}:
        return True
    return True  # unknown intensity → conservative, fire


def _stringify_for_match(tool_input: dict) -> str:
    """Flatten the tool input into a single matchable string."""
    if isinstance(tool_input, str):
        return tool_input
    parts: list[str] = []
    if isinstance(tool_input, dict):
        # Common cases: {"command": "...", "description": "..."}
        for key in ("command", "file_path", "path", "content", "pattern", "url"):
            value = tool_input.get(key)
            if isinstance(value, str):
                parts.append(value)
        # Fallback: dump everything as a JSON blob so regex patterns can still
        # reach into nested structures if a trigger really needs to.
        parts.append(json.dumps(tool_input, sort_keys=True))
    return "\n".join(parts)


# ─── Intensity read ──────────────────────────────────────────────────────────

CONFIG_PATH = ".quellis/config.toml"
DEFAULT_INTENSITY = "standard"


def read_intensity(repo_root: Path) -> str:
    path = repo_root / CONFIG_PATH
    if not path.is_file():
        return DEFAULT_INTENSITY
    try:
        config = _load_toml(path)
    except (OSError, ValueError):
        return DEFAULT_INTENSITY
    arch = config.get("architect", {})
    if isinstance(arch, dict):
        intensity = arch.get("intensity", DEFAULT_INTENSITY)
        if isinstance(intensity, str):
            return intensity.lower()
    return DEFAULT_INTENSITY


# ─── Entry point ─────────────────────────────────────────────────────────────


def run(stdin: str, repo_root: Path) -> tuple[int, str]:
    """Pure-function entry point — returns (exit_code, stderr_message).

    Kept side-effect-free for unit testing. main() handles the I/O.
    """
    try:
        event = json.loads(stdin) if stdin.strip() else {}
    except json.JSONDecodeError:
        return 0, ""  # bad input → never break the session

    tool = event.get("tool_name") or event.get("tool") or ""
    tool_input = event.get("tool_input") or event.get("input") or {}

    pack_path = locate_pack(repo_root)
    if pack_path is None:
        return 0, ""  # no pack installed → nothing to enforce

    try:
        pack = _load_toml(pack_path)
    except (OSError, ValueError):
        return 0, ""  # malformed pack → fail open

    intensity = read_intensity(repo_root)
    match = match_triggers(pack, tool, tool_input, intensity)
    if match is None:
        return 0, ""

    trigger, _matched_input = match
    reason = (trigger.get("block_reason") or "Blocked by Quellis trigger.")
    if len(reason) > BLOCK_REASON_LIMIT:
        # Truncate at runtime as a defensive net; validator will already have
        # caught this at pack-install time.
        reason = reason[: BLOCK_REASON_LIMIT - 1] + "…"
    trigger_id = trigger.get("id") or "unknown"
    return 2, f"[quellis:{trigger_id}] {reason}"


def main() -> int:
    repo_root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    stdin = sys.stdin.read()
    code, message = run(stdin, repo_root)
    if message:
        print(message, file=sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(main())
