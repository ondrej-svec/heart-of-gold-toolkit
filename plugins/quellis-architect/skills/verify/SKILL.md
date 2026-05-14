---
name: verify
description: >
  Walk the active evidence contract claim-by-claim and gather the
  evidence each claim requires. Run before Stop. Produces a verify
  report; does not bypass the Stop hook. Triggers: verify, check the
  contract, run the verify pass, am I actually done.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Write
  - Edit
---

# Verify (walk the contract before claiming done)

A pre-Stop verification pass that walks the active evidence contract claim-by-claim, gathers the evidence each claim requires, and reports pass/fail per claim. This is the *agent's* tool for proving readiness, not a backdoor around the Stop hook.

If a claim's evidence is present, the Stop hook will let the agent say the corresponding thing. If it's missing, this skill says so plainly so the agent fixes the work, not the message.

## Boundaries

**This skill MAY:** read the contract, run commands listed in the contract's evidence kinds (`cargo test`, `pytest`, `SELECT …`, `gitleaks`, `git diff`), write a verify report to `.quellis/contracts/<task-id>-verify.md`, **after a full-PASS report, prompt the user to mark the contract `completed` and — only on explicit yes — flip `status = "completed"` and clear the `active.toml` pointer.**
**This skill MAY NOT:** edit code, modify the contract to make claims pass, auto-complete the contract without the user's explicit yes, run destructive commands (drops, deletes, force pushes).

**Verify gathers evidence. It does not generate evidence.** If tests fail, the verify report says they fail. The agent's response is to fix the code, not rerun verify hoping for different output.

## Common Rationalizations

| Shortcut | Why it fails | The cost |
|---|---|---|
| "Tweak the claim_regex so my claim no longer matches" | Defeats the contract. The gate exists because the claim is dangerous to assert without evidence. | Silent regressions; the next agent inherits a lying contract. |
| "Auto-mark completed on PASS — skip the prompt" | A verify run that passes can still be wrong (false-positive evidence: test ran but tested the wrong thing). The human-yes is the last guard. | Premature completion buries claims that should have triggered a second look. |
| "Run verify until it passes" | If a claim fails, the answer is to make the code prove the claim — not to rerun the same gather. | Wasted cycles; underlying issue persists. |
| "Skip claims that don't have evidence yet" | Skipping is the contract's job, not yours. Stop's evidence-search already suppresses claims with present evidence. | Verify report disagrees with Stop hook; agent confused about which to trust. |

## Phase 0: Load the active contract

Read `.quellis/contracts/active.toml` to get the task_id. Load `.quellis/contracts/<task-id>.toml`.

**If no active contract:**
Tell the user: "No active contract. Run `/quellis-architect:plan` first, or proceed without per-task gates — the global stop-triggers.toml still applies." Stop.

**If contract status is not `active`:**
Tell the user: "Contract `<task-id>` is `<status>`. Activate it or write a new one before verifying." Stop.

## Phase 1: Walk each claim in order

For each `[[claim]]` in the contract, in order:

1. **State the claim**: print `claim: <id> — <claim_regex>` so the user sees what's being checked.
2. **Identify the evidence kind**: `test-run`, `verification-query`, `scan-output`, `diff-confirmation`, or absent.
3. **Gather evidence**:
   - `test-run` → ask the user (or read the repo) for the project's test command; run it; capture the result.
   - `verification-query` → ask the user for the SQL or `information_schema` query that proves the schema change; run it; capture the result.
   - `scan-output` → run the project's secret scanner (`gitleaks detect`, `trufflehog filesystem .`); capture the result.
   - `diff-confirmation` → run `git diff` or `git show HEAD` on the relevant paths; capture the output.
   - absent (always-block claim) → mark FAIL with note "claim has no evidence kind; this gate cannot be passed by verify; restate the claim with uncertainty or remove from the contract."
4. **Mark per-claim PASS or FAIL**:
   - PASS: evidence was gathered and matches the contract's intent (e.g., test-run exit 0, query returned the expected shape).
   - FAIL: evidence missing or wrong shape. Print the actual command output verbatim — the agent needs to see what failed.

Run claims sequentially. If one fails, **continue with the rest** — verify is a report, not a short-circuit. The agent needs the whole picture to plan the next fix.

## Phase 2: Write the verify report

Write `.quellis/contracts/<task-id>-verify.md` (overwrite any prior):

```markdown
---
task_id: <task-id>
verified_at: <ISO-8601 timestamp>
overall: <PASS | FAIL | PARTIAL>
---

# Verify report — <task-title>

## Summary
- claims passed: <n>/<total>
- claims failed: <n>/<total>

## Per-claim detail

### <claim-id> — <PASS | FAIL>
- evidence kind: <requires>
- command: `<actual command run>`
- result: <one-line summary>
- output (relevant excerpt):
  ```
  <verbatim output, ≤ 30 lines>
  ```

<… one section per claim …>

## Next move
<for FAIL claims: name the smallest fix that would flip the claim to PASS.
 for all-PASS reports: state that Stop will accept the contract's claims now.>
```

## Phase 3: Report to the user

Tell the user:

```
Verify ran for contract <task-id>.
<n>/<total> claims passed.

<For each FAIL: claim id + one-line reason>

Full report: .quellis/contracts/<task-id>-verify.md
```

## Phase 4: Propose completion on full PASS (else stop)

**If any claim FAILED:** stop here. The user reads the report and decides the next move. Verify is done.

**If every claim PASSED:** ask the user, exactly once:

```
All <total> claims in <task-id> pass. Mark the contract completed?

  y — flip status to "completed" and clear the active pointer
  n — leave the contract active (default if no answer)
```

- On explicit `y` (or "yes"): edit `.quellis/contracts/<task-id>.toml` to set `status = "completed"`, then delete `.quellis/contracts/active.toml`. Confirm both writes in a one-line summary.
- On `n`, silence, or anything ambiguous: leave the contract as-is and say "Contract stays active. Mark it completed with `/quellis-architect:contract complete <task-id>` when you're sure."

**Never flip the status without explicit yes.** A full-PASS verify run can still be wrong (the test ran the wrong assertions, the verification-query checked the wrong rows). The human-yes is the last guard against false-positive evidence.

## What makes this Quellis-shaped

- **Report, not override.** Verify lives in the same toolchain as the Stop hook; it cannot bypass it.
- **Per-claim continuation.** A failed claim doesn't abort the run — the agent gets the full picture to plan from.
- **Verbatim output in the report.** No paraphrasing. The agent's next move depends on knowing what actually happened.
- **No code edits.** This skill reads and runs; the actual fix is a follow-up turn after the user reads the report.
- **Completion needs an explicit yes.** Full-PASS doesn't auto-close the contract; the human stays in the loop on the final transition.
