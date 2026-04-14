---
name: visualize
description: >
  Render mind maps and tree visualizations from markdown. Prefer shareable HTML first for brainstorms, plans,
  architecture docs, and other structured workflow artifacts when share-html infrastructure is configured;
  otherwise fall back to terminal output for quick local inspection. Works on markdown files or any structured
  content. Triggers: visualize, mindmap, mind map, show me the structure, draw a map.
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

# Visualize — Babel Fish

Translating structured text into spatial understanding. Because walls of text hide structure that pictures reveal.

## Boundaries

- MAY: read files, generate terminal mind maps, generate temporary HTML artifacts, run renderer/share scripts via bash
- MAY NOT: modify project files, create persistent files outside temp/output artifacts, install unrelated packages

## The Renderers

Visualization now has two layers:
- `scripts/smart-render.js` — renders one HTML artifact using the mode the coding agent chose (or a safe fallback)
- `scripts/render-mindmap/index.js` — specialized mind-map renderer for branchy content

**Locations:**
- `scripts/smart-render.js`
- `scripts/render-mindmap/index.js`

**To find the smart renderer path**, locate it by searching for `smart-render.js`:
```bash
# Option 1: Use CLAUDE_PLUGIN_ROOT if available
SCRIPT="${CLAUDE_PLUGIN_ROOT}/skills/visualize/scripts/smart-render.js"

# Option 2: Search for it
SCRIPT=$(find ~/.claude/plugins -path "*/babel-fish/skills/visualize/scripts/smart-render.js" 2>/dev/null | head -1)
```

**First run:** If `node_modules/` doesn't exist in the mind-map renderer directory, run `npm install` there first:
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

### Shareable HTML flow

Use the helper script when the user wants a browser URL and the share server is already configured. It now generates one polished HTML artifact first, then publishes it:

```bash
bash scripts/render-and-share.sh path/to/file.md
```

This script:
1. generates one HTML artifact via the smart renderer
2. uses the mode the coding agent chose (or the renderer's safe default)
3. locates `share-html/scripts/publish.sh`
4. publishes the artifact to the configured local share server
5. prints the publish result so you can return the URL

## Rendering Behavior

- **Auto-depth:** If no `--depth` is specified, the renderer tries depths 3, 2, 1 and picks the deepest that fits the terminal width.
- **Pruning:** Long labels are truncated with `…`. Nodes with many children show the first few plus `+N more`.
- **Colors** (via ANSI, visible in Claude Code bash output):
  - Root: bold white on blue
  - Depth 1: bold cyan
  - Depth 2: green
  - Depth 3: yellow
  - Depth 4+: dim

## Phase 0 — Determine What to Visualize

First decide whether this should be a browser/shareable HTML view or a quick terminal view.

**Prefer browser/shareable HTML first when:**
- the source is a brainstorm, plan, architecture doc, or other structured workflow artifact
- the user asks to open it in a browser
- the user wants to share the result with another person or device
- the structure is large enough that browser navigation is more useful than terminal rendering
- `share-html` is configured

**Prefer terminal rendering when:**
- share-html is not configured
- the user explicitly wants a quick terminal-only look
- the environment is SSH-heavy and the browser/share path is not requested

When invoked as `/visualize [path]`:

**If a file path is provided:**
1. Read the file
2. Decide what kind of visual artifact would help most from context
3. If confidence is high enough, choose the mode and generate/share HTML first
4. If confidence is not high enough, ask the user which direction would help most
5. If sharing is unavailable or the user explicitly wants terminal output, fall back appropriately

**If no path is provided:**
1. Check if there's a recent brainstorm or plan document in the conversation context
2. If yes: use that document's path
3. If no: summarize the current conversation topic into a markdown structure with headings, write it to a temp file, then render

**If the user says "visualize this" or "show me a mind map":**
1. Look at what was just discussed or created
2. Generate an appropriate markdown structure
3. Render it

## Phase 1 — Render or Share

### Path A — Terminal rendering

**IMPORTANT: Output the mind map in the assistant response text, NOT as raw bash tool output.**

Many harness bash panels truncate long output and wrap wide content, breaking alignment. Instead:

1. Locate the renderer script (see above)
2. Ensure dependencies are installed
3. Run the renderer with `--no-color`, redirect to a temp file:
   ```bash
   node "$SCRIPT" --no-color [file] > /tmp/mindmap-result.txt 2>&1
   ```
4. Read `/tmp/mindmap-result.txt`
5. Output the contents inside a markdown fenced code block in your response text
6. Clean up: `rm -f /tmp/mindmap-result.txt`

The default mode is **vertical layout** — boxes on main branches, compact leaves, ~40 chars wide.

### Path B — Shareable HTML

For substantial artifacts, prefer this path first when `share-html` is configured.

The coding agent should choose the mode from context. Toolkit guidance:
- plans often fit `roadmap` or `outline`
- architecture docs often fit `architecture` or `outline`
- concise branchy brainstorms may fit `mindmap`
- product/UI concepts may fit `mockup`
- stakeholder-friendly summaries may fit `explainer`

If uncertain, ask the user using the harness's structured choice UI when available; otherwise present concise plain-text options.

1. Verify or assume the input markdown is ready
2. Run:
   ```bash
   bash scripts/render-and-share.sh --mode <chosen-mode> --url-only [file]
   ```
3. Read the returned URL from stdout
4. Return that URL to the user as the primary result
5. Briefly explain what was published and why this mode was chosen

If you need more detail for debugging, you may run the helper without `--url-only` and inspect the returned JSON.

If publishing fails because the share server is not configured, say so clearly and fall back to terminal rendering unless the user wants to stop and run `share-server-setup` first.

**For shell usage** (not through assistant panels): terminal rendering can use ANSI colors, or `--horizontal` for the wide spatial layout.

## Current HTML modes

- `outline` — safe default for dense or unknown structured docs
- `roadmap` — useful for plans and phased execution views
- `architecture` — useful for architecture docs and architect outputs
- `mindmap` — useful for concise branchy artifacts where it truly helps
- `mockup` — reserved for future product/UI concept views
- `explainer` — reserved for future stakeholder/narrative views

## Phase 2 — Offer Next Steps

After rendering or sharing, briefly note:
- for terminal mode: "Use `--depth N` to see more/less detail"
- for terminal mode: "Use `--width N` to fit a different terminal size"
- for shared HTML: return the final browser URL as the main result and say whether it is local-only or publicly reachable on the user's tailnet
- if publishing failed due to missing share infrastructure: suggest `share-server-setup`
- if the source was a brainstorm/plan/architecture doc, offer to continue the workflow (e.g., proceed to `/plan`, `/work`, or implementation)

## Input Formats

### Markdown (primary)
Standard markdown with `#` headings defining hierarchy:
```markdown
# Root Topic
## Branch A
- Detail 1
- Detail 2
## Branch B
### Sub-branch
- Detail 3
```

### JSON
Tree structure with `label` and `children`:
```json
{
  "label": "Root",
  "children": [
    { "label": "Branch A", "children": [] },
    { "label": "Branch B", "children": [
      { "label": "Sub-branch", "children": [] }
    ]}
  ]
}
```

## Generating Structure from Context

When visualizing conversation context (no file path), create a markdown structure that captures:

**For brainstorm content:**
- Root = topic
- Branches = key decisions or themes
- Leaves = specific choices or details

**For plan content:**
- Root = project name
- Branches = phases
- Leaves = tasks within each phase

**For general discussion:**
- Root = main topic
- Branches = subtopics discussed
- Leaves = key points or conclusions

Write the generated markdown to `/tmp/mindmap-XXXXXX.md`, render it, then clean up.

## What Makes This Babel Fish

The Babel Fish translates between languages. This skill translates between *modalities* — from linear text to spatial structure, and now from private working docs to shareable browser views. It makes the invisible visible: the hierarchy, the relationships, the gaps that only show up when you see the shape of the thinking.
