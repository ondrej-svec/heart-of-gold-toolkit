---
name: brainstorm
description: >
  Narrowly-scoped problem framing for a single coding task. Use before
  `/quellis-architect:plan` when the task shape is fuzzy — what's the
  smallest version that ships value, what are the load-bearing
  constraints, what evidence will count as done. Triggers: brainstorm,
  frame, scope, what's the smallest version, how should I cut this.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
---

# Brainstorm (coding-agent task framing)

A tight discovery pass for a single coding task. Answers **what is the smallest version that ships value, and what evidence will count as done.** Hands a short brainstorm note to `/quellis-architect:plan`, which writes the evidence contract.

This skill is deliberately narrower than `deep-thought:brainstorm`. That skill is for product/feature-level decisions. This one is for "I'm about to ask an agent to do a chunk of engineering — what's the right cut."

## Boundaries

**This skill MAY:** read code, grep for patterns, ask one or two reframing questions, write a short brainstorm note.
**This skill MAY NOT:** write or edit code, run tests, install packages, deploy, propose the plan, write the evidence contract.

**Do not write code in this skill. The whole point is to commit to nothing yet.**

## Common Rationalizations

| Shortcut | Why it fails | The cost |
|---|---|---|
| "The task is clear, skip framing" | Tasks dressed as clear usually carry one hidden assumption. Naming it up front beats discovering it on hour three. | Rework when the assumption breaks. |
| "Bigger cut is better — fewer round trips" | The agent loses context the larger the slice. Narrow slices fail visibly. Wide slices fail invisibly. | Silent half-completion. |
| "Brainstorming is for product, not for plumbing" | Plumbing decisions encode plumbing constraints. If you don't name them now, the agent will guess. | Wrong-shape solution. |

## Phase 0: Decide whether brainstorming is needed

**Skip this skill when** any of these hold:

- A `docs/brainstorms/` doc already covers the task at the right cut.
- The task is a one-line bug fix with an obvious root cause.
- The user already has a clear acceptance test in mind.

In those cases, jump to `/quellis-architect:plan` directly.

**Brainstorm when** any of these hold:

- The user describes a goal but not a slice.
- Multiple plausible cuts exist, and the choice has consequences beyond this PR.
- The task touches a footgun directory (auth, migrations, scoring, payments).

## Phase 1: Reframe the ask in two questions

Open with two questions, in order. **Do not list more.** The point is to force a small move, not a survey.

1. **What's the smallest version of this that ships value?**
   The smallest version is rarely the user's first description. Surface it.

2. **What would have to be true for you to call this done?**
   "Done" is the evidence contract in disguise. The answer feeds `/quellis-architect:plan` directly.

If the user can't answer #2 specifically, that's the brainstorm finding — the task isn't ready for an agent. Recommend they write a short acceptance test by hand first.

## Phase 2: Surface the load-bearing constraints (≤ 3)

Read the immediate code surface. Grep for the patterns the task touches. Identify **at most three** constraints that change the shape of the solution. Examples:

- "This touches the migrations/ directory — the §2.D backfill rule applies."
- "The auth/ folder has no public API; new code must route through the existing session module."
- "There's no test infra for this path; verification will need a manual SQL query."

If more than three constraints stand out, the task is too big — recommend cutting before planning.

## Phase 3: Write the brainstorm note

Write to `docs/brainstorms/<YYYY-MM-DD>-<short-slug>.md` (or the project's brainstorm directory override). Keep it under 30 lines. Structure:

```markdown
---
title: "<task title>"
type: brainstorm
date: <YYYY-MM-DD>
status: ready-for-plan
---

# <task title>

## Smallest version
<one paragraph: what ships if we only ship this>

## What "done" looks like
<3-5 bullets of testable conditions — these become the evidence contract claims>

## Load-bearing constraints
<≤ 3 bullets, each with a code pointer>

## Open questions
<questions the user must answer before /plan; one per line; mark "BLOCKING" or "PARKED">
```

The brainstorm note is the input to `/quellis-architect:plan`. It does not need to be exhaustive; it needs to be *clear about the cut*.

## Phase 4: Hand off

Tell the user: "Brainstorm ready at `<path>`. Run `/quellis-architect:plan <path>` next, which will write the evidence contract." Do nothing further.

## What makes this Quellis-shaped

- **Two questions, not twenty.** The deep-thought version explores; this one commits.
- **Three constraints max.** More means cut harder, not plan harder.
- **Always produces a written note.** Verbal brainstorms vanish; the contract that follows needs an anchor.
- **Stops at the contract handoff.** This skill does not propose the plan. The split prevents scope drift.
