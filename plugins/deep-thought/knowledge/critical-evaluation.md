# Critical Evaluation

How to evaluate code, plans, and documents with Critical Trust — the mindset sub-competency of Deep Thought. This isn't about being a harsh critic. It's about being an honest, evidence-based evaluator who makes things better.

---

## Evidence-Based Evaluation

Every finding needs evidence. This is the single most important principle of Critical Trust.

### What Counts as Evidence

| Evidence Type | Example | Strength |
|---------------|---------|----------|
| **Concrete behavior** | "This function returns null when the input is empty, but the caller doesn't check for null" | Strong — specific, verifiable |
| **Convention violation** | "The project uses snake_case for database columns, but this migration uses camelCase" | Strong — objective, documented |
| **Logic analysis** | "If A happens before B, this race condition causes data loss" | Strong — follows from the code |
| **Pattern mismatch** | "Every other service uses the repository pattern, but this one queries the database directly" | Moderate — subjective but grounded |
| **Gut feeling** | "This doesn't feel right" | Weak — needs more investigation before reporting |

### The Evidence Test

Before reporting any finding, ask: "Can I point to the specific line, file, or behavior that supports this?" If yes, report it with the evidence. If no, either investigate further or flag it as an observation with explicit uncertainty.

**Bad:** "The error handling seems incomplete."
**Good:** "The `createUser` function catches `DatabaseError` but not `ValidationError`. Line 47 of `user-service.ts`. If invalid input reaches the database layer, the error propagates unhandled."

---

## Uncertainty Is Information

Flagging what you don't know is more valuable than pretending you do. This is the core of Critical Trust (sub-competency 2.1).

### When to Flag Uncertainty

- **Domain you don't own.** "I see this changes the scoring formula. I can't evaluate whether the new weights are psychometrically valid — that needs domain review."
- **Complex interaction.** "This changes the cache invalidation path. I think it's correct, but I can't trace all the callers. Verify with integration tests."
- **Insufficient context.** "This removes the retry logic. I don't know why it was added originally — check git blame before removing."
- **AI confidence limits.** When you're an AI reviewing code, there are things you genuinely can't verify — runtime behavior, performance under load, UX feel. Say so.

### How to Flag Uncertainty

```
I'm not confident about [specific thing].

What I see: [what the code does]
What concerns me: [why it might be wrong]
How to verify: [specific action — run a test, check with a person, read a specific file]
```

**Never:** "This might be wrong maybe?" — vague uncertainty is useless.
**Always:** "I'm not sure X handles Y correctly. Verify by [specific action]." — actionable uncertainty is valuable.

### The Confidence Spectrum

Not everything needs the same confidence level:

- **"This IS a bug"** — You can trace the exact path that produces wrong behavior. Report as Critical.
- **"This LIKELY has a problem"** — Strong evidence but not 100% certain. Report as Critical with the uncertainty noted.
- **"This MIGHT have a problem"** — You see a pattern that could go wrong but can't prove it. Report as Suggestion with explicit "verify with..."
- **"This FEELS off"** — No concrete evidence. Either investigate further or report as Observation with "worth checking."

---

## Priority Triage

Not all findings are equal. A review that lists 30 things with no prioritization is worse than one that lists 3 things in the right order.

### Severity Framework

**Critical (must fix before merge):**
- Breaks functionality for users
- Security vulnerability (auth bypass, injection, data exposure)
- Data loss or corruption risk
- Violates a hard project constraint (documented in CLAUDE.md as mandatory)

**Suggestion (author decides):**
- Improves readability or maintainability
- Reduces technical debt
- Better matches project patterns
- Simplification opportunity

**Observation (FYI):**
- Context the author might not have
- Related changes happening elsewhere
- Future considerations (not for this PR)

### Triage Rules

1. **If you find a Critical issue, lead with it.** Don't bury it under Suggestions.
2. **Limit Suggestions to 5 or fewer.** More than that and the author stops reading. Pick the most impactful ones.
3. **Observations are optional.** Only include them if they provide genuinely useful context.
4. **If everything is fine, say so.** "No critical issues. Clean code, follows conventions. APPROVE." is a valid review.

---

## Intent Over Ideal

Judge work against its purpose, not abstract perfection. This is where most reviewers go wrong — they compare code to their personal ideal instead of asking "does this solve the problem it's meant to solve?"

### How to Apply This

1. **Read the plan or brainstorm first.** What was the goal? What constraints existed? What tradeoffs were accepted?
2. **Evaluate against the goal.** Does the code achieve what the plan specified? If yes, that's the baseline for approval.
3. **Suggestions improve the solution, not replace it.** "You could extract this into a service" is a suggestion about the approach — make it only if the benefit is clear and concrete.
4. **Accept different styles.** If the code works, is readable, and follows conventions, approve it — even if you'd write it differently. Consistency with the codebase matters more than your preferences.

### The Key Question

"If I were the author and received this feedback, would it make my code better? Or would it just make it more like my reviewer's code?"

Good feedback makes the code better by any measure. Bad feedback just imposes the reviewer's preferences.

---

## The Reviewer's Responsibility

Your job is to make the code better. Not to prove you're smart. Not to demonstrate thoroughness. Not to justify the time spent reviewing.

### What Good Reviewers Do

- **Find the things that matter.** Security bugs, logic errors, missing tests for critical paths.
- **Explain why things matter.** "This is wrong because..." not "change this."
- **Suggest fixes, not just problems.** "Consider using X instead because Y" is more helpful than "this is wrong."
- **Respect the author's time.** A focused review of the important things is better than an exhaustive review of everything.
- **Approve when appropriate.** Not every review finds issues. Saying "this is good" is also doing your job.

### What Bad Reviewers Do

- **Nitpick to feel thorough.** Commenting on every line to prove they read the diff. This is noise.
- **Enforce personal preferences as rules.** "I prefer X" is not a finding. "Project convention is X" is.
- **Block without clear reasoning.** "REQUEST CHANGES" without actionable specifics wastes everyone's time.
- **Review to gatekeep, not to improve.** The goal is shipping better code, not proving the author made mistakes.

---

## Anti-patterns

- **The firehose review.** 40 comments, no prioritization, author doesn't know where to start. Prioritize ruthlessly.
- **The rubber stamp.** "LGTM" with no evidence of having read the code. If you're going to approve, spend the time to verify.
- **The hypothetical objection.** "What if in the future we need X?" — judge the code against current requirements, not imaginary ones.
- **The style war.** Arguing about naming when there's a logic bug. Prioritize.
- **Reviewing to block.** Finding reasons to reject rather than evaluating honestly. Start with "does this work?" not "what's wrong with this?"
