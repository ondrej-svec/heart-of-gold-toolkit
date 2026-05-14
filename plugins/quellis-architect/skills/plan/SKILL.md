---
name: plan
description: >
  Produce the evidence contract for a single coding task. Decomposes
  the task into work units and names the evidence each claim will
  require at Stop time. Output is `.quellis/contracts/<task-id>.toml`
  (contract.v1). Triggers: plan this task, write the contract, what's
  the evidence, plan with quellis.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
---

# Plan (evidence contract for one coding task)

A focused planning pass that produces the **evidence contract** — the per-task TOML file the Stop hook consults before letting the agent declare anything done. Lighter than `deep-thought:plan`; produces a contract, not a multi-phase implementation plan.

The output of this skill is the input to the Stop hook (plan §2.B.2). When the agent later writes "migration applied" or "tests passing," the contract decides whether the claim needs evidence and what kind.

## Boundaries

**This skill MAY:** read code, read the brainstorm note (if any), write `.quellis/contracts/<task-id>.toml`, update the pointer at `.quellis/contracts/active.toml`.
**This skill MAY NOT:** write or edit code, run tests, deploy, install packages, decide architecture for the task.

**The contract is a claim → evidence mapping, not an implementation plan.** Resist the urge to fold in architectural decisions; those belong in `docs/plans/`.

## Common Rationalizations

| Shortcut | Why it fails | The cost |
|---|---|---|
| "Skip the contract — I'll just write tests" | Tests verify behavior; contracts verify *the agent's claims about behavior*. They're complementary, not redundant. | Agent says "verified" without running anything; hook lets it pass. |
| "Add ten claims to be safe" | Every claim is a potential block. Ten claims = high false-positive rate, agent learns to ignore them. | Trigger fatigue; contracts become noise. |
| "I'll skip `requires`; let it always block" | Always-block claims are fine for "you should never say this" patterns. For done-claims that have evidence, omitting `requires` kills the suppression escape. | Agent loops on the block forever. |
| "Reuse last contract" | Contracts are task-specific. The last one's claim shapes encode the last task's risks. | Wrong gates fire on this task. |

## Phase 0: Find the source of truth

**Entry:** user invoked `/quellis-architect:plan` with a brainstorm path, a task title, or nothing.

**If a brainstorm path is given:**
1. Read it. Extract the "What done looks like" bullets — these are the candidate claims.
2. Extract the load-bearing constraints — these inform which evidence kind each claim needs.
3. Note any BLOCKING open questions; if any exist, stop and ask the user before writing the contract.

**If a task title only is given:**
1. Recommend running `/quellis-architect:brainstorm` first if the cut is fuzzy.
2. If the user insists, ask: "What would have to be true for you to call this done?" Capture the answer as candidate claims.

**If nothing was given:**
Ask: "What task are we contracting?" Don't proceed without a task name.

## Phase 1: Decompose into 3-7 claim classes

Each claim class is a sentence the agent might write at Stop time. **3-7 is the target range.** Fewer and the contract is toothless; more and trigger fatigue ruins acceptance rates.

For each candidate claim from Phase 0, ask:

- **What evidence kind suffices?** One of `test-run`, `verification-query`, `scan-output`, `diff-confirmation`, or `null` (always block).
- **What block_reason redirects the agent?** ≤ 200 chars, complete sentence, leads with the concern in 8 words or fewer. The agent reads this — it should be a useful next-step.
- **What claim_regex catches the shape?** Be specific. `\bmigration applied\b` not `\bdone\b`. The §2.D.5 calibration learned that bare done/finished/complete are too noisy.

Reject claims that:

- Match anything the agent might say casually ("I think it works" should not block).
- Have no verifiable evidence kind ("the design is elegant" — not contractable).
- Duplicate the global `stop-triggers.toml` triggers (the contract is for *task-specific* additions; generics already fire).

## Phase 2: Write the contract

Generate a task_id: `<YYYY-MM-DD>-<short-slug>`. Match `[A-Za-z0-9][A-Za-z0-9_-]{0,127}`.

Write `.quellis/contracts/<task-id>.toml`:

```toml
schema_version = "contract.v1"
task_id        = "<task-id>"
task_title     = "<one-line title>"
created_at     = "<ISO-8601 timestamp>"
status         = "active"

[[claim]]
id           = "<short-name>"
claim_regex  = "<regex>"
requires     = "<evidence-kind>"   # or omit for always-block
block_reason = "<≤ 200 chars>"

# … one [[claim]] block per claim class …
```

Then update the pointer at `.quellis/contracts/active.toml`:

```toml
schema_version = "contract.pointer.v1"
task_id = "<task-id>"
```

If a previous contract was active, ask: "Mark <prev-task-id> completed or abandoned before switching pointer?" Don't silently overwrite.

## Phase 3: Validate

Run the validator before reporting success:

```bash
python3 $CLAUDE_PLUGIN_ROOT/hooks/lib/validate_pack.py \
  .quellis/contracts/active.toml \
  .quellis/contracts/<task-id>.toml
```

If validation fails, fix the contract before handing off. Common fails:

- block_reason over 200 chars — tighten the prose.
- claim_regex doesn't compile — escape the metacharacters.
- requires names an unknown evidence kind — restrict to the four known kinds.
- task_id has a `.` or `/` — use only `[A-Za-z0-9_-]`.

## Phase 4: Hand off

Tell the user:

```
Contract written: .quellis/contracts/<task-id>.toml
Pointer active: <task-id>
Claims: <count> covering <one-line summary>

The Stop hook will gate the named claims until evidence is present.
Run the implementation now. When you finish, /quellis-architect:verify
walks the contract claim-by-claim.
```

Do not start implementation. The plan-work split is intentional.

## What makes this Quellis-shaped

- **One file out, no implementation steps.** This is a contract, not a project plan.
- **3-7 claims, hard ceiling.** Trigger fatigue is the real failure mode.
- **Specific over generic claim regexes.** The §2.D.5 calibration was earned — don't undo it here.
- **Validates before handoff.** A malformed contract is silently ignored by the Stop hook; the user finds out only when the gate doesn't fire. Catch it now.
