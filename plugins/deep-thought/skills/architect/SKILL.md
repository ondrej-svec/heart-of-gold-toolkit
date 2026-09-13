---
name: architect
description: >
  Turn brainstorm decisions into user stories, architecture doc, and ADRs.
  Use after brainstorming to define WHAT to build and HOW it fits together.
  Standalone or pipeline-aware via env vars. Triggers: architect, stories,
  architecture, design, ADR, define stories, write stories.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - Write
  - Edit
---

# Architect

Turn decisions into stories + architecture. Answers **WHAT to build** and **HOW it fits together** — the bridge between brainstorm and implementation.

## Boundaries

**This skill MAY:** research (read-only), analyze codebase patterns, write stories and architecture docs.
**This skill MAY NOT:** edit code, create source files, run tests, deploy, implement anything.

**NEVER write code during this skill. Design and document only.**

### Interaction and readiness policy

Natural conversation is the default. Inspect evidence before questioning. Classify unknowns as user decisions, agent investigation, or later verification, and name their blocking phase and owner. Ask focused questions only when an answer changes progress (up to three independent related clarifications in prose), including evidence-based recommendation/tradeoffs where useful. Preserve decisions and stop when clear. Structured UI is conditional for a meaningful choice/approval only; prose and custom qualifications always work. Required work is progress, not a selectable scope. Stories, documents, paths, and suggested next steps do not authorize implementation. Hand off to execution planning, not unrestricted implementation; plan approval, readiness/preview gates, and explicit execution authorization remain separate.

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Skip codebase research — I know the patterns" | Your mental model may not match the actual codebase | Architecture conflicts with existing code → rework |
| "Write vague stories — the implementer will figure it out" | Vague stories produce vague implementations | Ambiguity → wrong code → rework |
| "Skip ADRs — the decision is obvious" | Obvious now, forgotten in 2 weeks | Decision gets reversed without understanding tradeoffs |
| "One big story — splitting is overhead" | Big stories hide complexity and block parallel work | Unestimable, unreviewable, unshippable |

---

## Phase 1: Load Context

**Entry:** User wants to define stories and architecture for a feature.

**If `$BRAINSTORM_PATH` is set (pipeline mode):**
1. Read the brainstorm document at `$BRAINSTORM_PATH`
2. Extract: chosen approach, key decisions, constraints, open questions
3. Announce: "Reading brainstorm: [filename]. Extracting decisions."
4. Skip to Phase 2

**If no env var (standalone mode):**
1. Use the supplied feature/context first; check `docs/brainstorms/` for a recent related match (last 14 days) and inspect it.
2. If competing inputs would materially change the architecture, ask one prose question with evidence and tradeoffs; otherwise proceed with the best-supported context.
3. Only if the intended feature/problem is still missing, ask for it in prose. Research agent-owned gaps before requesting more detail.

**Exit:** Feature context understood — decisions extracted or gathered from user.

---

## Phase 2: Research Codebase

**Entry:** Feature context loaded.

Launch research via **Agent**:

- "Find existing patterns related to: <feature description>. Search for: similar implementations, naming conventions, directory structure, test patterns, integration points."

Surface findings:
```
>> Existing pattern: src/services/auth.ts (similar service structure)
>> Convention: tests live alongside source as *.test.ts
>> Integration: uses EventBus for cross-module communication
```

**Exit:** Codebase patterns known, integration points identified.

---

## Phase 3: Write User Stories

**Entry:** Research complete.

Check the project's `CLAUDE.md` for a "Toolkit Output Paths" table. Use those paths if present, otherwise use defaults.

**Output path:** `{stories_path}/{slug}.md`
(Default `stories_path`: `docs/stories/`)

**If `$FEATURE_ID` is set:** use it as the slug. Otherwise derive from the feature description.

### Story Format

Each story follows this structure:

```markdown
# {Feature Title}

## STORY-001: {Story title}

**As a** {actor}
**I want** {capability}
**So that** {value}

### Acceptance Criteria
- [ ] {Measurable, testable criterion}
- [ ] {Another criterion}

### Edge Cases
- {Edge case and expected behavior}

### Notes
- [INTEGRATION] {Integration point with existing system}
```

**Story writing rules:**
- Each story is independently implementable and testable
- Acceptance criteria are measurable — "user can X" not "system handles X well"
- Edge cases are explicit, not implied
- `[INTEGRATION]` tags mark where the story touches existing systems
- Stories are ordered by dependency — downstream stories reference upstream ones
- IDs are sequential: STORY-001, STORY-002, etc.

**Exit:** Stories file written with all stories, acceptance criteria, and edge cases.

---

## Phase 4: Write Architecture Doc

**Entry:** Stories written.

**Output path:** `{stories_path}/{slug}.architecture.md`

### Architecture Doc Structure

Use the template from `architecture-template.md` in this skill's directory. The doc includes:

**1. Requirements**
- Functional Requirements (FR-001, FR-002, ...) — derived from stories
- Non-Functional Requirements (NFR-001, ...) — performance, security, reliability

**2. Architecture Decision Records (ADRs)**
- One ADR per significant decision (see `adr-format.md`)
- Each ADR: Context → Decision → Consequences → Alternatives Considered

**3. Dependencies**
- Every external package the implementation MUST use
- Each dependency: name, version constraint, purpose
- This list is BINDING — the implementer must import every listed package

**4. Integration Pattern**
- How the new code connects to the existing system
- Entry points, event flows, data transformations
- This pattern is BINDING — the implementer must follow it exactly

**5. File Structure**
- Expected file paths for implementation
- One file per responsibility — no god files

**6. External Services**
- APIs, databases, third-party services the feature touches
- Auth requirements, rate limits, error handling expectations

**7. Security Considerations**
- Input validation, auth/authz, data handling
- Relevant OWASP concerns for this feature

**Exit:** Architecture doc written alongside stories.

---

## Phase 5: Handoff to Execution Planning

**Entry:** Stories and architecture doc written.

Report the story and architecture paths, settled decisions, and unresolved blockers with owners. Do not route stories directly to unrestricted implementation or infer approval from a path or review.

**Standalone:** identify an existing execution plan to continue or recommend `/plan {architecture-path}` to create one from these artifacts. If the user already authorized that planning transition, continue through the plan skill without re-asking; otherwise state the next planning action and stop. Architect itself writes only stories and architecture docs, not execution plans. Ask naturally only if a consequential architecture decision remains.

**Pipeline (`$BRAINSTORM_PATH` set):** return these downstream outputs and stop; do not start planning or implementation automatically. Downstream execution still requires an execution plan, readiness, and user authorization.

```text
Stories: {stories_path}/{slug}.md
Architecture: {stories_path}/{slug}.architecture.md
```

**Exit:** Artifacts delivered with a planning handoff (standalone) or unchanged output paths (pipeline).

---

## Validate

Before delivering, verify:

- [ ] Every story has measurable acceptance criteria — not vague descriptions
- [ ] Stories are dependency-ordered — downstream stories reference upstream
- [ ] Architecture doc lists ALL dependencies with purpose — no mystery imports
- [ ] Integration pattern is specific enough to implement without guessing
- [ ] ADRs explain WHY, not just WHAT — alternatives are documented
- [ ] File structure matches project conventions (from Phase 2 research)
- [ ] No code was written — only stories and architecture docs

## What Makes This Heart of Gold

- **Task Decomposition (2.3):** Stories broken into independently implementable units with clear boundaries.
- **Prompt Mastery (2.2):** The architecture doc IS a prompt for the implementer. Dependencies are binding, patterns are exact.
- **Strategic AI Dialogue (2.4):** ADRs capture reasoning — alternatives considered, tradeoffs explicit.
- **Critical Trust (2.1):** Edge cases and integration points flagged honestly. Nothing swept under the rug.

## Knowledge References

- `./architecture-template.md` — Full architecture doc template
- `./adr-format.md` — ADR structure reference
- `./story-format.md` — Story format with examples
- `${CLAUDE_PLUGIN_ROOT}/knowledge/strategic-decomposition.md` — How to break work into units
- `${CLAUDE_PLUGIN_ROOT}/knowledge/decision-frameworks.md` — How to evaluate tradeoffs
