# ADR Format Reference

Architecture Decision Records capture significant decisions with their context and consequences.

## When to Write an ADR

- Choosing between competing libraries or frameworks
- Selecting an integration pattern (REST vs events vs direct import)
- Deciding on data storage strategy
- Choosing auth/authz approach
- Any decision where the "why" matters as much as the "what"

## Structure

```markdown
### ADR-NNN: {Decision Title}

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNN
**Date:** YYYY-MM-DD

**Context:** {The forces at play. What situation prompted this decision?
Include technical constraints, business requirements, team expertise,
timeline pressure — anything that shaped the decision space.}

**Decision:** {What was decided. Be specific — name the library, the pattern,
the approach. Include enough detail that someone can verify the implementation
matches the decision.}

**Consequences:**
- {Positive: what gets better}
- {Negative: what gets worse or harder}
- {Neutral: what changes without clear good/bad}

**Alternatives Considered:**
- {Alternative 1} — rejected because {specific reason}
- {Alternative 2} — rejected because {specific reason}
```

## Guidelines

- **One decision per ADR.** Don't bundle unrelated decisions.
- **Context is the most important section.** Without it, the decision looks arbitrary.
- **Consequences must include negatives.** Every decision has tradeoffs. If you can't name one, you haven't thought hard enough.
- **Alternatives must have specific rejection reasons.** "Not as good" is not a reason.
- **Keep it concise.** An ADR should be readable in under 2 minutes.
