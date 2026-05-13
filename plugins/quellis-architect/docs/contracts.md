# Evidence contracts (V1.1, schema `contract.v1`)

An **evidence contract** is a per-task TOML file declaring claim-classes the agent will make during a coding task, and the evidence each claim requires. The Stop hook (wiring lands in plan §2.B.2) consults the active contract *before* the global `stop-triggers.toml`, so a task can tighten the rules without weakening them.

Contracts are the V1.1 answer to "how does the agent prove it's done?" The global stop pack catches generic completion claims; contracts catch task-specific ones the user/agent named upfront.

## Layout

```
.quellis/contracts/
├── active.toml           ← pointer file (or absent → no active contract)
├── <task-id>.toml        ← one or more contract files
└── archive/              ← completed / abandoned contracts moved here
```

Only one contract is `active` at a time. The pointer file names it.

## Pointer schema (`contract.pointer.v1`)

`.quellis/contracts/active.toml`:

```toml
schema_version = "contract.pointer.v1"
task_id = "2026-05-13-add-intensity-column"
```

That's the whole file. If `active.toml` is missing, malformed, or points at a task that doesn't exist on disk, the Stop hook falls through to the global stop pack with no contract layer applied.

## Contract schema (`contract.v1`)

`.quellis/contracts/<task-id>.toml`:

```toml
schema_version = "contract.v1"
task_id        = "2026-05-13-add-intensity-column"
task_title     = "Add intensity column to users table"
created_at     = "2026-05-13T15:00:00Z"
status         = "active"        # active | completed | abandoned

[[claim]]
id           = "migration-applied"
claim_regex  = "\\b(?:migration|schema change) (?:applied|complete|done)\\b"
requires     = "verification-query"
block_reason = "Migration-applied claim needs schema-query evidence. Show the SELECT against information_schema or the EXPLAIN that confirms the new shape."

[[claim]]
id           = "rollback-tested"
claim_regex  = "\\b(?:rollback|revert)(?:ed|s)? (?:safe|tested|verified|works?)\\b"
requires     = "test-run"
block_reason = "Rollback-safe claim needs a test run that exercises the reverse migration on a staging copy."
```

### Required fields

| Field | Type | Notes |
|---|---|---|
| `schema_version` | string, exact `"contract.v1"` | Versioning rule: removing a field is major, adding optional is minor. |
| `task_id` | string, `[A-Za-z0-9][A-Za-z0-9_-]{0,127}` | Filesystem-safe. Convention: `YYYY-MM-DD-slug`. |
| `[[claim]]` array | at least one | A contract with no claims is meaningless and the loader rejects it. |

### Optional fields

| Field | Type | Notes |
|---|---|---|
| `task_title` | string | Human label for the contract slash command's listing. |
| `created_at` | ISO-8601 string | Informational. The loader does not parse it. |
| `status` | `active` \| `completed` \| `abandoned` | Default `active`. Non-active contracts are ignored by the Stop hook even when the pointer names them. |

### Claim fields

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Unique within the contract. Convention: `<short-name>`. Appears in `[quellis:<id>]` stderr block lines. |
| `claim_regex` | yes | Python regex, case-insensitive at match time, matched against the assistant's last message. Same shape as `stop.v1` triggers. |
| `requires` | optional | One of the evidence kinds in `evidence_search.EVIDENCE_KINDS` (`test-run`, `verification-query`, `scan-output`, `diff-confirmation`). Omit for "always block on this claim shape — no evidence escape." |
| `block_reason` | yes | ≤ 200 chars, ASCII (+ `…—–·`). Same Subjective Contract as triggers. |

## How contracts compose with `stop-triggers.toml`

The Stop hook checks contracts first, falls through to the global pack:

1. Load active contract via `contract_loader.load_active_contract(repo_root)`.
2. For each claim in the contract (in order), match `claim_regex` against the assistant's last message. First match wins.
3. If a contract claim matched and it carries `requires`, run the evidence-search; suppress when present.
4. If nothing matched in the contract, fall through to `packs/core/stop-triggers.toml`.

Contracts can therefore:

- **Tighten the bar**: declare a stricter claim_regex than the global pack catches.
- **Add task-specific shapes**: `"rollback-tested"` is contextual; no global trigger fits.
- **Override block_reason wording**: redirect the agent to the specific evidence this task expects.

Contracts cannot weaken the global pack — global triggers still fire if no contract claim matched first.

## Validation

The validator (`hooks/lib/validate_pack.py`) accepts `contract.v1` and `contract.pointer.v1` schemas alongside the existing trigger packs. From the plugin root:

```bash
python3 hooks/lib/validate_pack.py .quellis/contracts/active.toml \
                                   .quellis/contracts/<task-id>.toml
```

Findings shape: standard `<path>: <complaint>` lines, exit code 1 on any finding.

## Lifecycle

V1.1 ships the loader + validator. The CLI half (`quellis contract new`, `quellis contract activate`, `quellis contract complete`) is the §2.B.3 slash command's job — that wraps the CLI in a guided flow inside Claude Code sessions. Until then, contracts can be authored by hand and validated with the script above.

When a task ships, mark its contract `status = "completed"` and either move the file to `archive/` or delete the pointer. The next `/quellis-architect:plan` invocation can write a new contract.

## Why per-task contracts

The brainstorm called out that "claim → evidence" needs context the global pack can't know. A migration task and a billing-refactor task have different evidence shapes. Contracts let the user/agent name those shapes once upfront, then enforce them at Stop time without re-litigating per message.

This is the V1.2 personalization compound substrate: contracts that pass become candidate triggers (via `quellis teach`); contracts that fail become candidate calibration data.
