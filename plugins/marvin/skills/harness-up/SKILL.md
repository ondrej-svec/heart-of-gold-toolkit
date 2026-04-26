---
name: harness-up
description: >
  Install harness-engineering doctrine into a repository — short root AGENTS.md,
  docs/ taxonomy (plans, ADRs, solutions), verification rules, and
  project-scoped Claude Code plugins. Works on empty repos (greenfield
  scaffold), existing repos (survey + upgrade), and ports of existing systems.
  Distinct from `marvin:scaffold` (which installs deps and configs); distinct
  from `cc-lab:cc-lab-diagnose` (which observes but doesn't change anything).
  Triggers: harness up, harness this repo, set up AGENTS.md, agent doctrine,
  make this repo agent-ready, init harness, scaffold agent context.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Write
  - Edit
  - AskUserQuestion
  - Agent
---

# Harness Up

A repository that confuses an agent confuses a teammate too. The fix isn't a longer prompt — it's the smallest durable operating surface that points the next pair of hands, human or model, at the next safe move. This skill installs that surface.

## Boundaries

**This skill MAY:** read repo state, ask scoping questions, write doctrine docs (`AGENTS.md`, `CLAUDE.md`, `docs/agents-md-standard.md`, `docs/plans/README.md`, ADR/solutions templates), create `.claude/settings.json` (or merge), record marketplace add commands in a setup section, scaffold empty `docs/` subdirectories with README stubs.

**This skill MAY NOT:** write application source code, write tests, install npm/pnpm/pip dependencies (that is `marvin:scaffold`'s job), run tests or builds, deploy, modify production state, overwrite an existing `AGENTS.md` without merging, replicate `cc-lab:cc-lab-diagnose`'s observation logic.

**You install doctrine. You do not write the application.**

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|--------------|----------|
| "Skip the survey — drop in the template" | Templates bury real conventions; downstream links go dead | AGENTS.md routes agents to files that don't exist; the first session breaks on a 404 |
| "Add every plugin — they're free" | Each plugin loads on every session; cognitive load compounds | Slow starts, abandoned skills, contributors disabling the lot |
| "Empty repo, no brainstorm — fill in later" | Doctrine without mission reads generic | Agent has no routing anchor; produces boilerplate every invocation |
| "Mirror harness-lab 1:1" | That repo is a workshop; yours probably isn't | Sections nobody owns rot into doctrine debt within weeks |

## When NOT to Use

- The repo already has a passing `cc-lab:cc-lab-diagnose` and the user wants a targeted fix, not a doctrine refresh — edit directly instead.
- Application scaffolding (deps, source, tests) is what's actually needed — use `marvin:scaffold`.
- A single section needs a rewrite — edit that file; running the full skill is overkill.
- The repo is a one-off prototype with no team or future maintainers — doctrine is overhead it won't pay back.

---

## Phase 0: Detect Mode

**Entry:** User invoked the skill.

Run `git rev-parse --is-inside-work-tree`, `ls AGENTS.md CLAUDE.md docs package.json pyproject.toml Cargo.toml go.mod .claude`. Classify as **greenfield-blank** (empty), **greenfield-with-concept** (manifest/README, no doctrine), or **brownfield** (`AGENTS.md` or `docs/` already present). Announce in one line. If ambiguous, **AskUserQuestion** (header: "Mode", options matching the three classes plus "let me describe").

**Exit:** Mode known.

---

## Phase 1: Establish the Mission

**Entry:** Mode known.

A doctrine without a mission is filler. **AskUserQuestion** (header: "Mission") with: *clear concept* (describe now), *brainstorm first* (exit to `/deep-thought:brainstorm`, re-invoke this skill once `docs/brainstorms/...` lands), or *it's a port* (describe source — mine it for mission and content shape).

**If brownfield with a strong existing AGENTS.md:** skip — mission is already there. Confirm with the user in one sentence.

**Exit:** Mission captured, or skill exits to brainstorm without writing partial doctrine.

---

## Phase 2: Survey

**Entry:** Mode + mission known.

Inventory without re-implementing `cc-lab:cc-lab-diagnose`: read any existing `AGENTS.md` / `CLAUDE.md` fully (never overwrite blindly), detect framework from `package.json`, note `docs/` shape and `.claude/settings.json` state, note git remote. Produce a one-paragraph "what exists / what's missing / what conflicts" report. If `cc-lab:cc-lab-diagnose` is installed and this is brownfield, suggest running it first for deeper observations.

**Exit:** Inventory surfaced to the user.

---

## Phase 3: Pick the Surfaces

**Entry:** Survey complete.

Use **AskUserQuestion** with `multiSelect: true` (header: "Doctrine", question: "Which doctrine surfaces should I install or upgrade? Pick all that apply.") — defaults reflect the harness-engineering standard:

1. **Root AGENTS.md** — operating map: mission, read-first, task routing, verification, done — *recommended for every repo*
2. **CLAUDE.md mirror** — single-line `@AGENTS.md` for tools that look there
3. **`docs/agents-md-standard.md`** — what AGENTS.md commits to (the 12 PASS/FAIL checks)
4. **`docs/plans/`** — plan lifecycle (`approved | in_progress | complete | superseded | captured`) with archive rules
5. **`docs/adr/`** — architecture decision records template
6. **`docs/solutions/`** — searchable problem→fix log, paired with `marvin:compound`
7. **`docs/agent-ui-testing.md`** — Chrome DevTools MCP loop for UI-bearing repos
8. **`.claude/settings.json`** — permission allowlist defaults, optional lint-on-save hook
9. **Subtree AGENTS.md** for one major directory (ask which)

Then **AskUserQuestion** with `multiSelect: true` (header: "Plugins", question: "Which Claude Code plugins should be project-scoped? Project-scoped means anyone cloning the repo gets them, regardless of their global setup."):

1. **heart-of-gold-toolkit** — deep-thought, marvin, babel-fish, guide, quellis
2. **cc-lab** — `/cc-lab-diagnose` for ongoing setup checks
3. **compound-engineering** — review/plan/work agents
4. **vercel** — for Next.js / Vercel-hosted projects (auto-suggest if Next.js detected)
5. **chrome-devtools-mcp** — required by the UI-testing surface above
6. **None** — leave plugin choice to each developer's global config

Then **AskUserQuestion** with `multiSelect: false` (header: "Scope", question: "Where should plugin selections live?"):

1. **Project — `.claude/settings.json`** (recommended; collaborators get the same setup)
2. **User — each developer manages their own `~/.claude`**
3. **Both — install at project scope, document fallback in AGENTS.md**

**Exit:** Decisions captured.

---

## Phase 4: Generate

**Entry:** Decisions captured.

Source templates from `../knowledge/harness-doctrine.md` if it exists; otherwise synthesize from the reference repos (`~/projects/Bobo/harness-lab/AGENTS.md`, `docs/agents-md-standard.md`, `docs/plan-lifecycle-standard.md`). Substitute mission and stack from Phases 1-2. Cap AGENTS.md at ~180 lines (the `map_not_dump` heuristic).

Write in this order — each step depends on the prior:

1. `AGENTS.md` — root operating map; every other doc routes back to it
2. `CLAUDE.md` mirror (`@AGENTS.md`) if selected
3. `docs/` skeleton — `plans/`, `adr/`, `solutions/` as empty directories with `README.md` stubs that carry only lifecycle rules
4. `docs/agents-md-standard.md` if selected
5. `.claude/settings.json` — last, references everything above. Merge into an existing file when present; never replace it

For the AGENTS.md drafting (root and any subtree), use **Agent** with `subagent_type: harness-author` — the dedicated agent loads the harness-engineering standard and verifies its output against the 12-check rubric before returning. Pass mission, target path, and the survey output. The skill writes the body to disk; the agent does not write files itself. For unrelated tasks beyond doctrine adaptation (e.g. content scraping a port source), fall back to `general-purpose`.

Plugin scoping: for project scope, merge `.claude/settings.json`. Marketplace `add` commands are interactive in Claude Code — record them as a "First-time setup" section in `AGENTS.md` for collaborators to run once on clone.

**Exit:** Files written, no source code touched.

---

## Phase 5: Verify and Handoff

**Entry:** Files written.

Print a manifest grouped by surface — every file created or modified, with a one-line purpose. Suggest a single branch (`harness-up/scaffold`) so the doctrine lands as one reviewable diff. Then **AskUserQuestion** (header: "Next"): *done — commit*, *run `/cc-lab:cc-lab-diagnose`* (if cc-lab was selected), *adjust a section*, *generate a subtree AGENTS.md*, *open a brainstorm for an unfilled section*.

**Exit:** Manifest delivered, next move chosen.

---

## Validate

Before delivering, verify each:

- [ ] No source files, tests, or dependency installs were touched
- [ ] No existing file was overwritten without a merge step
- [ ] Root `AGENTS.md` is ≤ 180 lines (`map_not_dump` heuristic)
- [ ] All markdown links inside written docs are repo-relative
- [ ] Plugin scope matches the user's Phase 3 selection — not silently both
- [ ] Brownfield path preserved existing team-specific sections verbatim
- [ ] Brainstorm-route exits left no partial doctrine on disk
- [ ] `harness-author` self-verification passed before its draft was written

## Knowledge References

- `../agents/harness-author.md` — dedicated drafting agent dispatched in Phase 4 for AGENTS.md generation. Already loads the harness-engineering rubric.
- `../knowledge/harness-doctrine.md` — AGENTS.md shape, plan lifecycle, ADR template, solutions format. Create on first run if missing.
- `../knowledge/plugin-catalog.md` — marketplaces, install commands, project-vs-user scoping rules. Create on first run if missing.
- Reference repos for templates: `~/projects/Bobo/harness-lab/AGENTS.md`, `~/projects/Bobo/harness-lab/docs/agents-md-standard.md`, `~/projects/Bobo/harness-lab/docs/plan-lifecycle-standard.md`.
- Sibling skill: `cc-lab:cc-lab-diagnose` — use it to *observe* before this skill *changes*.

## What Makes This Heart of Gold

The smallest durable surface, not the longest prompt. Surveys before generating. Matches harness-engineering vocabulary exactly so `/cc-lab-diagnose` and `marvin:compound` work the day after install.
