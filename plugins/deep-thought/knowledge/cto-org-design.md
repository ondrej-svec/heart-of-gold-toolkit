# CTO Org Design — Teams, Hiring, and Decision Rights

Frameworks for organizational design, hiring decisions, and decision-making structures.

---

## Team Topologies (Skelton & Pais)

The foundational framework for engineering organizational design. Core insight: **team structure IS architecture** (Conway's Law, deliberately applied).

### Four Team Types

| Type | Purpose | Owns | Example |
|---|---|---|---|
| **Stream-aligned** | Delivers end-to-end user/business value | A flow of work (feature area, user journey, product) | "Coaching experience team" — owns the entire coaching flow |
| **Platform** | Reduces complexity for stream-aligned teams | Internal services/tools that other teams consume | "Infrastructure team" — owns deployment, monitoring, shared services |
| **Enabling** | Temporarily helps other teams build capability | Nothing permanently — transfers knowledge, then moves on | "AI enablement" — helps teams adopt AI tools, then disbands |
| **Complicated Subsystem** | Owns a domain requiring deep specialist knowledge | A technically complex component | "ML infrastructure" — owns model serving, fine-tuning pipeline |

### Three Interaction Modes

| Mode | When | Duration |
|---|---|---|
| **Collaboration** | Two teams working closely together to build something new | Temporary (weeks/months). High communication overhead. Use sparingly |
| **X-as-a-Service** | One team provides a service with a clear API/interface | Ongoing. Low communication overhead. The default for mature systems |
| **Facilitation** | One team helps another learn or adopt something | Temporary (weeks). Enabling teams use this by definition |

### Cognitive Load

The fundamental constraint. A team can only handle so much complexity.

**Three types of cognitive load:**
- **Intrinsic:** The inherent complexity of the problem domain
- **Extraneous:** The unnecessary complexity from tools, process, or unclear boundaries
- **Germane:** The beneficial cognitive effort of learning and improving

**CTO's job:** Minimize extraneous load. This means: clear ownership boundaries, good tooling, simple processes, and teams sized to their cognitive load (not to org chart aesthetics).

### Application at Different Scales

| Team size | Structure |
|---|---|
| 2-5 engineers | One stream-aligned team. Everyone does everything. This is fine. |
| 5-15 engineers | 2-3 stream-aligned teams with clear ownership. Maybe a thin platform function (often one person). |
| 15-50 engineers | Distinct stream-aligned + platform teams. Consider enabling teams for capability building. |
| 50+ engineers | Full Team Topologies application. Multiple stream-aligned, dedicated platform, enabling rotation. |

---

## Staffing Models (Larson)

### Team Sizing
- **Below 4:** Fragile. One departure breaks the team. One person on vacation leaves too few for effective collaboration.
- **4-6:** Functional but tight. Works for focused, experienced teams.
- **6-8:** Sweet spot. Enough capacity for sick days, vacations, and context switching. Small enough for direct communication.
- **Above 8:** Communication overhead increases. Consider splitting.

### Manager-to-IC Ratio
- **5-7 ICs per manager** is healthy for engineering
- Below 5: manager may be micro-managing or underutilized
- Above 8: manager is likely a bottleneck for 1:1s, reviews, and career development

### The CTO Transition Points

| Stage | CTO role | Coding? | Key challenge |
|---|---|---|---|
| **1-5 engineers** | Tech lead + architect + recruiter + manager | Yes, significantly | Doing everything. Building the foundation |
| **5-15 engineers** | Architecture + hiring + process + some coding | Decreasing | Letting go of code. Building the team that builds |
| **15-50 engineers** | Strategy + org design + executive partnership | Rarely | Thinking about the system, not the code |
| **50+ engineers** | Strategy + board + culture + industry presence | Almost never | Leading leaders. Staying technically relevant |

---

## Hiring Frameworks

### When to Hire

```
Do you need more people?
├─ Is the bottleneck a skill gap or a capacity gap?
│  ├─ Skill gap → Can you train existing people or use AI tools?
│  │  ├─ Yes → Do that first. Cheaper, faster, better retention
│  │  └─ No → Hire for the specific skill
│  └─ Capacity gap → Is the work structured efficiently?
│     ├─ No → Fix the structure first. Hiring into chaos creates more chaos
│     └─ Yes → Hire. But define the role precisely
├─ Can you articulate what the new person will DO in their first 30 days?
│  ├─ Yes → Good. You have a real role, not a vague need
│  └─ No → You're not ready to hire. Define the role first
└─ Is the CTO doing two jobs (coding + leading)?
   └─ Yes → That's the strongest hiring signal. One person can't do both well
```

### The AI-Era Hiring Bar

The hiring bar should rise, not fall:
- **Fewer people, higher judgment.** AI amplifies judgment — hire people who know what to build, not just how to build it
- **T-shaped skills matter more.** Broad understanding + deep expertise in one area. AI handles the breadth; humans need depth for judgment
- **Culture of craft.** The team decides whether AI-generated code is "good enough" or needs improvement. Hire people who care about quality
- **Self-direction.** AI tools work best with people who can define their own tasks. Hire for autonomy, not for task execution

### What to Hire For (Not What to Hire)

| Don't hire for... | Hire for... |
|---|---|
| "A React developer" | "Someone who owns the customer-facing experience end-to-end" |
| "A backend engineer" | "Someone who can design and build reliable services with clear APIs" |
| "A DevOps person" | "Someone who makes deployment fast, safe, and boring" |
| "An AI engineer" | "Someone who knows when to use AI and when not to" |

---

## CTO vs. VP Engineering

### The Classic Distinction (Fournier, Fred Wilson)

| | CTO | VP Engineering |
|---|---|---|
| **Facing** | External / technology | Internal / team |
| **Focus** | Technical vision, architecture, innovation | People, process, execution |
| **Key relationship** | CEO/board, customers, industry | Engineering team, product |
| **Measures success by** | Technical direction, innovation | Team health, delivery performance |
| **Thinks about** | "Are we building the right thing the right way?" | "Is the team effective and healthy?" |

### When to Split the Role

```
Should you split CTO and VP Eng?
├─ Engineering team > 20 people?
│  ├─ Yes → Strongly consider splitting
│  └─ No → One person can usually handle both
├─ Is the CTO unable to do both well?
│  ├─ Yes → Split. But figure out which role the current CTO fills naturally
│  └─ No → Don't fix what isn't broken
├─ Is there a strong candidate for the other role?
│  ├─ Yes → Split and let each person play to their strength
│  └─ No → Premature split with the wrong person is worse than one person doing both
```

**AI-era consideration:** If smaller teams can build bigger products (fewer engineers needed), the case for splitting weakens at mid-scale. A CTO at a 20-person engineering org may handle both functions indefinitely.

---

## Co-Founder Dynamics Playbook

Derived from direct experience and research on leadership team dysfunction in startups.

### Common Failure Patterns

| Pattern | What it looks like | Root cause |
|---|---|---|
| **Title-function mismatch** | "Co-CEO" who's actually COO. "CPO" who doesn't own product decisions | Titles assigned for ego/politics, not function |
| **Decision vacuum** | Founder stepped back but nobody filled the decision role | Decentralization without decision boundaries |
| **Commitment failure** | Decisions made but re-litigated mid-execution | Nobody is willing to say "this is hard and we're doing it anyway" |
| **The build-don't-think trap** | Leadership builds things during strategy meetings | Conflating "being busy" with "making decisions" |
| **Everyone can do everything** | AI era removes friction — no natural prioritization forcing function | AI capability creates illusion that all ideas are equally viable |

### Resolution Frameworks

**1. Decision Rights Map**
List the 10-20 most frequent leadership decisions. For each: who is the Owner? One person. If you can't agree, that's your biggest problem.

**2. Disagree-and-Commit (Bezos)**
- Before: obligated to voice objections
- At decision: explicitly say "I disagree and commit"
- After: fully commit. No hedging, no "I told you so"
- If you can't genuinely commit: escalate. Don't silently sabotage

**3. Commitment Cycles**
- 12-week strategy commitment: pick a direction, don't re-litigate for 12 weeks
- 6-week execution sprints within: review progress, adjust tactics
- Emergency clause: strategy re-opens ONLY if all leaders agree on a material external event

**4. Pivot Cost Estimate**
Before any direction change, the CTO produces a 1-page cost estimate:
- What we abandon and what it cost
- What the new direction requires
- How it affects timelines and commitments
- Not a veto — just information. Informed decisions are better decisions

**5. External Facilitation**
When the leadership team can't resolve dynamics internally:
- Bring in a team coach/facilitator, not just individual coaching
- Scope: how we make decisions and stick to them, not who's right
- Time-boxed pilot (3 sessions) to test value before committing
- Success metric: reduction in re-litigated decisions

---

## Single-Threaded Ownership

The principle that cuts across all org design: **one person is fully accountable for each outcome.** Not a committee. Not "shared ownership." One person who decides, is accountable, and has the authority to act.

**How to implement:**
- Name the owner explicitly for each domain/initiative
- "Owner" means: makes decisions within the domain, is accountable for outcomes, has authority to act without committee approval
- "Support" means: gives input, gets informed, but doesn't decide
- Review ownership quarterly — it changes as the company evolves

**Why it works:**
- Eliminates "I thought you were handling that"
- Prevents the "everyone responsible = no one responsible" failure
- Creates accountability without bureaucracy
- Works at any company size

**When it breaks down:**
- When the "owner" doesn't have actual authority to decide
- When decisions require so much cross-team coordination that one person can't own it alone
- When the culture punishes decision-making mistakes harshly — people avoid ownership
