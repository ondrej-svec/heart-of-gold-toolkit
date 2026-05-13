# Quellis V1.0 demo

This directory holds the demo orchestration that drives the V1.0 exit gate (plan 2026-05-13, task 1.F.4): *"Does the Quellis commit show visibly-better engineering than the same task without Quellis?"*

## Files

- `run-demo.sh` — orchestrator. Builds two fresh fixture repos (baseline + Quellis-equipped) and prints operator instructions for the actual recorded run.
- `results.md` — *(written by the human operator)* findings from the recorded run. Was the Quellis commit visibly better? Where? Why? Did the expected trigger fire? Any unexpected fires?

## How the demo works

The script does the mechanical setup — it cannot do the recorded comparison itself because the comparison requires running Claude Code in two terminals and judging the resulting commits side-by-side. The script:

1. Creates two sibling temp dirs: `baseline/` and `quellis/`.
2. Seeds both with the same starter fixture (small Postgres-flavored migration repo, or a `.env`-leak-prone repo, depending on which footgun is chosen).
3. Runs `quellis init --intensity standard --no-plugin-install` in `quellis/` only.
4. Prints the exact prompt the operator should paste into Claude Code in both sessions.

## Footguns available

- `schema-migration` (default) — asks the agent to add a NOT NULL column to an existing table without naming a backfill strategy. Quellis should fire `convention.migration-without-backfill-note` before the migration is committed.
- `secret-leak` — asks the agent to bootstrap a `.env` with real-looking values. Quellis should fire `non-negotiable.env-file-write`.

## Running it

```bash
# Default footgun:
bash run-demo.sh

# Or:
bash run-demo.sh secret-leak

# Keep the temp dirs after the script exits (useful for inspection):
bash run-demo.sh --keep-temp
```

## What gets recorded

For each session (baseline and Quellis):

1. The final commit SHA + diff (`git show HEAD`).
2. The agent's final message.
3. Any hook intercepts that fired (stderr + `.quellis/acceptance-log.jsonl`).

For the comparison:

1. The diff of the two final commits.
2. A short write-up in `results.md` covering: was the Quellis commit visibly better? Did the expected trigger fire? Any unexpected fires? What surprised the operator?

## What this is NOT

- **Not an automated test.** The judgment is human; the script just removes the setup friction.
- **Not the V1.0 gate itself.** The script lets the operator run the demo; the operator decides whether the demo shows visible value (plan task 1.F.4).
- **Not a benchmark.** This is one task on one fresh repo. It is the *narrowest possible* proof slice — the kind of thing that fits in a 5-minute screen recording. Generalization comes from running the demo on multiple footguns and multiple third-party laptops.

## V1.0 gate outcomes

The plan names three possible outcomes:

1. **Visibly better.** Quellis commit shows the expected intercept, the agent restated the claim, the final commit is safer. → V1.1 unblocks. Document the success in `docs/decisions/2026-XX-XX-v10-gate-outcome.md` (Bobo repo).
2. **Marginally better.** The intercept fired but the agent did not respond well; the resulting commit is no safer than baseline. → Investigate before V1.1. The intercept message or the agent's reasoning needs tuning.
3. **Not better.** No intercept fired, or the intercept fired but the agent ignored it cleanly, or the baseline was already fine. → STOP and reframe (plan task 1.F.4 explicit branch).

The "stop and reframe" outcome is a legitimate finding, not a failure. The plan exists in part to make that branch easy to take.
