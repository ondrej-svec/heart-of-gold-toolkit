# Coordination protocol — `.quellis/` shared directory

The `quellis` CLI and the `quellis-architect` Claude Code plugin coordinate exclusively through a filesystem directory at `.quellis/` in the user's repo. There is no IPC, no socket, no MCP server, no network. Filesystem truth, by design (V1.0–V1.2; revisitable in V2 if filesystem-only proves too coarse).

This document specifies what each side writes, what each side reads, and the schema-versioning rules that keep the two evolvable independently.

## Why a shared directory

- **Mechanical simplicity.** A directory is the lowest-friction integration. Anyone can `cat`, `grep`, or `git diff` it.
- **No coupling at process level.** The CLI runs offline; the plugin runs inside Claude Code. They never need to be alive at the same time.
- **Git-trackable.** The user can commit `.quellis/config.toml` and `.quellis/packs/` to share configuration with collaborators. Logs are gitignored by default.
- **Reversible.** Deleting `.quellis/` returns the repo to baseline. No system state to clean up.

## Directory layout (V1.0)

```
.quellis/
├─ config.toml                ← CLI writes at init; plugin reads
├─ packs/
│   └─ core/
│       ├─ pack.toml          ← Pack metadata (id, version, schema)
│       ├─ pretool-triggers.toml   ← Plugin reads at PreToolUse
│       ├─ stop-triggers.toml      ← Plugin reads at Stop
│       └─ doctrine/                ← V1.1: doctrine cards
├─ personalization.json       ← V1.2: CLI writes from `quellis personalize`; plugin reads at SessionStart
└─ acceptance-log.jsonl       ← Plugin writes; CLI reads at next `quellis personalize`
```

V1.0 ships `config.toml`, `packs/core/`, and an empty `acceptance-log.jsonl`. `personalization.json` lands with V1.2.

> **Note on naming.** The plan-spec uses `.quellis/packs/`. The current `quellis` CLI codebase still uses `.quellis/baselines/` (from the v1 surface). The rename ships in a V1.1 cleanup commit. Until then, the plugin reads from `.quellis/baselines/` and treats it as the pack root. Both names refer to the same content.

## Who writes what

| Path | Writer | Read by | Trigger to write |
|---|---|---|---|
| `config.toml` | CLI | Plugin (every hook), CLI (every command) | `quellis init`, `quellis personalize` |
| `packs/core/*` | CLI | Plugin (PreToolUse, Stop, SessionStart) | `quellis pack init`, `quellis teach`, `quellis baseline install` |
| `personalization.json` | CLI (V1.2) | Plugin SessionStart | `quellis personalize` |
| `acceptance-log.jsonl` | Plugin | CLI (V1.2 personalize) | Every hook fire |
| `episodes/<id>/` | CLI | CLI | `quellis session start`, `quellis episode close` |

Conflicts are avoided by **single-writer discipline**: no two processes write to the same file. The plugin only ever appends to `acceptance-log.jsonl`; the CLI only ever overwrites `config.toml` and pack files.

## Schema versioning

Every TOML or JSON file under `.quellis/` carries an explicit `schema_version` field at its top level. The plugin and CLI both **fail open** on unknown versions: log a warning and fall through to defaults, never crash the host session.

V1.0 schemas:

- `config.toml` → `architect.schema_version = "v2.0"`
- `packs/<id>/pack.toml` → `pack.schema_version = "v0.2.0"` (carried from v1; unchanged)
- `acceptance-log.jsonl` → each line carries `"schema_version": "log.v1"`
- `personalization.json` → `"schema_version": "personalization.v1"` (V1.2)

When a schema changes shape, the writer bumps the version and the reader gains a compatibility branch. **Removing a field is a major bump; adding an optional field is a minor bump.**

## `acceptance-log.jsonl` (plugin write)

One JSON object per line, append-only, never truncated. Each line records a single hook fire.

```json
{
  "schema_version": "log.v1",
  "timestamp": "2026-05-13T18:44:12.301Z",
  "hook": "PreToolUse",
  "trigger_id": "non-negotiable.git-force-push-main",
  "tool": "Bash",
  "match_text": "(redacted by plugin before writing)",
  "user_response": "accepted | dismissed | unknown",
  "session_id": "<claude-code-session-uuid>",
  "git_branch": "<branch-at-fire-time>"
}
```

`match_text` is **always redacted** before writing — the plugin runs the matched text through the same redaction logic as the CLI's `redaction.rs` (secrets, tokens, env values). `user_response` defaults to `unknown` when the plugin cannot observe the user's reaction; the CLI's V1.2 personalizer infers it from subsequent session activity.

## `config.toml` (CLI write, plugin read)

The plugin reads the `[architect]` section only. The rest of `config.toml` is for the CLI's verification/context machinery and is opaque to the plugin.

```toml
[architect]
schema_version = "v2.0"
intensity = "standard"      # chill | standard | strict
primary_stack = ""          # empty → use project.languages
non_negotiables = []        # empty → use core pack defaults
```

If `[architect]` is absent (older v1 config), the plugin falls back to all defaults and logs a one-line note to `acceptance-log.jsonl` with `hook = "config-missing"`.

## Race conditions

The CLI and plugin are not expected to run concurrently in practice (the CLI is invoked by the user; the plugin runs inside Claude Code sessions). But filesystem races can still happen — for example, the user runs `quellis personalize` while Claude Code is mid-session.

V1.0 handling: **last writer wins, no locks**. This is safe because:

- The plugin never overwrites files the CLI manages (config, packs, personalization).
- The plugin only appends to `acceptance-log.jsonl`. Concurrent appends are atomic on POSIX for lines < `PIPE_BUF` (4 KB on macOS, sufficient for our schema).
- The CLI never overwrites the acceptance log; it only reads it.

If concurrent-writer corruption becomes a real problem, V1.2 adds an advisory lock via `flock(2)` on `.quellis/.lock`. Not in V1.0 scope.

## Telemetry

`acceptance-log.jsonl` is **local-only by default**. Opt-in aggregation lands in V1.2 with a separate `quellis telemetry enable` flag and an explicit confirmation prompt that names exactly what gets uploaded and where. V1.0 has no telemetry surface.

## Failure modes

| Failure | Plugin behavior | CLI behavior |
|---|---|---|
| `.quellis/` absent | Print one-line note suggesting `quellis init`; skip all triggers; exit 0 | Refuse with explicit "run `quellis init` first" |
| `config.toml` malformed | Log + fall back to defaults; do not block | Refuse with parse error |
| Pack file missing | Skip that trigger family; log; do not block | `quellis pack validate` fails |
| Pack schema bump unknown | Log + skip pack | Refuse load |
| `acceptance-log.jsonl` unwritable | Log to stderr; do not block hook | n/a |

The bias is: **the plugin never breaks a Claude Code session.** Triggers can fail silently; the host session keeps going. The CLI is allowed to be strict because users invoke it deliberately.

## References

- Plan: `docs/plans/2026-05-13-feat-quellis-v2-senior-architect-plan.md` (Bobo repo)
- Schema audit: `docs/decisions/2026-05-13-quellis-v2-jsonl-schema-audit.md`
- CLI redaction: `conscience-harness/crates/quellis-cli/src/redaction.rs`
- Pack format (v1, surviving): `conscience-harness/crates/quellis-cli/src/pack.rs`
