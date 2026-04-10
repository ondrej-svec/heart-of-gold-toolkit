---
name: expert-panel
description: >
  Convene a research-grounded expert panel to review content, curriculum, workshops,
  documentation, or technical strategy. Each lens researches the real expert's published
  thinking before reviewing — not persona theatre, but grounded evaluation. Parallel
  dispatch, convergent synthesis, prioritized action list.
  Triggers: expert panel, expert review, expert audit, panel review, multi-lens review,
  get expert feedback, advisory review, content audit, workshop audit, strategy review.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - WebSearch
  - WebFetch
  - Bash
---

# Expert Panel

Convene a panel of research-grounded expert lenses to review content through multiple independent perspectives, then synthesize the findings into a prioritized action list.

This is NOT persona theatre. Each lens starts with **web research** into the real expert's published work on the specific topic before reviewing. The skill mandates grounding — citations, specific concepts, named frameworks — not vague impersonation.

## Boundaries

**This skill MAY:** read files, search the web, dispatch research subagents, analyze content, produce structured findings.
**This skill MAY NOT:** edit files, create code, modify the reviewed content, push changes.

**This is a review, not a fix. Present findings and priorities — the user decides what to act on.**

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Skip the research — I already know what Fowler thinks" | You know your training data's snapshot. The expert may have published new work, revised positions, or addressed this exact topic directly. | Stale or fabricated attribution damages credibility |
| "Run all lenses on everything" | A 7-lens review of a README is overkill. Lenses that don't apply produce noise that buries real signal. | The user reads 7 reviews, trusts none |
| "Skip synthesis — just show each review" | Raw reviews are noise. The value is where 3+ lenses converge. | User does the synthesis themselves, defeats the purpose |
| "One lens is enough for this" | If one lens is enough, use `/deep-thought:review` instead. The panel exists for the multi-perspective convergence. | Use the right tool |

---

## Phase 0: Scope and Lens Selection

**Entry:** User invoked `/expert-panel` with a topic, directory, or file set.

### Understand the target

Read the project's `AGENTS.md`, `CLAUDE.md`, and `README.md` to understand:
- What the project is trying to teach, build, or communicate
- Who the audience is (participants, developers, customers, operators)
- What the content delivery context is (workshop, docs, product, course)

### Select lenses

If the user specified lenses, use those. Otherwise, recommend a panel based on the content type:

| Content type | Recommended panel |
|---|---|
| Workshop / course curriculum | pedagogy, craft, practitioner, behavioral |
| Technical documentation | craft, practitioner, tool-fluency |
| Product strategy / architecture | craft, practitioner, systems-thinking |
| Educational content (blog, talks) | pedagogy, practitioner, narrative |
| Developer tools (CLI, SDK, API) | tool-fluency, craft, practitioner |

Present the recommendation using **AskUserQuestion**:
- header: "Expert panel"
- question: "I recommend these lenses for [content type]. Adjust?"
- Show the recommended lenses with one-line descriptions
- Options: "Go with these", "Add a lens", "Remove a lens", "Custom selection"

**Minimum: 3 lenses.** Fewer than 3 cannot produce convergent findings — use `/deep-thought:review` instead.
**Maximum: 8 lenses.** More than 8 dilutes synthesis quality and burns context budget.

**Exit:** Target scope and lens selection confirmed.

---

## Phase 1: Research (parallel, per lens)

**Entry:** Lenses selected, target scope confirmed.

**This is the phase that separates expert-panel from generic "review as persona X."**

For each selected lens, dispatch a **parallel Agent subagent** with this brief:

```
You are researching [EXPERT NAME]'s published thinking to prepare for
a grounded review of [TARGET DESCRIPTION].

1. SEARCH the web for [EXPERT]'s recent writing, talks, or interviews
   about [TOPIC AREA]. Prioritize:
   - Their blog, newsletter, or personal site
   - Recent conference talks (last 2 years)
   - Published books or articles on this specific topic
   - Specific frameworks, vocabulary, or mental models they use

2. FIND at least 3 specific concepts, frameworks, or positions the
   expert has published that are relevant to reviewing [TARGET].
   For each, note:
   - The concept name and where it comes from
   - How it applies to the target content
   - What the expert would specifically look for or critique

3. READ the target content: [FILE LIST]

4. WRITE a review of ~400 words in the expert's voice, using their
   specific vocabulary and frameworks. Every claim must be traceable
   to a named concept or publication. Do not fabricate attributions.

Format:
## [Lens Name] Review
### Research grounding
- [Concept 1]: [source] — [how it applies]
- [Concept 2]: [source] — [how it applies]
- [Concept 3]: [source] — [how it applies]
### Findings
[The actual review, using the expert's frameworks]
### Top 3 changes
1. [Most impactful]
2. [Second]
3. [Third]
```

**All lens subagents run in parallel.** Do not wait for one before dispatching the next. This is the performance-critical design choice — 7 sequential research passes would take 7x longer.

**If a subagent cannot find relevant published work for a lens:** The subagent should say so honestly ("I could not find [Expert]'s published position on [topic]. Proceeding with general principles from their known frameworks."). This is better than fabricating citations.

**Exit:** All subagent reviews collected.

---

## Phase 2: Synthesize

**Entry:** N lens reviews collected from parallel subagents.

This is where the panel produces value that no single review can.

### Step 1: Extract findings

From each lens review, extract every distinct finding (recommendation, critique, observation). Tag each with:
- Which lens produced it
- Severity: **critical** (blocks quality), **important** (strengthens quality), **observation** (worth noting)
- Which specific file or section it targets

### Step 2: Identify convergence

Group findings by theme. For each theme, count how many independent lenses flagged it.

- **Strong signal (3+ lenses):** These are the findings you can trust. Multiple independent perspectives arrived at the same conclusion through different reasoning paths. Lead the report with these.
- **Moderate signal (2 lenses):** Worth mentioning but not consensus. Note which two lenses converged and why.
- **Single-lens signal (1 lens):** Include only if severity is critical. Otherwise, these go in the per-lens appendix.

### Step 3: Identify productive disagreements

Where two lenses directly contradict each other, **name the tension** instead of picking a winner. Example: "Newport recommends expanding the demo to 35 minutes for deeper cognitive scaffolding; Orosz would cut it to keep the day realistic. The tension is depth vs. pace — the facilitator's room read should decide."

### Step 4: Prioritize actions

Produce a ranked action list ordered by:
1. Convergence strength (more lenses = higher priority)
2. Severity (critical > important > observation)
3. Effort (quick wins before heavy lifts, when convergence and severity are equal)

Each action should name: what to change, which file(s), why (citing which lenses and their reasoning), and estimated effort (one-line edit / new section / new document / architectural change).

**Exit:** Synthesis complete.

---

## Phase 3: Present

**Entry:** Synthesis complete.

### Output format

```markdown
# Expert Panel Review: [target description]

## Panel composition
[List of lenses used, with one-line description of each expert's focus]

## Headline finding
[One paragraph: the single most important thing the panel found,
supported by the convergence count]

## Where the panel agreed (strong signal)
[Findings with 3+ lens convergence. Each finding gets:]
- **Finding**: [what]
- **Lenses**: [which experts converged]
- **Why it matters**: [impact if unaddressed]
- **Recommended action**: [specific, with file references]

## Where the panel agreed (moderate signal)
[2-lens convergence findings, same format but briefer]

## Productive disagreements
[Named tensions between lenses, with both positions stated fairly]

## Prioritized action list
[Numbered list, effort-tagged, with file references]
1. [Action] — [files] — [effort: small/medium/large] — [lenses: X, Y, Z]
2. ...

## What not to change
[Things multiple lenses explicitly defended. Important for preventing
the user from "fixing" things that are already right.]

## Per-lens appendix
[Collapsed or clearly separated: the full review from each lens,
for the user who wants to read the raw expert perspectives]
```

Save the output to `docs/reviews/YYYY-MM-DD-expert-panel-<topic>.md` if the project has a `docs/reviews/` directory, otherwise present it inline.

**Exit:** Report delivered.

---

## Phase 4: Handoff

Use **AskUserQuestion** with:
- question: "Expert panel review complete. What next?"
- header: "Next step"
- options:
  1. label: "Create a plan", description: "Turn the prioritized actions into a /deep-thought:plan"
  2. label: "Discuss a finding", description: "Push back or explore a specific finding deeper"
  3. label: "Run again with different lenses", description: "Swap lenses and re-run on the same content"
  4. label: "Done", description: "Review complete"

---

## The Lens Library

Each lens below defines: the expert or school it's grounded in, the research targets for Phase 1, the specific frameworks and vocabulary the review should use, and what makes a finding from THIS lens distinct from others.

### `pedagogy` — Learning Design

**Grounded in:** Cal Newport (Deep Work, Slow Productivity), Andrew Ng (practical AI education), the science of learning transfer.

**Research targets:** Newport's writing on attention, cognitive load, and metacognitive scaffolding. Ng's writing on progressive disclosure, "one idea per lesson," and concrete-before-abstract. Learning science on transfer, spacing, and retrieval practice.

**What this lens looks for:**
- Does the day structure respect cognitive load and attention limits?
- Are concepts introduced in the right order (concrete → abstract, not the reverse)?
- Is there a single transferable mental model the learner takes away, or a pile of tips?
- Are there natural "deep work" blocks, or is the day fragmented?
- Does the curriculum install a practice (durable) or just convey information (perishable)?
- Is pseudo-productivity avoided? (Feeling of learning vs. evidence of learning.)

**Vocabulary:** attention residue, metacognitive scaffolding, depth vs. breadth, progressive disclosure, one-idea-per-lesson, concept before implementation, slow productivity, craft.

---

### `craft` — Technical Credibility

**Grounded in:** Martin Fowler (refactoring, evolutionary design, continuous delivery), the software craft tradition.

**Research targets:** Fowler's writing on refactoring, code smells, design patterns, TDD with AI, and "making change safe." His bliki (blog + wiki) entries on evolutionary design and reversible decisions.

**What this lens looks for:**
- Are claims about testing, refactoring, and verification technically precise or hand-wavy?
- Does the curriculum teach design vocabulary (smells, duplication of knowledge, rule of three, strangler fig)?
- Is verification framed as specification clarity or as TDD dogma?
- Does the content acknowledge the relationship between AI-generated code and design quality?
- Are the "good practices" actually recognized by working engineers, or invented terminology?

**Vocabulary:** evolutionary design, reversible decisions, refactoring toward, code smell, duplication of knowledge, rule of three, strangler fig, YAGNI, testing pyramid, making change safe.

---

### `practitioner` — Reality Check

**Grounded in:** Gergely Orosz (The Pragmatic Engineer), the tradition of engineering-team-level realism.

**Research targets:** Orosz's newsletter and posts on how real engineering teams use AI tools, the gap between conference advice and shipping reality, team dynamics under AI-assisted development, "AI-native engineers."

**What this lens looks for:**
- Does this advice survive contact with a real Monday morning?
- Is "harness engineering" (or whatever the concept is) a real discipline or a branded repackaging of things teams already know?
- Are the time estimates and scope realistic?
- Is the marketing language honest? Would a senior engineer roll their eyes at any claims?
- Does the content reflect how practitioners actually use these tools (iterative, messy, lots of rejection) vs. how demos show them (clean, one-shot)?

**Vocabulary:** evidence-based, "what actually works," shipping reality, hype vs. evidence, AI-native, team dynamics, velocity pressure, adoption barriers.

---

### `agent-engineering` — Agent Reliability

**Grounded in:** Anthropic's published thinking on agent scaffolding, OpenAI's harness engineering guidance, frontier-lab research on long-horizon agent reliability.

**Research targets:** Anthropic's engineering blog on agent tool use, context management, and eval methodology. OpenAI's articles on Codex harness engineering and approval loops. Academic papers on agent drift, hallucination in agentic settings, and eval-driven development.

**What this lens looks for:**
- Is "harness" used with technical precision (scaffolding that bounds and extends capability) or as a brand term?
- Does the content honestly represent where current coding agents fail (long-horizon drift, overconfident edits, invisible dependency assumptions)?
- Are verification and evals treated as first-order concerns?
- Is the continuation shift framed as an eval or just as an experience?
- Are cost, latency, and context-window budgets addressed?
- Are approval loops and sandboxing discussed with the right level of specificity?

**Vocabulary:** harness, scaffolding, eval harness, approval loop, sandboxing, long-horizon drift, context window budget, effective capability, verification boundary, tool affordances.

---

### `tool-fluency` — Concrete Practitioner Guidance

**Grounded in:** Simon Willison (daily AI tools practitioner, Datasette creator, LLM CLI author), the tradition of "show me the thing running."

**Research targets:** Willison's blog (simonwillison.net) on Codex, Claude Code, and other coding agents. His writing on prompt transparency, concrete examples, failure cases, and tool-specific affordances.

**What this lens looks for:**
- Are there concrete, copy-paste-able examples participants can run?
- Is there a "watch it go wrong" moment that teaches failure recovery?
- Does the curriculum acknowledge tool-specific affordances (why Codex for X, Claude Code for Y)?
- Are prompts shown transparently, or hidden behind abstractions?
- Does the curriculum acknowledge how fast the tool ecosystem changes, and install a learning practice rather than freezing knowledge?

**Vocabulary:** concrete examples, "show me the thing running," tool affordances, prompt transparency, failure cases, before/after pairs, learning practice, ecosystem velocity.

---

### `behavioral` — Operating Model Change

**Grounded in:** Aaron Dignan (Brave New Work, The Ready), the tradition of organizational operating system design.

**Research targets:** Dignan's writing on how teams change behavior (not posters), autonomy + constraints, "loose rules tight feedback," the difference between workshops that install habits and ones that entertain.

**What this lens looks for:**
- Does the workshop install a durable behavior change or just entertain for a day?
- Is there genuine self-organization with clear constraints, or hierarchy theatre?
- Does the facilitation read as a container for discovery or as a script to follow?
- What operating-model change could a participant take back to their team on Monday?
- Is frustration treated as signal or as failure?

**Vocabulary:** operating model, behavioral installation, loose rules / tight feedback, self-organization, container (not script), distributed authority, constraint-based autonomy.

---

### `systems-thinking` — Architecture and Feedback Loops

**Grounded in:** Donella Meadows (Thinking in Systems), Gene Kim (The Phoenix Project, Accelerate), the tradition of systems dynamics applied to software delivery.

**Research targets:** Meadows' leverage points framework. Kim's DORA metrics and the three ways (flow, feedback, continual learning). Systems thinking applied to developer experience and CI/CD.

**What this lens looks for:**
- Are there feedback loops that make the system learn from its own output?
- Where are the leverage points — small changes that shift behavior disproportionately?
- Is the system designed for flow (small batches, fast feedback) or for big-bang delivery?
- Are bottlenecks identified and addressed, or worked around?
- Does the architecture support continual learning or freeze at v1?

**Vocabulary:** feedback loop, leverage point, stock and flow, delay, reinforcing loop, balancing loop, three ways (flow / feedback / learning), DORA metrics, batch size.

---

### `narrative` — Story and Communication

**Grounded in:** The tradition of technical communication, developer relations, and storytelling for engineers. Nancy Duarte (Resonate), technical writing best practices.

**Research targets:** Duarte's writing on presentation structure and audience engagement. Developer advocacy best practices for technical content. "Show, don't tell" applied to engineering education.

**What this lens looks for:**
- Is there a narrative arc or just a sequence of topics?
- Does the content show before it tells?
- Is the opening a hook or a preamble?
- Are analogies concrete and appropriate for the audience, or abstract and decorative?
- Does the close drive action or just summarize?

**Vocabulary:** narrative arc, hook, show don't tell, audience contract, tension and resolution, call to action, concrete analogy.

---

## Validate

Before delivering the report:

- [ ] Every lens review cites at least 2 specific concepts from the expert's published work (not generic advice)
- [ ] Web research was performed for every lens (if a search found nothing, that's stated explicitly)
- [ ] Convergent findings identify which lenses converged and through what reasoning
- [ ] Productive disagreements name both sides fairly without picking a winner
- [ ] The prioritized action list has file references and effort estimates
- [ ] "What not to change" is present (prevents the user from breaking what works)
- [ ] No files were modified — findings only

## When NOT to Use /expert-panel

- **Code review.** Use `/deep-thought:review` instead. Expert-panel is for content, curriculum, strategy.
- **Quick feedback.** If you just want "is this good?" on a single doc, use `/deep-thought:review`.
- **Editing.** The panel reviews; it does not fix. Use the findings to drive `/deep-thought:plan` → `/marvin:work`.
- **Less than 3 lenses.** The convergent synthesis needs 3+ to produce signal. Fewer = use `/deep-thought:review`.

## What Makes This Heart of Gold

- **Critical Trust (2.1):** Research-grounded, not persona theatre. Every attribution is traceable.
- **Strategic AI Dialogue (2.4):** Parallel dispatch + convergent synthesis is a pattern a human can't efficiently replicate — 7 independent research passes in the time it takes to do one.
- **Prompt Mastery (2.2):** The lens definitions ARE the prompt engineering. Each lens encodes what to research, what vocabulary to use, and what makes a finding distinct.

## Knowledge References

- `../knowledge/critical-evaluation.md` — Evidence-based evaluation, uncertainty flagging
- `../knowledge/socratic-patterns.md` — CoVe technique for verifying findings
- `../knowledge/decision-frameworks.md` — Tradeoff evaluation for the prioritized action list
