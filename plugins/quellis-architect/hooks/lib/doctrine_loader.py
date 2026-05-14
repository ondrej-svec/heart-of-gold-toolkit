#!/usr/bin/env python3
"""Doctrine-card loader (plan 2026-05-13, task 2.C.1).

A doctrine card is a short piece of context the plugin injects when
the agent is about to touch a known footgun. Cards live in
`packs/<id>/doctrine.toml` (or `.quellis/packs/<id>/doctrine.toml`)
alongside the trigger packs.

See `docs/doctrine.md` for the full schema spec. In short, each card
has an id, a body (less than 500 chars), and at least one inject_on_*
selector (glob, tool name, or content regex).

Selection at runtime (used by 2.C.2 / 2.C.3):

  * SessionStart: pick the top-N cards whose `inject_on_glob` matches a
    recently-modified file, bounded by `MAX_CARDS_PER_INJECT` and
    `MAX_BYTES_PER_INJECT`.
  * PostToolUse: pick cards whose `inject_on_*` selectors match the
    just-completed tool call.

This module is pure stdlib. Hook wiring lands in 2.C.2 / 2.C.3.
"""

from __future__ import annotations

import fnmatch
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pretool_match import _load_toml  # type: ignore  # noqa: E402


SCHEMA_DOCTRINE = "doctrine.v1"

BODY_LIMIT = 500            # chars; budget per card body
MAX_CARDS_PER_INJECT = 5    # plan §2.C.2 hard ceiling
MAX_BYTES_PER_INJECT = 6000 # ~1500 tokens at 4 bytes/token rule-of-thumb

DEFAULT_PRIORITY = 5
PRIORITY_RANGE = range(1, 11)  # 1..10 inclusive

PACK_PATHS = (
    ".quellis/packs/core/doctrine.toml",
    ".quellis/baselines/core/doctrine.toml",
)


def locate_pack(repo_root: Path) -> Path | None:
    for rel in PACK_PATHS:
        candidate = repo_root / rel
        if candidate.is_file():
            return candidate
    return None


# ─── Card loading + filtering ────────────────────────────────────────────────


def load_cards(repo_root: Path) -> list[dict]:
    """Return validated cards from the user's doctrine pack, or [].

    Cards that fail validation are silently dropped (the validator
    catches them at pack-install time; this loader is the runtime
    fail-open path).
    """
    path = locate_pack(repo_root)
    if path is None:
        return []
    try:
        pack = _load_toml(path)
    except (OSError, ValueError):
        return []
    if pack.get("schema_version") != SCHEMA_DOCTRINE:
        return []
    raw = pack.get("card", []) or []
    if not isinstance(raw, list):
        return []
    cards: list[dict] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        normalized = _normalize_card(entry)
        if normalized is not None:
            cards.append(normalized)
    return cards


def _normalize_card(entry: dict) -> dict | None:
    cid = entry.get("id")
    body = entry.get("body")
    if not isinstance(cid, str) or not cid:
        return None
    if not isinstance(body, str) or not body:
        return None
    body = body.strip()
    if not body or len(body) > BODY_LIMIT:
        return None
    glob = entry.get("inject_on_glob") or ""
    tool = entry.get("inject_on_tool") or ""
    content = entry.get("inject_on_content_match") or ""
    if not isinstance(glob, str) or not isinstance(tool, str) or not isinstance(content, str):
        return None
    if not (glob or tool or content):
        # A card with no selectors would inject every time — reject.
        return None
    if content:
        try:
            re.compile(content)
        except re.error:
            return None
    priority = entry.get("priority", DEFAULT_PRIORITY)
    if not isinstance(priority, int) or priority not in PRIORITY_RANGE:
        priority = DEFAULT_PRIORITY
    title = entry.get("title")
    return {
        "id": cid,
        "title": title if isinstance(title, str) else "",
        "body": body,
        "priority": priority,
        "inject_on_glob": glob,
        "inject_on_tool": tool,
        "inject_on_content_match": content,
    }


def card_matches_paths(card: dict, paths: list[str]) -> bool:
    """Does any of the given path strings match the card's glob selector?

    Glob selector is comma-separated; empty selector matches nothing
    via this path (a card with no glob still matches via tool/content).
    """
    glob = card.get("inject_on_glob", "")
    if not glob:
        return False
    patterns = [g.strip() for g in glob.split(",") if g.strip()]
    for pattern in patterns:
        for path in paths:
            if _glob_match(pattern, path):
                return True
    return False


def _glob_match(pattern: str, path: str) -> bool:
    """fnmatch with `**/` shell semantics and right-aligned suffix match.

    Python's `fnmatch` does not treat `**` as a separate token, and does
    not match by path suffix the way shell globs typically do. We layer
    two behaviors on top:

      1. `**/` expands to zero-or-more directory levels (collapse to ``).
      2. Relative patterns (not starting with `/` or `**`) match against
         every path suffix — so `migrations/**/*.sql` hits
         `/repo/src/migrations/x.sql` the way an operator expects.

    Both absolute and relative paths are tried.
    """
    candidates = {pattern}
    if "**/" in pattern:
        candidates.add(pattern.replace("**/", ""))
    if "/**/" in pattern:
        candidates.add(pattern.replace("/**/", "/"))

    # Build the list of path forms we'll match against: the path as-is,
    # the lstripped form, and every right-suffix starting at a `/`.
    paths: list[str] = [path, path.lstrip("/")]
    parts = path.split("/")
    for i in range(1, len(parts)):
        paths.append("/".join(parts[i:]))

    for candidate in candidates:
        for p in paths:
            if fnmatch.fnmatch(p, candidate):
                return True
    return False


def card_matches_tool(card: dict, tool: str) -> bool:
    expected = card.get("inject_on_tool", "")
    if not expected:
        return False
    return expected == tool


def card_matches_content(card: dict, content: str) -> bool:
    pattern = card.get("inject_on_content_match", "")
    if not pattern or not content:
        return False
    try:
        return bool(re.search(pattern, content))
    except re.error:
        return False


def select_for_session_start(cards: list[dict], recent_paths: list[str]) -> list[dict]:
    """Pick cards matching recent git activity, bounded by limits.

    Cards with NO glob selector are skipped at SessionStart — they're
    runtime triggers (PostToolUse), not session-context cards.
    """
    matched = [c for c in cards if card_matches_paths(c, recent_paths)]
    matched.sort(key=lambda c: (-c["priority"], c["id"]))
    return _bound(matched)


def select_for_tool_use(cards: list[dict], *, tool: str, paths: list[str], content: str) -> list[dict]:
    """Pick cards that match a just-completed tool call (PostToolUse).

    A card matches if ANY of its selectors hit. Multiple selectors on a
    card are an OR — if you want AND-semantics, use separate cards.
    """
    matched: list[dict] = []
    for card in cards:
        if (
            card_matches_paths(card, paths)
            or card_matches_tool(card, tool)
            or card_matches_content(card, content)
        ):
            matched.append(card)
    matched.sort(key=lambda c: (-c["priority"], c["id"]))
    return _bound(matched)


def _bound(cards: list[dict]) -> list[dict]:
    """Apply the count + byte ceilings from plan §2.C.2."""
    out: list[dict] = []
    total = 0
    for card in cards:
        if len(out) >= MAX_CARDS_PER_INJECT:
            break
        size = len(card["body"].encode("utf-8")) + 64  # rough header overhead
        if total + size > MAX_BYTES_PER_INJECT:
            break
        out.append(card)
        total += size
    return out


# ─── Validation (used by validate_pack.py) ───────────────────────────────────


def validate_doctrine_pack(data: dict) -> list[str]:
    findings: list[str] = []
    if data.get("schema_version") != SCHEMA_DOCTRINE:
        findings.append(
            f"schema_version must be {SCHEMA_DOCTRINE!r}, got {data.get('schema_version')!r}"
        )
    cards = data.get("card", [])
    if not isinstance(cards, list):
        findings.append("`card` must be a list of tables")
        cards = []
    seen_ids: set[str] = set()
    for idx, card in enumerate(cards):
        if not isinstance(card, dict):
            findings.append(f"card[{idx}] is not a table")
            continue
        cid = card.get("id")
        if not isinstance(cid, str) or not cid:
            findings.append(f"card[{idx}]: missing id")
        elif cid in seen_ids:
            findings.append(f"card[{idx}] id={cid!r}: duplicate within pack")
        else:
            seen_ids.add(cid)
        body = card.get("body")
        if not isinstance(body, str) or not body.strip():
            findings.append(f"card[{idx}] id={cid!r}: missing body")
        elif len(body.strip()) > BODY_LIMIT:
            findings.append(
                f"card[{idx}] id={cid!r}: body over {BODY_LIMIT} chars ({len(body.strip())})"
            )
        glob = card.get("inject_on_glob") or ""
        tool = card.get("inject_on_tool") or ""
        content = card.get("inject_on_content_match") or ""
        if not (glob or tool or content):
            findings.append(
                f"card[{idx}] id={cid!r}: at least one of inject_on_glob / "
                "inject_on_tool / inject_on_content_match is required"
            )
        if content and isinstance(content, str):
            try:
                re.compile(content)
            except re.error as exc:
                findings.append(
                    f"card[{idx}] id={cid!r}: inject_on_content_match does not compile ({exc})"
                )
        priority = card.get("priority", DEFAULT_PRIORITY)
        if priority is not None and (not isinstance(priority, int) or priority not in PRIORITY_RANGE):
            findings.append(
                f"card[{idx}] id={cid!r}: priority must be int 1..10, got {priority!r}"
            )
    return findings


def main() -> int:  # pragma: no cover — small debug CLI
    import sys

    if len(sys.argv) < 2:
        print("usage: doctrine_loader.py REPO_ROOT", file=sys.stderr)
        return 64
    repo_root = Path(sys.argv[1])
    cards = load_cards(repo_root)
    if not cards:
        print("no cards loaded", file=sys.stderr)
        return 1
    import json
    print(json.dumps(cards, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
