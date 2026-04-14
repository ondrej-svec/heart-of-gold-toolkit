---
name: plan
description: >
  Strategic planning with auto-calibrated detail, decision rationale, and dependency ordering.
  Use when starting a new feature, bug fix, refactor, or any non-trivial work. Produces a
  plan document with tasks, reasoning, and acceptance criteria. Triggers: plan, planning,
  create plan, implementation plan, feature plan, work plan.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - Write
  - Edit
---

# Plan

Strategic planning that fits the problem. Answers **HOW** to build what was decided in `/brainstorm` (or from scratch for clear requirements).

## Boundaries

**This skill MAY:** research (read-only), analyze codebase patterns, write the plan document.
**This skill MAY NOT:** edit code, create files beyond the plan document, run tests, deploy, implement anything.

**NEVER write code during this skill. Research and plan only.**

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Skip research — I already know the codebase" | You know YOUR mental model. The codebase may have changed. | Plan conflicts with existing code → rework |
| "Skip decision rationale — the approach is obvious" | Obvious to you, now. Not to the person executing in 2 weeks. | Decisions get questioned, re-litigated, or silently reversed |
| "Make every task detailed — more detail is better" | Over-specified plans are brittle. They break on first contact with reality. | Plan becomes a constraint instead of a guide |
| "Skip risk analysis — it's low risk" | The risks you don't name are the ones that surprise you. | Unmitigated risk → emergency debugging |

---

## Phase 0: Detect Context

**Entry:** User has a topic, brainstorm path, or feature description.

**If the user provided a brainstorm path:**
1. Read the brainstorm document
2. Extract key decisions, chosen approach, open questions
3. Announce: "Using brainstorm: [filename]. Extracting decisions."
4. **Skip Phase 1** — the brainstorm already answered WHAT to build

**If the user provided a topic but no brainstorm:**
- Check `docs/brainstorms/` (or project override path) for a recent match (last 14 days, semantic match on filename/frontmatter)
- **If one found:** Read it and announce. Skip Phase 1.
- **If multiple found:** Ask the user which brainstorm to use.
  - Prefer the harness's structured choice UI if available
  - Otherwise present a short plain-text option list with each matching brainstorm plus `None — proceed without brainstorm context`
- **If none found:** Continue to Phase 1.

**Exit:** Context understood — brainstorm consumed (if exists), scope clear enough to research.

---

## Phase 1: Refine the Idea (Only if No Brainstorm)

**Entry:** No brainstorm exists. User provided a topic or description.

Ask clarifying questions one at a time, not a questionnaire. Prefer the harness's structured question UI when available; otherwise ask plainly in text and wait for the answer before continuing:
- What problem does this solve?
- What's the desired outcome?
- Any constraints? (time, tech, dependencies)

Prefer multiple-choice questions when natural options exist. Continue until the scope is clear OR user says "proceed."

**Exit:** Scope understood well enough to research.

---

## Phase 2: Research

**Entry:** Context detected (Phase 0) or idea refined (Phase 1).

Launch research **in parallel**:

- Task researcher("Find existing patterns related to: <feature description>. Search project CLAUDE.md for conventions, codebase for similar implementations, docs/solutions/ for past fixes, and docs/plans/ for related work.")

**Surface past solutions:**
```
>> Known pattern: docs/solutions/auth/jwt-refresh-fix.md (high match)
>> Existing code: services/scoring-engine/composite.py (similar pattern)
```

**Research decision for external sources:**

- **High-risk topics (security, payments, data privacy, migrations):** Always research externally. The cost of missing something is too high.
- **Strong local context (codebase has patterns, CLAUDE.md has guidance):** Skip external research.
- **Uncertain or unfamiliar territory:** Research externally.

**If external research is needed:**
Announce the decision and proceed: "This involves payment processing — researching current best practices before planning."

### Active Memory

Search past plans for similar features. Surface proven patterns and past risks:
- If a past plan for a similar feature exists, reference it: `>> Prior plan: docs/plans/YYYY-MM-DD-feat-x.md (similar scope)`
- Note what worked and what was risky in the prior implementation
- If a past plan's approach was abandoned or caused issues, flag it: "Previous plan [X] hit [problem]. Consider [alternative]."

See `../knowledge/active-memory-integration.md` for retrieval patterns.

If the task is design-heavy, copy-heavy, or boundary-sensitive, also search for:
- existing preview artifacts or mockups
- repo docs that define tone, design, or boundary rules
- prior plans that succeeded or drifted on subjective work

Surface both positive models and anti-models. Strong autonomous planning needs references and anti-references, not just similar code.

**Exit:** Codebase patterns known, past solutions surfaced, constraints identified.

### Autonomy Gate (Medium Challenge)

After calibrating detail level, decide whether to proceed autonomously or interactively:

- **Autonomous** (brainstorm exists AND confidence is high): Proceed to Phase 4 without asking the user about detail level. State the level and reasoning, then write.
- **Interactive** (no brainstorm AND multiple valid approaches): Explore the approach with the user before writing. Use Socratic questioning: "Have you considered [alternative]? It trades [X] for [Y]."

See `../knowledge/autonomy-modes.md` for detection heuristics.

---

## Phase 3: Calibrate Detail Level

**Entry:** Research complete.

Auto-calibrate based on complexity. Don't ask the user — assess it, then tell them.

```
CONCISE — when:
- Scope is clear and bounded
- One person, one day or less
- Low risk (no auth, scoring, data, money)
- Clear precedent in codebase

STANDARD — when:
- Multi-day work but clear approach
- Some risk or new patterns needed
- Decision rationale adds value

DETAILED — when:
- Multi-repo or multi-team
- Unclear approach, multiple valid options
- High risk (auth, scoring, data, money, migrations)
- Significant architectural decisions
```

Tell the user: "This is a [level] plan — [reason]. Let me know if you want more or less detail."

**Exit:** Detail level chosen and communicated.

---

## Phase 4: Write the Plan

**Entry:** Detail level set, research findings available.

Check the project's `CLAUDE.md` for a "Toolkit Output Paths" table. Use those paths if present, otherwise use defaults.

**Output path:** `{plans_path}/YYYY-MM-DD-{type}-{kebab-topic}-plan.md`
(Default `plans_path`: `docs/plans/`)

**Types:** `feat`, `fix`, `refactor`, `chore`, `docs`

**YAML frontmatter:**
```yaml
---
title: "{type}: {description}"
type: plan
date: YYYY-MM-DD
status: approved
brainstorm: {path if exists}
confidence: high | medium | low
---
```

**All plans include:**
1. **Title and one-line summary**
2. **Problem Statement** — What's wrong or missing? Why does this matter?
3. **Target End State** — What should be true when this lands?
4. **Scope and Non-Goals** — What is explicitly outside this change?
5. **Proposed Solution** — High-level approach
6. **Implementation Tasks** — Checkboxes with dependency ordering. These become the tracker for `/work`.
7. **Acceptance Criteria** — How do we know it's done? Measurable, testable.

**Standard and detailed plans also include:**
8. **Decision Rationale** — Why this approach? Alternatives considered? Tradeoffs?
9. **Constraints and Boundaries** — Architectural, editorial, release, privacy, or operating rules that stay fixed
10. **Assumptions** — What must be true for this plan to work? (see Assumption Audit below)
11. **Risk Analysis** — What could go wrong? How do we mitigate it?

**Detailed plans also include:**
12. **Phased Implementation** — Phases with exit criteria per phase
13. **References** — Links to brainstorm, relevant code, past solutions

**For subjective or boundary-sensitive plans, also include:**
- **Target outcome** — the felt or perceived result, not just the structural change
- **Anti-goals** — what the result must not become
- **References** — positive models or repo examples
- **Anti-references** — patterns or tones to avoid
- **Tone or taste rules** — explicit editorial, design, or teaching constraints
- **Representative proof slice** — one slice to prove before propagation
- **Rollout rule** — when it is safe to spread the pattern
- **Rejection criteria** — what makes the result wrong even if it compiles
- **Required preview artifacts** — the concrete previews needed before autonomous `work` starts

**Confidence calibration (stated in frontmatter and body):**
- **High:** Clear requirements + existing codebase patterns + bounded scope
- **Medium:** Requirements understood but approach is new territory
- **Low:** Unclear requirements, ambiguous scope, significant unknowns — flag these and suggest `/brainstorm` first

### Assumption Audit (standard and detailed plans)

Before finalizing, identify the assumptions the plan depends on and run the Recursive Why loop on each.

**Process:**

1. **Extract assumptions** from the proposed solution and task list. Look for:
   - Technical assumptions ("this API supports X", "the database can handle Y")
   - Data assumptions ("users will provide Z", "this field is always populated")
   - Organizational assumptions ("team X will review this", "we have access to Y")
   - Dependency assumptions ("library X works with our stack", "service Y is stable")

2. **For each assumption, ask "Why do we believe this?" → loop the answer:**
   ```
   Assumption: "The scoring engine can handle async batch processing"
   → Why? "Because it's stateless"
   → Why does statelessness guarantee batch support? "Because... it doesn't. We'd need to verify queue handling."
   → STOP: Unverified.
   ```

3. **Write the Assumptions section in the plan:**
   ```markdown
   ## Assumptions

   | Assumption | Status | Evidence |
   |------------|--------|----------|
   | PostgreSQL handles 10k concurrent reads | Verified | Load test from Q1 (docs/solutions/perf/db-load-test.md) |
   | Users provide email during onboarding | Verified | Required field in registration flow |
   | Scoring engine supports async batch | Unverified | Needs investigation before Phase 2 |
   | Feature flag service handles gradual rollout | Verified | Used in 3 prior features (flagd config) |
   ```

4. **Unverified assumptions** automatically become either:
   - A task in the implementation plan ("Verify: scoring engine async support")
   - An explicit risk in the Risk Analysis section
   - An open question that blocks a specific phase

**Depth:** 2-3 levels per assumption. If the brainstorm already ran an Assumption Audit, inherit its findings — don't repeat the work, just verify nothing changed.

See `../knowledge/discovery-patterns.md` → "Recursive Why" for the loop technique.

### Subjective Contract And Preview Gate

If the task materially changes UI, copy, information architecture, facilitation flow, or a trust boundary judged partly by human review, the plan must additionally include:
- target outcome
- anti-goals
- references
- anti-references
- tone or taste rules
- representative proof slice
- rollout rule
- rejection criteria
- required preview artifacts

For design-heavy tasks, autonomous `work` should not start until at least one preview artifact exists. Acceptable preview forms include an HTML/static mockup, a terminal-friendly structural preview, or another concrete representation that makes drift obvious before implementation. The plan should also say who reviews the preview and what failure sends the work back to planning.

**Exit:** Plan document written.

---

## Phase 5: Handoff

**Entry:** Plan written and saved.

Ask the user what to do next.

- Prefer the harness's structured choice UI if available
- Otherwise present this short plain-text choice list:
  1. **Start /work (Recommended)** — Begin implementing this plan
  2. **Visualize / Share** — Prefer a shareable HTML mind map when sharing is configured; otherwise render in the terminal
  3. **Review and refine** — Adjust the plan based on feedback
  4. **Done for now** — Return later; to start: `/work {plan-path}`

**If user selects "Start /work":** Suggest running `/work {plan-path}`.

**If user selects "Visualize / Share":** Run `/babel-fish:visualize {plan-path}` and prefer the shareable HTML flow when browser viewing or sharing is useful and `share-html` is configured. Otherwise render the terminal mind map. After rendering or sharing, return to this handoff with the remaining options.

**If user selects "Review and refine":** Accept feedback, update the plan, then present these options again.

**If user selects "Done for now":** Confirm the path.

---

## Validate

Before delivering the plan, verify:

- [ ] Tasks are dependency-ordered — not a flat, unordered list
- [ ] Acceptance criteria are measurable — "users can do X" not "the system is good"
- [ ] Decision rationale explains WHY, not just WHAT (for standard+ plans)
- [ ] Assumptions are surfaced with status (verified/unverified) — for standard+ plans
- [ ] Unverified assumptions are either investigation tasks or explicit risks — nothing swept under the rug
- [ ] Someone new could start `/work` from this plan without clarifying questions
- [ ] Confidence level is stated and honest
- [ ] No code was written — only the plan document was created

## What Makes This Heart of Gold

- **Task Decomposition (2.3):** Tasks broken down with dependency ordering, not dumped as a flat list.
- **Prompt Mastery (2.2):** The plan IS a well-structured prompt for `/work`. Clear enough that execution requires no guessing.
- **Strategic AI Dialogue (2.4):** Decision rationale captures reasoning — not just conclusions, but why alternatives were rejected.
- **Critical Trust (2.1):** Risks flagged honestly. If uncertain, the plan says so.

## Knowledge References

- `../knowledge/decision-frameworks.md` — How to evaluate tradeoffs
- `../knowledge/strategic-decomposition.md` — How to break work into dependency-ordered steps
