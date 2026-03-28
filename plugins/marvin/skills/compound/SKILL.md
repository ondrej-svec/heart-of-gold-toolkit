---
name: compound
description: >
  Capture knowledge — solutions, context docs, learnings, and principles. Use after fixing
  non-trivial bugs, creating context for AI, or discovering patterns worth preserving.
  Triggers: compound, document solution, capture fix, save solution, knowledge compound,
  document this, save this fix, context, create context, update context, build context,
  learn, save learning, remember this.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - Write
  - Edit
---

# Compound

Capture knowledge while context is fresh. Solutions, context docs, learnings — whatever you just discovered, structure it so it's findable and useful next time.

## Boundaries

**This skill MAY:** read code/docs for context, write knowledge documents (solutions, context docs, learnings), update CLAUDE.md.
**This skill MAY NOT:** edit application code, run tests, deploy, fix bugs. Knowledge capture only.

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Skip duplicate check — I'll write a new doc" | Parallel docs drift and eventually contradict | Knowledge drift → wrong fix applied next time |
| "Skip frontmatter — it's just metadata" | Frontmatter IS the search index. Without it, the solution is unfindable. | Captured but never surfaced → wasted effort |
| "Good enough — I'll refine later" | You won't. Context is freshest NOW. | Incomplete doc → next person can't reproduce the fix |
| "Too trivial to document" | The "trivial" fix that took 30 minutes will take someone else 30 minutes too | Repeated debugging of known problems |

---

## Phase 0: Detect What to Capture

**Entry:** User invoked `/compound` — possibly after a fix, with a topic, or with no context.

Auto-detect capture type:

| Context | Capture Type | Output Location |
|---------|-------------|-----------------|
| Just fixed a bug, resolved an error | **Solution** | `docs/solutions/{domain}/{topic}.md` |
| Need to create/update AI context | **Context doc** | `CLAUDE.md`, `../knowledge/{topic}.md`, or `docs/` |
| Discovered a pattern or principle | **Learning** | `CLAUDE.md` or memory files |

**If invoked after a fix:** Scan conversation for what broke, what was investigated, what fixed it.
**If invoked with a topic** (e.g., `/compound auth token refresh`): Use as hint.
**If unclear:** Use **AskUserQuestion** with:
- question: "What knowledge do you want to capture?"
- header: "Type"
- options:
  1. label: "Solution", description: "Problem → root cause → fix → prevention (for docs/solutions/)"
  2. label: "Context doc", description: "AI context, onboarding, or decision record"
  3. label: "Learning", description: "Pattern, preference, or principle for CLAUDE.md or memory"
- multiSelect: false

**Exit:** Capture type determined.

---

## Phase 1: Check for Duplicates

**Entry:** Capture type known.

**WAIT — search before writing:**

```
Search docs/solutions/, CLAUDE.md, ../knowledge/ for:
- Similar symptoms or component names
- Same error messages or topic
- Same root cause or pattern
```

**If related content exists:** Use **AskUserQuestion** (header: "Duplicate?", question: "Found related: {path}. Update existing or create new?") with options: "Update existing (Recommended)" (description: "Extend the existing doc — avoids parallel docs that drift") and "Create new" (description: "This is different enough to warrant a separate document").

Principle: **update > create.** Don't create parallel docs that drift.

### Intelligent Capture

After the duplicate check, apply capture heuristics:
- **Similar solution, different root cause:** Create a new doc, cross-reference the existing one in `related:` frontmatter.
- **Trivial fix** (typo, config error, one-line change): Suggest a memory note (CLAUDE.md or auto-memory) instead of a full solution doc. The 15-minute rule: if it took less than 15 minutes, it's probably not worth a full doc.
- **Novel pattern** (new approach, integration point, unexpected constraint): Create a full solution doc — this is exactly what compounding is for.

In autonomous mode: make the capture decision using these heuristics, document the reasoning in the output. Skip AskUserQuestion for clear-cut cases (obvious duplicate → update, obvious novel → create).

**Exit:** Confirmed new or updating existing.

---

## Phase 2: Extract Knowledge

**Entry:** Duplicate check done.

### Solution Capture

Extract from conversation or user input:
1. **Problem** — What happened? Symptoms?
2. **Root cause** — Why did it happen?
3. **Fix** — What resolved it? Specific change.
4. **Prevention** — How to avoid this in the future?

### Context Doc Capture

Determine the right location:

| Type | When | Where |
|------|------|-------|
| Project CLAUDE.md | Core conventions, rules for every session | Root `CLAUDE.md` |
| Knowledge file | Domain reference loaded on demand | `../knowledge/{topic}.md` |
| Onboarding doc | Setup, architecture overview | `docs/developers/` |
| Decision record | Why a specific decision was made | `architecture/decisions/` |

### Learning Capture

- **Project-specific:** Add to project CLAUDE.md or memory files
- **Toolkit-wide:** Add to the relevant plugin's `../knowledge/` directory
- Keep it concise — one pattern per entry

**Exit:** Knowledge extracted and structured.

---

## Phase 3: Write

**Entry:** Knowledge extracted, location determined.

Check the project's `CLAUDE.md` for a "Toolkit Output Paths" table. Use those paths if present, otherwise use defaults.

### Solution Document

**Output path:** `{solutions_path}/{domain}/{kebab-topic}.md`
(Default `solutions_path`: `docs/solutions/`)

**Domains:** `auth`, `database`, `scoring`, `frontend`, `backend`, `infrastructure`, `deployment`, `testing`, `integration`, or create a new one.

```yaml
---
title: "{Brief description of problem and fix}"
type: solution
date: YYYY-MM-DD
domain: {domain}
component: {specific component or service}
symptoms:
  - "symptom 1"
  - "symptom 2"
root_cause: "{one-line root cause}"
severity: low | medium | high | critical
related: []
---
```

```markdown
# {Title}

## Problem
{What happened. Symptoms. How it manifested.}

## Root Cause
{Why it happened. The actual underlying issue.}

## Fix
{What resolved it. Specific code changes, config changes, or commands.}

## Prevention
{How to avoid this in the future. Tests, patterns, checks.}

## Related
- {Links to related solutions, ADRs, or documentation}
```

### Context Doc / Knowledge File

For CLAUDE.md: Keep concise. Tables for quick reference. Link to details.
For knowledge files: 800-1200 words. What and why → how → pitfalls.

**Exit:** Document written.

---

## Phase 4: Verify and Handoff

**Entry:** Document written.

Verify:
- Search for the symptoms — does this doc surface?
- Are frontmatter keywords what someone would actually search for?
- Is the root cause confirmed (not just theory)?

Present:
```
Knowledge captured at {path}
Searchable by: {frontmatter keywords}
```

Use **AskUserQuestion** with:
- question: "Knowledge captured. Anything else?"
- header: "Next step"
- options:
  1. label: "Done", description: "Knowledge captured, move on"
  2. label: "Refine", description: "Adjust the document"
  3. label: "Capture more", description: "Document another solution or learning"
- multiSelect: false

**If user selects "Capture more":** Return to Phase 0.

---

## Validate

Before delivering, verify:

- [ ] **Findable:** Frontmatter keywords match what someone would search for
- [ ] **Reproducible:** Could someone reproduce the problem from symptoms alone?
- [ ] **Verified:** Root cause confirmed, fix tested (not just proposed)
- [ ] **No duplicates:** Searched existing docs — this is genuinely new
- [ ] **Correctly typed:** Solution vs context doc vs learning — right structure and location
- [ ] **No application code modified** — knowledge documents only

## What Makes This Heart of Gold

- **Knowledge Compounding:** Each solution captured makes the next occurrence faster.
- **Context Engineering:** Structured, typed, discoverable knowledge for AI consumption.
- **Knowledge Architecture:** Solutions with frontmatter for machine retrieval. Not random docs — structured knowledge.
- **Cross-plugin bridge:** `/deep-thought:plan` checks `docs/solutions/` before planning. `/marvin:review` suggests `/marvin:compound` when it finds insights.
