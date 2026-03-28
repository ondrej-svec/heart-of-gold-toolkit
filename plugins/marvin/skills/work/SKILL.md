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
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - Write
  - Edit
  - Bash
---

# Work

Execute a plan and ship it. This is the ONLY skill that writes code. Read tasks, implement in dependency order, test after every change, commit incrementally, quality checks, push.

## Boundaries

**This skill MAY:** read code, write code, edit files, run tests, run linters, commit, push, create PRs.
**This skill MAY NOT:** skip the plan, skip tests, ship with known failures, commit `.env` or secrets.

**This skill requires a plan.** If no plan exists, suggest `/deep-thought:plan` first. Don't improvise implementation from scratch.

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Skip reading the plan — I'll figure it out" | The plan has context, decisions, and dependencies you'll miss | Build the wrong thing → rework |
| "Giant commits — I'll sort it out later" | Hard to review, hard to revert, hide bugs | Technical debt + review burden |
| "Tests at the end — I'm in flow" | Late testing finds problems when fixing them is most expensive | Cascading failures |
| "Ship without quality checks — small change" | Small changes touch auth, data, or boundaries more often than you think | Bug in production from a "safe" change |

---

## Phase 0: Load the Plan

**Entry:** User invoked `/work` with a plan path or no arguments.

**If invoked with a plan path:**
1. Read the plan completely
2. Identify: tasks (checkboxes), dependencies, acceptance criteria

**If invoked without a path:**
- Check `docs/plans/` (or project override path) for the most recent active plan (`status: approved` or `status: in_progress` in frontmatter)
- **If one found:** Use **AskUserQuestion** (header: "Plan", question: "Found plan: [title]. Start working on this?") with options: "Yes, start" and "Different plan".
- **If multiple found:** Use **AskUserQuestion** (header: "Plan", question: "Multiple active plans found. Which one?") with each plan as an option.
- **If none found:** Use **AskUserQuestion** (header: "No plan", question: "No active plan found. What would you like to do?") with options: "Create a /deep-thought:plan first" and "Describe what to build".

**If anything in the plan is unclear:**
Use **AskUserQuestion** for clarifications now — better to ask than build wrong.

### Autonomy Activation

When a plan file is provided: **default to autonomous mode.** Plans are pre-approved decisions — execute without re-litigating them.

- **Challenge only on clear anti-patterns** during execution: skipping tests, unsafe patterns, ignoring documented constraints, scope creep beyond the plan.
- **Quality checks are never skipped** regardless of mode — Phase 3 always runs.
- **After Phase 5 (Report):** If a novel pattern was encountered during work (new approach, unexpected gotcha, reusable technique), suggest `/marvin:compound` to capture it.
- **Check `docs/solutions/` for the relevant domain** before starting implementation — avoid known pitfalls.

See `../knowledge/autonomy-modes.md` for confidence-gated escalation.

**Exit:** Plan loaded, tasks understood, ready to set up environment.

---

## Phase 1: Set Up Environment

**Entry:** Plan loaded.

**Auto-load relevant knowledge for the task:**
- CI/CD tasks → Read `../knowledge/ci-cd-patterns.md`
- Infrastructure tasks → Read `../knowledge/infrastructure-ops.md`

Check current state:
```bash
git branch --show-current
git status --short
```

Follow the project's branching conventions (check CLAUDE.md). Pull latest changes before starting.

**If on a feature branch:** Continue on it.
**If on main/default branch:** Check CLAUDE.md for branching rules.
  - **If project uses trunk-based development:** Continue on main.
  - **If project uses feature branches:** Use **AskUserQuestion** (header: "Branch", question: "Create a feature branch, or work on main?") with options: "New branch (Recommended)" (description: "Isolated work, easy to review") and "Stay on main" (description: "Direct commit, no PR needed").

Update plan status to `in_progress` if it was `approved`.

**Exit:** Branch ready, latest code pulled.

---

## Phase 2: Execute Tasks

**Entry:** Environment set up.

**Create trackable tasks from the plan** using **TaskCreate** for each major task:
- subject: task description from the plan
- description: context, acceptance criteria, dependencies
- activeForm: present participle (e.g., "Adding auth middleware")

For each task in dependency order:

```
while (unchecked tasks remain):
  1. TaskUpdate status → "in_progress" (shows spinner to user)
  2. Read the task and any referenced files
  3. Look for similar patterns in the codebase (grep, glob)
  4. Implement following existing conventions
  5. Run relevant tests
  6. If tests pass → TaskUpdate status → "completed"
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

**Exit:** All tasks checked off, all tests passing.

---

## Phase 3: Quality Checks

**Entry:** All tasks complete.

Run quality checks before shipping:

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
- [ ] All plan tasks checked (`[x]`)
- [ ] Tests pass (ran after last change)
- [ ] Linter clean
- [ ] No `.env`, credentials, or secrets staged
- [ ] Commit messages describe complete units

**If any gate fails:** Fix it. Don't ship with known issues.

Push and create PR if the project uses branches:
```bash
git push origin <branch>
# If using branches:
gh pr create --title "{short title}" --body "{summary + testing notes}"
```

Update plan status to `complete`.

**Exit:** Code pushed.

---

## Phase 5: Report and Handoff

**Entry:** Code shipped.

Present the summary:

```markdown
All tasks complete. Shipped.

Summary:
- [x] Task 1 — what was done
- [x] Task N — what was done

Acceptance criteria: all met / [list any that need verification]
```

Use **AskUserQuestion** with:
- question: "Work complete. What would you like to do?"
- header: "Next step"
- options:
  1. label: "Review code", description: "Run /marvin:review on the changes before merging"
  2. label: "Document insights", description: "Run /marvin:compound if this work has patterns worth preserving"
  3. label: "Release notes", description: "Generate three-audience notes (customer, engineering, business)"
  4. label: "Done", description: "All finished"
- multiSelect: false

**If user selects "Generate release notes":**

| Audience | Focus |
|----------|-------|
| **Customer** | What they can do now that they couldn't before |
| **Engineering** | What changed, which services, why, test coverage |
| **Business** | Business value, metrics affected |

---

## Validate

Before shipping, verify:

- [ ] All plan tasks checked — no unchecked boxes
- [ ] Tests pass — ran after the last change
- [ ] Quality checks pass — linting clean
- [ ] Plan status updated to `complete`
- [ ] Commits are atomic — one per logical unit, no WIP

## What Makes This Heart of Gold

- **Building:** Execute plans, write code, run tests. The core loop.
- **The 90/10 Craft:** AI generates the code. Your job: matching patterns, catching edge cases, verifying correctness.
- **Creative Courage:** Ship incrementally. Each commit is a working checkpoint.
- **No overhead:** Plan checkboxes are the tracker. One skill from start to shipped.
