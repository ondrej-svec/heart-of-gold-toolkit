# Active Memory Integration

How skills read and write knowledge to make every session smarter than the last. Not passive "context loading" — active retrieval at startup and compound capture at exit. Skills consult the project's memory before working and contribute back when they discover something worth preserving.

---

## Read Patterns

At skill startup, search for relevant prior art. This prevents re-solving solved problems and surfaces context that improves decisions.

### What Each Skill Type Should Read

| Skill Type | Search | Where | Purpose |
|------------|--------|-------|---------|
| Discovery (`/brainstorm`) | Past brainstorms on related topics | `docs/brainstorms/` | Prevent re-brainstorming; surface prior decisions and rejected alternatives |
| Planning (`/plan`) | Past plans for similar features, ADRs | `docs/plans/`, `architecture/decisions/` | Reuse proven patterns; respect existing constraints |
| Review (`/review`) | Past review findings, known solutions | `docs/solutions/`, past review artifacts | Check for recurring issues; reference known fixes |
| Execution (`/work`) | Plan file, solutions for this domain | Plan path, `docs/solutions/{domain}/` | Avoid known pitfalls during implementation |
| Investigation (`/investigate`) | Solutions matching symptoms | `docs/solutions/` by symptom/component | "This looks like the issue from X" — start with hypotheses, not blank slate |
| Capture (`/compound`) | Existing solutions (dedup check) | `docs/solutions/` | Don't create duplicates; update or cross-reference instead |

### Retrieval Strategy

**Search by keyword + frontmatter tags.** Don't dump entire files into context.

1. **Grep frontmatter fields** (title, domain, component, symptoms, tags) for matches
2. **Rank by relevance:** exact keyword match > related domain > same component
3. **Limit to 3 most relevant** artifacts. Context rot is real — more context doesn't mean better decisions.
4. **Surface with confidence tags:**

```
>> Known pattern: docs/solutions/auth/jwt-refresh-fix.md (high match)
>> Related brainstorm: docs/brainstorms/2026-02-15-notifications.md (medium match)
>> Possible prior art: docs/plans/2026-01-20-feat-sse-streaming-plan.md (low match)
```

5. **If nothing found, say so.** "No related prior art found in docs/brainstorms/, docs/solutions/, or docs/plans/." Don't invent relevance.

### Match Confidence

| Level | Meaning | Action |
|-------|---------|--------|
| **High match** | Same component, similar symptoms, or directly related topic | Read the artifact; reference specific decisions or findings |
| **Medium match** | Same domain or related feature | Mention it; let the user decide if it's relevant |
| **Low match** | Tangentially related | Mention only if nothing better was found |

---

## Write Patterns

Skills contribute back to the knowledge base when they encounter something worth preserving.

### Triggers for Compound Suggestions

| Trigger | Action | Example |
|---------|--------|---------|
| Novel pattern discovered | Suggest `/compound` at end of skill | "This SSE reconnection pattern is new — worth documenting?" |
| Known issue from docs/solutions/ was hit | Reference it in output | ">> Known pattern: docs/solutions/infra/sse-auth-fix.md" |
| Decision contradicts a past brainstorm | Flag explicitly in output | "Note: This contradicts the decision in brainstorm X. Context may have changed." |
| Recurring issue (3rd+ occurrence) | Suggest CLAUDE.md or docs/solutions/ addition | "This auth token issue has appeared 3 times. Consider adding to CLAUDE.md." |
| Fix took >15 minutes to figure out | Prompt for capture | "That took a while. Document it with `/compound`?" |

### Contradiction Handling

When a current decision contradicts a prior one:

1. **Surface the contradiction explicitly.** Don't silently override.
2. **Show both decisions** with their rationale.
3. **Ask:** "Has the context changed, or is this an oversight?"
4. **If context changed:** Document the new decision and note what changed.
5. **If oversight:** Flag for resolution before proceeding.

---

## Dedup Rules

Before creating a new solution doc, check for duplicates:

1. **Search by symptom keywords** in `docs/solutions/` frontmatter
2. **Search by component name** — same component often means related issue
3. **If exact match exists:** Update the existing doc instead of creating a new one
4. **If similar but different root cause:** Create a new doc, cross-reference the existing one in `related:` frontmatter
5. **If the fix is trivial** (typo, config error, one-line change): Suggest a memory note instead of a full solution doc

---

## Context Budget

Active memory adds tokens to every skill invocation. Stay within budget:

| Item | Token Cost | Justify When |
|------|-----------|-------------|
| Frontmatter scan (grep) | ~0 (tool use only) | Always — it's cheap |
| Reading 1 matched artifact | ~500-800 tokens | High or medium match confidence |
| Reading 3 matched artifacts | ~1500-2400 tokens | Multiple relevant results found |
| Surfacing "nothing found" | ~50 tokens | Always — avoids false silence |

**Hard limit:** 3 artifacts read per skill invocation. If you find more than 3 matches, pick the 3 most relevant by match confidence.

**Skip memory read when:** The skill was invoked with explicit, self-contained context that doesn't reference past work (e.g., a standalone code review of a PR diff).

---

## Anti-patterns

- **Context dumping.** Reading every related file into context. More context does not equal better decisions. Be selective.
- **Inventing relevance.** "This might be related..." when it's clearly not. Say "nothing found" instead.
- **Stale references.** Citing a solution that was for a different codebase version. Check dates and component names.
- **Over-capturing.** Running `/compound` on every trivial fix. The 15-minute rule: if it took less than 15 minutes to solve, it's probably not worth documenting.
- **Silent memory.** Reading past artifacts but not telling the user. Always surface what you found — even if it's "nothing relevant."
