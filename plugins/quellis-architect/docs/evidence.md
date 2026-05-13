# Evidence escape hatches

The Stop hook blocks claims that lack supporting evidence. This document is the answer to *"what counts as evidence?"*

The evidence kinds below are the V1.0 surface. Trigger packs reference them via the `requires` field; the hook walks the session transcript and confirms the evidence is present before the block fires. **If `requires` is set and evidence is found, no block.**

> **V1.0 behavior:** triggers without a `requires` field block on the claim alone (conservative). Triggers with `requires` use evidence-search before blocking.

## What gets searched

The evidence walker reads the Stop event's `transcript_path` (a Claude Code session JSONL). It scans assistant `tool_use` blocks in the last 2,000 events, looking for tool name + command-pattern matches that count as evidence.

Sessions are typically a few hundred events; the 2,000 cap is generous slack. Sessions are read line-by-line — no full-transcript load.

## Evidence kinds

### `test-run`

**Counts as evidence:**

| Tool | Command pattern matches |
|---|---|
| `Bash` | `cargo test`, `cargo nextest`, `npm test`, `yarn test`, `pnpm test`, `bun test`, `pytest`, `python -m pytest`, `python -m unittest`, `go test`, `rake test`, `rspec`, `mix test`, `phpunit`, `jest`, `vitest` |

**Does NOT count:**

- "I'll run the tests next" — the *promise* of a test is not the test.
- A `Read` of a test file — reading is not running.
- A `cargo build` or `cargo check` — compiling does not exercise behavior.

**Escape hatch when no tests exist:** restate the claim narrowly. Replace "verified" with "compiles" or "syntactically valid." The trigger will not match the narrower wording.

### `verification-query`

**Counts as evidence:**

| Tool | Command pattern matches |
|---|---|
| `Bash` | Queries against `information_schema`, raw `SELECT ... FROM ... WHERE`, psql `\d` describe, `EXPLAIN`, `DESCRIBE` |

**Does NOT count:**

- Reading the migration file itself.
- A `pg_dump` of the schema — that is a backup, not a verification.

**Escape hatch:** if no database is reachable, restate as "migration file written; not yet applied" — narrower wording, no block.

### `scan-output`

**Counts as evidence:**

| Tool | Command pattern matches |
|---|---|
| `Bash` | `gitleaks`, `trufflehog`, `detect-secrets`, `grep -r`, `rg --files-with-matches`, `rg -l` |

**Does NOT count:**

- Manual inspection of a file (`Read` block).
- A single-file `grep` (the trigger asks for *repository-wide* removal).

**Escape hatch:** scope the claim — "removed from this file only" — the trigger asks for repository-wide scans only when the claim is unscoped.

### `diff-confirmation`

**Counts as evidence:**

| Tool | Command pattern matches |
|---|---|
| `Bash`, `Read` | `git diff`, `git show`, `git log --patch` |

**Does NOT count:** narrating a diff without running the command.

## How to add a new evidence kind

1. Edit `hooks/lib/evidence_search.py` — add an entry to `EVIDENCE_KINDS` with the tool set and command patterns that count.
2. The validator picks it up automatically — `requires = "<new-kind>"` becomes valid in stop packs.
3. Add a unit test in `tests/test_pretool_match.py` exercising the new kind.
4. Document the kind here, including what does NOT count and the escape hatch.

V1.0 patterns are deliberately broad — better a false negative (evidence found when it should not have been) than a false positive that blocks legitimate work. The 1.D.6 calibration tunes the precision after real-session data lands.

## The two-stage gate

For each Stop-time trigger:

1. **Stage 1 (claim detection):** `claim_regex` matches the assistant's last message. If no match, exit 0.
2. **Stage 2 (evidence verification):** if the trigger has `requires`, walk the transcript for that evidence kind. If evidence present, exit 0. If absent, block with the trigger's `block_reason` + a quoted excerpt of the claim.

The two-stage gate is the cheapest way to keep the block message specific ("you wrote X, here is what was missing") while avoiding the false-positive cliff a one-stage blocker would create.

## What the agent should do when blocked

The Subjective Contract lays out the intended response, but the operational shape:

1. **Quote yourself back honestly.** Yes, you wrote "all tests passing." That is the claim under inspection.
2. **Look for evidence in your own transcript.** A `cargo test` you ran earlier in this session is evidence — point at it explicitly.
3. **If the evidence is not there, narrow the claim.** Replace "tests passing" with "compiles" or "the change is syntactically valid; tests not run in this session."
4. **If the user asked for the broad claim explicitly:** quote that ask, then restate the broad claim and tag it with the missing evidence ("user accepted no-test claim").

Never retry the same claim. The trigger is deterministic; the second time produces the same block.

## What the user should do

- **Override per-trigger.** Set `intensity = "chill"` in `.quellis/config.toml` to suppress convention triggers. Non-negotiables and evidence triggers (this file) still fire.
- **Disable a specific trigger.** Remove its entry from `packs/core/stop-triggers.toml`. (V1.1 will add a `quellis trigger disable <id>` shortcut.)
- **Add a custom evidence kind.** Edit `evidence_search.py` if a specific test runner or scanner isn't recognized. PRs welcome.

## What V1.E does not do (yet)

- **No semantic transcript reading.** The walker grepps command strings; it does not parse test runner output to see "X passed, Y failed." The agent's narrative is trusted (it owns its own claim).
- **No cross-session evidence.** Each Stop event consults the current transcript only. Prior sessions are V1.2's territory (via `quellis personalize`).
- **No timing checks.** "Tests passed three hours ago" still counts. V1.1 may add a "stale evidence" filter (e.g., evidence must be within the last N events).
