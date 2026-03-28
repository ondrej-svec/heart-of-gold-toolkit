---
name: investigate
description: >
  Detective-style investigation that follows evidence trails to find root causes, bugs,
  inconsistencies, and hidden problems. Works on code, performance, architecture, data,
  and systems. Three investigative lenses: Sherlock (deduction), Poirot (psychology/intent),
  Columbo (what's missing). Triggers: investigate, debug, detective, find bug, root cause,
  what's wrong, diagnose, trace, why is this broken, what happened.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - Bash
---

# Investigate

Detective-style investigation. Follow evidence trails, notice what's missing, connect what others overlook.

## Boundaries

**This skill MAY:** read code, run diagnostic commands (read-only), trace evidence, present findings.
**This skill MAY NOT:** edit code, fix issues, create PRs, deploy. The only Bash allowed is read-only diagnostics (git log, curl for status, kubectl get, etc.).

**This is an investigation, not a fix. Present the case — the user decides what to do.**

## The Three Minds

Three investigative lenses — reasoning frameworks that each unlock a different class of problems:

**Sherlock Holmes** — Deductive elimination. What MUST be true? Verify each premise. Catches: logic errors, broken invariants, impossible states, type mismatches.

**Hercule Poirot** — Psychological method. Study intent and mental model. The gap between what someone THOUGHT the system does and what it ACTUALLY does. Catches: misunderstood APIs, wrong assumptions, subtle misreads.

**Columbo** — Persistent nagging. Something doesn't sit right. "Just one more thing..." Catches what's MISSING — error handlers, edge cases, tests, cleanup.

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Jump to Phase 5 — I already know the answer" | Skipping evidence gathering confirms biases, not bugs | Wrong diagnosis → wrong fix → problem persists |
| "This code looks fine, move on" | Dangerous bugs LOOK correct | The bug you didn't investigate ships |
| "Not my scope — skip it" | Evidence trails cross boundaries | Surface symptom fixed, root cause remains |
| "The tests pass, so it's correct" | Tests test what the author THOUGHT, not what it ACTUALLY does | False confidence |

---

## Phase 0: Establish the Case

**Entry:** User described a problem, pointed at code, or said "something's wrong."

**Auto-detect polarity from context:**

| Signals | Polarity | Focus |
|---------|----------|-------|
| Diff, file path, error in code | **Code** | Bugs, logic errors, type mismatches |
| "Slow", latency, timeouts | **Performance** | Queries, memory, bottlenecks |
| "Is this the right structure" | **Architecture** | Patterns, coupling, design drift |
| "Data doesn't look right" | **Data** | Integrity, schema, migration risks |
| "Something is broken in prod" | **System** | Infrastructure, networking, runtime |

**If unclear:** Use **AskUserQuestion** with:
- question: "What are we investigating?"
- header: "Polarity"
- options:
  1. label: "Code bug", description: "Logic errors, type mismatches, broken flows"
  2. label: "Performance", description: "Slow queries, memory leaks, bottlenecks"
  3. label: "Architecture", description: "Pattern violations, coupling, design drift"
  4. label: "System/Data", description: "Infrastructure failures, data integrity issues"
- multiSelect: false

**Auto-load relevant knowledge:**
- Code + `.py` → Read `../knowledge/python-fastapi-patterns.md`
- Code + `.ts`/`.tsx` → Read `../knowledge/typescript-nextjs-patterns.md`
- System → Read `../knowledge/infrastructure-ops.md` + `../knowledge/observability.md`
- Performance → Read `../knowledge/observability.md` + relevant stack knowledge
- Security-related → Read `../knowledge/security-review.md`

**Also:** Search the project's `docs/operators/runbooks/` for matching runbooks when investigating system issues.

**Exit:** Polarity determined, knowledge loaded, evidence available.

---

## Phase 1: Survey the Scene (Poirot)

*"I do not leap to the conclusions. First, I observe."*

**Entry:** Evidence available (diff, files, error logs, system description).

Understand the full picture before analyzing:
- What is happening? What SHOULD be happening?
- What is the author's/system's mental model? What do they believe?
- What assumptions are being made — are they warranted?
- Does the evidence tell a coherent story, or are there contradictions?

### Memory Consultation

Before investigating, search `docs/solutions/` for matching symptoms or component names:
- If a known solution exists: `>> Known pattern: docs/solutions/{domain}/{topic}.md (high match) — verify if it applies here`
- Present it as a **hypothesis**, not a conclusion. Don't bias the investigation — the known pattern might not apply.
- If nothing matches: say so and proceed with fresh investigation.

In autonomous mode: follow the evidence chain to its conclusion without intermediate check-ins. Present the full case (findings, root cause, recommended fix) as a structured artifact at the end.

See `../knowledge/active-memory-integration.md` for retrieval patterns.

**Exit:** Mental model understood — you can articulate what the system intends to do.

---

## Phase 2: Examine the Evidence (Holmes)

*"It is a capital mistake to theorize before one has data."*

**Entry:** Mental model from Phase 1.

Apply deductive reasoning:
- What MUST be true for this to work correctly? List the premises.
- What patterns do you observe? What's consistent? What breaks pattern?

**Follow the trail.** When something catches your eye, trace it:
- Where does this data come from? Where does it go?
- What calls this? What does this call?
- Are types/contracts flowing correctly through the chain?

Eliminate the impossible: if a value can be null here and there's no null check, that's not suspicion — it's a deduction.

**Exit:** All premises listed and verified; trails followed to resolution or dead end.

---

## Phase 3: Interview the Witnesses (Poirot)

*"Every witness tells you something — even when they lie."*

**Entry:** Trails identified from Phase 2.

Study surrounding context:
- Do tests actually test what this does, or what the author WISHES it does?
- Do types/schemas tell the same story as the implementation?
- Does the API contract match what callers expect?
- Is there a mismatch between how existing code uses an interface and how new code provides it?

**Exit:** Tests, types, and callers reviewed — story is consistent or contradictions documented.

---

## Phase 4: Just One More Thing (Columbo)

*"Oh, I'm sorry to bother you again, but there's just one more thing..."*

**Entry:** Core analysis complete.

The most important phase. Look for what's MISSING:
- Error cases not handled
- Tests that should exist but don't
- Null/undefined checks absent
- Race conditions in async code
- Cleanup that never happens (listeners, timers, subscriptions, connections)
- Boundary conditions ignored (zero, empty, maximum)
- Logging/monitoring for operations that can fail silently
- Rollback paths for irreversible operations

Keep nagging. The thing that seems minor is often the whole case.

**Exit:** "Missing things" catalog complete — every absence documented with a failure scenario.

---

## Phase 5: Connect the Evidence (Holmes)

*"The game is afoot."*

**Entry:** All phases 1-4 complete.

Synthesize. Problems hide at intersections:
- A type says one thing, the runtime does another
- A function is async but its caller doesn't await
- A database column is NOT NULL but the API doesn't validate
- A feature flag check exists in one layer but not another
- An error is caught but the operation continues as if it succeeded

Each finding must survive the Holmes test: given the evidence, is there any other explanation?

**Exit:** Findings synthesized with evidence.

---

## Phase 6: Present the Case Report

**Entry:** Findings synthesized.

```markdown
## Case: [Brief title]

### Scene Assessment
[2-3 sentences: what's happening, the mental model, initial impression]

### Findings

#### [CONCLUSIVE] Finding title
**Evidence:** [location] — [quote the evidence]
**Deduction:** [Why this IS a problem, with concrete failure scenario]
**Impact:** [What happens when this fails]

#### [SUSPICIOUS] Finding title
**Evidence:** [location] — [quote the evidence]
**Deduction:** [Why this looks wrong, what could go wrong]
**Recommendation:** [What to verify or fix]

#### [INVESTIGATE] Finding title
**Evidence:** [location] — [quote the evidence]
**Concern:** [What might be wrong but can't be proven from here]
**Question:** [What should be verified]

### Just One More Thing...
[Columbo's parting observations — what SHOULD be here but isn't.
Each with a concrete scenario of what goes wrong.]

### Case Summary
**Verdict:** CLEAN / MINOR CONCERNS / BUGS FOUND / CRITICAL ISSUES
**Confidence:** [How thoroughly investigated given the scope]
[1-2 sentence overall assessment]
```

**Exit:** Case report presented.

---

## Phase 7: Handoff

**Entry:** Case report presented.

Use **AskUserQuestion** with:
- question: "Investigation complete. What would you like to do?"
- header: "Next step"
- options:
  1. label: "Fix the issues", description: "Start implementing fixes (exits investigation mode)"
  2. label: "Dig deeper", description: "Investigate a specific finding further"
  3. label: "Document findings", description: "Run /compound to capture this for future reference"
  4. label: "Done", description: "Investigation sufficient, move on"
- multiSelect: false

**If user selects "Dig deeper":** Use **AskUserQuestion** (header: "Finding", question: "Which finding to dig into?") with each finding as an option. Then return to Phase 2 focused on that trail.

---

## Rules of Investigation

1. **Never accuse without evidence.** Every finding cites location and explains WHY with a scenario.
2. **Distinguish certainty.** CONCLUSIVE (will cause a problem), SUSPICIOUS (looks wrong), INVESTIGATE (can't prove from here).
3. **Follow trails, don't scan categories.** If a query leads to a missing index, follow that.
4. **The most dangerous bugs look correct.** Focus on what LOOKS right but isn't.
5. **Assumptions are suspects.** Check if they're actually true.

## What You Ignore

- Style nitpicks — linters handle those
- Suggestions that aren't problems
- Hypothetical future problems — only present danger

## Validate

Before delivering the case report, verify:

- [ ] Every finding cites a specific location and concrete failure scenario
- [ ] Certainty levels are calibrated — not everything is CONCLUSIVE
- [ ] "Just One More Thing" section exists with at least one missing-thing observation
- [ ] Verdict matches the findings
- [ ] No code was modified — read-only investigation

## What Makes This Heart of Gold

- **Critical Trust (2.1):** Calibrated certainty. Three levels, never faking it.
- **Task Decomposition (2.3):** Complex investigations broken into phased methodology.
- **Strategic AI Dialogue (2.4):** The detective asks the questions others forgot.

## Knowledge References

- `../knowledge/critical-evaluation.md` — Evidence types, uncertainty flagging
- `../knowledge/decision-frameworks.md` — Prioritizing investigation depth
