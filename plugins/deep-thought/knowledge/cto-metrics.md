# CTO Metrics — Engineering Effectiveness Measurement

What to measure, how to measure it, and what good looks like by company stage.

---

## DORA Metrics (Forsgren, Humble, Kim)

The research-backed metrics for software delivery performance. From *Accelerate* — the only metrics proven to correlate with both engineering effectiveness AND business outcomes. `[academic]`

### The Four Metrics

| Metric | What it measures | How to measure |
|---|---|---|
| **Deployment Frequency** | How often you ship to production | Count deployments per week/month |
| **Lead Time for Changes** | Time from commit to production | Measure from merge to deployment |
| **Mean Time to Recovery (MTTR)** | How fast you fix incidents | Measure from incident detection to resolution |
| **Change Failure Rate** | What % of deployments cause problems | Count rollbacks, hotfixes, incidents / total deployments |

### What "Good" Looks Like by Stage

| Metric | Early stage (<15 people) | Growth (15-50) | Scale (50+) |
|---|---|---|---|
| Deployment Frequency | Multiple per week | Multiple per day | On demand |
| Lead Time | < 1 week | < 1 day | < 1 hour |
| MTTR | < 1 day | < 1 hour | < 15 minutes |
| Change Failure Rate | < 30% | < 15% | < 10% |

**Important:** Early-stage teams should NOT compare themselves to Google. The goal is consistent improvement, not hitting elite benchmarks. A team deploying weekly that moves to daily has improved enormously.

### How to Start Measuring

**If you measure nothing today:**
1. Start with Deployment Frequency. It's the easiest to track (count deployments)
2. Add MTTR next. Track incident timestamps
3. Lead Time requires CI/CD instrumentation — add when your pipeline is stable enough
4. Change Failure Rate requires incident classification — add when you have consistent incident management

**Don't over-instrument.** A spreadsheet tracking deployments and incidents is better than no data. Perfect tooling is not required.

---

## Team Health Indicators

Beyond DORA — signals that the engineering organization is healthy or struggling.

### Quantitative Indicators

| Indicator | Healthy | Warning | Critical |
|---|---|---|---|
| **Cycle time** (issue → production) | < 1 week | 1-4 weeks | > 4 weeks |
| **WIP per person** | 1-2 items | 3-4 items | 5+ items |
| **PR review time** | < 24 hours | 1-3 days | > 3 days |
| **On-call pages/week** | < 2 | 2-5 | > 5 |
| **Unplanned work ratio** | < 20% | 20-40% | > 40% |

### Qualitative Indicators

| Signal | What it means |
|---|---|
| Engineers skip code review | Trust breakdown or review is seen as obstacle |
| "I didn't know about that change" | Communication gaps, siloed work |
| Senior engineers leave | Culture, growth, or compensation problem |
| Nobody volunteers for hard problems | Learned helplessness or blame culture |
| Meetings proliferate | Process replacing trust |
| "That's not my job" | Ownership boundaries unclear or too rigid |
| Constant firefighting | Insufficient investment in quality/stability |

---

## Engineering Cost Models

### Pivot Cost Calculator

Use to quantify the cost of strategic direction changes.

**Inputs:**
- Average engineer cost per week (salary + benefits + overhead / 52)
- Number of engineers who worked on the abandoned direction
- Duration of the abandoned work (weeks)
- Reusability factor (what % of the work carries forward): 0% = total waste, 100% = nothing lost

**Formula:**
```
Wasted investment = (Engineers × Weeks × Cost/week) × (1 - Reusability factor)
Transition cost = Engineers × 1.5 weeks × Cost/week  (context switching overhead)
Total pivot cost = Wasted investment + Transition cost
```

**Example:**
- 3 engineers × 8 weeks × €1,000/week = €24,000 invested
- Reusability: 40% (some frontend work carries forward)
- Wasted: €24,000 × 0.6 = €14,400
- Transition: 3 × 1.5 × €1,000 = €4,500
- **Total pivot cost: ~€18,900**

### Context Switching Cost

Research shows developers need ~23 minutes to refocus after an interruption. Complex coding tasks take ~45 minutes to recover. Context switching reduces effective productivity to ~40%. `[academic: Gloria Mark, UC Irvine — context switching research]`

**For a team:**
```
Effective hours lost per pivot = Team size × 0.6 × 40 hours/week × weeks_of_disruption
```

At a 4-person team, a mid-sprint pivot costs approximately 1 full week of effective output just in context switching — before any actual work on the new direction begins.

### Rework Cost Ratio

Track over time: what percentage of engineering effort goes to rework (rebuilding things that were already built)?

| Rework ratio | Assessment |
|---|---|
| < 10% | Healthy. Some rework is natural |
| 10-25% | Concerning. Look for systematic causes |
| 25-50% | Significant waste. Likely caused by unclear requirements or frequent pivoting |
| > 50% | Crisis. The team is doing more rework than new work |

---

## AI Tool Adoption Metrics

### What to Measure

| Metric | What it tells you | How to measure |
|---|---|---|
| **AI tool usage** | Adoption rate | % of engineers using AI tools regularly |
| **Token spend** | Cost trajectory | Monthly spend, per-team, per-feature |
| **AI-assisted PR ratio** | Integration depth | % of PRs with significant AI-generated code |
| **Time to first commit** | Onboarding impact | How fast new engineers ship their first change (with/without AI) |
| **Defect rate in AI-assisted code** | Quality impact | Bug rate in AI-generated vs. human-written code |

### When AI Tools Are Helping vs. Adding Noise

**Helping signs:**
- Engineers report spending less time on boilerplate
- Time from idea to working prototype decreases
- PR volume increases without quality decrease
- Engineers use AI for exploration ("what if we tried X?")

**Noise signs:**
- Engineers spend more time debugging AI output than they saved generating it
- Code review burden increases (reviewers struggling to validate AI-generated patterns)
- Architecture becomes inconsistent (AI makes different design choices each time)
- Engineers stop thinking about design ("the AI will figure it out")
- Token costs grow faster than productivity gains

---

## Glue Work Visibility (Reilly)

Glue work is the invisible coordination that makes projects succeed: mentoring, design review, unblocking, process improvement, cross-team communication. It's critical but fails to appear in performance reviews. `[practitioner: Reilly]`

### How to Surface It

**1. Name it.** Create a shared vocabulary. "Glue work" has a name — use it.

**2. Track it.** In sprint reviews or weekly updates, explicitly ask: "What coordination work did you do this week?"

**3. Distribute it.** If one person is doing all the glue work, that's a sign it's not valued — it's expected. Rotate coordination responsibilities.

**4. Credit it.** Include glue work in performance reviews. "Led the cross-team alignment for Project X" is as valuable as "shipped Feature Y."

**5. Watch for patterns.** Glue work disproportionately falls on women and underrepresented groups. This is documented. Monitor and correct.

### Glue Work Categories

| Category | Examples |
|---|---|
| **Unblocking** | Helping teammates with technical problems, reviewing PRs quickly, answering questions |
| **Coordination** | Cross-team communication, stakeholder updates, meeting facilitation |
| **Knowledge sharing** | Documentation, onboarding new members, maintaining wikis |
| **Process improvement** | Improving CI/CD, automating repetitive tasks, fixing flaky tests |
| **Mentoring** | 1:1 guidance, pairing, code review feedback that teaches |

---

## The CTO's Dashboard

If you could only track 7 things:

| Metric | Source | Review cadence |
|---|---|---|
| **Deployment frequency** | CI/CD pipeline | Weekly |
| **MTTR** | Incident log | Monthly |
| **Cycle time** | Issue tracker | Weekly |
| **Unplanned work ratio** | Sprint tracking | Sprint review |
| **Token spend** | AI provider dashboard | Monthly |
| **Team sentiment** | 1:1s, anonymous survey | Monthly |
| **Pivot cost (cumulative)** | CTO calculation | Quarterly |

**The principle:** Measure to learn, not to control. Metrics that become targets become bad metrics (Goodhart's Law). Use these to spot trends and have informed conversations, not to set quotas.
