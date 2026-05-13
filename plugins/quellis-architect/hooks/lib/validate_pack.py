#!/usr/bin/env python3
"""Validate a Quellis trigger pack against the V1.0 schema.

Run as a sanity check after `quellis teach`, after editing a pack by hand,
or in CI. Returns 0 on success and a non-zero exit code with a list of
findings on failure.

Validates (plan 2026-05-13, tasks 1.D.7 + 1.D.8):
  - schema_version is present and known.
  - Each [[trigger]] has id, type, block_reason.
  - PreToolUse triggers carry match_tool + match_regex.
  - Stop triggers carry claim_regex.
  - block_reason is ≤ 200 chars (Subjective Contract).
  - block_reason does NOT contain emojis or other non-text-y bytes
    (per the "no cute" anti-goal).
  - All ids are unique within the pack.
  - All regexes compile.

Usage:
    python3 validate_pack.py path/to/pretool-triggers.toml [...]
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pretool_match import _load_toml  # type: ignore  # noqa: E402

BLOCK_REASON_LIMIT = 200

KNOWN_SCHEMAS = {
    "pretool.v1": "pretool",
    "stop.v1": "stop",
    "contract.v1": "contract",
    "contract.pointer.v1": "contract-pointer",
}

TRIGGER_TYPES = {"non-negotiable", "convention", "evidence"}

# Anything outside printable ASCII + the small set we explicitly allow is
# flagged as "cute". This is deliberately strict; the anti-goal is no
# emojis, no decorative characters, complete sentences only.
ALLOWED_NON_ASCII = set("…—–·")


def find_block_reason_issues(reason: str) -> list[str]:
    issues: list[str] = []
    if len(reason) > BLOCK_REASON_LIMIT:
        issues.append(
            f"block_reason exceeds {BLOCK_REASON_LIMIT}-char limit (got {len(reason)})"
        )
    for ch in reason:
        if ord(ch) < 32 and ch not in {"\n", "\t"}:
            issues.append(f"block_reason contains control character {ord(ch):#x}")
            break
        if ord(ch) > 127 and ch not in ALLOWED_NON_ASCII:
            issues.append(
                f"block_reason contains non-ASCII character {ch!r} "
                f"(only {sorted(ALLOWED_NON_ASCII)} allowed)"
            )
            break
    return issues


def validate_trigger(
    trigger: dict, kind: str, ids_seen: set[str], idx: int
) -> list[str]:
    findings: list[str] = []
    tid = trigger.get("id")
    if not isinstance(tid, str) or not tid:
        findings.append(f"trigger[{idx}]: missing or non-string `id`")
    else:
        if tid in ids_seen:
            findings.append(f"trigger[{idx}] id={tid!r}: duplicate id within pack")
        ids_seen.add(tid)

    ttype = trigger.get("type")
    if ttype not in TRIGGER_TYPES:
        findings.append(
            f"trigger[{idx}] id={tid!r}: type {ttype!r} not in {sorted(TRIGGER_TYPES)}"
        )

    reason = trigger.get("block_reason")
    if not isinstance(reason, str) or not reason:
        findings.append(f"trigger[{idx}] id={tid!r}: missing block_reason")
    else:
        for issue in find_block_reason_issues(reason):
            findings.append(f"trigger[{idx}] id={tid!r}: {issue}")

    if kind == "pretool":
        tool = trigger.get("match_tool")
        if not isinstance(tool, str) or not tool:
            findings.append(f"trigger[{idx}] id={tid!r}: missing match_tool")
        pattern = trigger.get("match_regex")
        if not isinstance(pattern, str) or not pattern:
            findings.append(f"trigger[{idx}] id={tid!r}: missing match_regex")
        else:
            try:
                re.compile(pattern)
            except re.error as exc:
                findings.append(
                    f"trigger[{idx}] id={tid!r}: match_regex does not compile ({exc})"
                )
        suppress = trigger.get("suppress_if_content_matches")
        if suppress is not None:
            if not isinstance(suppress, str) or not suppress:
                findings.append(
                    f"trigger[{idx}] id={tid!r}: suppress_if_content_matches must be a non-empty string"
                )
            else:
                try:
                    re.compile(suppress)
                except re.error as exc:
                    findings.append(
                        f"trigger[{idx}] id={tid!r}: suppress_if_content_matches does not compile ({exc})"
                    )
    elif kind == "stop":
        pattern = trigger.get("claim_regex")
        if not isinstance(pattern, str) or not pattern:
            findings.append(f"trigger[{idx}] id={tid!r}: missing claim_regex")
        else:
            try:
                re.compile(pattern)
            except re.error as exc:
                findings.append(
                    f"trigger[{idx}] id={tid!r}: claim_regex does not compile ({exc})"
                )
        # `requires` is optional but must name a known evidence kind when set.
        requires = trigger.get("requires")
        if requires is not None:
            if not isinstance(requires, str):
                findings.append(
                    f"trigger[{idx}] id={tid!r}: requires must be a string"
                )
            else:
                # Lazy import — only stop packs need this.
                sys.path.insert(0, str(Path(__file__).parent))
                from evidence_search import EVIDENCE_KINDS  # type: ignore
                if requires not in EVIDENCE_KINDS:
                    findings.append(
                        f"trigger[{idx}] id={tid!r}: requires {requires!r} "
                        f"is not a known evidence kind (known: {sorted(EVIDENCE_KINDS)})"
                    )

    return findings


def validate_pack(path: Path) -> list[str]:
    findings: list[str] = []
    if not path.is_file():
        findings.append(f"{path}: file does not exist")
        return findings
    try:
        pack = _load_toml(path)
    except ValueError as exc:
        findings.append(f"{path}: parse error: {exc}")
        return findings
    schema = pack.get("schema_version")
    if schema not in KNOWN_SCHEMAS:
        findings.append(
            f"{path}: unknown schema_version {schema!r} "
            f"(known: {sorted(KNOWN_SCHEMAS)})"
        )
        return findings
    kind = KNOWN_SCHEMAS[schema]
    if kind == "contract":
        sys.path.insert(0, str(Path(__file__).parent))
        from contract_loader import validate_contract_file  # type: ignore
        for f in validate_contract_file(pack):
            findings.append(f"{path}: {f}")
        return findings
    if kind == "contract-pointer":
        sys.path.insert(0, str(Path(__file__).parent))
        from contract_loader import validate_pointer_file  # type: ignore
        for f in validate_pointer_file(pack):
            findings.append(f"{path}: {f}")
        return findings
    triggers = pack.get("trigger", []) or []
    if not isinstance(triggers, list):
        findings.append(f"{path}: `trigger` must be a list of tables")
        return findings
    ids_seen: set[str] = set()
    for idx, trigger in enumerate(triggers):
        if not isinstance(trigger, dict):
            findings.append(f"{path}: trigger[{idx}] is not a table")
            continue
        for f in validate_trigger(trigger, kind, ids_seen, idx):
            findings.append(f"{path}: {f}")
    if kind == "pretool":
        for f in validate_path_family_coverage(triggers):
            findings.append(f"{path}: {f}")
    return findings


def validate_path_family_coverage(triggers: list) -> list[str]:
    """Plan §2.D.2: any path_family with an Edit/Write trigger must also have
    a Bash trigger. Otherwise an agent can bypass the path-class rule via
    heredoc redirection.
    """
    findings: list[str] = []
    families: dict[str, dict[str, list[str]]] = {}
    for trigger in triggers:
        if not isinstance(trigger, dict):
            continue
        family = trigger.get("path_family")
        if not isinstance(family, str) or not family:
            continue
        tool = trigger.get("match_tool") or ""
        tid = trigger.get("id") or "<unnamed>"
        bucket = families.setdefault(family, {"edit_write": [], "bash": []})
        if tool in {"Edit", "Write"}:
            bucket["edit_write"].append(tid)
        elif tool == "Bash":
            bucket["bash"].append(tid)
    for family, buckets in families.items():
        if buckets["edit_write"] and not buckets["bash"]:
            findings.append(
                f"path_family {family!r} has Edit/Write triggers "
                f"({sorted(buckets['edit_write'])}) but no Bash trigger — "
                "agents can bypass via heredoc / redirection"
            )
    return findings


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: validate_pack.py PACK [PACK ...]", file=sys.stderr)
        return 64  # EX_USAGE
    exit_code = 0
    for arg in sys.argv[1:]:
        findings = validate_pack(Path(arg))
        if findings:
            exit_code = 1
            for finding in findings:
                print(finding, file=sys.stderr)
        else:
            print(f"{arg}: ok", file=sys.stderr)
    if exit_code == 0:
        print(json.dumps({"status": "ok", "packs": sys.argv[1:]}))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
