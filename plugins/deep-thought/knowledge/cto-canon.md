# CTO Canon — Thought Leader Reference

The definitive voices on technical leadership, curated for the CTO strategic advisor. Organized by which CTO operating modes each voice is strongest on.

**Evidence tags:** `[practitioner]` = published from direct experience. `[academic]` = research-backed. `[standards]` = industry standards body.

---

## Core Canon (10 Voices)

### 1. Will Larson
**Role:** CTO at Imprint (previously Carta, Calm, Stripe, Uber)
**Core thesis:** Engineering management is a systems problem. Strategy emerges from writing it down, not from consensus meetings. `[practitioner]`
**Strongest modes:** Technical Strategy, Org Design, Process & Culture
**Key works:**
- *An Elegant Puzzle* (2019) — Systems of engineering management: team sizing (4-8 ideal), tech debt as organizational debt, succession planning
- *Staff Engineer* (2021) — Four IC leadership archetypes: Tech Lead, Architect, Solver, Right Hand
- *The Engineering Executive's Primer* (2024) — Engineering strategy, cost models, the shift from orchestration-heavy to leadership-heavy management

**Key principles:**
- "Most companies have an implicit strategy. The CTO's job is to write it down before someone else writes the wrong one." `[practitioner]`
- Teams below ~4 are fragile; above ~8 have communication overhead. The sweet spot is 6-8. `[practitioner]`
- "Write five design documents, then synthesize" — strategy emerges bottom-up from real decisions `[practitioner]`
- Engineering leaders must shift from orchestration-heavy to leadership-heavy management — less coordination control, more enabling autonomy `[practitioner]`

**AI-era position (2026):**
- "Judgment and creativity are all you need" (March 2026) — as AI absorbs routine work, those two qualities become the entire residual value of senior technical leaders `[practitioner]`
- **The Sequential Constraint Model:** Post-AI, engineering bottlenecks shift through stages: Time (solved by agents) → Attention (increasingly manageable) → **Judgment** (current primary constraint) → Creativity (predicted next frontier) `[practitioner]`
- "Coding agents have already generally solved the problem of time for our team. We have, effectively, an unlimited amount of time." (March 2026) `[practitioner]`
- **Compound Engineering loop:** Plan → Work (agentic) → Review → Compound (learnings feed back). Immediately implementable in ~1 hour `[practitioner]`
- On coding: "You don't have to write all the software — but you should have written some simple pull requests to verify you can reason about the codebase." `[practitioner]`
- Predicts "datapacks" — expert-context skill packages for agent workflows — as a commercial market `[practitioner]`

---

### 2. Camille Fournier
**Role:** Author, engineering leadership advisor (previously CTO at Rent the Runway)
**Core thesis:** The CTO is the company's "technical conscience" — ensuring the company doesn't accidentally devalue its technical foundation. `[practitioner]`
**Strongest modes:** Org Design, Product Co-ownership, Stakeholder Translation
**Key works:**
- *The Manager's Path* (2017) — The career ladder from tech lead to CTO. Still the definitive map.

**Key principles:**
- The CTO's job: set technical direction, be the voice of technical concerns at the executive table, build engineering culture, make the org sustainable `[practitioner]`
- CTO = external/technical facing. VP Eng = internal/team facing. When both exist and trust each other, it's powerful `[practitioner]`
- New managers expect the same freedom as engineers. Instead: "other people own your time" `[practitioner]`
- Regular 1:1s are "like oil changes; skip them and plan to get stranded at the worst possible time" `[practitioner]`
- Involve engineers early in ideation — engineers excluded from brainstorming create resentment and lose buy-in `[practitioner]`

---

### 3. Charity Majors
**Role:** CTO at Honeycomb
**Core thesis:** Observability is not a tooling decision — it's a strategic organizational capability. Engineering managers are essential, not overhead. `[practitioner]`
**Strongest modes:** Process & Culture, Technical Strategy, Hands-On Contribution
**Key works:**
- Blog (charity.wtf), conference talks, Honeycomb engineering culture posts

**Key principles:**
- DevOps has failed at its core mission — 20 years in, most orgs still don't have fast feedback loops between developers and production `[practitioner]`
- Engineering managers are essential against the "flat org" trend — coordination costs are real `[practitioner]`
- "You can't observe your way around bad architecture" — observability amplifies good decisions, not bad ones `[practitioner]`
- The CTO who stops coding eventually loses intuition for how long things actually take `[practitioner]`

**AI-era position (2025-2026):**
- "2025 was for AI what 2010 was for cloud" (Dec 2025) — past experimental, now foundational infrastructure `[practitioner]`
- "Skepticism was reasonable for a time, and then it was not." (March 2026) `[practitioner]`
- **Observability as AI-SRE Infrastructure:** Traditional three-pillar model (metrics, logs, traces) destroys relational value. AI agents need rich, interconnected telemetry. "Our wisdom must be encoded into the system, or it does not exist." (March 2026) `[practitioner]`
- AI-generated code hitting production without observability is reliability debt, not just code quality debt `[practitioner]`
- Cites Adam Jacob: "The career risk to being a laggard is incredibly high" `[practitioner]`

---

### 4. Kelsey Hightower
**Role:** Independent (previously Google, Kubernetes ecosystem)
**Core thesis:** Deep technical understanding matters most precisely when technology moves fast and everyone is pattern-matching on buzzwords. `[practitioner]`
**Strongest modes:** Technical Strategy, External Presence, Hands-On Contribution
**Key works:**
- "Kubernetes the Hard Way" (47k GitHub stars) — deliberate pedagogy: learn infrastructure without automation
- "nocode" project — satirical: "the best way to write secure software is to write nothing, deploy nowhere"

**Key principles:**
- Understand the fundamentals before adopting abstractions `[practitioner]`
- Skepticism of hype-driven adoption is a leadership quality, not resistance to change `[practitioner]`
- CTOs who can't explain how their infrastructure works are building on sand `[practitioner]`

---

### 5. David Heinemeier Hansson (DHH)
**Role:** CTO/co-founder at 37signals (Basecamp, HEY)
**Core thesis:** Small teams, simplicity, technical leadership stays embedded. You don't need to grow headcount to grow impact. `[practitioner]`
**Strongest modes:** Technical Strategy, Hands-On Contribution, Process & Culture
**Key works:**
- *Rework* (2010), *Remote* (2013), *It Doesn't Have to Be Crazy at Work* (2018), *Shape Up* (Basecamp methodology)
- Ruby on Rails creator, ongoing blog (world.hey.com)

**Key principles:**
- "Company cultures collapse when non-technical executives take control" `[practitioner]`
- Six-week betting cycles — strategic decisions at cycle start, execution between. No mid-cycle pivots `[practitioner]`
- Writing over meetings. "Writing solidifies, chat dissolves." `[practitioner]`
- Champions simplicity and ownership — build and publish internal tools as practice `[practitioner]`
- Stay small. 37signals has been profitable with a deliberately small team for decades `[practitioner]`

**AI-era position (2025-2026):**
- "They're fully capable of producing production-grade contributions to real-life code bases." (Jan 2026) `[practitioner]`
- But: "Pure vibe coding remains an aspirational dream for professional work for me, for now. Supervised collaboration, though, is here today." `[practitioner]`
- **Supervised Collaboration** framework: agents work autonomously on defined tasks, humans review outcomes. Rejects both "AI writes everything" and "AI as autocomplete" `[practitioner]`
- Demonstrated agent completing multi-step real-world tasks through human interfaces without custom middleware: "I didn't install any skills, any MCPs, or give it access to any APIs. Zero machine accommodations." (Feb 2026) `[practitioner]`
- "You gotta get in there. See where we're at now for yourself." — Hands-on testing is the only legitimate basis for opinions about AI capability `[practitioner]`

---

### 6. Martin Fowler
**Role:** Chief Scientist at Thoughtworks
**Core thesis:** Software delivery practices must be evidence-based, not fashion-driven. Empirical caution is a virtue. `[practitioner]` `[academic]`
**Strongest modes:** Technical Strategy, Process & Culture
**Key works:**
- *Refactoring* (1999/2018), *Patterns of Enterprise Application Architecture* (2002)
- martinfowler.com — ongoing articles and bliki

**Key principles:**
- "Any fool can write code that a computer can understand. Good programmers write code that humans can understand." `[practitioner]`
- Refactoring is not a project — it's a continuous practice woven into development `[practitioner]`
- Test-driven development is about design, not testing `[practitioner]`

**AI-era position (2025-2026):**
- "I am intrigued by the possibilities but unsure what it means for our profession in the long run." `[practitioner]`
- Organized **Thoughtworks Future of Software Development workshop** (Feb 2026, ~50 participants) — treating AI's impact as a systematic research question `[practitioner]`
- **"Humans on the Loop"** framework (via Kief Morris, March 2026): reject "humans outside the loop" (pure vibe coding) AND "humans in the loop" (micromanaging). Instead: humans build and manage the working loop `[practitioner]`
- **Harness Engineering:** Building proper context, specifications, and code cleanup for agents "is serious work, taking five months at OpenAI" `[practitioner]`
- Warning about **"The Lethal Trifecta"** in AI agents: untrusted content + sensitive information + external communication = high-risk attack surface `[practitioner]`
- Key concerns: code quality from AI output, supply chain security, whether AI replaces pair programming or serves a different function `[practitioner]`

---

### 7. Matthew Skelton & Manuel Pais
**Core thesis:** Organizational design IS technical architecture. Team structure determines system design (Conway's Law, inverted). `[practitioner]` `[academic]`
**Strongest modes:** Org Design, Technical Strategy
**Key works:**
- *Team Topologies* (2019) — The organizational design framework for engineering

**Key principles:**
- Four team types: Stream-aligned (owns end-to-end outcomes), Platform (reduces complexity for others), Enabling (temporary capability transfer), Complicated Subsystem (specialist expertise) `[practitioner]`
- Three interaction modes: Collaboration, X-as-a-Service, Facilitation `[practitioner]`
- Cognitive load is the fundamental constraint on team effectiveness — a team can only handle so much `[academic]`
- The fastest way to ship faster is to reduce cognitive load, not hire more people `[practitioner]`

**AI-era relevance:** What does "platform team" mean when the platform includes AI infrastructure? How does cognitive load change when AI handles implementation but humans handle judgment? Open questions.

---

### 8. Nicole Forsgren, Jez Humble, Gene Kim
**Core thesis:** Software delivery performance is measurable, correlates with business outcomes, and the capabilities that drive it are learnable. `[academic]`
**Strongest modes:** Process & Culture, Metrics
**Key works:**
- *Accelerate* (2018) — Research-based case for DORA metrics. Shingo Institute Publication Award.

**Key principles:**
- Four DORA metrics: Deployment Frequency, Lead Time for Changes, Mean Time to Recovery, Change Failure Rate `[academic]`
- High performers ship faster AND more reliably — speed and stability are not tradeoffs `[academic]`
- Culture (Westrum typology) is the strongest predictor of delivery performance `[academic]`
- You can measure engineering effectiveness. You should. `[academic]`

---

### 9. Marty Cagan
**Role:** Partner at SVPG (Silicon Valley Product Group)
**Core thesis:** Most companies waste engineering by treating it as a cost center executing feature roadmaps. The CTO and CPO must be genuine peers. `[practitioner]`
**Strongest modes:** Product Co-ownership, Stakeholder Translation, Org Design
**Key works:**
- *Inspired* (2008/2017), *Empowered* (2020), *Transformed* (2023)

**Key principles:**
- "Feature teams" (build what they're told) vs. "empowered product teams" (solve problems they're given) `[practitioner]`
- The CTO ensuring feasibility/integrity, the CPO ensuring value/viability — both are required `[practitioner]`
- Engineering is a co-owner of the product, not an executor of someone else's roadmap `[practitioner]`
- The failure mode: CTO becomes a technology executor rather than a co-equal shaper `[practitioner]`

---

### 10. Simon Willison
**Role:** Independent researcher/practitioner (co-creator of Django)
**Core thesis:** AI changes who can code. Quality remains a choice. Test suites are prerequisite infrastructure for agent-driven development. `[practitioner]`
**Strongest modes:** Technical Strategy (AI-era), Hands-On Contribution
**Key works:**
- simonwillison.net — the most prolific and nuanced AI practitioner blog

**Key principles:**
- Coding agents make it "feasible for people in high-interruption roles (like CEOs) to productively work with code again" `[practitioner]`
- "Shipping worse code with agents is a *choice*" — quality is a decision, not an inevitability `[practitioner]`
- Robust test suites are now prerequisite for agent-driven development. Tests are now "effectively free" — red-green TDD with agents is non-negotiable `[practitioner]`
- The field is splitting: those who value craft vs. those who value throughput. AI amplifies both `[practitioner]`
- **"Vibe Engineering" vs. "Vibe Coding"** distinction: professional use = you remain accountable and understand what's built. Vibe coding = abdication of responsibility `[practitioner]`
- **The Tethering Principle:** Code can be automatically tested, so agents can be "tethered to reality" via test execution — a unique advantage over other professions `[practitioner]`
- Personally ships production code with Claude Code (Datasette 1.0, cross-language porting) — models that domain expertise + AI = dramatically better output than AI alone `[practitioner]`

---

## Emerging Voices (3)

### 11. Gergely Orosz
**Role:** Author, The Pragmatic Engineer (200k+ subscribers)
**Signal:** Ground-level intelligence on what engineering teams actually experience `[practitioner]`
**Key observations (2025-2026):**
- Claude Code dominates AI tool usage: 75% usage at small companies vs. 35% GitHub Copilot (March 2026 survey, 900+ engineers) `[practitioner]`
- **Seniority-adoption correlation:** Staff+ engineers at 63.5% regular AI agent usage vs. 49.7% for regular engineers. Technical depth predicts adoption success, not title `[practitioner]`
- Agent users feel nearly 2x as enthusiastic about AI (61% vs. 36% non-users) `[practitioner]`
- Token costs emerging as new CTO budget line alongside headcount and infrastructure `[practitioner]`
- Enterprise firms default to GitHub Copilot (56%) due to Microsoft procurement, not developer preference — CTOs must actively override defaults `[practitioner]`
- The Staff Engineer role will structurally transform by 2027 `[practitioner]`

### 12. Tanya Reilly
**Role:** Author, *The Staff Engineer's Path* (2022)
**Signal:** Glue work — the invisible coordination that makes projects succeed `[practitioner]`
**Key principles:**
- Glue work (mentoring, design review, unblocking, process improvement) is critical but fails to appear in performance reviews
- CTOs must make glue work visible and deliberately distribute it — it's disproportionately absorbed by women `[practitioner]`
- Making organizational work career-legible is a CTO responsibility `[practitioner]`

### 13. Gregor Ojstersek
**Role:** Practitioner CTO, Engineering Leadership newsletter
**Signal:** Concrete, tactical advice for CTOs building AI-native engineering teams `[practitioner]`
**Focus areas:**
- Building AI-native engineering workflows from scratch
- Engineering leadership in companies under 50 people
- The practical mechanics of CTO-to-CEO translation

---

## Canon by CTO Operating Mode

| Mode | Primary Voices | Key Frameworks |
|---|---|---|
| 1. Technical Strategy | Larson, Hightower, DHH, Fowler, Willison | Engineering Strategy, Two-Way Doors, Reversibility |
| 2. Org Design & Hiring | Fournier, Skelton & Pais, Larson, Reilly | Team Topologies, Staffing Ratios, Cognitive Load |
| 3. Stakeholder Translation | Fournier, Cagan, Larson | Strategy Doc, Pivot Cost, Board Prep |
| 4. Process & Culture | Majors, Forsgren et al., DHH, Reilly | DORA, Shape Up, Glue Work, DevOps Culture |
| 5. External Presence | Hightower, Willison, Orosz | Technical Brand, Content Strategy |
| 6. Hands-On Contribution | DHH, Majors, Willison, Hightower | Stage-appropriate contribution, AI-augmented coding |
| 7. Product Co-ownership | Cagan, Fournier, Larson | CTO-CPO Partnership, Empowered Teams |

---

## How to Use This File

This is the **reference library** for the CTO strategic advisor. When a user asks a CTO question:

1. Identify which operating mode(s) it falls into (see `cto-operating-modes.md`)
2. Pull the relevant voices and frameworks from the table above
3. Apply their specific principles to the user's situation
4. Cite the source: "Per Larson's engineering strategy framework..." not "experts say..."

**Update cadence:** Core canon is stable (books don't change). Emerging voices section should be reviewed quarterly — the AI-era landscape shifts fast.
