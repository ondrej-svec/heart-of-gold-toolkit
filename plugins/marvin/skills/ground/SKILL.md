---
name: ground
description: >
  Survey a repo and ground externally on the relevant parts of the internet. Local manifest
  scan + CLAUDE.md/AGENTS.md + recent git activity, then external grounding via WebSearch,
  WebFetch, and gh — synthesized into a terse, dated, sourced briefing cached at
  docs/ground/<fingerprint>.md with a 7-day freshness window. Composable: invoked standalone
  or embedded as a pre-flight phase in other skills. Triggers: ground, ground yourself,
  ground myself, survey and ground, pre-flight grounding, research the stack, what's new in.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - WebSearch
  - WebFetch
  - Write
  - AskUserQuestion
---

# Ground

Survey the current repo, then ground externally on what's relevant. Dynamic per-repo — no static config, no curated tech list. The repo IS the configuration.

## Boundaries

**This skill MAY:** read manifests, scan git history, fetch from the web (WebSearch/WebFetch/context7/gh), write the briefing file at `docs/ground/<fingerprint>.md`.
**This skill MAY NOT:** edit code, modify configuration, install dependencies, run anything other than read-only `gh` queries. Briefings are advisory artifacts.

**Designed to run as a subagent.** Web research bloats context fast — keep the heavy fetching in an isolated context and return only the synthesized briefing to the caller.

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Skip the local survey — just web search for the topic" | The repo's stack disambiguates the search. Without it, results are generic. | Wallpaper briefings that don't change Claude's behavior |
| "Fetch everything in parallel, ignore timeouts" | One slow source blocks the briefing. Worse: stalls the calling skill. | /work latency balloons; Ondrej learns to skip /ground |
| "Synthesize without citing sources" | Looks confident, can't be verified, indistinguishable from training-data regurgitation | Defeats the entire point — briefings must be fact-checkable |
| "Always refresh — never trust the cache" | Re-fetches every time, makes cross-session reuse impossible | Token/time cost on every invocation; cache pattern wasted |
| "Generate a long briefing — more detail is better" | Past 1500 tokens the briefing gets ignored as wallpaper | Token waste + behavioral degradation |

---

## Phase 0: Detect Inputs

**Entry:** Skill invoked standalone (slash command or Task call from another skill).

Resolve:
1. **`cwd`** — current working directory. From the invocation context.
2. **`topic`** — what the user (or calling skill) is grounding for. From the invocation arguments. Required; if absent, ask via AskUserQuestion.
3. **`local_only`** — boolean flag. Default `false`. When `true`, skip Phase 4 (external grounding).
4. **`force_refresh`** — boolean flag. Default `false`. When `true`, skip cache check in Phase 3.

**Exit:** Inputs resolved. Ready to survey.

---

## Phase 1: Local Survey

**Entry:** Inputs known.

Scan, in parallel where possible (use Glob + Read in batches):

- **Manifest files** in `cwd` and one level into submodules: `package.json`, `Gemfile`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `composer.json`, `pubspec.yaml`. Extract: detected primary language, top dependencies (max 10), versions.
- **Conventions docs**: `CLAUDE.md`, `AGENTS.md`, `README.md` (first 100 lines). Extract: project mission, conventions, stack callouts.
- **Recent git activity**: `git log -20 --format="%h %s"`, `git status --short`, `git branch --show-current`. Note: recent themes, in-flight files.
- **Open PRs** (if `gh` available and repo has remote): `gh pr list --limit 5 --json title,number,labels`. Note: in-flight work, themes.

If `cwd` has no manifest files AND no `CLAUDE.md`/`AGENTS.md` AND no git history → emit "insufficient local signal for grounding" and exit. Don't fabricate a briefing for a directory with no code.

**Exit:** Local survey complete. Have: detected stack, conventions, recent themes.

---

## Phase 2: Compute Fingerprint

**Entry:** Local survey complete.

Compute the cache key as `<repo-name>__<dominant-tech-or-topic>` (double underscore — single chars like `:` or `-` cause ambiguity with repo names containing hyphens):

1. **`repo-name`**: basename of cwd, or `git remote get-url origin` parsed name if more authoritative.
2. **`dominant-tech-or-topic`**: priority order — pick the *stablest* key that's still accurate, so briefings get reused instead of fragmenting:
   - A single dominant framework detectable from manifests: `nextjs`, `expo`, `rails`, `django`, etc. **This is the default.** It stays stable across a repo's normal development, so the 7-day cache actually gets reused.
   - A topic slug **only** when `topic` names a bounded, durable *sub-area* of the repo (`auth`, `billing`, `payments`, `migrations`) — never a one-off feature or task title. "Add CSV export" is a task, not a sub-area: it grounds under the framework key.
   - Else: `default`.

File name on disk uses the fingerprint verbatim with `.md` suffix. Examples: `quellis-cor__expo.md`, `bobo__default.md`, `harness-lab__auth.md`, `aibility__rails.md`.

**Exit:** Fingerprint computed.

---

## Phase 3: Cache Check

**Entry:** Fingerprint known.

Look for `docs/ground/<fingerprint>.md` in `cwd`. If it exists, read its `last_grounded` frontmatter timestamp.

- If `force_refresh=true` → skip cache, go to Phase 4.
- If file missing or unparseable → go to Phase 4.
- If `last_grounded` is within 7 days of now → **return the cached briefing's summary** (everything below the frontmatter, capped at ≤1500 tokens — the same cap Phase 6 applies to fresh briefings) to the caller; skip Phase 4-6.
- If `last_grounded` is older than 7 days → go to Phase 4 (refresh).

**Exit:** Either cached briefing returned (skill ends here) OR proceed to fetch.

---

## Phase 4: External Grounding

**Entry:** Cache miss or stale.

**If `local_only=true`** → skip this phase; produce a local-only briefing (Phase 5 with no external sources).

Otherwise, route signals from Phase 1 + topic to external tools, in parallel, with a 30-second per-source timeout:

| Signal | Tool | What to fetch |
|---|---|---|
| Each detected library/framework | WebSearch (context7 too, if a context7 MCP server is available in this environment) | Version-aware docs / changelog for the relevant API surface — e.g. `"<lib> <version> docs"`, `"<lib> migration guide"` |
| `topic` mentions "best practice", "current pattern", "recent" | WebSearch | 2-3 queries: `"<tech> best practices 2026"`, `"<tech> migration <version>"`, `"<topic> current approach"` |
| `topic` is an error symptom or "known issue" | gh search + Grep on `docs/solutions/` | Recent issues in tech's GitHub repo + local prior-art matches |
| Specific URL in `topic` | WebFetch | The URL directly |
| Manifest shows a tech with known recent release | WebSearch | `"<tech> changelog <last-30-days>"` or `<tech> release notes` |

If a source times out, log it and continue. If ALL external sources fail → produce a local-only briefing and tag `confidence: low`.

**Exit:** External research collected. Have: per-source raw output + URLs.

---

## Phase 5: Synthesize

**Entry:** Local survey + (optionally) external grounding complete.

Produce a terse briefing. Style rules:

- **Bullet form, not prose.** No paragraphs.
- **Every external claim cites a URL.** If you can't cite, don't claim.
- **Date everything you can.** "As of <ISO date>" not "currently".
- **Cap synthesized summary at ≤1500 tokens** (the version returned to caller). Full file on disk ≤3000.
- **No fabrication.** If a source disagrees with another, say so plainly. If you don't know, say "no recent signal."

Section template (use these exact headings):

```markdown
## Repo State
- <5-10 bullets: detected stack, dominant framework, key dependencies with versions, CLAUDE.md highlights, recent commit themes, in-flight files>

## Recent Ecosystem Changes
- <Per detected tech, only when there's signal: "<tech> v<X>.<Y> released <date>: <one-line>. [URL]">
- <Skip silently when no signal — don't pad>

## Known Footguns
- <gh issues + docs/solutions/ matches relevant to topic or detected stack, with URLs>
- <Skip if none>

## Recommended Further Reading
- <Max 5 URLs, each with a one-line "why">
```

**Exit:** Synthesized briefing ready.

---

## Phase 6: Write + Return

**Entry:** Briefing synthesized.

1. Compose the full file with frontmatter:
   ```yaml
   ---
   last_grounded: <ISO timestamp UTC>
   fingerprint: <fingerprint from Phase 2>
   repo: <repo-name>
   sources_consulted:
     - <URL or "context7:<lib>" or "gh:<owner>/<repo>" or "local:<file>">
   confidence: high | medium | low
   ---
   ```
2. `mkdir -p docs/ground/` if needed.
3. Write to `docs/ground/<fingerprint>.md` (overwriting any stale version).
4. **Return the synthesized summary (everything below the frontmatter, capped at 1500 tokens) to the caller** — not the full file path. The caller wants the content, not the location.

**Exit:** Briefing persisted; summary returned.

---

## Phase 7: Handoff (standalone invocation only)

**Entry:** Skill was invoked as a slash command (not as a Task subagent call from another skill).

Offer next steps. Skip this phase when invoked as a subagent — control returns to the caller.

- Prefer the harness's structured choice UI if available
- Otherwise present plain-text options:
  1. **Continue working** — Use the briefing as context for the next task
  2. **`/compound`** — Promote this briefing into a permanent solution doc at `docs/solutions/`
  3. **`/plan`** — Convert the briefing's insights into an implementation plan
  4. **Done** — Briefing cached at `docs/ground/<fingerprint>.md` for future reuse

---

## Validate

Before returning, verify:

- [ ] Briefing has frontmatter with `last_grounded`, `fingerprint`, `sources_consulted`
- [ ] Every external claim cites a URL
- [ ] Synthesized summary returned to caller is ≤1500 tokens
- [ ] No fabricated facts — if a source wasn't fetched, the section is empty or absent
- [ ] If `local_only=true` or all external sources failed, `confidence: low` is set
- [ ] File written to `docs/ground/<fingerprint>.md`
- [ ] No code was written, no configuration modified

## What Makes This Heart of Gold

- **AI-Augmented Discovery (1.3):** Surfaces relevant external signal automatically by routing repo-state and prompt-intent to the right tool — WebSearch for library docs and current practices, gh for issues, WebFetch for URLs (context7 too, when its MCP server is available).
- **AI Curiosity (1.1):** Explores the repo first, then the world — local context disambiguates the external search. Generic queries return generic results; grounded queries return useful ones.
- **Critical Trust (2.1):** Every claim cites a source. Briefings are fact-checkable artifacts, not authoritative-sounding wallpaper. When sources disagree, the briefing says so.
- **Knowledge Compounding (3.2):** Cached briefings are reusable across sessions, promotable to `/compound` for permanent solutions, and inspectable as real artifacts.
