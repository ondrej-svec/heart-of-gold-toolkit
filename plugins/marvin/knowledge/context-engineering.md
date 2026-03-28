# Context Engineering

How to build structured context for AI — the right information, in the right format, at the right time. Context engineering is what separates a helpful AI session from a transformative one.

---

## Why Context Matters

AI is only as good as the context you give it. The same model produces wildly different results depending on what it knows about your project, conventions, and goals. Context engineering is the skill of preparing that information deliberately.

**The multiplier effect:** A well-structured CLAUDE.md doesn't just help one session — it helps every session. Time invested in context pays compound returns.

---

## Context Types

Not all context is equal. Different types serve different purposes.

### Always-Loaded Context (CLAUDE.md)

This is loaded every session. Every line costs attention, so every line must earn its place.

**What belongs here:**
- Core conventions (naming, file structure, patterns to follow)
- Decision trees (quick if/then guidance for common choices)
- Key file paths (where to find what)
- Team rules (branching strategy, commit conventions, review process)
- Knowledge map (pointers to detailed docs, not the docs themselves)

**What doesn't belong here:**
- Detailed reference material (put in knowledge files, link from CLAUDE.md)
- Temporary information (use a separate doc, not CLAUDE.md)
- Full architecture docs (link to them)
- Everything you've ever learned (curate ruthlessly)

**Target:** Keep CLAUDE.md under 200 lines of substantive content. Longer than that and you're paying an attention tax on every session.

### On-Demand Context (Knowledge Files)

Loaded when a specific skill or agent needs them. Can be more detailed since they're only read when relevant.

**What belongs here:**
- Domain-specific reference (psychometric methods, API patterns, etc.)
- Detailed decision frameworks
- Comprehensive anti-pattern catalogs
- Background material that skills reference

**Structure:** 800-1200 words. Accessible voice. Open with what/why, then how, then pitfalls.

### Searchable Context (Solution Library)

`docs/solutions/` — structured problem/solution pairs with YAML frontmatter for machine retrieval.

**What belongs here:**
- Non-trivial problems and their fixes
- Gotchas that would trip someone up again
- Patterns discovered through debugging

**Structure:** Problem → root cause → fix → prevention. With frontmatter: domain, component, symptoms, root_cause, severity.

### Reference Context (Documentation)

`docs/` — human-readable docs that AI can also consume.

**What belongs here:**
- Architecture decisions (ADRs)
- Runbooks and operational procedures
- Onboarding guides
- API documentation

---

## Designing Good Context

### The Specificity Principle

Specific context > generic context. Always.

**Bad:** "Follow best practices for error handling"
**Good:** "Use the `AppError` class from `lib/errors.ts`. Always include error code, user message, and HTTP status. See `services/auth/errors.ts` for the pattern."

The second version tells AI exactly what to do. The first leaves it guessing.

### The Freshness Problem

Context goes stale. Code changes, conventions evolve, decisions get revisited. Stale context is worse than no context — it confidently points AI in the wrong direction.

**Mitigations:**
- Date all context docs. Review anything older than 3 months.
- Use links to source code rather than copied snippets (code changes, links stay current)
- Periodic audits: read through CLAUDE.md and ask "is this still true?"
- Delete > update. If something is no longer relevant, remove it rather than adding caveats.

### The Duplication Trap

The same information in two places will drift. When it drifts, AI gets conflicting instructions and produces inconsistent results.

**Rule: one source of truth.** If information appears in CLAUDE.md and in a knowledge file, one should link to the other. Not repeat it.

**Exception:** Key rules that are critical enough to state in CLAUDE.md AND elaborate in a knowledge file. But the CLAUDE.md version should be concise and link to the detailed version.

---

## Context for Teams

When multiple people use AI on the same project, context alignment becomes critical.

### Shared Context (CLAUDE.md)

- Checked into the repo. Everyone gets the same context.
- Changes go through review like code changes.
- Represents team decisions, not individual preferences.

### Personal Context (memory files, personal instructions)

- Individual preferences (editor settings, communication style)
- Session-specific notes
- Should never contradict shared context

### The Alignment Test

Two people starting a fresh session on the same project should get the same core guidance from CLAUDE.md. If they don't, the shared context has gaps.

---

## Progressive Disclosure

Not everything needs to be in the first 50 lines. Structure context in layers:

1. **Layer 1: CLAUDE.md** — The essentials. What AI must know every session.
2. **Layer 2: Knowledge map** — Pointers to detailed docs. "Read X when working on Y."
3. **Layer 3: Knowledge files** — Detailed reference. Loaded on demand by skills.
4. **Layer 4: Solution library** — Searchable past fixes. Loaded when matching symptoms appear.

Each layer goes deeper. Most sessions only need Layers 1-2. Complex work reaches Layers 3-4.

---

## Anti-patterns

- **The kitchen sink CLAUDE.md.** Everything dumped into one file. Results in a 500-line doc where nothing stands out. Curate ruthlessly.
- **Context without structure.** A wall of text with no headings, tables, or decision trees. Structure is what makes context scannable.
- **Stale context left in place.** "We use framework X" when you migrated to Y six months ago. Stale context actively misleads.
- **Copy-paste context.** Pasting the same information into multiple docs. It will drift. Link instead.
- **No context at all.** Starting every session from scratch. The minimum viable context (CLAUDE.md with conventions and key paths) takes 30 minutes to create and saves hours per week.
