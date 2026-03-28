# CTO Stakeholder Translation — Communication Frameworks

How CTOs make technical reality visible to non-technical stakeholders. Templates and frameworks for every communication mode.

**Evidence tags:** `[practitioner]` = published from direct experience. `[academic]` = research-backed.

---

## The Translation Principle

The CTO's unique position: fluent in both technology and business. The job isn't to simplify — it's to translate. Every technical decision has business implications. Every business request has technical costs. The CTO makes both visible. `[practitioner: Fournier]`

**The cardinal rule:** If you can't explain why a technical decision matters in business terms, you might not understand why it matters. `[practitioner]`

---

## Language Translation Table

Replace technical jargon with business-meaningful language. `[practitioner: synthesis from CTO Magazine, Larson]`

| Technical term | Business translation |
|---|---|
| Technical debt | Operational drag — it's slowing us down by X% |
| Refactoring | Reducing operational drag — invest N weeks now, save M weeks/quarter |
| Legacy system | Revenue blocker — prevents us from doing X until addressed |
| Infrastructure upgrade | Scaling investment — required to support N customers/revenue |
| Architecture migration | Foundation rebuild — costs N weeks but enables X, Y, Z |
| We need more engineers | We can't execute our strategy with current capacity — here's the gap |
| The system is fragile | We're one incident away from customer-facing downtime |
| We need better testing | We're relying on luck instead of confidence for every deployment |
| Code review | Quality assurance — catching problems before customers see them |
| CI/CD pipeline | Automated deployment — reduces human error and speeds delivery |
| Observability | Visibility into what's actually happening in production |
| Microservices | Independent components that teams can change without breaking each other |

---

## Pivot Cost Estimate Template

Use before any strategic direction change. One page. The document that makes the cost of chaos undeniable. `[practitioner]`

```markdown
# Pivot Cost Estimate: [From X] → [To Y]

## What We're Abandoning
| Work item | Investment (eng-weeks) | Investment (currency) | Still usable? |
|---|---|---|---|
| [Feature/system A] | N weeks | €X | Yes/Partial/No |
| [Feature/system B] | N weeks | €X | Yes/Partial/No |

**Total investment at risk:** N eng-weeks / €X

## What the New Direction Requires
| New work | Estimated effort | Dependencies |
|---|---|---|
| [New feature/system A] | N weeks | [what must exist first] |

**Total new investment:** N eng-weeks / €X

## Transition Cost
- Context switching overhead: ~N weeks (engineers need to ramp on new direction)
- Knowledge loss: [what institutional knowledge becomes obsolete]
- Recruitment impact: [does this change who we need to hire?]

## Impact on Commitments
- **Customer commitments:** [which promises are affected?]
- **Timeline impact:** [how does this affect breakeven/launch/milestone?]
- **Team morale:** [how many pivots has the team absorbed recently?]

## Summary
Pivoting costs approximately **N total eng-weeks (€X)** including transition overhead.
This pushes [milestone] from [date] to [date].
```

---

## Strategy Doc Template (Diagnosis / Direction / Cost)

The one-page document that frames reality before proposing solutions. Based on Larson's Engineering Strategy framework (diagnosis → guiding policies → coherent actions). `[practitioner: Larson]`

```markdown
# [Company] — Where We Are

## Diagnosis: What's Actually True
[3-5 bullet points of undeniable facts. Team size, resource constraints,
revenue reality, recent pivot history with concrete costs]

## Direction: What We're Building Now
[1-2 sentences. What the current strategy is. Not what it could be —
what it IS right now]

The question isn't whether this is the best possible direction.
The question is: **will we commit to it long enough to find out?**

## Cost of Changing Again
[Concrete pivot cost estimate. Weeks, money, delayed milestones.
What we lose. What we'd need to rebuild]

## What I'm Proposing
[3 specific asks. Not vague — concrete commitments with time bounds]
```

---

## Board Prep Framework

When presenting technical investments to a board, investors, or non-technical executives. `[practitioner: Larson, Fournier]`

### Structure

```markdown
# [Topic] — Board Summary

## Business Impact (lead with this)
[What this means for the business in 1-2 sentences.
Not "we refactored the database" but "we reduced incident response time
by 60%, protecting €X in customer contracts"]

## What We Did / What We Need
[2-3 bullet points. Technical enough to show competence,
business enough to show relevance]

## Metrics
[Before → After, or Current → Target]
- Deployment frequency: X/week → Y/week
- Incident recovery: X hours → Y minutes
- Customer-affecting outages: X/month → Y/month

## Investment Required
[Time, people, money — concrete]

## Risk If We Don't
[What happens if we don't invest. Concrete consequences,
not fear mongering]
```

### Framing Principles

- **Lead with business impact.** The board cares about customers, revenue, and risk. Technical details support the case — they don't lead it
- **Use metrics.** "Better" is meaningless. "60% faster" is a fact. "2 fewer customer-affecting incidents per month" is undeniable
- **Frame investments as risk reduction.** "If we don't invest in X, we risk Y" is stronger than "X would be nice to have"
- **Translate timelines into business terms.** Not "6 engineer-weeks" but "6 weeks before we can ship the feature that closes deal Z"

---

## Decision Rights Map Template

For leadership alignment sessions. Fill in as a group.

```markdown
# Decision Rights Map

| # | Decision Area | Examples | Owner | Support |
|---|---|---|---|---|
| 1 | Product direction | Features, cuts, roadmap | ___ | ___ |
| 2 | Technical architecture | Build/buy, infrastructure, stack | ___ | ___ |
| 3 | Enterprise/client commitments | Contracts, scope, deadlines | ___ | ___ |
| 4 | Hiring & team structure | Roles, budget, team design | ___ | ___ |
| 5 | Strategy & pivots | Direction changes, new models | ___ | ___ |
| 6 | Marketing & content | Messaging, channels, brand | ___ | ___ |
| 7 | Financial decisions | Budget, pricing, runway | ___ | ___ |
| 8 | Quality & reliability | Testing, deployment, incidents | ___ | ___ |
| 9 | Operations & process | Tools, meetings, workflows | ___ | ___ |

## Rules
- Every row has exactly ONE Owner
- Owner decides. Support gives input
- Two-way door decisions: Owner decides, informs the group
- One-way door decisions: Owner writes 1-page proposal, gets input, then decides
- If you can't agree on who owns a row, that row is your biggest problem
```

---

## Incident Communication Framework

When something breaks in production and non-technical stakeholders need to know.

### During the Incident

**Template (to leadership/board):**
```
Subject: [Service] incident — [impact level]

What happened: [1 sentence — what the user sees]
Impact: [who's affected, how many, since when]
Status: [investigating / identified / fixing / resolved]
ETA: [if known, or "investigating"]
Next update: [time]
```

**Principles:**
- Lead with impact, not cause. "Users can't log in" not "database connection pool exhausted"
- Don't guess the cause until you know. "We're investigating" is honest
- Set expectations for next update. Silence creates anxiety

### After the Incident (Post-mortem summary for leadership)

```markdown
## Incident Summary: [Date] — [Title]

**Impact:** [who was affected, for how long, any revenue/customer impact]
**Root cause:** [1-2 sentences, non-technical]
**What we're changing:** [concrete actions to prevent recurrence]
**Timeline:** [when changes will be complete]
```

---

## The "Everyone Can Code" Conversation Guide

When a non-technical leader says "just use AI to build it." Grounded in Willison's observation that AI agents make it "feasible for people in high-interruption roles to productively work with code again" — while Tobi Lütke (Shopify CEO) shipping code via agents demonstrates both the opportunity and the need for guardrails. `[practitioner: Willison, Lütke]`

**Step 1: Agree.** "Yes, AI can generate that code. That part is fast."

**Step 2: Expand the frame.** "Here's what else goes into making it production-ready:"
- Testing: ensuring it works correctly under all conditions
- Security: protecting user data and preventing unauthorized access
- Deployment: getting it safely into production without breaking existing features
- Monitoring: knowing when something goes wrong before users tell us
- User management: permissions, accounts, data privacy
- Scale: handling 10 users is different from handling 10,000

**Step 3: Quantify.** "AI handles roughly 30-40% of the total work — the code generation part. The other 60-70% is making it reliable and maintainable."

**Step 4: Offer options.** "We can ship a prototype in [X days]. Production-ready takes [Y weeks]. Which timeline serves our goals?"

**What NOT to do:**
- Don't argue about AI's limitations. That's defensive
- Don't say "you don't understand." That's dismissive
- Don't over-complicate to justify your role. That's insecure
- Don't gatekeep. If they want to prototype with AI, let them. Protect production, not your ego
