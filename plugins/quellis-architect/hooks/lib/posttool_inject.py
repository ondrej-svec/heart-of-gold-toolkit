#!/usr/bin/env python3
"""PostToolUse doctrine injector (plan 2026-05-13, task 2.C.3).

After a tool call lands, look at the tool name + the tool input (file
paths, command text, content body) and inject the doctrine cards whose
selectors match. The cards become additional context the agent reads
on its next turn.

Match semantics: a card matches if ANY of its inject_on_* selectors
hit (OR across glob / tool / content). Card budget (≤5 per inject,
≤6000 bytes) is enforced by `doctrine_loader.select_for_tool_use()`.

Hook contract:
  - stdin: Claude Code's PostToolUse JSON payload.
  - stdout: doctrine context to inject (may be empty).
  - Exit 0 always; this hook never blocks a session.

Schema reference (PostToolUse JSON, V1.1):

    {
      "tool_name": "Write",
      "tool_input": {"file_path": "...", "content": "..."},
      "tool_response": {...},        # optional
      "session_id": "..."
    }

We do NOT consult tool_response — by the time PostToolUse fires, the
write or command already happened. Injection is forward-looking
context for the next turn.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from doctrine_loader import (  # type: ignore  # noqa: E402
    load_cards,
    select_for_tool_use,
)


def _extract_paths(tool_input: dict) -> list[str]:
    """Pull path-shaped fields from the tool input."""
    if not isinstance(tool_input, dict):
        return []
    paths: list[str] = []
    for key in ("file_path", "path", "notebook_path"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            paths.append(value)
    return paths


def _extract_content(tool_input: dict) -> str:
    """Pull content-shaped fields for the content selector to match against."""
    if isinstance(tool_input, str):
        return tool_input
    if not isinstance(tool_input, dict):
        return ""
    parts: list[str] = []
    for key in ("content", "new_string", "command", "pattern"):
        value = tool_input.get(key)
        if isinstance(value, str):
            parts.append(value)
    return "\n".join(parts)


def render(cards: list[dict]) -> str:
    """Compose the PostToolUse injection blob.

    Empty when no cards matched — the hook then emits nothing and the
    session proceeds unmolested.
    """
    if not cards:
        return ""
    lines: list[str] = [
        f"Quellis doctrine ({len(cards)} card"
        f"{'' if len(cards) == 1 else 's'} matched the last tool call):"
    ]
    for card in cards:
        title = card.get("title") or ""
        header = f"· {card['id']}"
        if title:
            header += f" — {title}"
        lines.append("")
        lines.append(header)
        for body_line in card["body"].strip().splitlines():
            lines.append(f"  {body_line.rstrip()}")
    return "\n".join(lines) + "\n"


def run(stdin: str, repo_root: Path) -> str:
    """Pure-function entry point. Returns the stdout text (may be empty)."""
    try:
        event = json.loads(stdin) if stdin.strip() else {}
    except json.JSONDecodeError:
        return ""
    tool = event.get("tool_name") or event.get("tool") or ""
    tool_input = event.get("tool_input") or event.get("input") or {}

    cards = load_cards(repo_root)
    if not cards:
        return ""

    paths = _extract_paths(tool_input)
    content = _extract_content(tool_input)
    if not tool and not paths and not content:
        return ""

    chosen = select_for_tool_use(cards, tool=tool, paths=paths, content=content)
    return render(chosen)


def main() -> int:
    repo_root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    config = repo_root / ".quellis" / "config.toml"
    if not config.is_file():
        return 0  # not a Quellis repo
    stdin = sys.stdin.read()
    output = run(stdin, repo_root)
    if output:
        sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
