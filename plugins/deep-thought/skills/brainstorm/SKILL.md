---
name: brainstorm
description: >
  Collaborative discovery before planning. Explore the problem space, evaluate approaches,
  surface past work, and produce a structured brainstorm document. Triggers: brainstorm,
  explore, discovery, ideate, think through, what should we build, explore approaches.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - Write
  - Edit
---

# Brainstorm

Collaborative discovery before planning. Answers **WHAT** to build and **WHY** — precedes `/plan`, which answers **HOW**.

## Boundaries

**This skill MAY:** research (read-only), discuss, ask questions, write the brainstorm document.
**This skill MAY NOT:** edit code, create files beyond the brainstorm document, run tests, deploy, implement anything.

**NEVER write code during this skill. This is a discussion, not implementation.**

### Interaction and readiness policy

Natural conversation is the default. Inspect available evidence before questioning. Classify an unknown as a user decision, agent investigation, or later verification; name its blocking phase and owner. Ask only focused questions that determine progress (up to three independent related clarifications in prose), with evidence-based recommendation/tradeoffs when useful. Preserve decisions and stop when this phase is clear. Use a structured UI only for a consequential choice or approval and always permit plain prose/custom qualifications; required work is progress, never an option. A document path or suggested next step is not execution authorization. New plans are drafts until the user approves scope; readiness and preview gates remain separate. End with the result and one appropriate next step, not a fixed handoff menu.

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Skip reframing — the user already knows what they want" | Users describe solutions, not problems. Without reframing, you build the wrong thing. | Days of rework when the real need surfaces |
| "Skip research — I'll brainstorm from scratch" | Reinventing what exists. The codebase has patterns, past brainstorms have context. | Wasted effort + inconsistency with existing decisions |
| "Keep exploring — we haven't found the perfect approach" | Diminishing returns. After 2-3 solid options, more exploration adds noise, not signal. | Analysis paralysis — nothing ships |
| "Let me just write some code to test this idea" | Brainstorming is for decisions, not prototypes. Code anchors you to an approach too early. | Premature commitment to the first thing that compiles |

---

## Phase 0: Assess Whether Brainstorming Is Needed

**Entry:** User has a topic or problem area.

Not everything needs a brainstorm.

**If requirements are already clear and specific:**
Report that evidence and recommend planning directly; ask only if the user has expressed uncertainty about skipping discovery. If a real choice remains, ask it in prose (or optional structured UI) with the tradeoff. Do not treat the recommendation as authorization to plan or implement.

- If the user asks to plan → transition to `/plan` without re-asking permission; otherwise only recommend it.
- If the user wants discovery → continue to Phase 1.

**Brainstorm when:**
- The problem is ambiguous or has multiple valid approaches
- It's a significant feature with architectural implications
- The user isn't sure what they want yet
- There's real risk of building the wrong thing

**Exit:** Decision made — brainstorm or skip.

---

## Phase 1: Reframe the Problem

**Entry:** The user requested discovery and the topic benefits from it; the initial request is sufficient, with no ritual reconfirmation.

This is the critical step. Before exploring solutions, question the problem.

Ask one focused question only when evidence cannot resolve a user-owned decision; do not dump a questionnaire. Research agent-owned unknowns first and record later verification separately. Use these as lenses, not a mandatory interview; skip what is already settled:

1. "What problem are we actually solving?" — Strip away assumptions. Get to the root need.
2. "Who has this problem and when?" — Context changes solutions.
3. "What does success look like?" — Not features, outcomes.

Stop asking once the problem is clear enough for this phase. Offer alternatives only for a real choice. Verify researchable assumptions yourself; ask for confirmation only when a consequential assumption belongs to the user.

**Exit:** Problem statement is clear and reframed. Both you and the user agree on what you're solving.

### Socratic Verification (High Challenge)

Before accepting the problem framing, apply Chain-of-Verification:

1. **Generate 2-3 verification questions** about the framing: "What would need to be true for this framing to be wrong?" "Is this the real problem, or a symptom?"
2. **Answer each with evidence** from past brainstorms, codebase patterns, or documented constraints.
3. **Surface contradictions** with past decisions: "This seems to conflict with [prior brainstorm]. Has the context changed?"
4. **Use provisional confidence:** "I see a potential issue with this framing — [evidence]. Worth exploring before we commit?"

Don't challenge obvious framings just to seem thorough. Challenge when you have evidence or genuine uncertainty.

See `${CLAUDE_PLUGIN_ROOT}/knowledge/socratic-patterns.md` for technique details.

---

## Phase 2: Research What Exists

**Entry:** Problem statement is clear (Phase 1 complete).

Check the project's `CLAUDE.md` for a "Toolkit Output Paths" table. Use those paths if present, otherwise use defaults.

Launch research agents **in parallel**:

- Task researcher("Find existing patterns related to: <problem statement>. Search docs/brainstorms/, docs/solutions/, docs/plans/, and codebase for similar features, past decisions, and prior art.")
- Task grounder("Follow /marvin:ground protocol for: <problem statement>. Survey the repo at <cwd> and ground externally. Return synthesized briefing.")

The `researcher` agent covers internal prior art; the `grounder` agent covers external ecosystem state — recent releases, current best practices, known footguns. If `/ground` is unavailable or fails, proceed with the researcher's findings alone — grounding is advisory, never blocking.

**Surface findings to the user:**
```
>> Related brainstorm: docs/brainstorms/2026-02-15-notifications-brainstorm.md
>> Existing pattern: services/email-notifier/ (notification handling)
>> Past solution: docs/solutions/infrastructure/sse-auth-token-refresh.md
```

**If no relevant findings:** Say so. Don't invent relevance.

If the task is design-heavy, copy-heavy, or boundary-sensitive, also surface:
- relevant references already present in the repo
- anti-references or known bad patterns from past work
- whether a preview artifact will likely be required before autonomous implementation

The goal is not only "what exists?" It is also "what should the future plan pull toward and stay away from?"

**Exit:** Findings presented. User has seen what exists before exploring approaches.

---

## Phase 3: Explore Approaches

**Entry:** Research complete (Phase 2). User has context on what exists.

Through collaborative dialogue, explore 2-3 approaches. For each:
- **What it optimizes for** (speed, flexibility, simplicity, etc.)
- **What it costs** (complexity, maintenance, time, risk)
- **Who's done this before** (prior art in the codebase or industry)

Ask one question at a time. Start broad (purpose, users), narrow to specifics (constraints, edge cases). Prefer explicit option lists when there are 2-4 natural choices.

**If open questions emerge:** classify each. Investigate agent-owned questions, ask only user-owned decisions that block this phase, and record later verification without interrupting progress.

If the chosen approach depends on taste, hierarchy, copy quality, workshop framing, or boundary judgment, you MUST also capture before leaving this phase:
- target outcome
- anti-goals
- references
- anti-references
- tone or taste rules
- representative proof slice
- explicit rejection criteria
- whether preview artifacts will be required

**Exit when:**
- The approach is clear and the user signals a decision
- You've explored enough to choose (2-3 approaches with tradeoffs)
- The user says "proceed" or equivalent

### Assumption Audit (after approach is chosen)

Once an approach is selected, run the Recursive Why loop before locking it in. This is mandatory — not optional.

**The loop:**

1. **Extract assumptions** — identify 3-5 things that must be true for this approach to work. These are often implicit: technical feasibility, team capability, data availability, user behavior, performance characteristics.

2. **For each assumption, run the Recursive Why:**
   ```
   Assumption: "We need real-time updates"
   → Why? "Because users expect instant feedback"
   → Why do they expect that? "Because... actually, we haven't validated this. A 5-second poll might be fine."
   → STOP: Hit "I don't know" — this is an unverified assumption.
   ```

3. **Classify what you find:**
   - **Bedrock** (verified, backed by evidence or hard constraint) → proceed with confidence
   - **Unverified** (believed but not proven) → assign an owner and blocking phase; investigate available evidence or record later verification, asking only about a user-owned consequential decision
   - **Weak** (rests on habit or "that's how we do it") → check the rationale against evidence; challenge with a question only if the remaining direction or risk acceptance is user-owned

4. **Surface to the user** before moving to Phase 4:
   ```
   Assumption audit for [chosen approach]:
   ✓ Bedrock: PostgreSQL can handle the query pattern (verified in similar feature X)
   ? Unverified: Users need real-time updates (no data — assumed)
   ✗ Weak: "We always use WebSockets for this" (habit, not requirement)
   ```

5. **Classify unverified or weak assumptions.** Investigate evidence the agent can obtain; ask the user only when risk acceptance or a consequential direction is theirs to decide. State the recommendation and tradeoffs. A structured UI is optional only for that real choice; prose and qualifications remain valid.

**Depth:** 2-3 levels of "why" per assumption. Stop at bedrock, not at a fixed number.

See `${CLAUDE_PLUGIN_ROOT}/knowledge/socratic-patterns.md` for evidence grounding and `discovery-patterns.md` → "Recursive Why" for the loop technique.

---

## Phase 4: Capture Decisions

**Entry:** Approach chosen (Phase 3 complete).

For each decision made during brainstorming, capture:
- **What was decided** — the choice
- **Why** — the reasoning
- **What was rejected** — alternatives considered and why

Also capture:
- **Open questions** — things to resolve during planning or implementation
- **Out of scope** — things explicitly excluded

---

## Phase 5: Write Brainstorm Document

**Entry:** Decisions captured (Phase 4 complete).

**Output path:** `{brainstorms_path}/YYYY-MM-DD-{kebab-topic}-brainstorm.md`
(Default `brainstorms_path`: `docs/brainstorms/`)

Write the document with this structure:

```markdown
---
title: "{Topic}"
type: brainstorm
date: YYYY-MM-DD
participants: [{who was involved}]
related:
  - {links to related brainstorms, plans, solutions found in Phase 2}
---

# {Topic}

## Problem Statement
{The actual problem, reframed from Phase 1}

## Context
{Key findings from Phase 2 — what exists, what's been tried}

## Chosen Approach
{High-level description of the selected approach}

## Why This Approach
{Decision rationale — what it optimizes for, why alternatives were rejected}

## Subjective Contract (when needed)
- Target outcome: {What the result should feel or read like}
- Anti-goals: {What it must not become}
- References: {Positive models or repo examples}
- Anti-references: {Patterns or tones to avoid}
- Tone or taste rules: {Editorial, design, or teaching constraints}
- Rejection criteria: {Concrete reasons to say the result is wrong}

## Preview And Proof Slice (when needed)
- Proof slice: {One representative slice to prove first}
- Required preview artifacts: {HTML mockup, ASCII preview, screenshot comp, etc.}
- Rollout rule: {When this can propagate broadly}

## Key Design Decisions

### Q1: {Decision topic} — RESOLVED
**Decision:** {What was decided}
**Rationale:** {Why}
**Alternatives considered:** {What else was explored and why it was rejected}

## Open Questions
{For each unknown: user decision / agent investigation / later verification; owner, blocking phase, and next action}

## Out of Scope
{Things explicitly excluded from this work}

## Next Steps
- `/plan` to create an implementation plan from these decisions
```

### Memory Integration

Before writing, check if any decisions contradict past brainstorms surfaced in Phase 2. If a contradiction exists:
- Flag it explicitly in the document under the relevant Key Design Decision
- Note what changed: "Previously decided [X] in [brainstorm]. Now choosing [Y] because [context change]."

If a novel pattern was discovered during brainstorming (approach nobody's tried, new integration point, unexpected constraint), note it as a candidate for `/compound` in the Next Steps section.

**Exit:** Document written.

---

## Phase 6: Handoff

**Entry:** Document written (Phase 5 complete).

Report the brainstorm path, settled decisions, open questions with their owners/phases, and the appropriate next step. If the user already requested planning next, transition to `/plan {brainstorm-path}` without another permission question; otherwise suggest it without implying that planning or implementation has started. Continue exploration only on a concrete unresolved decision; otherwise stop.

---

## Validate

Before delivering the brainstorm document, verify:

- [ ] Problem was reframed — not just accepted at face value
- [ ] At least 2 approaches were explored with tradeoffs
- [ ] Assumption Audit ran on the chosen approach — assumptions classified as bedrock/unverified/weak
- [ ] Unverified/weak assumptions have an owner, blocking phase, and disposition — investigate available evidence; ask only user-owned consequential decisions
- [ ] Every decision has rationale and rejected alternatives documented
- [ ] Open questions are listed — nothing swept under the rug
- [ ] Planning can use settled decisions without repeating discovery; remaining blockers identify their owner and next action
- [ ] No code was written — only the brainstorm document was created

## What Makes This Heart of Gold

- **Problem Reframing (1.4):** Questions the problem before solving it. Highest-leverage question: "What are we actually solving?"
- **Opportunity Recognition (1.2):** Researcher agent surfaces past work, patterns, and prior art before building new.
- **AI-Augmented Discovery (1.3):** Multi-source research synthesized into insights — connects dots across brainstorms, solutions, and code.
- **AI Curiosity (1.1):** Explores multiple approaches before committing. Rewards looking around, not jumping to the first idea.
