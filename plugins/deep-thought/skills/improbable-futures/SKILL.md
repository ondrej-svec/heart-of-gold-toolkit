---
name: improbable-futures
description: >
  Strategy-forward product cartography. Articulates the goal, grounds the analysis in domain
  research, commits to a strategic thesis, then maps three mutually-exclusive futures that
  execute it — each with a user's love-letter, required capability, what it excludes, and a
  next move you can hand to your agent. Auto-invokes /babel-fish:visualize for the visual map.
  Use when exploring "where could this go," forcing a strategic commitment, or stress-testing
  a product idea for lovability. Triggers: improbable futures, product futures, where could
  this go, map my project, lovable product, cartographer, product atlas, product strategy.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
  - Agent
  - AskUserQuestion
  - WebSearch
  - WebFetch
---

# Improbable Futures

Most product advice asks "is this good?" This skill asks better questions: **"what is the goal? what strategy serves it? where could that strategy take you, and what does each path cost?"**

You are a cartographer and a strategist. Read the project as it actually is. Name the goal — explicitly. Ground the analysis in real domain research, not vibes. Commit to a single strategic thesis. Then sketch three futures that execute that thesis differently — each genuinely improbable, each mutually exclusive with the other two. Pin a love-letter from a named user six months ahead to each future. Surface wild cards. Hand the builder a map AND a next move they can give to their agent.

Think of it as the Improbability Drive for product strategy: not three options that look similar, but three commitments that look mutually unreachable until you land in one of them.

## Boundaries

**This skill MAY:** read project files, scan repos, ask the user for goal and pitch when context is thin, run targeted web research for domain best-practices and strategic-move patterns, generate a strategy + map markdown, auto-invoke `/babel-fish:visualize` on the output.
**This skill MAY NOT:** edit code, run builds, write implementation plans, produce verdicts or scorecards, generate pitch-deck copy, do TAM/SAM/SOM market sizing, name real clients, attribute opinions to specific named people.

**This is a strategy AND a map, not a plan. Commit to a thesis — do not implement it. Hand the next move to the user's agent — do not execute it.**

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Skip research — generate the futures from the project signal alone" | Without grounded reference to what works in this category, you produce vibe-strategy. Three futures that read smart but match no real strategic move pattern. | Smoothie output that the builder closes without aching |
| "Skip the goal — work from what the project clearly is" | Projects rarely make the goal explicit. If you guess wrong, every future executes the wrong strategy. The map is geometrically correct and pointed at nothing. | Builder reads three "interesting" futures and feels none of them. The goal mismatch is silent until the futures land flat |
| "Three plausible futures is enough" | Plausible is the enemy. The brief asks for IMPROBABLE futures that are mutually exclusive — not three reasonable variations the founder could pursue in parallel. | "Pick one and lose the others" turns into "pick whichever, do all three eventually" — no commitment, no map |
| "Love-letters can sound similar across futures — same author, same project" | If all three letters read like the same person wrote them, you've written articles, not letters. Real letters have distinct voices, distinct ticks, distinct silences. | Reader skims the letters as decoration. The ache that should drive choice never lands |

---

## Phase 0: Detect Input Shape

**Entry:** User invoked `/deep-thought:improbable-futures` with a path, a pitch, or nothing.

**Case A — path to a repo or directory:** Note the path. Proceed to Phase 1.

**Case B — inline pitch:** Note the pitch. Ask: "Is there a repo or docs I should read too, or should I work from this pitch alone?" If a path is offered, add it. Proceed.

**Case C — nothing, or near-empty repo:** Use **AskUserQuestion** once. Header: "Improbable Futures". Question: "Give me one paragraph: what is this project, who is it for, and what's the nearest win you're imagining?" Conversational, not a form.

**Exit:** You have a path, a pitch, or both.

---

## Phase 1: Read Current State

**Entry:** Phase 0 complete.

Read the signal-dense surface only:

- `README.md`, `README` (root)
- `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`
- Top-level `docs/` — especially `brainstorms/`, `plans/`, dated last 90 days
- One representative source file per major surface
- `CLAUDE.md`, `AGENTS.md` at the root

**Anti-pattern:** opening a tenth file. Stop — you have enough.

Synthesize internally (not yet output): what the project actually is (the thing, not the pitch), who it's for, what it's orbiting (the unstated gravity well).

**Exit:** You could describe the project in two to three honest sentences — its shape, not its copy.

---

## Phase 2: Articulate the Goal

**Entry:** You understand the project's shape.

**Why this phase exists:** Most builders haven't named their goal explicitly. They have a project. They know what they're working on. They haven't said out loud what success looks like, on what time horizon, in what shape. Without a named goal, the futures aim at nothing.

**Step 1 — try to extract the goal from signal.** Read recent brainstorms, READMEs, plans, and any `goals.md` / `roadmap.md` style files. Look for explicit statements of intent. Synthesize one sentence: "The goal of this project, as far as the signal shows, is [X by Y]."

**Step 2 — confirm or correct via AskUserQuestion.**
- header: "Goal"
- question: "I read your goal as: '[X]'. Adjust?"
- options: `Yes, that's it`, `Close — let me edit`, `No — let me restate`, `I haven't articulated a goal yet`

**Step 3 — handle "no goal yet."** If the user picks the last option, ask one focused question: "What does success look like for this project six to twelve months from now? One sentence. If you don't know yet, say so — we'll work from a placeholder and the futures will surface what the goal should be." Use the answer (or "no goal yet" placeholder) as the goal of record.

**Why goal precedes strategy:** A future is a way to execute a strategy. A strategy is a way to pursue a goal. If the goal is unclear, every future is shooting at fog. If the user doesn't have a goal yet, the futures themselves can become a goal-articulation tool — but only if you name that explicitly in the output.

**Exit:** A single-sentence goal of record. Could be a placeholder. Either way, you can quote it.

---

## Phase 3: Stage Detection

**Entry:** Goal of record exists.

Guess the stage from signals:

| Stage | Signals |
|---|---|
| **Idea** | Pitch only, empty repo, no deployed surface |
| **Mid-build** | Active commits, partial features, plans present, no public launch signal |
| **Pre-launch** | Feature-complete signals, landing/waitlist language, launch references |
| **Live** | Users referenced, usage metrics, post-launch docs, support files |

Confirm with **AskUserQuestion** (header: "Stage"; question: "I read this as [stage]. Adjust?"; options: Idea / Mid-build / Pre-launch / Live / Mix).

Stage shapes the weight of each section in Phase 5 — do not add new sections. Idea-stage futures are wider; live-stage futures must reckon with what already exists.

**Exit:** Stage agreed.

---

## Phase 4: Research Grounding

**Entry:** Goal and stage agreed.

The futures must be grounded in what actually works in this category — not generated from vibes. Use the tier system below to pick the highest available source of grounding.

### Grounding tiers

**Tier 1 — User-provided references (highest fidelity).** If the project root contains a `references/futures/` directory or the user passed `--references <path>`, read those files first. Treat them as authoritative for the domain.

**Tier 2 — Targeted web research (default).** Use **WebSearch** + **WebFetch** to pull 3–5 sources on:
- Strategic-move patterns for projects in this category (e.g., "open-source workshop businesses how they scale," "developer tools community to commercial product")
- Recent (≤24 months) writing from category practitioners — not generic advice, but specific case studies, post-mortems, founder essays
- Best-practice frameworks the user's domain references (e.g., for a workshop business: pricing models, productisation patterns, embedded-residency models)

Cite each source you use in the output's `Research Sources` section. If a source contradicts a future, surface the contradiction in that future's "What you'd have to believe" section.

**Tier 3 — Training-data only (fallback).** If web access is unavailable or the user passes `--no-research`, state explicitly in the output: "Grounding tier: training-data only. Specific concepts applied: [list named frameworks or patterns]."

### What to research, concretely

Generate 3–5 search queries, then dispatch a parallel research subagent. Sample brief:

> Research strategic-move patterns and case studies for [category]. Focus on:
> - Real founder-written accounts (not advice columns)
> - Post-mortems and pivots — what worked, what failed
> - Specific products in this category that took unusual or improbable paths
> - The 2–3 most-cited frameworks in this category (and their critics)
> Return: 5–8 specific patterns or moves, each with one citation.

**Anti-pattern:** generic "product strategy" advice from generalist business sites. Reject if the source isn't category-specific or doesn't cite a real product.

**Exit:** A short internal brief: 5–8 grounded patterns, each citable. The futures in Phase 5 will be tested against these.

---

## Phase 5: Generate the Strategy Thesis and Map

**Entry:** Phases 0–4 complete.

This phase produces seven internal drafts. Do not write the file yet — Phase 6 reviews them first.

### 5a. You are here — the diagnostic

Two to four sentences. Quiet observation of the gravity well the project is already orbiting. No verdict. Specific. End with the tension the project is currently living inside (e.g., "right now you're trying to be both, which is the most expensive way to be either").

### 5b. Strategy thesis — a single committed direction

One paragraph, 3–5 sentences. Format:

> Given the goal — **[quoted goal]** — your strategic thesis is **[single, committed direction grounded in research]**. The three futures below are not three different goals; they are three mutually-exclusive ways to execute this one thesis. Pick one and the others become unreachable.

This is the load-bearing part. The thesis must:
- Reference the goal verbatim
- Commit to a single direction (not "explore options")
- Be grounded in at least one Phase 4 research finding (cite inline)
- Make the mutual-exclusivity of the futures intelligible — three executions of one thesis, not three different theses

### 5c. Three mutually-exclusive futures

Exactly three. Each a different execution of the thesis. For each, produce:

1. **One-line bet** — specific, committal. Not a category ("a SaaS version"); a thing ("a small daemon installed in your repo that exposes three skills").
2. **Stance paragraph** — 3–5 sentences explaining what this future actually is, what the builder becomes if they pick it, and what they stop being.
3. **Required capability** — one sentence. The single thing that must exist for the love-letter to be possible.
4. **This excludes** — one sentence. What picking this future kills. Naming the kill is what makes it mutually exclusive.

**Improbability test (apply to every future before keeping it):**
- Would a smart founder in this category have considered this option? If yes — push harder. The future is too obvious.
- Is this a textbook scaling move (named-discipline play, productised-self-serve play, geographic-specialisation play)? If yes — regenerate.
- Does this future, if pursued, kill the other two? If no — they're not mutually exclusive; they're parallel options. Regenerate.

### 5d. Love-letters — one per future, distinct voices, with ache

Each letter: 4–7 sentences from a named user, six months after they live in this future. Attribution line at the end.

**Voice rules:**
- Each letter must read like a different person wrote it. Different sentence rhythm, different vocabulary, different tics.
- After drafting, re-read the three letters back-to-back. If two of them could trade signatures and nobody would notice, regenerate at least one.

**Ache rules — every letter must contain at least two of these:**
- A contradiction or longing (something they miss or didn't get, even though they love this)
- A specific physical detail (time of day, what they were holding, the silence in the room)
- An unresolved question or concern they tell only the recipient
- A mild request (don't water this down, please don't change X, tell people in [place])
- A sentence that wouldn't make sense in a testimonial reel

**Anti-test:** Could this letter appear unmodified on a SaaS landing page as a customer quote? If yes — it's marketing copy. Regenerate.

### 5e. Wild cards

Three to five one-line branches. Genuinely improbable — not variations on the three futures.

**Test:** would a "wild" card slot into one of the three futures as a feature? If yes, it's not wild. Regenerate.

Each wild card should be a left turn the project could (improbably) take. Tactile, weird, anti-software, anti-scale, accidentally institutional — these are good directions. Variation of "another revenue stream" — bad direction.

### 5f. Paths and required beliefs (per future)

For each future:

**Paths — first 2–3 moves.** Directions, not milestones. If you're writing "Sprint 1" or "Milestone 1", stop — that's `/plan`'s job.

**What you'd have to believe — 2–4 assumptions.** Concrete bets, not vague "market exists" statements. Each belief is a place where you and a smart competitor could disagree and only time would tell who's right.

### 5g. Agent-actionable next moves

For each future, draft a single command the user can hand to their coding agent verbatim. Format:

```
/deep-thought:plan "[future-specific brief in one sentence]"
```

or, when more brainstorming is needed:

```
/deep-thought:brainstorm "[narrow exploration question]"
```

These commands appear in two places in the output:
- In the YAML frontmatter as a structured `next_moves:` block (machine-readable)
- In a "Hand this to your agent" section at the bottom of the output (human-readable)

### 5h. Structured data for the visual (mandatory)

The output markdown must carry structured data blocks in frontmatter that `/babel-fish:visualize` reads to build real components — not stylised prose. Without these blocks, the downstream visualizer falls back to "prose with one decorative SVG."

Produce four (sometimes five) frontmatter blocks:

- **`comparison_dimensions`** — 4–6 tradeoff-revealing dimensions × 3 futures. The single most important visual.
- **`timeline_waypoints`** — 3–4 specific moves per future, dated.
- **`research_timing`** — category events plus "YOU ARE HERE" and "WINDOW CLOSES" markers (both mandatory).
- **`naming_landscape`** — competing vocabularies positioned (include when the category is mid-naming-fight).
- **`visual_brief`** — directive header listing required components.

**See `../knowledge/strategy-dashboard-spec.md`** for the exact YAML shape of each block, tradeoff-vs-feature examples, and the reasoning behind each field. That knowledge file is the authoritative spec; the skill must produce frontmatter that matches it.

**Exit:** Seven internal drafts ready plus the structured visual blocks above. Nothing written yet.

---

## Phase 6: Self-Review Against Rejection Criteria

**Entry:** Phase 5 drafts complete.

Walk this checklist honestly. Look for reasons the map is wrong, not reasons to ship it.

**Rejection checklist (the output is wrong if any item is true):**

Strategic content:
- [ ] The strategy thesis does not quote the goal of record verbatim
- [ ] The thesis does not cite at least one research finding
- [ ] Any future could be pursued in parallel with another — they are not mutually exclusive
- [ ] Any future is a textbook category-conventional move (named-discipline / productised-self-serve / geographic-specialisation / "go enterprise")
- [ ] The "This excludes" line for any future is vague or polite — it should name what you kill
- [ ] Any love-letter could appear unmodified on a SaaS landing page as a customer quote
- [ ] Two or more love-letters could trade signatures and nobody would notice
- [ ] Any love-letter has zero of the ache markers (contradiction, physical detail, unresolved question, request, non-testimonial sentence)
- [ ] Any wild card could slot into one of the three futures as a feature — it isn't wild
- [ ] "You are here" praises or criticises instead of observing
- [ ] Any "Path" reads as an implementation plan (Sprint 1, Milestone, etc.)
- [ ] Any "What you'd have to believe" item is vague ("market exists") instead of a concrete bet
- [ ] Drafts collectively exceed three futures, five wild cards, or seven sections
- [ ] Pitch-deck vocabulary is present (TAM, SAM, SOM, value prop, positioning, ICP)
- [ ] Any agent-actionable command is generic — it must be future-specific and verbatim-runnable
- [ ] A contributor or client name appears anywhere

Structured visual data (Phase 5h):
- [ ] `comparison_dimensions` block has fewer than 4 dimensions, or any dimension is descriptive rather than tradeoff-revealing ("Has feature X" — wrong; "Identity you become" — right)
- [ ] `timeline_waypoints` has fewer than 3 waypoints per future, or any waypoint reads as a milestone rather than a specific move
- [ ] `research_timing` is missing the "YOU ARE HERE" pin or the "WINDOW CLOSES" marker — the urgency must be visible
- [ ] Any structured block is in the prose body rather than the frontmatter — visualizers cannot scan prose for structure

If any box is ticked, revise the affected draft. If the same box keeps getting ticked on rewrites, the signal for that part is too thin — ask one more clarifying question or drop the offending future and regenerate from the thesis.

**Exit:** Every box unticked.

---

## Phase 7: Write the Output

**Entry:** Drafts have passed self-review.

**Output path:** `docs/futures/YYYY-MM-DD-{kebab-project}-improbable-futures.md`

Write this skeleton exactly — heading depths are what `/babel-fish:visualize` reads as hierarchy.

```markdown
---
title: "Improbable Futures: {project}"
type: improbable-futures
date: YYYY-MM-DD
stage: {idea | mid-build | pre-launch | live}
goal: "{goal of record, verbatim}"
grounding_tier: {1 | 2 | 3}
research_sources:
  - "{url or citation 1}"
  - "{url or citation 2}"
next_moves:
  future_1:
    direction: "{one-line summary}"
    suggested_command: "/deep-thought:plan ..."
  future_2: { direction: "...", suggested_command: "..." }
  future_3: { direction: "...", suggested_command: "..." }
comparison_dimensions:
  - { name: "Identity",        future_1: "...", future_2: "...", future_3: "..." }
  - { name: "Revenue model",   future_1: "...", future_2: "...", future_3: "..." }
  - { name: "What you leave",  future_1: "...", future_2: "...", future_3: "..." }
  - { name: "What it costs",   future_1: "...", future_2: "...", future_3: "..." }
  # 4–6 dimensions, each tradeoff-revealing
timeline_waypoints:
  future_1:
    - { when: "Week 2",  move: "..." }
    - { when: "Week 8",  move: "..." }
    - { when: "Month 3", move: "..." }
    - { when: "Month 6", move: "...'s letter arrives" }
  future_2: [ ... ]
  future_3: [ ... ]
research_timing:
  - { date: "YYYY-MM", source: "...", event: "..." }
  - { date: "YYYY-MM-DD", source: "YOU ARE HERE", event: "This map" }
  - { date: "YYYY-MM", source: "WINDOW CLOSES", event: "..." }
naming_landscape:
  - { term: "...", backers: ["..."], scope: "..." }
visual_brief:
  artifact_family: "strategy-dashboard"
  primary_components:
    - "comparison_matrix"     # from comparison_dimensions — top of page
    - "journey_timelines"     # from timeline_waypoints — three side-by-side
    - "urgency_timeline"      # from research_timing — single horizontal axis
    - "naming_landscape"      # from naming_landscape — when present
  secondary_components:
    - "strategy_thesis_hero"
    - "letter_cards"          # love-letters as letter-styled objects, not blockquotes
    - "agent_command_ctas"    # primary call-to-action per future
---

# Improbable Futures: {project}

## You are here

{2–4 sentences from 5a.}

## Strategy thesis

{Single paragraph from 5b. Quotes the goal. Cites a research finding.}

## Three futures worth chasing

Each future is a way to execute the thesis above. Pick one and the other two stop being available.

### Future 1: {one-line bet}

{Stance paragraph.}

> {Love-letter, 4–7 sentences.}
>
> — {Named user, role, six months in}

**Required capability:** {one sentence}

**This excludes:** {one sentence — what picking this future kills}

**Hand to your agent:** `/deep-thought:plan "..."`

<details>
<summary>First moves and what you'd have to believe</summary>

**First moves**
- {Direction 1}
- {Direction 2}
- {Direction 3}

**What you'd have to believe**
- {Belief 1}
- {Belief 2}

</details>

### Future 2: {one-line bet}

{Same shape as Future 1.}

### Future 3: {one-line bet}

{Same shape as Future 1.}

## Wild cards

- **{Title}** — {one-line description}
- {3–5 wild cards total}

## Hand this to your agent

If you've picked a future — even tentatively — the next move is not another brainstorm. It's a plan.

- **Future 1 ({direction}):** `/deep-thought:plan "..."`
- **Future 2 ({direction}):** `/deep-thought:brainstorm "..."`
- **Future 3 ({direction}):** `/deep-thought:plan "..."`

If you haven't picked one, sit with the love-letters one more time. The one you ached at is the one to chase.

## Research sources

- {Source 1 with citation}
- {Source 2 with citation}
- Grounding tier: {1, 2, or 3}
```

**Exit:** File written.

---

## Phase 8: Auto-Visualize with Explicit Brief, Then Handoff

**Entry:** Output file written.

The visual is a first-class part of this skill, not an option. Do not ask whether to visualize — invoke it. And do not invoke it without a brief — `/babel-fish:visualize` is a generalist; without explicit direction it produces "prose with one decorative SVG" and the strategic argument stays locked in paragraphs.

### Step 1 — invoke visualize with the strategy-dashboard brief

Call the Skill tool with `babel-fish:visualize`. Pass the output path as the primary argument and append the **strategy-dashboard brief from `../knowledge/strategy-dashboard-spec.md`** as additional context (concatenate verbatim to the args string after the path).

Why the brief: the visualizer is a generalist. Without explicit direction it produces "prose with one decorative SVG." The knowledge file tells it exactly which components to build, enforces the UI quality rules (no label collisions, colour consistency, 760px mobile behaviour, danger-colour reserved for risk), and includes a browser-self-verification protocol for agents with Chrome tooling available. Read the knowledge file and pass it along.

Surface three things after the call returns:
- the markdown path: `docs/futures/YYYY-MM-DD-{kebab-project}-improbable-futures.md`
- the published URL from visualize
- verification status — if the executing agent has browser tools, the 1440px / 760px screenshot check per `strategy-dashboard-spec.md`; otherwise an explicit note that verification was skipped

If `/babel-fish:visualize` fails, report plainly, leave the markdown in place, and tell the user how to retry (`/babel-fish:visualize {output-path}` plus the brief from the knowledge file). Do not silently fall back to a menu without the visual.

### Step 2 — post-visual handoff

Present the post-visual menu (prefer the harness's structured choice UI if available):

1. **Review and refine** — Tell me what reads off; I'll rewrite the affected sections and republish
2. **Plan a future** — Pick 1, 2, or 3; I'll suggest `/deep-thought:plan` with the agent-command from the output
3. **Done for now** — Markdown and visual are both saved

If "Review and refine": ask which section, rewrite through Phases 5–6, rewrite the file, re-invoke visualize with the same brief, return here.
If "Plan a future": surface the matching `next_moves[future_N].suggested_command` from the frontmatter.
If "Done": confirm both paths and exit.

**Why the brief, not just the path.** The visualizer is a generalist designer who's never met this skill. Handing it a markdown file alone is like handing a designer a brief that says "make something nice with this content." This skill knows what makes an improbable-futures map land — the visual brief is how that knowledge survives the handoff.

---

## Validate

Before delivering the map, verify:

- [ ] Phase 0–1 detected input shape and synthesized the project in 2–3 honest sentences
- [ ] Phase 2 surfaced a goal of record (or an explicit "no goal yet" placeholder) — confirmed with the user
- [ ] Phase 3 confirmed stage with the user
- [ ] Phase 4 grounding tier is declared in the output frontmatter; sources cited if Tier 2
- [ ] Phase 5b strategy thesis quotes the goal verbatim and cites a research finding
- [ ] Three mutually-exclusive futures — each with bet, stance, capability, "this excludes," love-letter, paths, beliefs, agent-command
- [ ] Each love-letter passes the voice-distinctness test (could the letters trade signatures? — no) and the ache test (≥2 ache markers per letter)
- [ ] Each future has a "This excludes" line that names what is killed by picking this future
- [ ] 3–5 genuinely-wild wild cards, each one line
- [ ] `next_moves:` block in frontmatter has all three futures with verbatim-runnable commands
- [ ] "Hand this to your agent" section appears in the output body
- [ ] Phase 6 rejection checklist was walked — every box unticked
- [ ] Output file exists at `docs/futures/YYYY-MM-DD-{kebab-project}-improbable-futures.md`
- [ ] Frontmatter contains all four structured visual blocks (`comparison_dimensions`, `timeline_waypoints`, `research_timing`, `visual_brief`); `naming_landscape` present when relevant
- [ ] `comparison_dimensions` has 4–6 tradeoff-revealing dimensions (not feature lists)
- [ ] `research_timing` includes the "YOU ARE HERE" pin and "WINDOW CLOSES" marker
- [ ] `/babel-fish:visualize` was auto-invoked **with the explicit strategy-dashboard brief** — not a bare path
- [ ] Published artifact passes the 10-second-scan test: the three futures and their key differences are visible without reading paragraphs
- [ ] Published artifact has at least 4 distinct prose-light visual components above the fold
- [ ] Comparison matrix renders as a scannable grid (not bullet points)
- [ ] Timelines with dense events use vertical layout (no horizontal label collision)
- [ ] Browser self-verification completed (1440px + 760px screenshots) OR explicit note that tooling is unavailable
- [ ] No contributor names, no client names, no pitch-deck vocabulary, no MBA vocabulary

## What Makes This Heart of Gold

- **Problem Reframing (1.4):** Refuses the verdict trap. Asks "what is the goal, what strategy serves it, and what futures execute it?" — not "is this good?"
- **AI-Augmented Discovery (1.3):** Phase 4 grounds the futures in real category research — case studies, founder writing, post-mortems — so the strategy thesis is not vibes.
- **AI Curiosity (1.1):** Three mutually-exclusive futures plus wild cards — structurally biased toward widening the option space before forcing commitment. The "This excludes" line is what turns options into commitment.
- **Opportunity Recognition (1.2):** The named-user love-letter surfaces the smallest unit of "why this should exist" — a specific person on a specific Tuesday — instead of the generic "market opportunity" abstraction.

## Knowledge References

- `../knowledge/strategy-dashboard-spec.md` — **authoritative spec for Phase 5h structured data and the Phase 8 visual brief.** Referenced by both phases; the skill will not produce a coherent dashboard without it.
- `../knowledge/discovery-patterns.md` — AskUserQuestion usage, thin-context handling, goal articulation
- `../knowledge/socratic-patterns.md` — evidence grounding for Phase 6 self-review
- `../knowledge/twelve-techniques.md` — technique checklist this skill applies (few-shot examples, negative prompting, format specification, reflection, RAG via Phase 4 research)
- `../knowledge/strategic-decomposition.md` — strategy-thesis framing (referenced by Phase 5b)
