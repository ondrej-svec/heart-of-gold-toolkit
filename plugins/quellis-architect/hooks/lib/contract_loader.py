#!/usr/bin/env python3
"""Evidence-contract loader (plan 2026-05-13, task 2.B.1).

A *contract* is a per-task TOML file declaring claim-classes the agent
will make during this task and the evidence each claim requires. The
Stop hook consults the active contract (if any) *before* the global
stop-triggers.toml, so a task can tighten the rules without weakening
them.

Layout:

    .quellis/contracts/
    ├── active.toml           ← pointer file: task_id = "<id>"
    ├── <task-id>.toml        ← one or more contract files
    └── archive/              ← completed/abandoned contracts

`active.toml` schema:

    schema_version = "contract.pointer.v1"
    task_id = "2026-05-13-add-intensity-column"

Contract file schema (contract.v1):

    schema_version = "contract.v1"
    task_id        = "2026-05-13-add-intensity-column"
    task_title     = "Add intensity column to users table"
    created_at     = "2026-05-13T15:00:00Z"
    status         = "active"     # active | completed | abandoned

    [[claim]]
    id           = "migration-applied"
    claim_regex  = "\\b(?:migration|schema change) (?:applied|complete|done)\\b"
    requires     = "verification-query"
    block_reason = "Migration-applied claim needs schema-query evidence."

This module is pure stdlib. Hook integration happens in 2.B.2.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pretool_match import _load_toml  # type: ignore  # noqa: E402


# ─── Paths ───────────────────────────────────────────────────────────────────

CONTRACTS_DIR = ".quellis/contracts"
POINTER_FILE = ".quellis/contracts/active.toml"
SCHEMA_POINTER = "contract.pointer.v1"
SCHEMA_CONTRACT = "contract.v1"
VALID_STATUSES = {"active", "completed", "abandoned"}


def _task_id_pattern() -> re.Pattern[str]:
    # Allow yyyy-mm-dd-slug shape. Reject path-separator chars, dots, etc.
    return re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")


# ─── Loaders ─────────────────────────────────────────────────────────────────


def load_pointer(repo_root: Path) -> str | None:
    """Return the active task_id, or None if no pointer exists / is invalid.

    Failure modes are silent — the hook bias is *never break the session*.
    """
    pointer = repo_root / POINTER_FILE
    if not pointer.is_file():
        return None
    try:
        data = _load_toml(pointer)
    except (OSError, ValueError):
        return None
    if data.get("schema_version") != SCHEMA_POINTER:
        return None
    task_id = data.get("task_id")
    if not isinstance(task_id, str) or not _task_id_pattern().match(task_id):
        return None
    return task_id


def load_active_contract(repo_root: Path) -> dict | None:
    """Load + return the active contract dict, or None if no active contract.

    Returns a dict shaped like:
        {
          "task_id": "...",
          "task_title": "...",
          "status": "active",
          "claims": [ {id, claim_regex, requires, block_reason}, ... ]
        }

    or None on any of: missing pointer, missing file, parse error, wrong
    schema, non-active status.
    """
    task_id = load_pointer(repo_root)
    if task_id is None:
        return None
    path = repo_root / CONTRACTS_DIR / f"{task_id}.toml"
    if not path.is_file():
        return None
    try:
        data = _load_toml(path)
    except (OSError, ValueError):
        return None
    if data.get("schema_version") != SCHEMA_CONTRACT:
        return None
    status = data.get("status") or "active"
    if status != "active":
        return None
    raw_claims = data.get("claim", []) or []
    if not isinstance(raw_claims, list):
        return None
    claims: list[dict] = []
    for entry in raw_claims:
        if not isinstance(entry, dict):
            continue
        claim_id = entry.get("id")
        claim_regex = entry.get("claim_regex")
        requires = entry.get("requires")
        block_reason = entry.get("block_reason")
        if not all(isinstance(v, str) and v for v in (claim_id, claim_regex, block_reason)):
            continue
        try:
            re.compile(claim_regex)
        except re.error:
            continue
        claims.append({
            "id": claim_id,
            "claim_regex": claim_regex,
            "requires": requires if isinstance(requires, str) else None,
            "block_reason": block_reason,
        })
    if not claims:
        return None
    return {
        "task_id": task_id,
        "task_title": data.get("task_title") or "",
        "status": status,
        "claims": claims,
    }


# ─── Validation helpers (used by validate_pack.py) ───────────────────────────


def validate_pointer_file(data: dict) -> list[str]:
    findings: list[str] = []
    if data.get("schema_version") != SCHEMA_POINTER:
        findings.append(
            f"schema_version must be {SCHEMA_POINTER!r}, got {data.get('schema_version')!r}"
        )
    task_id = data.get("task_id")
    if not isinstance(task_id, str) or not task_id:
        findings.append("task_id must be a non-empty string")
    elif not _task_id_pattern().match(task_id):
        findings.append(
            f"task_id {task_id!r} must match {_task_id_pattern().pattern}"
        )
    return findings


def validate_contract_file(data: dict) -> list[str]:
    findings: list[str] = []
    if data.get("schema_version") != SCHEMA_CONTRACT:
        findings.append(
            f"schema_version must be {SCHEMA_CONTRACT!r}, got {data.get('schema_version')!r}"
        )
    task_id = data.get("task_id")
    if not isinstance(task_id, str) or not task_id:
        findings.append("task_id must be a non-empty string")
    elif not _task_id_pattern().match(task_id):
        findings.append(f"task_id {task_id!r} must match {_task_id_pattern().pattern}")
    status = data.get("status")
    if status is not None and status not in VALID_STATUSES:
        findings.append(f"status {status!r} not in {sorted(VALID_STATUSES)}")
    claims = data.get("claim", [])
    if not isinstance(claims, list):
        findings.append("`claim` must be a list of tables")
        claims = []
    seen_ids: set[str] = set()
    for idx, claim in enumerate(claims):
        if not isinstance(claim, dict):
            findings.append(f"claim[{idx}] is not a table")
            continue
        cid = claim.get("id")
        if not isinstance(cid, str) or not cid:
            findings.append(f"claim[{idx}]: missing id")
        elif cid in seen_ids:
            findings.append(f"claim[{idx}] id={cid!r}: duplicate within contract")
        else:
            seen_ids.add(cid)
        regex = claim.get("claim_regex")
        if not isinstance(regex, str) or not regex:
            findings.append(f"claim[{idx}] id={cid!r}: missing claim_regex")
        else:
            try:
                re.compile(regex)
            except re.error as exc:
                findings.append(
                    f"claim[{idx}] id={cid!r}: claim_regex does not compile ({exc})"
                )
        reason = claim.get("block_reason")
        if not isinstance(reason, str) or not reason:
            findings.append(f"claim[{idx}] id={cid!r}: missing block_reason")
        elif len(reason) > 200:
            findings.append(
                f"claim[{idx}] id={cid!r}: block_reason over 200 chars ({len(reason)})"
            )
        requires = claim.get("requires")
        if requires is not None:
            if not isinstance(requires, str):
                findings.append(f"claim[{idx}] id={cid!r}: requires must be a string")
            else:
                from evidence_search import EVIDENCE_KINDS  # type: ignore
                if requires not in EVIDENCE_KINDS:
                    findings.append(
                        f"claim[{idx}] id={cid!r}: requires {requires!r} "
                        f"is not a known evidence kind (known: {sorted(EVIDENCE_KINDS)})"
                    )
    if not claims:
        findings.append("contract must declare at least one claim")
    return findings


def main() -> int:  # pragma: no cover — tiny CLI for manual checks
    import sys

    if len(sys.argv) < 2:
        print("usage: contract_loader.py REPO_ROOT", file=sys.stderr)
        return 64
    repo_root = Path(sys.argv[1])
    contract = load_active_contract(repo_root)
    if contract is None:
        print("no active contract", file=sys.stderr)
        return 1
    import json

    print(json.dumps(contract, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
