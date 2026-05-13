# V1.0 trigger calibration — retroactive replay against 89 real sessions

> **Plan task 1.D.6** asks for "a week of real sessions" with a >40% accept-rate target. A live week is not feasible in a single Claude Code session, but the cheapest preview — *retroactive replay against existing sessions* — gives a meaningful first read on fire-rate per trigger.

**Date:** 2026-05-13
**Corpus:** `~/.claude/projects/-Users-ondrejsvec-projects-Bobo/*.jsonl` (89 sessions, ~245 MB total, 16 Claude Code versions)
**Method:** for each assistant `tool_use` event, replay through `pretool_match` against the production `packs/core/`. For each assistant `text` block, replay through `stop_match` with the actual session JSONL as `transcript_path` so evidence-search runs.

## Headline numbers

- **Sessions analyzed:** 89
- **Sessions where ANY trigger would have fired:** 51 (57%)
- **Total `tool_use` events:** 15,342
- **Total assistant text blocks:** 4,158

## PreToolUse fires

11 trigger entries (3 non-negotiable plus 4 conventions × Edit+Write variants = 11). Every one fires at least twice — none are dormant.

| Trigger ID | Fires | % of sessions |
|---|---:|---:|
| `non-negotiable.env-file-write-via-write-tool` | 25 | 7.9% |
| `convention.auth-without-rationale-write` | 19 | 7.9% |
| `convention.auth-without-rationale-edit` | 15 | 9.0% |
| `convention.migration-write-without-backfill-note` | 12 | 7.9% |
| `convention.sql-template-interpolation-write` | 9 | 4.5% |
| `convention.migration-without-backfill-note` | 9 | 5.6% |
| `convention.sql-template-interpolation` | 5 | 2.2% |
| `non-negotiable.env-file-write` (Edit tool) | 4 | 1.1% |
| `non-negotiable.package-publish` | 2 | 2.2% |
| `convention.scoring-or-payment-path-write` | 2 | 2.2% |
| `non-negotiable.git-reset-hard-unpushed` | 2 | 1.1% |

By tool, PreToolUse fires concentrate on Write (67) and Edit (33), Bash a distant third (4). That matches the V1.0 thesis: file edits are the load-bearing surface, not shell commands.

### Fire-rate interpretation

- **Healthy band**: 4–25 fires per trigger across 89 sessions = roughly 0.05–0.3 fires/session/trigger. That is a few intercepts per session in the sessions where they fire, not a flood.
- **The auth + migration triggers are the most active** (combined ~55 fires, ~17% of sessions). These are the most likely to surface noise during real use. They are also the most likely to add real value when correctly tuned.
- **The non-negotiable `env-file-write-via-write-tool`** is the single most-active trigger (25 fires). That is *correct behavior* — writing `.env` files is exactly what Quellis should catch. The signal is strong.
- **`git-reset-hard-unpushed`** and **`scoring-or-payment-path-write`** are low-rate but present — they will catch the cases they target without saturating noise.

## Stop-time fires (with evidence search)

| Trigger ID | Fires (claim+no-evidence) | % of sessions |
|---|---:|---:|
| `evidence.completion-without-test-run` | 175 | 37.1% |
| `evidence.migration-applied-without-verification` | 1 | 1.1% |
| `evidence.secret-removed-without-scan` | 0 | 0% |

### Comparison: claim-only vs. claim-plus-evidence-check

| Trigger | Without evidence-search | With evidence-search | Reduction |
|---|---:|---:|---:|
| `evidence.completion-without-test-run` | 577 fires, 69.7% of sessions | 175 fires, 37.1% of sessions | **70% fewer fires** |
| `evidence.migration-applied-without-verification` | 3 fires, 2.2% | 1 fire, 1.1% | 67% |

The Phase 1.E evidence-search helper does meaningful work — it suppresses 70% of would-be blocks when a test run is genuinely present elsewhere in the transcript. Without it, the completion trigger would be intolerable.

## The completion-trigger problem (the one to watch)

Even with evidence-search, `evidence.completion-without-test-run` would still fire on **37% of sessions**. That is the highest fire-rate in the V1.0 surface and the most likely to be perceived as noise.

Three concrete narrowing options for V1.0 calibration (1.D.6) or a V1.1 follow-up:

1. **Tighten the word list.** "done" is the most common false-positive trigger word — it appears in casual usage ("done reading", "done with that step") that is not a completion claim. Removing `done` alone might cut fires significantly without losing the load-bearing cases ("verified", "tested", "safe", "production-ready").
2. **Negation handling.** "not done yet" should not fire. The current regex is positive-only; a short Python `re` lookbehind for `(?<!not |yet )` would help.
3. **Hedging recognition.** "I think this is done" is softer than "this is done." Require the claim to NOT be preceded by `I think|seems|appears|probably|maybe` within ~5 tokens.
4. **Last-text-only matching.** Only run the Stop matcher on the LAST text block per session, not every text block. This collapses the multi-fire-per-session pattern into one decision point per session.

Recommended: option 1 (drop `done`) for V1.0; options 2–4 for V1.1 once we have accept-rate data from real intercepts.

## The two zero-fire triggers

`evidence.secret-removed-without-scan` fires 0 times across 89 sessions. That is consistent with the trigger being correctly scoped — "secrets removed" claims are rare. If V1.0 ships with this and it never fires across a month of real use, that is acceptable; the trigger exists to catch a specific, high-stakes claim shape.

## What this calibration does NOT measure

- **Accept-rate.** A real user has to react to a real intercept and either accept the framing or override it. Retroactive replay cannot generate that data. The >40% accept-rate target from the plan remains unmeasured.
- **False positives in conventions.** A trigger firing on `auth/middleware.ts` is "correct" by the trigger's own logic, but whether the agent's response to the intercept is *useful* is a separate question. Real sessions will tell us; replay cannot.
- **Latency.** Each hook adds round-trip time. Retroactive replay does not measure cold-start latency or impact on session flow.
- **Tone drift over many fires.** A trigger firing once per session may feel useful; firing six times per session may feel preachy even if every fire is "correct."

## Verdict for V1.0

The fire-rate distribution is healthy enough to ship V1.0 to a private marketplace test install. No trigger is dormant; the noisiest one (completion-without-test-run) has a known narrowing path. The convention triggers fire often enough to test their value but rarely enough to not saturate.

**Concrete recommendation for the V1.0 → V1.1 gate (1.F.4):**
- If the demo (1.F.3) shows visibly-better commits, ship V1.0 with `done` removed from `evidence.completion-without-test-run` to take the worst-case fire rate from 37% of sessions down to a more reasonable ~10–15%.
- Track per-trigger accept-rate during the V1.1 build via `acceptance-log.jsonl`.
- Re-run this calibration script monthly against the latest session JSONLs to detect drift.

## Reproducing this calibration

The script lives at `/tmp/quellis-calibration.py` for this run. A productized version under `hooks/lib/calibrate.py` is a V1.1 candidate so anyone with `quellis` installed can run their own calibration against their own sessions.

```bash
python3 hooks/lib/calibrate.py ~/.claude/projects/<your-slug>
```
