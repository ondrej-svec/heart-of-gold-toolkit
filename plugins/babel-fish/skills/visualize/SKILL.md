---
name: visualize
description: >
  Render mind maps and tree visualizations directly in the terminal using Unicode box-drawing characters
  with ANSI colors. Works over SSH, no browser needed. Use on brainstorm docs, plan docs, markdown files,
  or any structured content. Triggers: visualize, mindmap, mind map, show me the structure, draw a map.
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

# Visualize — Babel Fish

Translating structured text into spatial understanding. Because walls of text hide structure that pictures reveal.

## Boundaries

- MAY: read files, generate mind maps, run the renderer script via bash
- MAY NOT: modify files, create new files (except temp files in /tmp), install packages

## The Renderer

A Node.js script that converts markdown headings into colored, spatial Unicode mind maps.

**Location:** `scripts/render-mindmap/index.js` (relative to this skill's directory)

**To find the script path**, locate it by searching for `render-mindmap/index.js`:
```bash
# Option 1: Use CLAUDE_PLUGIN_ROOT if available
SCRIPT="${CLAUDE_PLUGIN_ROOT}/skills/visualize/scripts/render-mindmap/index.js"

# Option 2: Search for it
SCRIPT=$(find ~/.claude/plugins -path "*/babel-fish/skills/visualize/scripts/render-mindmap/index.js" 2>/dev/null | head -1)
```

**First run:** If `node_modules/` doesn't exist in the renderer directory, run `npm install` there first:
```bash
RENDER_DIR=$(dirname "$SCRIPT")
if [ ! -d "$RENDER_DIR/node_modules" ]; then
  (cd "$RENDER_DIR" && npm install --silent)
fi
```

## Usage

```bash
# Render a markdown file
node "$SCRIPT" path/to/file.md

# With options
node "$SCRIPT" --no-color path/to/file.md    # plain Unicode, no ANSI
node "$SCRIPT" --width 120 path/to/file.md   # constrain to 120 columns
node "$SCRIPT" --depth 2 path/to/file.md     # limit tree depth
node "$SCRIPT" --json path/to/data.json      # JSON tree input

# Pipe markdown
echo "# Root\n## Branch A\n## Branch B" | node "$SCRIPT"
```

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

When invoked as `/visualize [path]`:

**If a file path is provided:**
1. Read the file
2. Render it directly with the mind map renderer

**If no path is provided:**
1. Check if there's a recent brainstorm or plan document in the conversation context
2. If yes: use that document's path
3. If no: summarize the current conversation topic into a markdown structure with headings, write it to a temp file, then render

**If the user says "visualize this" or "show me a mind map":**
1. Look at what was just discussed or created
2. Generate an appropriate markdown structure
3. Render it

## Phase 1 — Render

**IMPORTANT: Output the mind map in Claude's response text, NOT as bash tool output.**

Claude Code's bash output panel truncates long output and wraps wide content, breaking alignment. Instead:

1. Locate the renderer script (see above)
2. Ensure dependencies are installed
3. Run the renderer with `--no-color`, redirect to a temp file:
   ```bash
   node "$SCRIPT" --no-color [file] > /tmp/mindmap-result.txt 2>&1
   ```
4. Read `/tmp/mindmap-result.txt`
5. Output the contents inside a markdown fenced code block in your response text
6. Clean up: `rm /tmp/mindmap-result.txt`

The default mode is **vertical layout** — boxes on main branches, compact leaves, ~40 chars wide. Fits perfectly in Claude Code's response area.

**For shell usage** (not through Claude Code): Run without `--no-color` for ANSI colors, or use `--horizontal` for the wide spatial layout.

## Phase 2 — Offer Next Steps

After rendering, briefly note:
- "Use `--depth N` to see more/less detail"
- "Use `--width N` to fit a different terminal size"
- If the source was a brainstorm/plan, offer to continue the workflow (e.g., proceed to `/plan` or `/work`)

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

The Babel Fish translates between languages. This skill translates between *modalities* — from linear text to spatial structure. It makes the invisible visible: the hierarchy, the relationships, the gaps that only show up when you see the shape of the thinking.
