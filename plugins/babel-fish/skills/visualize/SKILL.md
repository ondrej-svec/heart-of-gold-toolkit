---
name: visualize
description: >
  Create shareable HTML visual artifacts from markdown, plans, architecture docs, brainstorms, and other structured
  content. Prefer browser-viewable HTML first when it will materially improve clarity or sharing; otherwise fall back
  to terminal rendering. Triggers: visualize, mindmap, mind map, show me the structure, draw a map, make this clear,
  make this visual.
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

# Visualize — Babel Fish

Translating structured text into spatial understanding. The job is not to "turn markdown into HTML." The job is to create a visual artifact that helps a human understand the material faster.

## Mission

Create one clear, polished, shareable visual artifact that:
- matches the user's actual need
- feels intentionally designed, not markdown restyled in boxes
- summarizes before detailing
- uses browser HTML as the primary medium for substantial artifacts
- falls back to terminal rendering only when that is the better fit

## Boundaries

- MAY: read files, generate terminal mind maps, generate temporary HTML artifacts, run renderer/share scripts via bash
- MAY NOT: modify project files, create persistent files outside temp/output artifacts, install unrelated packages

## Core Principle

Do **not** mirror the source document structure one-to-one unless the user explicitly wants a document view.

Instead:
1. understand the source
2. decide what the artifact is trying to communicate
3. choose the visual form that best serves that goal
4. compress and reshape the content into a stronger visual story
5. keep raw/source detail secondary or collapsible when possible

HTML should feel like:
- a dashboard
- an explainer
- a roadmap
- an architecture brief
- a deliberate mind map

Not like:
- a markdown page with nicer CSS

## Artifact Families

These are guidance categories for the coding agent. They are not rigid parser outputs.

### `outline`
Use when the user wants:
- document structure
- a reading aid
- a faithful but polished source-oriented view
- a safe fallback when a richer artifact is not justified

### `roadmap`
Use when the source is best understood as:
- phases
- priorities
- sequencing
- workstreams
- execution flow

### `architecture`
Use when the source is best understood as:
- components
- boundaries
- integrations
- decisions
- responsibilities

### `mindmap`
Use only when the content is genuinely:
- concise
- branchy
- idea-oriented
- better understood spatially than sequentially

### `explainer`
Use when the artifact should help another human quickly understand:
- the recommendation
- tradeoffs
- key decisions
- what matters and why

### `mockup`
Use when the user really wants:
- product/UI concept visualization
- believable interface framing
- layout and interaction-oriented representation

## Style Foundations

Apply these defaults unless the user asks for something else:

- calm, high-contrast visual language
- restrained accent usage
- strong hierarchy and generous spacing
- summary-first information architecture
- progressive disclosure for dense detail
- cards, panels, lanes, chips, and callouts over markdown-heavy paragraphs
- readable max-widths for prose
- sticky navigation only when it helps, never as the dominant element
- polished but restrained effects; no gimmicky AI-demo chrome

See also:
- `docs/architecture/visualize-design-rules.md`

## Rules: Do

- Decide the communication goal before choosing the renderer.
- Prefer shareable HTML for substantial workflow artifacts when `share-html` is configured.
- Transform the source into a view model in your head before rendering: summary, priorities, risks, dependencies, decisions, outcomes.
- Lead with a strong first screen: title, one-line mission, key takeaways, and obvious next scan targets.
- Convert dense content into visual units where appropriate: cards, grouped sections, lanes, side panels, chips, callouts, expandable details.
- Use `roadmap` or richer execution-oriented views for plans when that improves understanding.
- Use `architecture` views for system/design-heavy documents.
- Keep raw source detail available, but secondary.
- Briefly explain why you chose the visualization mode when sharing the result.

## Rules: Don't

- Do not treat HTML generation as a markdown restyling task.
- Do not dump long raw paragraphs into large cards as the main UI.
- Do not let the table of contents dominate the page.
- Do not force a mind map onto content that is not naturally branch-shaped.
- Do not use flashy gradients, glass, shadows, or color noise unless they clearly improve hierarchy.
- Do not silently guess when the visualization choice is materially ambiguous.
- Do not create multiple competing artifacts unless the user explicitly asks for comparison.

## Expected Behavior

When invoked, behave like a visual editor, not a format converter.

1. Read the source or infer the source from context.
2. Decide whether the user needs:
   - structure comprehension
   - execution clarity
   - system understanding
   - stakeholder explanation
   - UI/product visualization
3. Choose the best artifact family.
4. If uncertain, ask one concise question.
5. Generate one HTML artifact first when browser rendering will help.
6. Fall back to terminal rendering when browser/share is unavailable or explicitly not wanted.

If the user says "you decide," choose the clearest non-gimmicky artifact, not the fanciest one.

## Uncertainty Protocol

When the best visualization is not clear, do **not** silently guess if the choice would materially affect usefulness.

Ask **one concise question at a time**:
- state the decision in plain language
- offer 2-4 explicit options
- include a recommended option when you have one
- keep option labels outcome-focused, not renderer-jargon-first

Good pattern:
- "Which would help most here?"
- `Roadmap` — show phases, sequencing, and implementation progress
- `Outline` — show the document structure clearly
- `Mind map` — show branching ideas and relationships
- `Architecture view` — show components, boundaries, and decisions

If the harness supports structured choices, use them.
If not, use a short plain-text question such as:

```text
I can visualize this a few different ways. Which would be most useful?
1. Roadmap — phases and tasks
2. Outline — document structure
3. Mind map — branching ideas
4. Architecture view — components and boundaries
```

If the user does not care or says "you decide," choose the safest useful mode:
- default to `outline`
- use `roadmap` for clearly execution-heavy plans
- use `architecture` for clearly system-design-heavy docs
- use `mindmap` only when the artifact is genuinely concise and branchy

## Renderers

Visualization has two implementation layers:
- `scripts/smart-render.js` — renders one HTML artifact using the mode the coding agent chose, with a safe fallback
- `scripts/render-mindmap/index.js` — specialized mind-map renderer for branchy content

**Locations:**
- `scripts/smart-render.js`
- `scripts/render-mindmap/index.js`

To find the smart renderer path:

```bash
# Option 1: Use CLAUDE_PLUGIN_ROOT if available
SCRIPT="${CLAUDE_PLUGIN_ROOT}/skills/visualize/scripts/smart-render.js"

# Option 2: Search for it
SCRIPT=$(find ~/.claude/plugins -path "*/babel-fish/skills/visualize/scripts/smart-render.js" 2>/dev/null | head -1)
```

First run for the mind-map renderer:

```bash
RENDER_DIR=$(dirname "$SCRIPT")/render-mindmap
if [ ! -d "$RENDER_DIR/node_modules" ]; then
  (cd "$RENDER_DIR" && npm install --silent)
fi
```

## Usage

```bash
# Generate a safe default HTML visualization for a markdown file
node "$SCRIPT" path/to/file.md --out /tmp/view.html

# Usually the coding agent should choose the mode from context
node "$SCRIPT" path/to/file.md --mode roadmap --out /tmp/view.html
node "$SCRIPT" path/to/file.md --mode outline --out /tmp/view.html
node "$SCRIPT" path/to/file.md --mode architecture --out /tmp/view.html
node "$SCRIPT" path/to/file.md --mode mindmap --out /tmp/view.html

# Use the specialized mind-map renderer directly when needed
node "$(dirname "$SCRIPT")/render-mindmap/index.js" --html /tmp/map.html path/to/file.md
```

## HTML Share Flow

Use the helper script when the user wants a browser URL and the share server is already configured:

```bash
bash scripts/render-and-share.sh path/to/file.md
```

This script:
1. generates one HTML artifact via the smart renderer
2. uses the mode the coding agent chose (or the renderer's safe default)
3. locates `share-html/scripts/publish.sh`
4. publishes the artifact to the configured local share server
5. prints the publish result so you can return the URL

### Recommended share flow

1. Verify or assume the input markdown is ready.
2. Choose the mode from context.
3. Run:
   ```bash
   bash scripts/render-and-share.sh --mode <chosen-mode> --url-only [file]
   ```
4. Read the returned URL from stdout.
5. Return that URL to the user as the primary result.
6. Briefly explain what was published and why this mode was chosen.

If publishing fails because the share server is not configured, say so clearly and fall back to terminal rendering unless the user wants to stop and run `share-server-setup` first.

## Terminal Rendering

Use terminal rendering when:
- share-html is not configured
- the user explicitly wants terminal-only output
- a quick local structural check is more useful than a browser view

**IMPORTANT:** Output the mind map in the assistant response text, not as raw bash tool output.

Many harness bash panels truncate long output and wrap wide content, breaking alignment. Instead:

1. Locate the renderer script.
2. Ensure dependencies are installed.
3. Run the renderer with `--no-color`, redirect to a temp file:
   ```bash
   node "$SCRIPT" --no-color [file] > /tmp/mindmap-result.txt 2>&1
   ```
4. Read `/tmp/mindmap-result.txt`.
5. Output the contents inside a fenced code block.
6. Clean up:
   ```bash
   rm -f /tmp/mindmap-result.txt
   ```

The default mode is vertical layout — boxes on main branches, compact leaves, about 40 chars wide.

## Required Output Structure

For substantial HTML artifacts, prefer this structure:
- strong title + one-line framing
- summary layer first
- main visual body second
- dense details compressed or collapsible
- source-faithful appendix only if needed

### Plan-oriented artifact target shape
- title + mission
- key stats or scope summary
- priorities / phases / workstreams
- dependencies / risks / acceptance gates
- expandable detail or appendix

### Architecture-oriented artifact target shape
- title + system framing
- major components / boundaries / integrations
- key decisions and tradeoffs
- risks / assumptions
- supporting detail below

### Explainer target shape
- title + recommendation
- why this matters
- options / comparison / decision
- what happens next
- supporting source detail below

## Quality Gates

Before returning a shared HTML result, check mentally:
- Does the first screen explain the artifact in under 10 seconds?
- Does this feel designed, not like markdown with nicer CSS?
- Is hierarchy obvious?
- Is summary ahead of detail?
- Are dense sections compressed into meaningful visual units?
- Is the chosen mode actually appropriate for the content?
- If this is a plan, does it foreground execution rather than document order?
- If this is a brainstorm, is it actually branch-shaped enough for a mind map?

If the answer to several of these is no, reconsider the mode or ask the user.

## Input Formats

### Markdown (primary)
Standard markdown with `#` headings defining hierarchy.

### JSON
Tree structure with `label` and `children`.

## Generating Structure From Context

When visualizing conversation context with no file path:
- brainstorms: root = topic, branches = key themes, leaves = concrete ideas
- plans: root = project, branches = priorities/phases, leaves = tasks
- general discussion: root = main topic, branches = subtopics, leaves = key takeaways

Write the generated markdown to `/tmp/mindmap-XXXXXX.md`, render it, then clean up.

## What Makes This Babel Fish

The Babel Fish translates between languages. This skill translates between modalities — from linear text to spatial understanding, and from private working notes to clear shareable browser artifacts.