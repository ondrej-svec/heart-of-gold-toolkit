---
name: think
description: >
  Deep reasoning for complex decisions — expert panel simulation, devil's advocate,
  what-if scenarios, and structured tradeoff analysis. Use when a decision has high stakes,
  multiple valid approaches, or you need to stress-test your thinking. Triggers: think,
  think through, analyze, expert panel, devil's advocate, what if, tradeoff, decision,
  weigh options, stress test, second opinion.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
---

# Think

Deep reasoning for decisions that matter. Expert perspectives, devil's advocate, what-if scenarios, and structured tradeoff analysis.

## Boundaries

**This skill MAY:** read code/docs for context, reason, analyze, present conclusions.
**This skill MAY NOT:** edit code, create files, run commands, implement anything, deploy.

**This is thinking, not doing. Present the analysis — the user decides what to act on.**

### Interaction and readiness policy

Natural conversation is the default. Inspect evidence before questioning. Classify unknowns as user decisions, agent investigation, or later verification, naming phase and owner. Ask focused questions only when they determine progress (up to three independent related prose clarifications), and give evidence-based recommendation/tradeoffs where relevant. Preserve decisions and stop when clear. Use structured UI only for a consequential choice or approval, never as a requirement; prose/custom qualifications always work. Required work is not a choice. A recommendation, artifact path, or suggested next step never authorizes execution; approval, readiness, and execution authorization are separate.

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Default to Expert Panel for everything" | Not always the right lens. A security decision needs Devil's Advocate. | Generic advice that misses the specific risk |
| "High confidence — the analysis is thorough" | Most decisions are genuinely medium confidence. | Over-commitment to a choice that should have been hedged |
| "Skip the counter-argument" | If you can't articulate why the alternative might be better, you don't understand the tradeoff. | Blind spot becomes the failure mode |
| "The first framing is fine" | How you frame the question determines what answers you see. | Solving the wrong problem with rigor |

---

## Phase 0: Frame the Question

**Entry:** User invoked `/think` with a question, topic, or nothing.

**If invoked with a question** (e.g., `/think should we use WebSockets or SSE?`):
- Use the question as starting point
- Gather relevant context: what does the codebase currently do? What are the constraints?

**If invoked without a question:**
Ask naturally what decision or problem to examine. Do not manufacture options before evidence establishes a real choice.

**If invoked with `ultrathink`:**
- Enable extended thinking — deeper analysis, more perspectives, longer reasoning chains

**Exit:** Question framed, context available.

---

## Phase 1: Choose the Mode

**Entry:** Question framed.

| Mode | When | What It Does |
|------|------|-------------|
| **Expert Panel** | Multiple domains intersect | Simulate 3-5 relevant expert perspectives |
| **Devil's Advocate** | You have a preferred option | Systematically attack it |
| **What-If Analysis** | Uncertain about consequences | Trace each option through scenarios |
| **Tradeoff Matrix** | Comparing options across criteria | Structured weighted comparison |

**If mode isn't obvious from the question:** choose the lightest useful mode from evidence and state why. Ask only if the user has a consequential preference about the lens; then present the tradeoff naturally (optional structured UI, prose fallback).

**Exit:** Mode chosen.

---

## Phase 2: Think

**Entry:** Mode chosen, context available.

### Expert Panel

Identify 3-5 relevant expert perspectives based on THIS question — not generic experts.

For each expert:
```
### [Expert perspective name]

**Lens:** What this perspective focuses on
**Assessment:** What they see in this situation
**Recommendation:** What they'd do and why
**Concern:** What worries them about other approaches
```

Then synthesize:
```
### Synthesis
Where experts agree: [consensus]
Where they disagree: [tensions]
The key tradeoff: [the core tension to resolve]
```

### Devil's Advocate

1. **Steel man it first** — state the strongest version of why this approach makes sense
2. **Attack the assumptions** — what must be true for this to work? Is each actually true?
3. **Find the failure modes** — how does this break? Under what conditions?
4. **Identify the hidden costs** — what does this make harder in the future?
5. **Propose the counter-argument** — what's the strongest alternative?

### What-If Analysis

For each option:
```
### Option A: [name]

**If it goes well:** [best realistic outcome]
**If it goes okay:** [likely outcome]
**If it goes badly:** [worst realistic outcome]
**Reversibility:** [how hard to undo]
**What you learn:** [what this choice teaches you, even if it fails]
```

### Tradeoff Matrix

```
| Criterion (weight) | Option A | Option B | Option C |
|---------------------|----------|----------|----------|
| Speed to ship (30%) | 8/10     | 5/10     | 7/10     |
| Maintainability (25%)| 6/10    | 9/10     | 7/10     |
| Risk (25%)          | 7/10     | 8/10     | 5/10     |
| Team capability (20%)| 9/10    | 6/10     | 7/10     |
| **Weighted total**  | **7.4**  | **7.0**  | **6.5**  |
```

**Exit:** Analysis complete for the chosen mode.

### Adversarial Verification (High Challenge)

For each conclusion in the analysis, generate the strongest counter-argument before presenting it:

- "The strongest objection to this recommendation is [X]. It holds / doesn't hold because [evidence]."
- Use provisional confidence: "I lean toward [A] (~75% confidence) because [evidence], but [B] is stronger if [condition is true]."
- If in autonomous mode: present the full deliberation as an artifact — recommendation + key tradeoffs + counter-arguments + confidence — without intermediate dialogue.

See `${CLAUDE_PLUGIN_ROOT}/knowledge/socratic-patterns.md` for verification technique details.

---

## Phase 3: Conclude

**Entry:** Analysis complete.

Every `/think` session ends with a clear recommendation:

```
## Recommendation

**Do:** [specific recommendation]
**Because:** [1-2 sentence reasoning]
**Risk:** [the main risk and how to mitigate it]
**Confidence:** [low/medium/high] — [why]
```

**Confidence calibration:**
- **High:** Strong evidence, clear consensus, low uncertainty. Rare — most decisions don't reach this bar.
- **Medium:** Good reasoning, genuine uncertainty remains. The honest default.
- **Low:** Significant unknowns, conflicting evidence. Name what's missing.

If no clear winner: "Both A and B are defensible. The tiebreaker question is: [the one thing that determines which is better]."

**Exit:** Recommendation delivered.

---

## Phase 4: Handoff

**Entry:** Recommendation delivered.

Report the recommendation, uncertainty, and one appropriate next step. Continue only on a concrete challenge or request for another lens. If planning is appropriate, suggest it without implying authorization to implement.

---

## Validate

Before delivering the recommendation, verify:

- [ ] Recommendation is actionable — not "it depends" but "do X, because Y"
- [ ] There's a concrete next step — what does the user DO with this?
- [ ] Confidence is calibrated — not "high" by default
- [ ] Counter-argument was addressed — can articulate why the rejected option might have been better
- [ ] No code was written, no files modified — analysis only

## When NOT to Use /think

- **Easily reversible decisions.** Two-way doors don't need deep analysis. Just decide.
- **Obvious answers.** If you already know, skip the ceremony.
- **Implementation questions.** "How do I implement X" → use `/plan`, not `/think`.

## What Makes This Heart of Gold

- **Critical Trust (2.1):** Stress-tests thinking instead of trusting first instinct.
- **Strategic AI Dialogue (2.4):** AI as thinking partner, not executor.
- **Task Decomposition (2.3):** Complex decisions decomposed into evaluable components.
- **The thinking that prevents rework.** 30 minutes of `/think` before a week of `/work` often saves the week.

## Knowledge References

- `${CLAUDE_PLUGIN_ROOT}/knowledge/decision-frameworks.md` — Stakes matrix, when to decide fast vs. slow
- `${CLAUDE_PLUGIN_ROOT}/knowledge/critical-evaluation.md` — Evidence types, uncertainty flagging
- `${CLAUDE_PLUGIN_ROOT}/knowledge/strategic-decomposition.md` — Breaking complex problems into parts
