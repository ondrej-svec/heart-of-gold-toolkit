#!/usr/bin/env python3
"""SessionStart doctrine injector (plan 2026-05-13, task 2.C.2).

At session start, scan recent git activity in the user's repo, select
the doctrine cards that match those paths, and emit them as session
context.

Activity sources, in order:
  1. `git diff --name-only HEAD`   — uncommitted changes
  2. `git log --name-only -n 5`    — recently-committed paths

The paths feed `doctrine_loader.select_for_session_start()`, which
applies the per-session limits (≤ 5 cards, ≤ 6000 bytes ~ 1500 tokens).

The first line of stdout is the V1.0 status line (intensity + log
path). The doctrine block follows. Both together must stay terse — the
SessionStart token budget is precious.

Hook contract:
  - No stdin input.
  - cwd is the user's repo root (or $CLAUDE_PROJECT_DIR if set).
  - stdout becomes session context.
  - Exit 0 always; this hook never breaks a session.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from doctrine_loader import (  # type: ignore  # noqa: E402
    load_cards,
    select_for_session_start,
)
from pretool_match import read_intensity  # type: ignore  # noqa: E402


GIT_TIMEOUT_SECS = 2
RECENT_COMMITS_TO_SCAN = 5
MAX_RECENT_PATHS = 50  # bound the input to doctrine_loader


def recent_git_paths(repo_root: Path) -> list[str]:
    """Best-effort list of recently-touched paths in the repo.

    Combines uncommitted-change paths with the last few commits' paths.
    Returns at most MAX_RECENT_PATHS entries, deduplicated, in
    arbitrary order. Empty list on any failure — the hook never blocks
    on git issues.
    """
    paths: list[str] = []
    for args in (
        ["diff", "--name-only", "HEAD"],
        ["log", "--name-only", "--pretty=format:", f"-n{RECENT_COMMITS_TO_SCAN}"],
    ):
        try:
            result = subprocess.run(
                ["git", "-C", str(repo_root), *args],
                capture_output=True,
                text=True,
                timeout=GIT_TIMEOUT_SECS,
            )
        except (OSError, subprocess.SubprocessError):
            continue
        if result.returncode != 0:
            continue
        for line in result.stdout.splitlines():
            line = line.strip()
            if line:
                paths.append(line)
    # Dedupe preserving first-seen order; cap to a reasonable size.
    seen: set[str] = set()
    out: list[str] = []
    for p in paths:
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
        if len(out) >= MAX_RECENT_PATHS:
            break
    return out


def render(intensity: str, cards: list[dict]) -> str:
    """Produce the SessionStart context blob.

    Format intentionally compact — token budget is the constraint.
    """
    lines: list[str] = [
        f"Quellis active · intensity: {intensity} · "
        "acceptance log: .quellis/acceptance-log.jsonl",
    ]
    if cards:
        lines.append("")
        lines.append(
            f"Doctrine relevant to recent activity ({len(cards)} card"
            f"{'' if len(cards) == 1 else 's'}):"
        )
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


def run(repo_root: Path) -> str:
    intensity = read_intensity(repo_root)
    cards = load_cards(repo_root)
    if not cards:
        # No doctrine pack installed; emit only the V1.0 status line so the
        # SessionStart hook's prior contract is preserved.
        return render(intensity, [])
    paths = recent_git_paths(repo_root)
    if not paths:
        return render(intensity, [])
    chosen = select_for_session_start(cards, paths)
    return render(intensity, chosen)


def main() -> int:
    repo_root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    config = repo_root / ".quellis" / "config.toml"
    if not config.is_file():
        return 0  # no Quellis here, emit nothing
    sys.stdout.write(run(repo_root))
    return 0


if __name__ == "__main__":
    sys.exit(main())
