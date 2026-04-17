# Strategy Dashboard Spec

Reference for `/deep-thought:improbable-futures` Phase 5h (structured data in output frontmatter) and Phase 8 (visual brief passed to `/babel-fish:visualize`). Extracted from the SKILL.md to keep the skill file under the 500-line threshold.

The skill file references this knowledge; the skill does not work without it. Do not delete without updating the SKILL.

---

## Why this exists

`/babel-fish:visualize` is a generalist designer. Without explicit direction, it produces "prose with one decorative SVG" and the strategic argument stays locked in paragraphs. The structured data blocks below give the visualizer the raw material for real visual components; the visual brief below tells it exactly what to build.

---

## Structured data blocks (Phase 5h output frontmatter)

The skill's output markdown must carry four YAML blocks in the frontmatter. These are machine-readable — visualizers scan them to build components.

### `comparison_dimensions` — the scannable matrix

4–6 dimensions × 3 futures. Each cell is one short phrase. This is the single most important visual in the artifact — it lets a reader scan the strategic shape of all three futures in ~10 seconds.

**Dimensions must reveal tradeoffs, not describe features.** Good: "Identity you become." "What you leave behind." "What this kills." Bad: "Has a CLI." "Uses Python." "Pricing tiers available."

```yaml
comparison_dimensions:
  - name: "Identity you become"
    future_1: "Software vendor"
    future_2: "Embedded consultant"
    future_3: "Standards author"
  - name: "Revenue model"
    future_1: "Org-layer licensing"
    future_2: "€60k × 6 residencies/year"
    future_3: "Books, talks, reputation"
  - name: "What you leave behind"
    future_1: "A daemon that runs without you"
    future_2: "A customised harness in one codebase"
    future_3: "A spec other people teach from"
  - name: "What this kills"
    future_1: "Workshops, residency, claim to own the spec"
    future_2: "Daemon, scaling, canonical authorship"
    future_3: "Brand dominance, premium-vendor identity"
```

### `timeline_waypoints` — per-future journey

3–4 waypoints per future from "now" to 6 months. Each waypoint is a specific move at a specific time. These power the side-by-side journey timeline visuals.

Waypoints are directions, not milestones. "Ship harness verify MVP" — good. "Sprint 1: scope MVP" — bad.

```yaml
timeline_waypoints:
  future_1:
    - { when: "Week 2",  move: "Ship harness verify CLI to 3 trusted engineers" }
    - { when: "Week 6",  move: "Three skills live" }
    - { when: "Month 3", move: "Cancel remaining workshops" }
    - { when: "Month 6", move: "Petr's letter arrives" }
  future_2: [ ... ]
  future_3: [ ... ]
```

### `research_timing` — the urgency visual

Dated events in the category plus the "YOU ARE HERE" pin and the "WINDOW CLOSES" marker. This makes the timing argument *visible* rather than buried in thesis prose.

The YOU ARE HERE and WINDOW CLOSES markers are mandatory. Without them, the urgency is implicit rather than visual.

```yaml
research_timing:
  - { date: "2025-07", source: "Manus", event: "Context Engineering for AI Agents" }
  - { date: "2025-09", source: "Anthropic", event: "Effective Context Engineering" }
  - { date: "2026-04-02", source: "Böckeler", event: "Harness Engineering defined" }
  - { date: "2026-04-15", source: "ThoughtWorks Radar", event: "Cognitive Debt named" }
  - { date: "2026-04-16", source: "YOU ARE HERE", event: "This map" }
  - { date: "2027-04", source: "WINDOW CLOSES", event: "Spec-maintainer position claimed by someone" }
```

### `naming_landscape` — competing frames (optional)

Positions competing terms/vocabularies against each other so the reader can see where this project's claim fits. Include when the category is mid-naming-fight; skip when the category's vocabulary is settled.

```yaml
naming_landscape:
  - term: "context engineering"
    backers: ["Anthropic", "Manus"]
    scope: "What goes into the model — tokens, memory, tools"
    position: "narrower"
  - term: "harness engineering"
    backers: ["Böckeler / Fowler", "harness-lab claim"]
    scope: "The full loop — context PLUS verification PLUS workflow"
    position: "wider — operationalises context engineering"
```

### `visual_brief` — the directive header

Lists required components so the visualizer knows what to build.

```yaml
visual_brief:
  artifact_family: "strategy-dashboard"
  primary_components:
    - "comparison_matrix"
    - "journey_timelines"
    - "urgency_timeline"
    - "naming_landscape"
  secondary_components:
    - "strategy_thesis_hero"
    - "letter_cards"
    - "agent_command_ctas"
```

---

## The visual brief — pass verbatim to `/babel-fish:visualize`

> Treat this as a strategy dashboard, not a stylised document. The source markdown carries a `visual_brief` frontmatter listing required visual components and structured data blocks (`comparison_dimensions`, `timeline_waypoints`, `research_timing`, `naming_landscape`) that supply the data those components need.
>
> Implement each primary component as a distinct visual object with real visual weight — at least 4 prose-free or prose-light components above the fold:
>
> 1. **Comparison matrix** — render `comparison_dimensions` as a scannable 3-column × N-row grid at the top of the page. Use color/chips/spacing per cell so a reader can compare across futures in 10 seconds. Not a wall of text. This is the single most important visual on the page.
> 2. **Journey timelines** — render `timeline_waypoints` as three side-by-side vertical timelines, each with date markers and one-line moves. Visual rhythm matters more than detail.
> 3. **Urgency timeline** — render `research_timing` as a **vertical** timeline with one event per row (date column + label column). Do not use horizontal timelines with absolute-positioned labels — they collide whenever events cluster within a few weeks. The "YOU ARE HERE" row gets a larger, accent-coloured pin. The "WINDOW CLOSES" row gets the danger colour.
> 4. **Naming landscape** (when present) — render `naming_landscape` as a position map showing where the project's claim fits among competing terms.
>
> Secondary components: render love-letters as styled letter objects (with date, signature, mild paper texture) — not as blockquotes. Render agent-commands as primary CTAs per future, distinctly stylised, copy-able.
>
> Anti-goals: do not produce a document with one SVG at top. Do not put the comparison matrix as bullet points. Do not let prose dominate the layout. The 10-second-scan test: a reader should see the strategic shape (three futures, their key differences, the timing pressure) without reading any paragraph.
>
> Use the agent-authored HTML path. Do not delegate the whole job to the smart-render fallback.

---

## UI quality rules — non-negotiable

These rules exist because past runs failed on each one.

- **Label collisions are bugs, not aesthetics.** If two text labels could overlap at any common viewport (1024 / 1280 / 1440 / 1920px wide), the layout is wrong. Default to vertical layouts for any timeline with ≥4 events or any cluster of events within 8% of axis distance.
- **Absolute positioning is a smell on dense data.** Prefer flex/grid layouts that auto-space. Use absolute positioning only when the visual semantics demand it (e.g., a 2D scatter plot) AND when label collision is mathematically impossible.
- **Every interactive component must work at 760px wide.** Test mentally: stacked single-column on mobile, multi-column on desktop. Add `@media (max-width: 760px)` collapses for every grid.
- **Long labels must wrap or truncate predictably.** No `white-space: nowrap` on labels longer than 30 characters unless you've measured the available space.
- **Color-coded futures must keep their colour everywhere.** Future 1 = accent (purple in default theme). Future 2 = accent-2 (teal). Future 3 = accent-3 (amber). Use these consistently across matrix, timelines, letters, CTAs.
- **The danger colour is reserved for "what this kills" / "deadline" / "risk."** Do not use it decoratively.
- **No more than one hero-scale element above the fold.** The thesis hero IS that element. The comparison matrix can be visually heavy but must not compete for primacy.

---

## Browser self-verification (when tools allow)

If the agent executing the skill has Chrome / browser tooling available (e.g., `mcp__claude-in-chrome__*`, `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`, Playwright, or equivalent), use it to verify the published artifact before declaring success.

After publishing, navigate to the published URL and:

1. **Take a full-page screenshot at 1440px viewport.** Inspect for: overlapping text, broken grid alignment, wild whitespace gaps, components that render as raw markdown, missing visual elements from the brief.
2. **Take a second screenshot at 760px viewport.** Inspect for: horizontal scroll, broken stacking, illegible text, cramped components.
3. **If issues found:** describe the issue in one sentence, edit the artifact HTML, republish, re-verify. Cap iterations at 3 — beyond that, surface to the user with screenshots and ask for direction.
4. **If clean:** report the URL to the user with a one-line verification note ("verified at 1440px and 760px — no collisions, all components render").

If browser tools are not available, state that explicitly in the handoff note ("visual verification skipped — no browser tooling available") so the user knows to eyeball the result.

The cost of an extra round-trip is small. The cost of shipping a broken visual that the user has to point out is large.
