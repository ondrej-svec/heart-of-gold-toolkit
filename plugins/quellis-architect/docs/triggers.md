# Trigger pack schemas (V1.0)

Quellis triggers live in TOML files inside `.quellis/packs/<pack-id>/`. The plugin's hook scripts load them at hook-fire time; the CLI's `quellis teach` writes new ones; `hooks/lib/validate_pack.py` enforces the schema.

This document is the specification. Real trigger content (the 7 non-negotiable + 5 convention + 3 evidence triggers from plan tasks 1.D.3–1.D.5) lives in `docs/trigger-mockups/` until Ondrej reviews the tone, then promotes to `packs/core/`.

## Pack types

V1.0 ships two pack file types, distinguished by `schema_version`:

| File | `schema_version` | Read by hook |
|---|---|---|
| `pretool-triggers.toml` | `"pretool.v1"` | `pretool.sh` → `pretool_match.py` |
| `stop-triggers.toml` | `"stop.v1"` | `stop.sh` → `stop_match.py` |

Both live at `.quellis/packs/<pack-id>/`. The default pack id is `core` and is installed by `quellis init`.

## `pretool.v1` schema

```toml
schema_version = "pretool.v1"

[[trigger]]
id           = "non-negotiable.git-force-push-main"
type         = "non-negotiable"   # or "convention"
match_tool   = "Bash"             # exact Claude Code tool name
match_regex  = "^git push (--force|-f) .*(main|master)\\b"
block_reason = "Force-push to a protected branch — escalate to a maintainer."
```

### Required fields

| Field | Type | Meaning |
|---|---|---|
| `id` | string, unique within pack | Identifier; appears in stderr block messages and in `acceptance-log.jsonl`. Convention: `<kind>.<short-name>` (e.g. `non-negotiable.git-force-push-main`). |
| `type` | `"non-negotiable"` \| `"convention"` \| `"evidence"` | Determines whether intensity affects it. Non-negotiables fire regardless; conventions are suppressed at `chill` intensity. |
| `match_tool` | string | Exact tool name (`Bash`, `Edit`, `Write`, etc.). |
| `match_regex` | Python regex string | Matched against the flattened tool input. Searches across `command`, `file_path`, `content`, `pattern`, `url`, then the full JSON blob as fallback. |
| `block_reason` | string, ≤ 200 chars, ASCII (+ `…—–·` allowed) | Emitted to stderr when the trigger fires. **Subjective Contract:** complete sentences, lead with the concern in 8 words or fewer, no emojis. |

### Optional fields (V1.1+)

| Field | When it lands | Purpose |
|---|---|---|
| `inject_on` (glob) | V1.1 (1.C / 2.C) | When the agent touches a file matching this glob, inject the trigger's doctrine card preemptively rather than only blocking. |
| `accept_window` (seconds) | V1.2 | After this trigger fires, if the user does NOT undo within this window, count it as "accepted" in the acceptance log. |
| `evidence_pattern` (regex) | V1.1 | For convention triggers that want to enforce "X requires Y in the same change," matched against transcript context. |

V1.0 ships only the required fields. The validator accepts unknown fields with a warning so V1.1 packs are forward-compatible.

## `stop.v1` schema

```toml
schema_version = "stop.v1"

[[trigger]]
id           = "claim.done-without-test-evidence"
type         = "evidence"
claim_regex  = "\\b(done|verified|safe|tested)\\b"
block_reason = "You wrote \"done\" without test evidence. Show the run or restate as uncertain."
```

### Required fields

| Field | Type | Meaning |
|---|---|---|
| `id` | string, unique within pack | Same convention as pretool. |
| `type` | `"non-negotiable"` \| `"convention"` \| `"evidence"` | Stop triggers are usually `"evidence"`. |
| `claim_regex` | Python regex (case-insensitive) | Matched against the assistant's last message. |
| `block_reason` | string, ≤ 200 chars | Same rules as pretool. |

### Phase 1.E additions (`requires` field)

V1.0 detects the claim shape only. Phase 1.E adds a `requires` field naming the evidence kind the trigger demands, plus the `hooks/lib/evidence-search.py` helper that walks the transcript and confirms whether the evidence is actually present before the block fires.

Until 1.E ships, every claim match blocks. This is conservative (some false positives) but safer than the alternative (false negatives missed).

## Anti-patterns

The validator enforces:

- **No emojis or decorative characters.** ASCII only, plus the small allowed set `… — – ·`. Subjective Contract anti-goal: NOT cute.
- **No block_reason longer than 200 chars.** Hard ceiling per the plan.
- **No duplicate `id` within a pack.** Logs would become ambiguous.
- **Regex must compile.** Bad patterns are caught at validation time, not at hook-fire time.

The validator is pure Python stdlib. Run it from the plugin root:

```bash
python3 hooks/lib/validate_pack.py path/to/pretool-triggers.toml
```

## Why the schema is intentionally narrow

The plan's Subjective Contract names what V1.0 is *not*: not a teacher, not a linter, not verbose, not configurable to anything. Trigger packs are correspondingly narrow:

- One regex per trigger. No DSL.
- One block_reason. No conditional messaging.
- Intensity is the only personalization knob in V1.0.
- The agent does not see the regex or the trigger's internal structure — just the `[quellis:<id>] <block_reason>` line on stderr.

V1.1+ adds richer semantics behind a stable schema version. V1.0 stays mechanical.
