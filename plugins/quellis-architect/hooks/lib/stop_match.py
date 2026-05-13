#!/usr/bin/env python3
"""Stop trigger matcher (plan 2026-05-13, task 1.D.2).

Reads Claude Code's Stop hook JSON from stdin and the trigger pack at
`.quellis/packs/core/stop-triggers.toml`. Scans the last assistant message
for claim-without-evidence patterns. On the first match, emits the
trigger's `block_reason` to stderr and exits 2 (blocks the Stop transition).

Trigger pack schema:

    schema_version = "stop.v1"

    [[trigger]]
    id           = "claim.done-without-test-evidence"
    type         = "non-negotiable"
    claim_regex  = "\\b(done|verified|safe|tested)\\b"
    requires     = "test-run"             # see EVIDENCE_KINDS below
    block_reason = "You wrote \\"done\\" without test evidence. Show the run or restate as uncertain."

Real evidence inspection (parsing the full transcript) ships in Phase 1.E
via the evidence-search helper. This V1.0 matcher does the claim-detection
half — phase 1.E adds the "is the evidence actually present?" check before
the block fires.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

# Reuse the trigger-pack loading + intensity discipline from pretool_match,
# and the evidence-search helper from Phase 1.E.
sys.path.insert(0, str(Path(__file__).parent))
from pretool_match import (  # type: ignore  # noqa: E402
    BLOCK_REASON_LIMIT,
    DEFAULT_INTENSITY,
    _load_toml,
    _trigger_applies_to_intensity,
    read_intensity,
)
from evidence_search import EVIDENCE_KINDS, has_evidence  # type: ignore  # noqa: E402


PACK_PATHS = (
    ".quellis/packs/core/stop-triggers.toml",
    ".quellis/baselines/core/stop-triggers.toml",
)


def locate_pack(repo_root: Path) -> Path | None:
    for rel in PACK_PATHS:
        candidate = repo_root / rel
        if candidate.is_file():
            return candidate
    return None


def extract_last_assistant_text(event: dict) -> str:
    """Pull the most recent assistant text from the Stop hook payload.

    Claude Code's Stop event includes a `transcript_path` pointing at the
    session JSONL. Walking the full transcript for evidence is phase 1.E
    territory. For V1.0 we look at whatever the hook ships inline.
    """
    inline = event.get("message") or event.get("last_assistant_text") or ""
    if isinstance(inline, str):
        return inline
    if isinstance(inline, dict):
        # message.content[*] shape
        content = inline.get("content")
        if isinstance(content, list):
            chunks = [
                block.get("text", "")
                for block in content
                if isinstance(block, dict) and block.get("type") == "text"
            ]
            return "\n".join(chunks)
    return ""


def match_triggers(pack: dict, claim_text: str, intensity: str) -> dict | None:
    raw = pack.get("trigger", []) or []
    if not isinstance(raw, list):
        return None
    for trigger in raw:
        if not _trigger_applies_to_intensity(trigger, intensity):
            continue
        pattern = trigger.get("claim_regex")
        if not pattern:
            continue
        try:
            if re.search(pattern, claim_text, re.IGNORECASE):
                return trigger
        except re.error:
            continue
    return None


def run(stdin: str, repo_root: Path) -> tuple[int, str, dict | None]:
    """Pure-function entry point.

    Returns `(exit_code, stderr_message, log_event)`. `log_event` is a
    structured `log.v1` record that `main()` writes to
    `.quellis/acceptance-log.jsonl` (plan §2.D.3). It is `None` when
    nothing matched.
    """
    try:
        event = json.loads(stdin) if stdin.strip() else {}
    except json.JSONDecodeError:
        return 0, "", None

    pack_path = locate_pack(repo_root)
    if pack_path is None:
        return 0, "", None

    try:
        pack = _load_toml(pack_path)
    except (OSError, ValueError):
        return 0, "", None

    claim_text = extract_last_assistant_text(event)
    if not claim_text:
        return 0, "", None

    intensity = read_intensity(repo_root)
    trigger = match_triggers(pack, claim_text, intensity)
    if trigger is None:
        return 0, "", None

    # Phase 1.E: if the trigger names an evidence kind, walk the transcript
    # to confirm the evidence is *missing* before blocking. A "completion"
    # claim with a test-run earlier in the transcript is not a violation.
    requires = trigger.get("requires")
    transcript_path = _extract_transcript_path(event)
    session_id = event.get("session_id") or event.get("sessionId") or ""
    if requires and transcript_path and requires in EVIDENCE_KINDS:
        if has_evidence(transcript_path, requires):
            log_event = {
                "hook": "Stop",
                "trigger_id": trigger.get("id") or "unknown",
                "match_text": claim_text,
                "event_type": "suppressed_compliant",
                "session_id": session_id,
            }
            return 0, "", log_event

    reason = trigger.get("block_reason") or "Claim lacks supporting evidence."
    if len(reason) > BLOCK_REASON_LIMIT:
        reason = reason[: BLOCK_REASON_LIMIT - 1] + "…"
    trigger_id = trigger.get("id") or "unknown"
    quoted = _quote_claim(claim_text, trigger.get("claim_regex"))
    if quoted:
        body = f"{reason} You wrote: \"{quoted}\"."
        if len(body) > BLOCK_REASON_LIMIT + 80:
            # Cap the combined message at a slightly looser ceiling so the
            # quote does not dominate, but the original block_reason is
            # still surfaced in full.
            body = body[: BLOCK_REASON_LIMIT + 79] + "…"
    else:
        body = reason
    log_event = {
        "hook": "Stop",
        "trigger_id": trigger_id,
        "match_text": claim_text,
        "event_type": "fire",
        "session_id": session_id,
    }
    return 2, f"[quellis:{trigger_id}] {body}", log_event


def _extract_transcript_path(event: dict) -> Path | None:
    """Pull the transcript path from Claude Code's Stop event payload."""
    candidate = event.get("transcript_path") or event.get("transcriptPath")
    if isinstance(candidate, str) and candidate:
        path = Path(candidate)
        if path.is_file():
            return path
    return None


def _quote_claim(claim_text: str, pattern: str | None) -> str:
    """Pull a short quote around the matched claim, capped at 80 chars.

    Falls back to the first 80 chars of the message if no pattern given.
    """
    if not pattern:
        return claim_text.strip().splitlines()[0][:80]
    try:
        match = re.search(pattern, claim_text, re.IGNORECASE)
    except re.error:
        return ""
    if not match:
        return claim_text.strip().splitlines()[0][:80]
    start = max(0, match.start() - 20)
    end = min(len(claim_text), match.end() + 30)
    snippet = claim_text[start:end].strip()
    snippet = " ".join(snippet.split())  # collapse whitespace
    if len(snippet) > 80:
        snippet = snippet[:79] + "…"
    return snippet


def main() -> int:
    repo_root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    stdin = sys.stdin.read()
    code, message, log_event = run(stdin, repo_root)
    if log_event is not None:
        sys.path.insert(0, str(Path(__file__).parent))
        from acceptance_log import append_event  # type: ignore  # noqa: E402
        append_event(repo_root, log_event)
    if message:
        print(message, file=sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(main())
