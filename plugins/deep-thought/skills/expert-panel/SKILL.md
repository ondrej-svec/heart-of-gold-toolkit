---
name: expert-panel
description: >
  Multi-framework content review with convergent synthesis. Each lens applies a
  named analytical framework — grounded in published source material, not persona
  impersonation — to the target content. Parallel dispatch, web research or
  user-provided references, convergent synthesis, prioritized action list.
  Triggers: expert panel, expert review, expert audit, panel review, multi-lens
  review, framework review, content audit, workshop audit, strategy review,
  get expert feedback, advisory review.
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

Apply multiple analytical frameworks to content in parallel, then synthesize the findings into convergent signals, productive disagreements, and a prioritized action list.

## What this skill is — and what it is not

Each lens is a **named analytical framework** (evolutionary design, learning science, practitioner reality-check, etc.) with traceable sources (books, articles, published talks). The skill applies those frameworks to the target content and cites specific concepts by name.

Each lens is **NOT a persona impersonation**. The skill never claims "Fowler says" or "Newport would argue." It claims "applying the evolutionary-design framework (source: Fowler, Refactoring 2nd ed.) to this content, the following pattern emerges." The framework is the lens. The author is the source. The AI is the reader applying the framework — like a careful graduate student who read the book, not like the author in the room.

This distinction matters because:
- AI cannot faithfully represent what a specific person thinks. It can apply their published frameworks.
- Persona impersonation fabricates opinions and creates false authority. Framework application is traceable and falsifiable.
- If a framework produces a wrong finding, you can check it against the source material. If a persona produces a wrong finding, there's nothing to check — it's just plausible-sounding noise.

## Grounding tiers

The skill supports three tiers of grounding, from highest to lowest fidelity:

### Tier 1 — User-provided reference material (highest fidelity)

The user provides the actual source texts (book chapters, blog posts, talk transcripts, papers) in a `references/` directory or via `--references <path>`. Each lens reads its assigned reference material as primary context and applies the specific arguments from that material to the target content.

This is the closest to "what would the framework's author think" because the model is reading and applying THEIR actual words, not reconstructing them from training data. Citations point to specific sections of the provided material.

```
/expert-panel content/ --references docs/references/
```

Where `docs/references/` contains files named by lens:
```
references/
  learning-design/
    newport-deep-work-ch4.md
    ng-coursera-teaching-principles.md
  evolutionary-design/
    fowler-refactoring-smells-catalog.md
    fowler-bliki-evolutionary-design.md
  practitioner-reality/
    orosz-ai-native-engineers-newsletter.md
```

Each lens reads only its own subdirectory. If the subdirectory is empty or absent, the lens falls back to Tier 2.

### Tier 2 — Web research (default)

The skill searches the web for the framework authors' published work on the specific topic being reviewed. Each lens subagent runs WebSearch + WebFetch to find recent articles, blog posts, or talks, reads them, and extracts specific concepts to apply.

Better than training-data recall because it finds current publications. Still limited by search quality and the model's ability to faithfully represent what it read. Every finding must cite the source URL or publication name.

### Tier 3 — Framework application from known concepts (fallback)

If both Tier 1 (no references provided) and Tier 2 (web search found nothing relevant) fail, the lens applies the framework's well-known published concepts (e.g., Fowler's code smells catalog, Meadows' 12 leverage points) from the model's training data. The lens must explicitly state: "No current published work found on this specific topic. Applying the framework's established concepts from [source name, publication year]."

This is the lowest tier. It works for frameworks with well-codified concepts (code smells, DORA metrics, leverage points) and poorly for frameworks that depend on evolving positions (a practitioner's current view on AI tools).

**The skill MUST state which tier each lens operated at in the output.** The user needs to know whether a finding is grounded in provided material, in a web-sourced article, or in training-data recall.

## Boundaries

**This skill MAY:** read files, search the web, dispatch research subagents, read user-provided reference material, analyze content, produce structured findings.
**This skill MAY NOT:** edit files, create code, modify the reviewed content, push changes. Claim that a specific person holds a specific opinion. Use "X says" or "X would argue" phrasing.

**This is a review, not a fix. Present findings and priorities — the user decides what to act on.**

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "I know this framework well enough to skip research" | You know your training data's snapshot. The source author may have revised their position, published new work, or addressed this exact topic. | Stale or fabricated attribution damages credibility |
| "Run all lenses on everything" | A 7-lens review of a README is overkill. Lenses that don't apply produce noise that buries real signal. | The user reads 7 reviews, trusts none |
| "Skip synthesis — just show each review" | Raw reviews are noise. The value is where 3+ lenses converge. | User does the synthesis themselves, defeats the purpose |
| "One lens is enough for this" | If one lens is enough, use `/deep-thought:review` instead. The panel exists for multi-perspective convergence. | Use the right tool |
| "Fowler would say..." | You are not Fowler. You are applying Fowler's published evolutionary-design framework. Say that. | False authority, unfalsifiable claim, potential misrepresentation |

---

## Phase 0: Scope and Lens Selection

**Entry:** User invoked `/expert-panel` with a topic, directory, or file set.

### Understand the target

Read the project's `AGENTS.md`, `CLAUDE.md`, and `README.md` to understand:
- What the project is trying to teach, build, or communicate
- Who the audience is (participants, developers, customers, operators)
- What the content delivery context is (workshop, docs, product, course)

### Check for reference material

Look for a `references/` directory at the project root or at the path specified by `--references`. If found, inventory its subdirectories and match them to available lenses. Report which lenses have Tier 1 material and which will use Tier 2 (web research).

### Select lenses

If the user specified lenses, use those. Otherwise, recommend a panel based on the content type:

| Content type | Recommended panel |
|---|---|
| Workshop / course curriculum | learning-design, evolutionary-design, practitioner-reality, behavioral-change |
| Technical documentation | evolutionary-design, practitioner-reality, tool-craft |
| Product strategy / architecture | evolutionary-design, practitioner-reality, systems-dynamics |
| Educational content (blog, talks) | learning-design, practitioner-reality, narrative-craft |
| Developer tools (CLI, SDK, API) | tool-craft, evolutionary-design, practitioner-reality |

Present the recommendation using **AskUserQuestion**:
- header: "Expert panel"
- question: "I recommend these frameworks for [content type]. Adjust?"
- Show the recommended lenses with one-line descriptions and grounding tier per lens
- Options: "Go with these", "Add a lens", "Remove a lens", "Custom selection"

**Minimum: 3 lenses.** Fewer than 3 cannot produce convergent findings — use `/deep-thought:review` instead.
**Maximum: 8 lenses.** More than 8 dilutes synthesis quality and burns context budget.

**Exit:** Target scope, lens selection, and grounding tiers confirmed.

---

## Phase 1: Research and Review (parallel, per lens)

**Entry:** Lenses selected, target scope confirmed.

For each selected lens, dispatch a **parallel Agent subagent** with this brief:

```
You are applying the [FRAMEWORK NAME] analytical framework to review
[TARGET DESCRIPTION].

## Grounding

[IF TIER 1]: Read the reference material at [REFERENCE PATH]. Extract
the specific concepts, frameworks, vocabulary, and evaluative criteria
from this material. Your review MUST cite specific sections or arguments
from the provided material. Do not supplement with your own knowledge of
the author — the provided text is your source of truth.

[IF TIER 2]: Search the web for published work by [SOURCE AUTHORS] on
[TOPIC AREA]. Prioritize their blog, newsletter, or personal site;
recent talks (last 2 years); and published books or articles on this
specific topic. Find at least 3 specific concepts or frameworks from
their published work that apply to this review. Cite the source URL or
publication for each.

[IF TIER 3]: Apply the framework's established published concepts:
[LIST THE WELL-KNOWN CONCEPTS]. State explicitly that no current
material was found and that you are applying established concepts from
[SOURCE, YEAR].

## Review the target content

Read: [FILE LIST]

Apply the framework's specific evaluative criteria to the content.
For each finding, cite which concept from the framework it applies and
where in the source material the concept comes from.

## Output format

## [Framework Name] lens
### Grounding (Tier [N])
- [Concept 1]: [source reference] — [how it applies to this content]
- [Concept 2]: [source reference] — [how it applies]
- [Concept 3]: [source reference] — [how it applies]
### Findings
[The review, using the framework's vocabulary. Never say "[Author] says"
or "[Author] would argue." Say "the [framework] identifies" or "applying
[concept name] from [source], this content...".]
### Top 3 changes
1. [Most impactful — with file reference]
2. [Second]
3. [Third]
```

**All lens subagents run in parallel.** Do not wait for one before dispatching the next.

**If a Tier 2 subagent cannot find relevant published work:** The subagent must say so honestly and fall back to Tier 3. "Web search did not surface [Author]'s published position on [topic]. Applying established [framework] concepts from [known source]." This is better than fabricating citations.

**Exit:** All subagent reviews collected.

---

## Phase 2: Synthesize

**Entry:** N lens reviews collected from parallel subagents.

This is where the panel produces value that no single review can.

### Step 1: Extract findings

From each lens review, extract every distinct finding. Tag each with:
- Which framework produced it
- Grounding tier (1, 2, or 3) — findings from Tier 1 carry more weight
- Severity: **critical** (blocks quality), **important** (strengthens quality), **observation** (worth noting)
- Which specific file or section it targets

### Step 2: Identify convergence

Group findings by theme. For each theme, count how many independent frameworks flagged it.

- **Strong signal (3+ frameworks):** Multiple independent analytical lenses arrived at the same conclusion through different reasoning paths. Lead the report with these. Note if any are Tier 1 grounded (highest confidence).
- **Moderate signal (2 frameworks):** Worth mentioning but not consensus. Note which two converged and why.
- **Single-framework signal (1 framework):** Include only if severity is critical. Otherwise, per-lens appendix only.

### Step 3: Identify productive disagreements

Where two frameworks directly contradict each other, **name the tension** instead of picking a winner.

Example: "The learning-design framework recommends expanding the demo to 35 minutes for deeper cognitive scaffolding (source: Newport, Deep Work, ch. 2 on attention residue). The practitioner-reality framework would cut it to keep the day realistic (source: Orosz, Pragmatic Engineer newsletter on workshop realism). The tension is depth vs. pace — the facilitator's room read should decide."

Note: the example above cites sources and frameworks, not personas. This is correct.

### Step 4: Prioritize actions

Produce a ranked action list ordered by:
1. Grounding tier (Tier 1 findings > Tier 2 > Tier 3, when convergence is equal)
2. Convergence strength (more frameworks = higher priority)
3. Severity (critical > important > observation)
4. Effort (quick wins before heavy lifts, when the above are equal)

Each action should name: what to change, which file(s), why (citing which frameworks and their specific reasoning), and estimated effort.

**Exit:** Synthesis complete.

---

## Phase 3: Present

**Entry:** Synthesis complete.

### Output format

```markdown
# Framework Panel Review: [target description]

## Panel composition
| Framework | Grounding | Focus |
|---|---|---|
| [Name] | Tier [N]: [source description] | [one-line focus] |

## Honesty note
This review applies named analytical frameworks to the target content.
It does not represent the personal opinions of any named author. Findings
are traceable to specific published concepts cited in each lens's grounding
section. [Tier 1 lenses] were grounded in user-provided reference material.
[Tier 2 lenses] were grounded in web-sourced publications. [Tier 3 lenses]
applied established concepts from training data.

## Headline finding
[One paragraph: the single most important thing the panel found,
supported by the convergence count and grounding tier]

## Where the panel converged (strong signal)
[Findings with 3+ framework convergence. Each finding gets:]
- **Finding**: [what]
- **Frameworks**: [which lenses converged]
- **Grounding**: [Tier N — source references]
- **Why it matters**: [impact if unaddressed]
- **Recommended action**: [specific, with file references]

## Where the panel converged (moderate signal)
[2-framework convergence findings, same format but briefer]

## Productive disagreements
[Named tensions between frameworks, with both positions and their
sources stated fairly. The user decides — the panel does not.]

## Prioritized action list
1. [Action] — [files] — [effort] — [frameworks + tiers]
2. ...

## What not to change
[Things multiple frameworks explicitly defended. Prevents the user
from "fixing" things that are already right.]

## Per-lens appendix
[The full review from each lens, with grounding tier and source
citations, for the user who wants the raw framework perspectives.]
```

Save to `docs/reviews/YYYY-MM-DD-expert-panel-<topic>.md` if `docs/reviews/` exists, otherwise present inline.

**Exit:** Report delivered.

---

## Phase 4: Handoff

Use **AskUserQuestion** with:
- question: "Framework panel review complete. What next?"
- header: "Next step"
- options:
  1. label: "Create a plan", description: "Turn the prioritized actions into a /deep-thought:plan"
  2. label: "Discuss a finding", description: "Push back or explore a specific finding deeper"
  3. label: "Run again with different frameworks", description: "Swap lenses and re-run"
  4. label: "Improve grounding", description: "Provide reference material for Tier 2/3 lenses and re-run at Tier 1"
  5. label: "Done", description: "Review complete"

---

## The Framework Library

Each lens defines: the analytical framework it applies, the published sources it draws from, the evaluative criteria it uses, the vocabulary that makes its findings distinct, and what it looks for that other lenses do not.

The lens names are the FRAMEWORK names. The authors are SOURCES, not personas.

---

### `learning-design` — Learning Science & Cognitive Load

**Framework:** How people actually learn — attention management, cognitive load theory, progressive disclosure, transfer vs. retention, and practice installation.

**Key sources:**
- Cal Newport — *Deep Work* (2016), *Slow Productivity* (2024). Specifically: attention residue, depth vs. breadth, ritualized focus, cognitive constraint.
- Andrew Ng — AI education methodology, Coursera/DeepLearning.AI teaching patterns. Specifically: one idea per lesson, concrete before abstract, "the fastest way to learn is to build."
- Learning science — spacing effect, retrieval practice, desirable difficulty, Bloom's revised taxonomy.

**Evaluative criteria:**
- Does the day structure respect attention limits and avoid context-switching?
- Are concepts introduced concrete-first (example → principle) or abstract-first (principle → example)?
- Is there a single transferable mental model, or a pile of disconnected tips?
- Does the curriculum install a durable practice or just transmit perishable information?
- Is pseudo-productivity avoided? (Feeling of work vs. evidence of learning.)
- Are there natural deep-work blocks, or is the schedule fragmented?

**Vocabulary:** attention residue, metacognitive scaffolding, progressive disclosure, desirable difficulty, retrieval practice, transfer, concept before implementation.

---

### `evolutionary-design` — Design Quality & Refactoring Craft

**Framework:** Evolutionary software design — making change safe, growing systems incrementally, using tests as specification, and recognizing design smells as signals.

**Key sources:**
- Martin Fowler — *Refactoring* 2nd ed. (2018), bliki entries on evolutionary design, code smells catalog, reversible decisions, strangler fig pattern, continuous delivery.
- The software craft tradition — Kent Beck's *XP Explained*, Robert Martin's clean code principles (as frameworks, not as authority claims).

**Evaluative criteria:**
- Are claims about testing, refactoring, and verification technically precise or hand-wavy?
- Does the content teach design vocabulary that working engineers recognize (smells, duplication of knowledge, rule of three)?
- Is verification framed as executable specification (honest) or as TDD dogma (polarizing)?
- Does the content address the design quality implications of AI-generated code?
- Are "best practices" grounded in real craft tradition or invented terminology?

**Vocabulary:** evolutionary design, reversible decisions, refactoring toward, code smell, duplication of knowledge, rule of three, strangler fig, YAGNI, making change safe.

---

### `practitioner-reality` — Monday Morning Survivability

**Framework:** Engineering-team-level reality check — the gap between conference advice and what actually works when you're shipping with a real team under real constraints.

**Key sources:**
- Gergely Orosz — *The Pragmatic Engineer* newsletter. Specifically: how senior engineers actually use AI tools, hype vs. evidence, AI-native engineers, adoption barriers, team dynamics under AI-assisted development.
- The tradition of practitioner skepticism: "does this survive contact with the enemy?"

**Evaluative criteria:**
- Does this advice survive a real Monday morning with velocity pressure and async code review?
- Is the concept a real discipline or a branded repackaging of things engineers already know?
- Are time estimates and scope realistic for the claimed audience?
- Is the marketing language honest? Would a senior engineer roll their eyes?
- Does the content reflect iterative, messy real usage vs. clean demo-mode usage?

**Vocabulary:** shipping reality, evidence-based, hype detection, adoption barriers, velocity pressure, "what actually works."

---

### `agent-engineering` — Agent Reliability & Eval Methodology

**Framework:** How frontier labs and serious practitioners think about AI agent scaffolding — harness design, eval-driven development, approval loops, context management, and honest capability claims.

**Key sources:**
- Anthropic — engineering blog on agent tool use, context management, Claude computer use evaluation methodology.
- OpenAI — harness engineering guidance, Codex approval modes, agent sandboxing documentation.
- Academic research — agent drift in long-horizon tasks, hallucination in agentic settings, eval methodology.

**Evaluative criteria:**
- Is "harness" used with technical precision (scaffolding that bounds and extends capability) or as a vague brand term?
- Does the content honestly represent where current agents fail (long-horizon drift, overconfident edits, invisible assumptions)?
- Are verification and evals treated as first-order infrastructure?
- Are cost, latency, and context-window constraints addressed as real engineering tradeoffs?
- Are approval loops and sandboxing discussed with tool-specific accuracy?

**Vocabulary:** harness, scaffolding, eval harness, approval loop, sandboxing, long-horizon drift, context budget, effective capability, verification boundary.

---

### `tool-craft` — Concrete Examples & Tool Affordances

**Framework:** Practitioner-grade tool guidance — show the thing running, name the affordances, demonstrate failure, install a learning practice that outlasts any specific tool version.

**Key sources:**
- Simon Willison — simonwillison.net blog on Codex, Claude Code, LLM CLI, and practical AI tool usage. Specifically: prompt transparency, concrete reproducible examples, failure documentation, tool-specific affordance mapping.
- The "show, don't tell" tradition in developer advocacy and tool documentation.

**Evaluative criteria:**
- Are there concrete, runnable examples the reader can try immediately?
- Is there a "watch it go wrong" moment that teaches failure recovery (not just happy-path demos)?
- Does the content name tool-specific affordances (why tool X for task Y)?
- Are prompts transparent and reproducible, or hidden behind abstractions?
- Does the content acknowledge ecosystem velocity and install a reading/learning practice that survives version churn?

**Vocabulary:** concrete examples, "show me it running," tool affordances, prompt transparency, failure cases, before/after pairs, learning practice, ecosystem velocity.

---

### `behavioral-change` — Habit Installation & Operating Model

**Framework:** How organizations and teams actually change behavior — operating system design, autonomy with constraints, the difference between workshops that install habits and ones that entertain.

**Key sources:**
- Aaron Dignan — *Brave New Work* (2019), The Ready methodology. Specifically: operating models, "loose rules tight feedback," self-organization with clear constraints, distributed authority.
- Behavior design — BJ Fogg's Tiny Habits model (trigger, routine, reward), James Clear's atomic habits framework (environment design > motivation).

**Evaluative criteria:**
- Does the workshop install a durable behavior change or just entertain for a day?
- Is there genuine self-organization with clear constraints, or hierarchy theatre?
- Does the facilitation design a container for discovery (good) or a script to follow (fragile)?
- What operating-model change could a participant take back to their team on Monday?
- Is frustration treated as useful signal or as failure to manage?

**Vocabulary:** operating model, behavioral installation, loose rules / tight feedback, self-organization, container design, distributed authority, constraint-based autonomy, environment design.

---

### `systems-dynamics` — Feedback Loops & Leverage Points

**Framework:** Systems thinking applied to software delivery — stocks and flows, feedback loops, leverage points, and the conditions for continual learning.

**Key sources:**
- Donella Meadows — *Thinking in Systems* (2008). Specifically: 12 leverage points, stocks and flows, reinforcing and balancing loops, system delays.
- Gene Kim et al. — *Accelerate* (2018), *The Phoenix Project*. Specifically: DORA metrics, the three ways (flow, feedback, continual learning), batch size reduction.

**Evaluative criteria:**
- Are there feedback loops that let the system learn from its own output?
- Where are the leverage points — small changes that shift behavior disproportionately?
- Is the design optimized for flow (small batches, fast feedback) or big-bang delivery?
- Are bottlenecks identified and addressed, or silently worked around?
- Does the architecture support continual learning or freeze knowledge at v1?

**Vocabulary:** feedback loop, leverage point, stock and flow, delay, reinforcing loop, balancing loop, three ways, DORA metrics, batch size.

---

### `narrative-craft` — Story Arc & Technical Communication

**Framework:** How to communicate technical ideas so they land — narrative structure, audience contract, "show don't tell," and the difference between information transfer and understanding transfer.

**Key sources:**
- Nancy Duarte — *Resonate* (2010). Specifically: the "what is" / "what could be" contrast structure, audience journey, call to action.
- Technical writing craft — developer advocacy best practices, the Diátaxis documentation framework (tutorial / how-to / reference / explanation).
- "Show, don't tell" as applied to engineering education.

**Evaluative criteria:**
- Is there a narrative arc or just a sequence of topics?
- Does the content show before it tells (concrete example → principle, not the reverse)?
- Is the opening a hook (creates a question) or a preamble (delays the point)?
- Are analogies concrete and appropriate for the audience, or abstract and decorative?
- Does the close drive action (what to do Monday) or just summarize (what we covered)?

**Vocabulary:** narrative arc, hook, "what is" / "what could be," show don't tell, audience contract, call to action, concrete analogy.

---

## Validate

Before delivering the report:

- [ ] **No persona claims.** The report never says "[Author] says," "[Author] would argue," or "[Author] thinks." It says "the [framework] lens identified" or "applying [concept] from [source]."
- [ ] **Grounding tier stated per lens.** The reader knows which lenses had Tier 1, 2, or 3 grounding.
- [ ] **Every finding cites a specific named concept from a traceable source.** Generic advice ("test your code") without framework grounding is not a finding — it's filler.
- [ ] **Web research was performed for Tier 2 lenses.** If a search found nothing, that's stated explicitly and the lens fell back to Tier 3 with disclosure.
- [ ] **Convergent findings identify which frameworks converged and through what reasoning.**
- [ ] **Productive disagreements name both sides and their sources fairly without picking a winner.**
- [ ] **The prioritized action list has file references and effort estimates.**
- [ ] **"What not to change" is present** — prevents the user from breaking what works.
- [ ] **No files were modified** — findings only.

## When NOT to Use /expert-panel

- **Code review.** Use `/deep-thought:review` instead.
- **Quick feedback on a single doc.** Use `/deep-thought:review`.
- **Editing.** The panel reviews; it does not fix. Use findings to drive `/deep-thought:plan` → `/marvin:work`.
- **Fewer than 3 lenses.** Convergent synthesis needs 3+. Use `/deep-thought:review` for single-lens evaluation.
- **When you need the actual person's opinion.** This skill applies frameworks; it does not simulate people. If you need Cal Newport's opinion, email Cal Newport.

## What Makes This Heart of Gold

- **Critical Trust (2.1):** Framework-grounded, not persona theatre. Every attribution is traceable and falsifiable. Grounding tier is disclosed per lens.
- **Strategic AI Dialogue (2.4):** Parallel dispatch + convergent synthesis is a pattern no single review can replicate. N independent analytical passes in the time of one.
- **Prompt Mastery (2.2):** The lens definitions ARE the prompt engineering. Each lens encodes what to research, what vocabulary to use, what evaluative criteria to apply, and what makes its findings distinct from other lenses.
- **Honesty over impressiveness.** The skill explicitly names what it cannot do (represent a person's actual opinion) and what it can (apply their published frameworks carefully). The grounding-tier system makes the confidence level visible, not hidden.

## Knowledge References

- `../knowledge/critical-evaluation.md` — Evidence-based evaluation, uncertainty flagging
- `../knowledge/socratic-patterns.md` — CoVe technique for verifying findings
- `../knowledge/decision-frameworks.md` — Tradeoff evaluation for the prioritized action list
