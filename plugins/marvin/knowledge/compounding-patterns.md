# Compounding Patterns

How knowledge compounds — the patterns that make every solved problem cheaper than the last. Not knowledge management theory, but practical patterns for teams building software with AI.

---

## The Compounding Loop

Knowledge compounding follows a simple loop:

```
Solve a problem
    ↓
Capture the solution (while context is fresh)
    ↓
Structure it for retrieval (frontmatter, categories, symptoms)
    ↓
Surface it automatically (before debugging, during planning)
    ↓
Save time on the next occurrence
    ↓
Invest that saved time in solving harder problems
    ↓
Repeat
```

The key insight: each iteration takes less time than the last. The first time you solve an SSE auth token problem, it takes hours. The second time, the solution doc takes minutes. The third time, the AI surfaces it before you even start debugging.

---

## Capture Patterns

### When to Capture

Not everything is worth documenting. The sweet spot:

| Worth Capturing | Not Worth Capturing |
|----------------|-------------------|
| Took >15 minutes to figure out | Obvious fix (typo, missing import) |
| Involved investigation or debugging | Well-known pattern already in docs |
| Would trip someone up again | One-off configuration change |
| Has a non-obvious root cause | Simple "read the error message" fix |
| Crosses system boundaries | Isolated to one line of code |

**The 15-minute rule:** If it took more than 15 minutes to solve, it's probably worth 5 minutes to document.

### While Context Is Fresh

The biggest enemy of knowledge capture is procrastination. "I'll document it later" = "I'll never document it."

**Capture immediately after solving.** Not tomorrow, not next sprint — now. Five minutes while everything is fresh produces a better doc than thirty minutes next week from faded memory.

### The Right Level of Detail

**Too little:** "Fixed the auth bug." — Useless for retrieval. What auth bug? How?

**Too much:** A 2000-word narrative of every debugging step. — Nobody will read this.

**Just right:** Problem (symptoms + context) → Root cause (the actual issue) → Fix (what to do) → Prevention (how to avoid it). 200-400 words total.

---

## Structure Patterns

### Frontmatter as Search Index

The YAML frontmatter is the most important part of a solution doc. It's the search index that other tools use to find the right solution:

```yaml
---
title: "SSE connection drops after auth token refresh"
date: 2026-02-15
domain: infrastructure
component: notification-service
symptoms:
  - "SSE connection closes unexpectedly"
  - "EventSource onerror fires after ~30 minutes"
  - "notification stream stops working"
root_cause: "Auth token expires during long-lived SSE connection, server rejects refresh"
severity: medium
---
```

**Symptoms are keywords.** Write them as someone experiencing the problem would describe them. Not technical root causes — observable behaviors.

### Domain Organization

Solutions organized by domain (`docs/solutions/{domain}/`) are easier to browse and maintain:

| Domain | What Goes Here |
|--------|---------------|
| `auth` | Authentication, authorization, tokens, sessions |
| `database` | Migrations, queries, connection issues, data integrity |
| `scoring` | Score calculations, weights, formulas, calibration |
| `frontend` | UI bugs, component issues, state management |
| `backend` | API errors, service interactions, business logic |
| `infrastructure` | Deployment, networking, containers, CI/CD |
| `testing` | Test infrastructure, flaky tests, test patterns |
| `integration` | Cross-service issues, event handling, sync problems |

Don't over-categorize. If a domain has 1-2 docs, it might not need its own folder yet.

### Cross-References

Solutions don't exist in isolation. Link related solutions:

```yaml
related:
  - docs/solutions/auth/jwt-rotation-strategy.md
  - docs/solutions/infrastructure/sse-connection-management.md
```

And link from plans and brainstorms to relevant solutions. The graph of connections is what makes retrieval powerful.

---

## Retrieval Patterns

### Before Debugging

Before investigating a problem, search the solution library:

```
Search docs/solutions/ for:
- Matching symptoms (grep frontmatter)
- Same component or domain
- Similar error messages
```

If there's a match, you save the investigation time entirely. If there's a partial match, it narrows the investigation.

### During Planning

Before planning a feature, check for relevant past solutions:

```
Search docs/solutions/ for:
- Same component being changed
- Related patterns or domains
- Past gotchas in the area
```

Surface them in the plan: "Known pattern: docs/solutions/auth/jwt-refresh-fix.md (high match)"

### Automatic Surfacing

The most powerful pattern is automatic surfacing — the AI finds relevant solutions without being asked. This happens when:
1. CLAUDE.md instructs "search docs/solutions/ before debugging"
2. Plan skills check the solution library during research
3. Review skills suggest /compound when they find new insights

---

## Maintenance Patterns

### Pruning

Solution libraries grow. Periodically review and prune:
- Remove solutions for problems that no longer exist (migrated away, refactored out)
- Merge related solutions that should be one doc
- Update solutions whose fixes have changed

### Freshness

Old solutions may have stale fixes. Mark solutions with dates and component names. When a component is significantly refactored, review its solutions.

### Quality over Quantity

A library with 20 well-structured, searchable solutions is more valuable than 200 scattered notes. Quality of documentation matters more than volume.

---

## Anti-patterns

- **Capture everything.** Documenting trivial fixes dilutes the library. Capture only what would save future time.
- **Unstructured notes.** A solution without frontmatter is a note that nobody will find. Structure is retrieval.
- **Write and forget.** Solutions go stale. Review periodically. Delete what's no longer relevant.
- **Individual hoarding.** Solutions in personal notes help one person. Solutions in docs/solutions/ help the team. Share by default.
- **Perfectionism.** A rough 5-minute capture is better than a perfect doc you never write. Capture now, polish later (or never — rough is fine).
