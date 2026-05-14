# Doctrine cards (V1.1, schema `doctrine.v1`)

A **doctrine card** is a short piece of context the plugin injects when the agent is about to touch a known footgun. Cards complement triggers: triggers *block*, cards *teach*. Both ship in the core pack; cards inject at SessionStart and PostToolUse (plan §2.C.2 and §2.C.3 wire the hooks).

## Layout

```
packs/<id>/doctrine.toml      ← plugin-bundled cards (shipped in `core` pack)
.quellis/packs/<id>/doctrine.toml  ← user repo's cards (installed via `quellis init`)
```

Same schema, same loader. The user's repo can ship project-specific cards alongside the global `core` pack.

## Schema

```toml
schema_version = "doctrine.v1"

[[card]]
id       = "migration-backfill-discipline"
title    = "Migrations need a backfill plan"
priority = 8                                    # 1..10, default 5

# Selectors — at least one of these three is required.
inject_on_glob          = "migrations/**/*.sql,prisma/migrations/**/*.sql"
inject_on_tool          = "Write"
inject_on_content_match = "(?i)\\bALTER TABLE\\b"

body = """
NOT NULL + DEFAULT applies to existing rows in the same ALTER on
SQLite/Postgres/MySQL — no separate UPDATE. Annotate inline:

    -- backfill: DEFAULT 'x' applies to existing rows in the same ALTER.
"""
```

### Required fields

| Field | Type | Notes |
|---|---|---|
| `schema_version` | string, exact `"doctrine.v1"` | |
| `id` | string, unique within pack | `<short-kebab-case>`. Appears in injection log lines. |
| `body` | string, ≤ 500 chars after `.strip()` | The actual text injected to the agent's context. |
| At least one of `inject_on_glob` / `inject_on_tool` / `inject_on_content_match` | string | A card with no selectors would inject every time; the validator rejects this. |

### Optional fields

| Field | Default | Notes |
|---|---|---|
| `title` | empty | Human label for the SessionStart summary line. |
| `priority` | 5 | Integer 1..10. Higher = picked first when too many cards match. Reject outside range. |
| `inject_on_glob` | empty | Comma-separated glob patterns matched via `fnmatch`. Both relative and absolute paths are tried. |
| `inject_on_tool` | empty | Exact Claude Code tool name (`Bash`, `Edit`, `Write`, …). PostToolUse only. |
| `inject_on_content_match` | empty | Python regex matched against the tool input content (or recent file content at SessionStart). |

### Selectors compose as OR

A card matches if *any* of its selectors hit. For AND-semantics, write two cards with the narrower regex baked into the content-match field.

## Hard limits

| Limit | Value | Where |
|---|---|---|
| Body length | ≤ 500 chars | per-card; validator enforces |
| Cards per inject | ≤ 5 | both SessionStart and PostToolUse |
| Bytes per inject | ≤ 6000 (~1500 tokens) | both SessionStart and PostToolUse |

If the matched set exceeds either ceiling, the loader sorts by priority (descending), then id (ascending), and truncates to the limits. **There is no "show more" affordance** — the budget exists because token cost is the whole point.

## Hook integration

| Hook | What it injects | Selector that matches |
|---|---|---|
| **SessionStart** | Cards relevant to recently-modified files in the repo | `inject_on_glob` matches one of the recent paths |
| **PostToolUse** | Cards relevant to the tool call just completed | Any of the three selectors matches |

PreToolUse intentionally does NOT inject doctrine — at PreToolUse time the agent is about to act; injection there would slow every action by ~500ms+ of context processing. Cards run at the boundaries (start of session, after a tool call lands) where the agent is already taking a turn.

## Authoring discipline

Cards earn their place by being:

- **Concrete.** Name the path or pattern. "Migrations need care" is useless; "NOT NULL + DEFAULT works in one ALTER on Postgres" is useful.
- **Short.** 500 chars is generous. 200 is better. The agent reads many cards; long bodies bury the signal.
- **Actionable.** A card should change behavior. "Be careful with auth code" doesn't; "Auth changes need an `// ADR-NNN` comment in the diff" does.
- **Tight selector.** A card with `inject_on_glob = "**/*.ts"` fires on every TypeScript edit — that's noise. Scope it to the actual surface where the doctrine matters.

The same anti-goals as triggers apply:

- No emojis, no jokes, no personality performance.
- ASCII (+ `…—–·`) only.
- No "you should" without naming the consequence.

## Validation

```bash
python3 hooks/lib/validate_pack.py packs/core/doctrine.toml
```

Findings: standard `<path>: <complaint>` lines, exit code 1 on any finding.

## Why per-card priority

When the user's repo has 30+ cards and the agent touches 5 footgun surfaces in a session, the system has to decide which 5 cards to inject. Priority is the simplest discriminator: 1-10, ascending sort, ties broken by id alphabetically. A card with `priority = 10` is "always inject if matched"; `priority = 1` is "only if there's room."

V1.2 personalization may swap this for a learned ranking. V1.1 ships the deterministic version.
