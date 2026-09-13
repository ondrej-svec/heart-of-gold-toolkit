---
name: work
description: >
  Execute a plan from start to ship — read tasks, implement in dependency order, test
  continuously, commit incrementally, run quality checks, and push. The plan's checkboxes
  are the tracker. Triggers: work, execute plan, implement, start work, build, ship, finalize,
  release, push, ready to ship, done building.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - Write
  - Edit
  - Bash
---

# Work

Execute a plan and ship it. This is the ONLY skill that writes code. Read tasks, implement in dependency order, test after every change, commit incrementally, quality checks, push.

## Boundaries

**This skill MAY:** read code, write code, edit files, run tests, run linters, commit, push, create PRs.
**This skill MAY NOT:** skip the plan, skip tests, ship with known failures, commit `.env` or secrets.

**This skill requires an execution plan and explicit authorization.** If no plan exists, suggest `/deep-thought:plan`; do not improvise implementation from scratch.

### Interaction and readiness policy

Natural conversation is the default. Inspect evidence before questioning. Classify unknowns as user decisions, agent investigation, or later verification, naming the blocking phase and owner. Ask focused questions only when an answer determines progress (up to three independent related prose clarifications), with evidence-based recommendation/tradeoffs where useful. Preserve decisions and stop when clear. Use structured UI only for a meaningful choice/approval; prose and custom qualifications always work. Required tasks inside an authorized, ready scope are obligations and progress, not alternatives. Plan existence/status, readiness (including subjective preview gates), and execution authorization are separate. Explicit execution intent authorizes the stated scope subject to gates: natural requests such as "Implement the ready plan at docs/plans/x.md" and `/work <path>` both count. A path mention, review, recommendation, blank answer, dismissal, or timeout does not. Once authorized and ready, execute independently without per-task reapproval; a blocker stops only dependent work.

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Skip reading the plan — I'll figure it out" | The plan has context, decisions, and dependencies you'll miss | Build the wrong thing → rework |
| "Giant commits — I'll sort it out later" | Hard to review, hard to revert, hide bugs | Technical debt + review burden |
| "Tests at the end — I'm in flow" | Late testing finds problems when fixing them is most expensive | Cascading failures |
| "Ship without quality checks — small change" | Small changes touch auth, data, or boundaries more often than you think | Bug in production from a "safe" change |

---

## Phase 0: Load the Plan

**Entry:** User requests execution in natural language or invokes `/work`, with a plan path or identifiable scope.

**If the user explicitly requests execution (for example "Implement this plan" or `/work <plan-path>`):**
1. Read the plan completely and identify tasks, dependencies, acceptance criteria, status, readiness, preview gates, and scope.
2. Record the authorized scope; start only its ready tasks. Do not require literal slash-command syntax or re-ask an already authorized transition. An old `approved` status does not override current user intent or unresolved gates.

**If a path is merely mentioned, supplied for review, or recommended:** read/review it if requested, but do **not** start work.

**If invoked without a path:** inspect active plans and ask for an explicit execution request only if no unambiguous authorized scope is already in the user request. Do not turn required tasks into a scope menu.

**If anything is unclear:** first investigate agent-owned gaps. Ask only a blocking, user-owned clarification; do not re-ask settled scope.

If the plan authorizes design-heavy, copy-heavy, or boundary-sensitive work, verify before leaving Phase 0 that the plan already includes:
- target outcome and anti-goals
- references and anti-references
- proof-slice or rollout rule
- explicit rejection criteria
- preview artifacts when the task depends on human judgment

If those items or a required preview approval are missing, report the blocked dependent work and return to planning/review. Continue any independent authorized, ready phase; do not mark the whole plan complete while later gates remain unchecked.

### Autonomy Activation

After explicit execution authorization **and** documented readiness gates: execute autonomously without re-litigating the approved scope or seeking per-task approval.

- **Challenge only on clear anti-patterns** during execution: skipping tests, unsafe patterns, ignoring documented constraints, scope creep beyond the plan.
- **Quality checks are never skipped** regardless of mode — Phase 3 always runs.
- **After Phase 5 (Report):** If a novel pattern was encountered during work (new approach, unexpected gotcha, reusable technique), suggest `/marvin:compound` to capture it.
- **Check `docs/solutions/` for the relevant domain** before starting implementation — avoid known pitfalls.
- **Pre-flight grounding**: Before starting implementation, invoke `/ground` as a subagent for the plan's domain. The briefing it returns populates the implementation context with current ecosystem state — recent releases, known footguns, version-aware docs.

  ```
  Task grounder("Follow /marvin:ground protocol for: <plan title or topic>. Survey the repo at <cwd> and ground externally. Return synthesized briefing.")
  ```

  - **Skip** when the plan is `confidence: high` AND scoped to a single small fix — grounding overhead isn't worth a one-line change.
  - When `docs/ground/<fingerprint>.md` is already fresh (<7d old), `/ground` returns the cached briefing itself — invoke it anyway; the freshness check lives inside `/ground`, not here.
  - **Graceful degradation**: if `/ground` is unavailable or fails, proceed without grounding. It is advisory, never blocking.


**Exit:** Plan loaded, tasks understood, ready to set up environment.

---

## Phase 1: Set Up Environment

**Entry:** Plan loaded.

Check current state:
```bash
git branch --show-current
git status --short
```

Follow the project's branching conventions (check CLAUDE.md). Pull latest changes before starting.

**If on a feature branch:** Continue on it.
**If on main/default branch:** Check CLAUDE.md for branching rules.
  - **If project uses trunk-based development:** Continue on main.
  - **If project uses feature branches:** ask the consequential branch choice with the project evidence and tradeoff. A structured UI is optional; plain prose/custom qualification remains valid.

Update plan status to `in_progress` only when execution is explicitly authorized and the started scope is ready.

**Exit:** Branch ready, latest code pulled.

---

## Phase 2: Execute Tasks

**Entry:** Environment set up.

Create visible task tracking from the plan for each major task.

- If the harness provides task or progress UI, it may mirror major tasks.
- Otherwise report task transitions clearly in text (`in progress`, `completed`, `blocked`) and keep plan checkboxes as the source of truth.
- Never present required tasks as a selectable handoff or seek approval again for each task.

For each task in dependency order:

```
while (unchecked authorized, ready tasks remain):
  1. Mark the current task as in progress
  2. Read the task and any referenced files
  3. Look for similar patterns in the codebase (grep, glob)
  4. Implement following existing conventions
  5. Run relevant tests
  6. If tests pass → mark the task completed
  7. Check off the task in the plan ([ ] → [x])
  8. Evaluate: commit now or continue?
```

**Commit heuristic:** Commit when you've completed a logical unit — a model, a service, a component, a migration. Don't commit partial units. If the commit message would be "WIP", keep working.

**When tests fail:** Fix immediately. Don't move to the next task with broken tests. If a test failure reveals a plan problem, update the plan.

**Follow existing patterns:**
1. Read the codebase first — find similar patterns before writing new code
2. Match conventions exactly — naming, structure, error handling, test patterns
3. Reuse existing components — don't build what already exists
4. Check CLAUDE.md for project conventions

**Stage specific files — never `git add .`**

If the plan requires a proof slice, do not propagate beyond that slice until its verification passes. If preview review or plan adherence fails, update the plan instead of improvising the missing contract in code.

**Exit:** All currently authorized, ready tasks checked off and tested. If later tasks remain gated, report them as unchecked rather than treating the plan as complete.

---

## Phase 3: Quality Checks

**Entry:** The current authorized scope is implemented, whether the whole plan or an explicitly independently shippable phase.

Always run applicable quality checks before committing/pushing this checkpoint; later gated tasks are not a reason to skip checks:

**Tests:**
```bash
# Run the project's test suite (check CLAUDE.md for the command)
# All tests must pass
```

**Linting:**
```bash
# Run the project's linter (check CLAUDE.md for the command)
# Fix any violations
```

**Convention check:**
- Does the code follow the project's patterns?
- Any files that shouldn't be committed? (.env, credentials, large binaries)

**If any check fails:** Fix before proceeding. Do not ship with known issues.

**Exit:** All quality checks pass.

---

## Phase 4: Ship

**Entry:** Quality checks pass.

**Pre-ship gate — all must be true:**
- [ ] All tasks and gates for the shipping scope are complete; if this is an independent phase, later work remains unchecked and explicitly recorded
- [ ] Tests pass (ran after last change)
- [ ] Linter clean
- [ ] No `.env`, credentials, or secrets staged
- [ ] Commit messages describe complete units

**If any gate fails:** Fix it. Don't ship with known issues.

Commit the verified scope and push; create a PR if the project requires one. An explicitly independently shippable phase may reach this checkpoint while later phases are gated. A source push is not publication, deployment, or activation; those need their own authorization and applicable release checks.
```bash
git push origin <branch>
# If using branches:
gh pr create --title "{short title}" --body "{summary + testing notes}"
```

Update plan status to `complete` only when every plan task and required gate is complete; otherwise retain `in_progress` and record the remaining blocked phase.

**Exit:** Code pushed.

---

## Phase 5: Report and Handoff

**Entry:** Verified scope committed/pushed, or a blocking gate prevents further work.

Present the actual checkpoint, never a blanket completion claim:

```markdown
Completed scope: {whole plan or named independent phase}
Source: {commit and push status}; activation: {actual status}
Checks: {what ran and passed, or what is blocked}
Remaining: {unchecked gated work and owners, or none}
Acceptance criteria: {met for this scope / outstanding verification}
```

Report completed scope, remaining independent/dependent work, checks, and the appropriate next step. Do not use a fixed handoff menu. If the user requests release notes, then:

| Audience | Focus |
|----------|-------|
| **Customer** | What they can do now that they couldn't before |
| **Engineering** | What changed, which services, why, test coverage |
| **Business** | Business value, metrics affected |

---

## Validate

Before shipping, verify:

- [ ] All tasks/gates in the shipping scope are complete; later gated work is recorded
- [ ] Tests pass — ran after the last change
- [ ] Quality checks pass — including independent-phase checkpoints
- [ ] Plan status is `complete` only if all plan tasks/gates are done; otherwise `in_progress`
- [ ] Commits are atomic — one per logical unit, no WIP

## What Makes This Heart of Gold

- **Building:** Execute plans, write code, run tests. The core loop.
- **The 90/10 Craft:** AI generates the code. Your job: matching patterns, catching edge cases, verifying correctness.
- **Creative Courage:** Ship incrementally. Each commit is a working checkpoint.
- **No overhead:** Plan checkboxes are the tracker. One skill from start to shipped.
