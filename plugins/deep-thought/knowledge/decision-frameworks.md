# Decision Frameworks

How Heart of Gold professionals make decisions. Not decision theory in the abstract — practical frameworks for the choices you face every day when building software with AI.

---

## The Stakes Matrix

Not all decisions deserve the same attention. Before spending time analyzing, figure out where the decision sits:

|  | **Reversible** | **Irreversible** |
|--|---------------|-----------------|
| **High impact** | Decide fast, learn fast. You can undo it if wrong. Example: choosing an API design pattern — refactor later if it doesn't fit. | Decide carefully. Get input. Sleep on it. Example: database schema for production data — migration cost is real. |
| **Low impact** | Just pick one. Don't waste time. Example: naming a utility function — rename later, nobody cares. | Rare. If it's truly irreversible but low impact, decide and move on. Example: choosing a log format — annoying to change but won't matter much. |

**The trap:** Treating reversible decisions like irreversible ones. Teams lose weeks debating things they could try in an afternoon. If you can undo it, try it. You'll learn more from the attempt than from the analysis.

**How to use this:** Before any decision that feels heavy, ask: "If we're wrong, how hard is it to change?" If the answer is "a few hours of work," stop analyzing and start building.

---

## Tradeoff Evaluation

Most decisions aren't right vs. wrong — they're tradeoffs between legitimate concerns. Here's how to evaluate them without getting stuck.

### The Good Enough Threshold

Perfection is the enemy of shipping. For any decision, define:

1. **What "good enough" looks like.** Not the ideal — the minimum that ships value and doesn't create debt you can't pay back.
2. **What "too cheap" looks like.** The version that creates real problems: security holes, unmaintainable code, broken user experience.
3. **The gap between them.** That gap is your decision space. Pick anything in it and move on.

Example: Choosing a caching strategy. "Good enough" = simple TTL cache that handles 90% of reads. "Too cheap" = no cache at all, database melts at scale. "Ideal" = distributed cache with invalidation, warming, and monitoring. Start with good enough. You'll know when you need more.

### Comparing Alternatives

When you have 2-3 approaches and none is obviously better:

1. **Write down what each optimizes for.** Approach A optimizes for speed. Approach B optimizes for flexibility. Approach C optimizes for simplicity.
2. **Ask: what matters most right now?** Not in theory — for this feature, this team, this timeline.
3. **Name what you're giving up.** Every choice has a cost. If you can name it and accept it, decide. If you can't name what you're losing, you don't understand the tradeoff yet.

**Never compare more than 3 options.** If you have more, eliminate the weakest until you're down to 3. Humans can't meaningfully compare more than that. [consensus]

---

## When to Decide Fast vs. Slow

### Decide Fast When:

- **You've seen this before.** Pattern recognition is your friend. If the problem is familiar, trust your judgment and iterate.
- **The cost of delay exceeds the cost of a wrong choice.** A good decision now beats a perfect decision next week.
- **You can instrument.** If you can measure the outcome and change course, speed wins.
- **The team is blocked.** Unblocking people is almost always worth a slightly-less-than-perfect decision.

### Decide Slow When:

- **You're in unfamiliar territory.** If neither you nor your AI has seen this pattern, the risk of a bad fast decision is high. Research first.
- **The cost of being wrong is asymmetric.** If success saves a day but failure costs a month, invest in getting it right.
- **Multiple teams are affected.** Coordination costs make reversals expensive even when they're technically simple.
- **Security or data integrity is at stake.** These deserve extra scrutiny every time. No exceptions.

---

## When to Ask for Help

Critical Trust (sub-competency 2.1) includes knowing what you don't know. Here's when to stop and get input:

### Ask When:

- **You're about to make an irreversible, high-impact decision** and you're less than 80% confident.
- **You've been going back and forth for more than 15 minutes.** Indecision is a signal that you're missing information or perspective.
- **The decision touches a domain you don't own.** Another team's schema, another person's module, infrastructure you didn't build.
- **Your AI gave you an answer you can't verify.** If you can't tell whether the AI is right, you need a human who can.

### Don't Ask When:

- **You're procrastinating.** Not every decision needs consensus. If you can undo it, make the call.
- **You already know the answer and want validation.** That's not asking for help — that's avoiding responsibility.
- **It's a stylistic preference.** Tabs vs. spaces, naming conventions — these should be decided once in a style guide, not per-decision.

---

## Decision Documentation

Capturing "why" is more valuable than capturing "what." Anyone can read the code to see WHAT you did. Only the decision record explains WHY.

### What to Document

- **The decision.** One sentence. "We chose PostgreSQL over MongoDB."
- **The context.** What constraints or facts drove the choice? "We need ACID transactions and have a relational data model."
- **The alternatives.** What else was considered? "MongoDB was considered for schema flexibility."
- **Why this one.** The actual reason. "Our team knows PostgreSQL, the data is relational, and we need transactions. Schema flexibility was not a priority."
- **What would change it.** Under what conditions should this be revisited? "If we add a document-heavy feature with no relational needs, reconsider."

### What NOT to Document

- **Obvious decisions.** "We chose to use the language the project is written in." Don't document the non-decisions.
- **Reversible, low-impact choices.** These aren't worth the overhead. Change them when they're wrong.
- **Decisions made for you.** Framework choices, company mandates — unless you're recording that the mandate exists and why.

### Where to Put It

In the plan's Decision Rationale section. Not a separate ADR for every plan — the rationale lives with the plan that needed it. If a decision is architectural and affects the whole system, promote it to a proper ADR.

---

## Anti-patterns

- **Analysis paralysis.** Spending more time deciding than the decision is worth. Use the stakes matrix — if it's reversible, decide and move.
- **Consensus theater.** Getting everyone to "agree" when what you need is one person to decide. Consensus is expensive. Use it for irreversible, high-impact decisions. Use judgment for everything else.
- **Deciding without data.** Making a call when 30 minutes of research would give you a clear answer. Fast decisions are good; uninformed decisions are not.
- **Changing decisions without new information.** If the facts haven't changed, the decision shouldn't either. Relitigating is expensive.
