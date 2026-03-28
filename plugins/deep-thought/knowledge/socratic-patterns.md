# Socratic Patterns

How to challenge assumptions and improve decisions through evidence-based questioning. Not personality engineering — research shows persona-based prompts ("be critical") don't improve output quality. What works: grounding challenges in evidence, asking questions that surface real gaps, and using verification techniques that catch mistakes before they compound.

---

## Chain-of-Verification (CoVe)

The core technique. Before finalizing any significant decision, generate verification questions and answer them honestly.

### How It Works

1. **Draft** the decision or conclusion
2. **Generate** 2-3 verification questions that would disprove it if wrong
3. **Answer** each question with evidence from the codebase, docs, or prior decisions
4. **Revise** if any answer reveals a problem

### Example

```
Decision: Use WebSocket for real-time notifications.

Verification questions:
1. Does the existing infrastructure support WebSocket connections?
   → Check: Load balancer config, CORS settings, connection limits.
2. Has this been tried before in the project?
   → Check: docs/brainstorms/, past architecture decisions.
3. What's the fallback if WebSocket isn't available?
   → Check: Do we need SSE as backup? What do mobile clients support?

Revised: Use SSE (existing pattern) with WebSocket as future upgrade path.
```

### When to Apply CoVe

| Situation | Apply CoVe? | Why |
|-----------|-------------|-----|
| Major architectural decision | Yes | High cost of being wrong |
| Problem reframing in brainstorm | Yes | Wrong framing wastes everything downstream |
| Review finding rated "Critical" | Yes | False critical findings erode trust |
| Choosing between 2+ approaches | Yes | Verification surfaces hidden tradeoffs |
| Trivial implementation decision | No | Overhead exceeds value |
| Following an established pattern | No | The pattern IS the verification |

---

## Question Templates

Use these patterns to surface gaps. The best questions are specific, evidence-seeking, and non-leading.

### Assumption Testing

- "What evidence supports [assumption]? Can you point to the specific code, doc, or data?"
- "What would need to be true for this approach to fail?"
- "This assumes [X]. Has that been verified, or are we taking it on faith?"

For deep assumption testing, use the **Recursive Why loop** — each answer becomes the next question's input until you hit bedrock or "I don't know." See `../../deep-thought/knowledge/discovery-patterns.md` → "Recursive Why" for the full technique. This loop is mandatory in `/brainstorm` (Phase 3 Assumption Audit) and `/plan` (Phase 4 for standard+ plans).

### Contradiction Surfacing

- "This conflicts with the decision in [specific brainstorm/plan]. Has the context changed, or is this an oversight?"
- "The codebase does [Y] in similar situations. Why is this case different?"
- "Last time we tried [similar approach], it caused [problem]. What's different now?"

### Scope Probing

- "Is this solving the actual problem, or a symptom of a deeper issue?"
- "What's the simplest version of this that would still deliver the core value?"
- "If we had to ship this in half the time, what would we cut?"

### Provisional Confidence

When you have a concern but aren't certain, frame it as provisional:

- "I see a potential issue — this pattern usually causes [X] in projects of this scale. Is that a concern here?"
- "I lean toward [approach A] (roughly 75% confidence) because [evidence], but [approach B] is stronger if [condition]. Which condition applies?"
- "This might be fine, but worth checking: does [specific thing] still hold given [recent change]?"

---

## Challenge Calibration

Not every skill needs the same intensity. Match the challenge level to the phase of work.

### High Challenge (brainstorm, review, think)

These are the discovery and evaluation phases — maximum questioning.

- Run CoVe on every major decision
- Surface contradictions with past brainstorms, plans, and solutions
- Ask "what would disprove this?" before accepting conclusions
- Generate the strongest counter-argument for each approach

### Medium Challenge (plan, investigate, compound)

These transform decisions into action — challenge scope and approach, not the fundamentals.

- Run CoVe on approach selection and risk assessment
- Reference past plans for similar features — what worked, what didn't
- Surface contradictions only when they directly affect the current work
- Challenge scope: "Is this the minimum needed, or are we gold-plating?"

### Low Challenge (work, orchestrate)

Execution phases — challenge only on clear anti-patterns.

- Challenge if: skipping tests, unsafe patterns, ignoring known issues, scope creep during implementation
- Don't challenge: implementation details that match existing codebase patterns
- Focus on "does this match what the plan says?" not "should the plan say something different?"

---

## What Doesn't Work

Research-backed anti-patterns to avoid:

- **Personality engineering.** "You are a critical thinker who challenges everything" — this changes communication style, not output quality. Skip it entirely.
- **Fake questions.** Asking things you already know the answer to feels manipulative. Only ask questions that genuinely probe uncertainty.
- **Challenging everything.** Questioning obvious decisions wastes time and erodes trust. Challenge proportionally to stakes and uncertainty.
- **Assertions without evidence.** "This won't work" is not a challenge — it's an opinion. "This won't work because [specific evidence]" is useful.
- **All-caps urgency.** "CRITICAL: YOU MUST CHALLENGE ALL ASSUMPTIONS" — modern models don't try harder with shouting. They just mimic the tone.
- **Checklist skepticism.** Running through a fixed list of challenges regardless of context. Good challenges are responsive to what's actually being proposed.

---

## Grounding Challenges in Evidence

The single most important principle: every challenge must point to something specific.

| Evidence Type | Example | When to Use |
|---------------|---------|-------------|
| **Codebase pattern** | "The project uses [X] in all 12 similar cases" | Proposed approach deviates from convention |
| **Past decision** | "Brainstorm from Feb 15 decided against [Y] because [reason]" | Current proposal revisits a closed decision |
| **Known solution** | "docs/solutions/auth/jwt-refresh-fix.md solved this differently" | Similar problem was solved before |
| **Documented constraint** | "CLAUDE.md requires [Z] for auth changes" | Proposal may violate a project rule |
| **Test/runtime behavior** | "Running this with [input] produces [unexpected output]" | You can demonstrate the problem |

**If you can't point to evidence, investigate before challenging.** A gut feeling is a signal to investigate, not to challenge.
