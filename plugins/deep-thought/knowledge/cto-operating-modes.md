# CTO Operating Modes — The 7-Mode Taxonomy

A CTO doesn't have one job — they have seven simultaneously. This file is the **primary routing document** for the CTO strategic advisor: identify which mode(s) a challenge falls into, then apply the relevant frameworks.

---

## Mode 1: Technical Strategy & Architecture

**What it covers:** Deciding what to build, how to build it, and critically — what NOT to build. Setting technical direction for the company. Managing the portfolio of technical bets.

**Key frameworks:**
- **Engineering Strategy (Larson):** Diagnosis → Guiding policies → Coherent actions. Write it down before someone else writes the wrong one.
- **Two-Way vs. One-Way Doors (Bezos):** Reversible decisions get made fast. Irreversible decisions get careful deliberation. Most decisions are two-way doors treated as one-way.
- **Architecture as Optionality:** Design for change, not for perfection. The best architecture keeps options open.
- **Pivot Cost Estimate:** Before any direction change, quantify: what we abandon, what it cost, what's required next, how it affects timelines.

**Decision tree:**
```
Facing a technical direction decision?
├─ Is it reversible in < 30 days?
│  ├─ Yes → Decide now. Owner calls it.
│  └─ No → Write a 1-page proposal. Get input. Then decide.
├─ Does it change what the company builds (not just how)?
│  ├─ Yes → This is Mode 5 (Strategy & Pivots), not just architecture
│  └─ No → Technical call. CTO decides.
└─ Are you choosing between build, buy, or generate (AI)?
   └─ See cto-ai-era.md: Build/Buy/Generate decision framework
```

**Anti-patterns:**
- **Architecture astronaut:** Designing for scale you don't have. Build for today's load with clean interfaces for tomorrow's.
- **Resume-driven development:** Choosing tech because it's interesting, not because it solves the problem.
- **"We can rebuild this faster":** The most expensive words in AI-era startups. Every rebuild covers the same ground before reaching new ground.
- **Platform before product:** "Let's build a platform on which we can build anything" — you can't. Platforms emerge from products, not the other way around.

**AI-era twist:** AI can now generate code to spec, creating a third option (generate) alongside build and buy. This makes reversibility even more important — if you can regenerate something in days, architecture decisions become cheaper to change. But: AI-generated code without test infrastructure accumulates invisible technical debt.

**Primary voices:** Larson, Hightower, DHH, Fowler, Willison

---

## Mode 2: Organizational Design & Hiring

**What it covers:** Team structure, cognitive load management, hiring decisions, the CTO-VP Eng split question, and making each person maximally effective.

**Key frameworks:**
- **Team Topologies (Skelton & Pais):** Four team types (Stream-aligned, Platform, Enabling, Complicated Subsystem) × Three interaction modes (Collaboration, X-as-a-Service, Facilitation). Design teams around cognitive load, not org charts.
- **Staffing Ratios (Larson):** Teams of 6-8 are optimal. Below 4 is fragile. Above 8 has communication overhead. Manager-to-IC ratio matters.
- **Cognitive Load Management:** A team can only handle so much. The fastest way to ship faster is to reduce cognitive load, not hire more people.
- **Decision Rights Map:** Who decides what. Owner/Support model. Every domain has exactly one Owner.

**Decision tree:**
```
Considering a hire?
├─ Is the bottleneck a skill gap or a capacity gap?
│  ├─ Skill gap → Can AI tools or training close it?
│  │  ├─ Yes → Invest in tools/training first
│  │  └─ No → Hire for the specific skill
│  └─ Capacity gap → Can AI augmentation increase capacity?
│     ├─ Yes → Invest in AI tooling first
│     └─ No → Hire. Define the role precisely.
├─ Is the CTO doing both coding and strategy?
│  ├─ Yes → That's two jobs. Hire to offload one.
│  └─ No → The structure might be fine.
└─ Is the team > 8 people reporting to one manager?
   ├─ Yes → Split into sub-teams before adding people
   └─ No → Structure is likely fine
```

**Anti-patterns:**
- **Hiring to bail water:** Adding people without first fixing the system that's creating the work. New hires inherit chaos, not clarity.
- **Everyone does everything:** Works at 5 people. Breaks at 15. At 15+, fuzzy roles become the primary source of dysfunction.
- **CTO + VP Eng combined too long:** At some point (usually 20-50 engineers), you can't be both the strongest technologist AND the best engineering manager. Split the role.
- **Hiring for titles, not functions:** "Co-CEO" when you mean "COO" and "Head of Product." Titles that don't match function create confusion and accountability gaps.

**AI-era twist:** The hiring bar should rise, not fall. Fewer people with higher judgment, augmented by AI tools. Each person has more leverage, so wrong hires are more costly. The "10x team" (not 10x individual) is now an operational target.

**Primary voices:** Fournier, Skelton & Pais, Larson, Reilly

---

## Mode 3: Stakeholder Translation

**What it covers:** Making technical reality visible to non-technical stakeholders. Board presentations. CEO/co-founder communication. Translating between CTO and CPO. Incident communication.

**Key frameworks:**
- **Pivot Cost Estimate:** Quantify direction changes in weeks, money, and opportunity cost. The document that makes the cost of chaos undeniable.
- **Strategy Doc (Diagnosis/Direction/Cost):** Three sections: what's actually true, what we're building, what changing again costs. One page.
- **Board Prep:** Technical investments translated into business outcomes. Not "we refactored the database" but "we reduced incident response time by 60%, protecting $X in customer contracts."
- **Language Translation Table:** "Technical debt" → "operational drag." "We need to refactor" → "This costs X weeks/quarter in lost velocity." "Legacy system" → "revenue blocker."

**Decision tree:**
```
Need to communicate a technical decision to non-technical stakeholders?
├─ Is it about a direction change / pivot?
│  └─ Use Pivot Cost Estimate: weeks, money, opportunity cost
├─ Is it about investment (hiring, infrastructure, tooling)?
│  └─ Use Board Prep: translate to business outcome + timeline
├─ Is it about pushing back on a request?
│  └─ Frame as: "Here's what that costs" not "That's a bad idea"
└─ Is it about an incident / outage?
   └─ Use Incident Framework: what happened, impact, what we're doing, what changes
```

**Anti-patterns:**
- **"It's too technical to explain":** Everything can be translated. If you can't explain why something matters in business terms, you might not understand why it matters.
- **Leading with the "no":** "That will take 6 months" vs. "Here are three options: Option A takes 2 weeks and covers 80%, Option B takes 6 weeks for 95%, Option C is 6 months for 100%. Which tradeoff do you want?"
- **Technical martyrdom:** Working 80-hour weeks instead of making the resource constraint visible. The business can't solve problems it doesn't know about.
- **The "everyone can code" trap:** When a non-technical leader says "just use AI to build it" — don't argue about AI limitations. Instead: "Here's what goes into making it production-ready: testing, security, deployment, monitoring. The AI handles 30% of that."

**AI-era twist:** Non-technical leaders now have direct experience with AI tools (ChatGPT, Claude). They believe they understand what's possible. The CTO must navigate between genuine AI capability and the "it looks easy" illusion. The key phrase: "Yes, AI can generate that code. Here's what it takes to make it reliable, secure, and maintainable."

**Primary voices:** Fournier, Cagan, Larson

---

## Mode 4: Process & Engineering Culture

**What it covers:** How work gets done. Deployment practices, code review, incident response, on-call, testing culture. The engineering operating system.

**Key frameworks:**
- **DORA Metrics (Forsgren et al.):** Deployment Frequency, Lead Time for Changes, Mean Time to Recovery, Change Failure Rate. The CTO's dashboard for engineering effectiveness.
- **Shape Up (37signals):** Six-week betting cycles. Fixed-time, variable-scope. Strategic decisions at cycle start, execution between. No mid-cycle pivots.
- **Glue Work (Reilly):** The invisible coordination (mentoring, design review, unblocking) that makes projects succeed. Make it visible, distribute it deliberately.
- **DevOps as Culture (Majors):** Not a tooling choice. Fast feedback loops between developers and production. If developers don't see production behavior, DevOps has failed.

**Decision tree:**
```
Engineering process isn't working?
├─ Are deployments slow or scary?
│  └─ Measure DORA metrics. Fix the bottleneck (usually test confidence or deployment automation)
├─ Is work constantly re-prioritized mid-sprint?
│  └─ Implement fixed-length commitment cycles (Shape Up). No mid-cycle changes.
├─ Do some people do all the coordination while others "just code"?
│  └─ Surface glue work. Redistribute. Make it career-legible.
├─ Do bugs surprise you in production?
│  └─ Observability gap. Invest in production feedback loops before features.
└─ Is everyone "busy" but nothing ships?
   └─ Context switching cost. Reduce WIP. Each person works on one thing.
```

**Anti-patterns:**
- **Process theater:** Meetings about process instead of work. Standups that last 45 minutes. Retrospectives with no action items.
- **"We're too small for process":** You're never too small for a deployment pipeline, a testing habit, and a shared understanding of who decides what.
- **Buying tools instead of building culture:** No CI/CD tool fixes a team that doesn't test. No project management tool fixes a team that doesn't commit to decisions.
- **Constant re-prioritization disguised as agility:** Changing direction every week is not agile. It's chaos labeled as agility.

**AI-era twist:** AI tools change the process itself. Code review now includes AI-generated code quality. Deployment pipelines need to handle AI-generated PRs. Testing becomes MORE important, not less — AI can generate code that looks right but has subtle bugs. The process must evolve to include AI as a participant, not just a tool.

**Primary voices:** Majors, Forsgren et al., DHH, Reilly

---

## Mode 5: External Presence

**What it covers:** Writing, speaking, conference appearances, open source contributions, recruiting brand. How the CTO represents the company's technical identity externally.

**Key frameworks:**
- **Technical Brand Audit:** What do candidates see when they research your engineering team? Blog posts? Open source? Conference talks? Nothing? The answer determines your hiring pipeline quality.
- **Content Strategy for CTOs:** Write about real problems you solved, not thought leadership platitudes. Engineers respect specificity and honesty about failures.
- **Open Source Strategy:** Contribute to projects you depend on. Open source tools you've built internally when they're genuinely useful. Don't open source for PR — engineers can tell.

**Decision tree:**
```
Should the CTO invest in external presence?
├─ Is hiring a bottleneck?
│  ├─ Yes → Writing/speaking is the highest-leverage recruiting activity
│  └─ No → Lower priority. Focus on product and team.
├─ Is the company selling to technical buyers?
│  ├─ Yes → CTO credibility directly enables sales
│  └─ No → Less critical, but still builds team pride
└─ Does the CTO enjoy it?
   ├─ Yes → Do it. It compounds over years.
   └─ No → Don't force it. Authentic presence > performative presence.
```

**Anti-patterns:**
- **Conference tourism:** Speaking at conferences without producing substance. Engineers notice when the CTO is "famous" but the codebase is a mess.
- **Performative open source:** Open sourcing code nobody needs to signal engineering culture. Real contributions > theater.
- **Thought leadership without substance:** Blog posts about "the future of engineering" without concrete experience. Write about what you've actually built and learned.

**AI-era twist:** The AI conversation is the most visible topic in tech. CTOs who can speak authentically about how their team uses AI (wins AND failures) have outsized influence. The trap: performing AI adoption for external credibility while the internal reality is messy.

**Primary voices:** Hightower, Willison, Orosz

---

## Mode 6: Hands-On Technical Contribution

**What it covers:** The perennial question: should the CTO code? How to maintain technical credibility. AI agents making CTO coding viable again.

**Key frameworks:**
- **Stage-Appropriate Contribution (Larson):** Prototyping and internal tools: often appropriate. Production features for the main product: rarely, at scale. The question isn't "should you code" — it's "what type of contribution is appropriate at this scale?"
- **AI-Augmented Leadership Coding (Willison):** AI agents make meaningful technical contributions possible in 30-minute windows. High-interruption roles can now engage with code without the overhead of staying current on every dependency.
- **Credibility Maintenance:** CTOs who stop coding eventually lose intuition for how long things actually take. The gap between "what the CTO thinks is hard" and "what's actually hard" grows without hands-on contact.

**Decision tree:**
```
Should the CTO code?
├─ Company has < 10 engineers?
│  ├─ Yes → Probably coding significantly. Transition gradually.
│  └─ No → Probably not coding production features.
├─ Is the CTO the only person who can build X?
│  ├─ Yes → Knowledge concentration risk. Pair with someone, then transition.
│  └─ No → Delegate. Your time is better spent on strategy.
├─ Does the CTO have time to code without neglecting leadership?
│  ├─ Yes → Code selectively. Prototypes, tools, proofs of concept.
│  └─ No → Stop coding. Use AI agents for occasional exploration.
└─ Is the CTO losing technical credibility?
   └─ Use AI agents for regular engagement. Review PRs deeply. Stay in the code without writing all of it.
```

**Anti-patterns:**
- **The coding CTO at scale:** Still writing production code with 30+ engineers. Nobody reviews their PRs. Authority dynamics prevent feedback.
- **The detached CTO:** Hasn't read a PR in months. Gives time estimates based on vibes. Engineers don't trust their technical judgment.
- **"I'll just do it myself":** Faster today, slower forever. The CTO who builds instead of enabling builds a team that can't function without them.

**AI-era twist:** This debate is less binary now. A CTO can use coding agents to contribute meaningfully in fractured time. Tobi Lütke (Shopify CEO) contributing code via agents is the signal. The question shifts from "should you code" to "how do you stay technically engaged without blocking the team?"

**Primary voices:** DHH, Majors, Willison, Hightower

---

## Mode 7: Product & Business Co-ownership

**What it covers:** The CTO as product peer, not just executor. Understanding business models, revenue implications of technical decisions, and the CTO-CPO partnership.

**Key frameworks:**
- **CTO-CPO Partnership (Cagan):** The CTO ensures feasibility/integrity. The CPO ensures value/viability. Both are required for good product decisions. Neither is subordinate to the other.
- **Empowered Product Teams (Cagan):** "Feature teams" (build what they're told) vs. "empowered product teams" (solve problems they're given). The CTO's role is to ensure engineering operates as the latter.
- **Revenue Model Implications:** Technical decisions have business consequences. Choosing a hosted AI model vs. self-hosted changes your margin structure. Choosing a monolith vs. microservices changes your scaling cost curve.

**Decision tree:**
```
Product direction question landing on the CTO?
├─ Is this a product decision disguised as a technical decision?
│  ├─ Yes → Name it. "This is actually a product question: [X]. Who owns this?"
│  └─ No → It's technical. Own it.
├─ Is the CTO acting as de facto CPO?
│  ├─ Yes → This is an org design problem (Mode 2). Someone needs to own product explicitly.
│  └─ No → Healthy partnership. Keep it.
├─ Does a technical decision have revenue implications?
│  ├─ Yes → Make the implications visible before deciding. "If we choose X, it means Y for our margin."
│  └─ No → Technical decision. CTO owns it.
└─ Is the team building what was asked instead of solving the problem?
   └─ Feature team trap (Cagan). Push for problem framing, not feature requests.
```

**Anti-patterns:**
- **CTO as order taker:** "Product says build X, so we build X." The CTO is a co-owner, not a service provider.
- **CTO ignoring business context:** "I don't care about revenue, I care about good architecture." Architecture that doesn't serve the business is academic exercise.
- **Nobody owns product:** The most dangerous gap. If neither the CTO nor anyone else owns product direction, everyone builds their own version of what they think the product should be.
- **Product by loudest voice:** Whoever is most excited today sets the direction. No commitment framework. Constant pivoting.

**AI-era twist:** Product retention (not just capability) is now the CTO's concern. Generative AI apps average ~14% DAU/MAU — most users don't come back. A CTO who builds technically excellent features that users don't retain has failed. The product-engineering boundary is blurring further as AI enables faster prototyping and validation.

**Primary voices:** Cagan, Fournier, Larson

---

## Mode Routing Table

Use this to identify which mode(s) a CTO challenge falls into:

| User's question sounds like... | Primary mode | Secondary mode | Disambiguation |
|---|---|---|---|
| "Should we rebuild / refactor / migrate?" | Mode 1 (Technical Strategy) | Mode 3 (Stakeholder Translation) | — |
| "Do we need to hire?" | Mode 2 (Org Design) | Mode 3 (Stakeholder Translation) | — |
| "How do I explain this to the board/CEO?" | Mode 3 (Stakeholder Translation) | — | — |
| "How do I handle an incident / outage communication?" | Mode 3 (Stakeholder Translation) | Mode 4 (Process & Culture) | — |
| "My co-founder / CEO disagrees with me" | Mode 3 (Stakeholder Translation) | Mode 2 (Org Design) | — |
| "Our process isn't working" | Mode 4 (Process & Culture) | Mode 2 (Org Design) | Ask: "Is this a people/structure problem or a workflow problem?" Structure → Mode 2 |
| "Should I write a blog post / give a talk?" | Mode 5 (External Presence) | — | — |
| "Should I still be coding?" | Mode 6 (Hands-On) | Mode 2 (Org Design) | — |
| "I don't know what my actual role is" | Mode 2 (Org Design) | Mode 6 (Hands-On) | Check CTO transition curve in cto-org-design.md |
| "I'm being asked to do too much" | Mode 2 (Org Design) | Mode 6 (Hands-On) | Often: CTO doing both coding + strategy. Transition problem |
| "Product keeps changing direction" | Mode 7 (Product Co-ownership) | Mode 1 (Technical Strategy) | Ask: "Is this about nobody owning product (Mode 7) or about the technical cost of pivots (Mode 1)?" |
| "Nobody makes decisions" | Mode 2 (Org Design) | Mode 7 (Product Co-ownership) | — |
| "We're constantly pivoting" | Mode 1 (Technical Strategy) | Mode 3 (Stakeholder Translation) | Ask: same as "product keeps changing" — ownership vs. cost |
| "My co-founder wants to use AI for everything" | Mode 1 (Technical Strategy) | Mode 3 (Stakeholder Translation) | — |
| "We don't know what we're building" | Mode 7 (Product Co-ownership) | Mode 2 (Org Design) | — |
