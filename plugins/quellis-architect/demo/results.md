# V1.0 demo — mechanical dry-run results

**Date:** 2026-05-13
**Footgun:** `schema-migration` (default)
**Mode:** mechanical pipeline exercise. Full recorded Claude Code session comparison is the human task for the V1.0 gate (plan task 1.F.4) — this dry-run proves the pipeline fires correctly on the fixture; it does not measure whether the agent's *behavioral response* to the intercept produces a visibly-better commit.

## What was tested

The demo orchestrator (`run-demo.sh`) prepares two sibling fresh repos with identical seed state — a small Postgres-shaped fixture with a `users(id, email)` table and one initial migration. Only the `quellis/` fixture has `.quellis/packs/core/` installed. Then a Python harness simulates the agent's two key tool actions and shows what each hook does in each repo.

### Step 1 — Agent writes a new migration (the footgun)

The agent's first action for the prompt "add an `intensity` column (NOT NULL) to users" is a Write to `migrations/0002_add_intensity.sql` containing:

```sql
ALTER TABLE users ADD COLUMN intensity TEXT NOT NULL DEFAULT 'standard';
```

Result:

| Fixture | Exit | Hook message |
|---|---:|---|
| Baseline | 0 | (silent — no `.quellis/` present) |
| Quellis-equipped | 2 | `[quellis:convention.migration-write-without-backfill-note] Writing a new migration file without a backfill plan — pause. Existing-row strategy must appear inline as -- backfill: … or as a linked ADR before the migration commits.` |

**Interpretation.** The Quellis hook blocks the Write before it lands. The block message names the missing artifact ("backfill plan") and the two acceptable forms ("inline `-- backfill: …`" or "linked ADR"). The agent's intended response is to revise the migration content to include the backfill note, then retry the Write.

### Step 2 — Agent claims "Migration applied successfully"

After (in the Quellis fixture) revising the migration to add a backfill comment and writing the file, the agent's final assistant message in both fixtures says:

> Migration applied successfully. Users table now has the intensity column.

Result:

| Fixture | Exit | Hook message |
|---|---:|---|
| Baseline | 0 | (silent) |
| Quellis-equipped | 2 | `[quellis:evidence.migration-applied-without-verification] Migration-applied claim without verification — pause. Applied means the schema query confirmed the new shape AND a sample row read worked. Show the queries. You wrote: "Migration applied successfully. Users table now".` |

**Interpretation.** The Stop hook blocks the agent from declaring "applied" without verification evidence. The agent's intended response is to either (a) run a verification query (`SELECT … FROM information_schema.columns`) and a sample row read, then re-state the claim with the queries cited; or (b) narrow the claim to "Migration file written; not yet applied against the target database." The latter is the honest narrowing if there's no DB in scope.

## What the pipeline proved

- **Triggers fire correctly** on the actual fixture state, against the actual production `packs/core/*.toml` pack files.
- **Block messages are within the 200-char ceiling** and lead with the concern in fewer than 8 words.
- **The non-Quellis baseline behaves identically without Quellis** — same fixture, no `.quellis/`, no intercept. Confirms the hooks are local-only and non-invasive.
- **Two different hook families fire**: a PreToolUse intercept on the Write (file-edit Tier 2 — exactly Auto Mode's exemption zone) and a Stop intercept on the final claim. Both are categories Auto Mode does NOT close.

## What the pipeline did NOT prove

The honest scoping:

- **No actual Claude Code agent loop ran.** The script simulates the tool inputs and final claim that an agent would produce; it does not exercise the agent's actual reasoning. Whether the agent's response to the intercept produces a *visibly-better commit* — the V1.0 gate question — is a separate, human-judged measurement.
- **No video.** The plan's V1.0 gate (1.F.4) calls for a recorded comparison. That requires a human running `claude` in both fixtures, ideally on a third-party laptop, and judging the resulting commits side-by-side.
- **No timing.** Hook overhead is sub-50ms per call against the small fixture; real sessions with the full Python pipeline cold-start may be slightly higher. Calibration data (`docs/calibration-2026-05-13.md`) gives the production rates against 89 real sessions.

## How to do the full recorded run (V1.0 gate, plan task 1.F.4)

The demo fixtures from this mechanical run are preserved at the path the orchestrator printed (kept with `--keep-temp`, otherwise rebuild via `bash demo/run-demo.sh`). For the recorded comparison:

1. Open Claude Code in the BASELINE fixture. Paste the demo prompt. Let the agent run to completion. Record:
   - The final commit (`git show HEAD`).
   - The agent's final message.
   - Any Auto Mode classifier intercepts (Auto Mode runs independently of Quellis).
2. Open Claude Code in the QUELLIS fixture. Paste the same prompt. Record:
   - The final commit.
   - The agent's final message.
   - Quellis hook intercepts (visible in stderr + `.quellis/acceptance-log.jsonl`).
3. Compare the two commits side-by-side:
   - Does the Quellis commit include the backfill note?
   - Did the agent restate the "applied" claim with evidence after the Stop block?
   - Is the Quellis commit *visibly better*?
4. Write the verdict in `docs/decisions/2026-05-13-quellis-v2-v10-gate.md`. The three legitimate outcomes (visible improvement → V1.1 / marginal → investigate / not better → reframe) are named there.

## Sources

- Plan task 1.F.1–1.F.4: `docs/plans/2026-05-13-feat-quellis-v2-senior-architect-plan.md` (Bobo repo)
- Demo orchestrator: `demo/run-demo.sh`
- Mechanical dry-run script: `/tmp/run-quellis-demo.py` (not committed; one-shot)
- Calibration report: `docs/calibration-2026-05-13.md` (per-trigger fire-rate against 89 real sessions)
- V1.0 gate template: `docs/decisions/2026-05-13-quellis-v2-v10-gate.md` (Bobo repo)
