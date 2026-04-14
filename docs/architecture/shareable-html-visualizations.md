# Shareable HTML Visualizations

This note defines how Heart of Gold workflows produce optional browser-viewable visualization artifacts without breaking cross-agent portability.

## Canonical Rule

Markdown documents remain canonical.

For workflows such as `brainstorm`, `plan`, and `architect`:
- the markdown document is the source of truth
- HTML is a derived preview artifact
- the preview may be published through the local share server when configured

## Why This Exists

Terminal visualization is useful for quick inspection, especially over SSH. But some workflow artifacts become significantly more useful in a browser:
- larger mind maps
- decision structures
- phased plans
- architecture/story overviews
- artifacts intended to be opened on another device or shared with another person

A shareable HTML path is a better portability layer than a harness-specific TUI because it works across Claude Code, Codex, Pi, OpenCode, and manual shell flows.

## Layering

### Shared skill layer
Shared skills may:
- offer a visualization/share step in their handoff
- prefer a shareable HTML preview when sharing infrastructure is configured
- fall back to terminal visualization or plain markdown when it is not

Shared skills may not:
- require browser access
- require one specific harness
- make HTML the only output

### Share infrastructure layer
The portable `share-html` and `share-server-setup` skills provide:
- local share server setup/adoption
- static HTML/site publishing
- browser-viewable URLs

### Harness enhancement layer
Harnesses may improve UX around the shared flow, but the flow itself remains portable.

## Current v1 Realization

- `babel-fish/visualize` remains the shared visualization entrypoint
- terminal render remains the default quick-inspection path
- HTML mind maps are generated through the existing renderer's `--html` mode
- publish happens through `marvin/share-html`
- workflow handoffs in `brainstorm`, `plan`, and `architect` may suggest `/babel-fish:visualize {path}` and let the skill choose between terminal or shareable output based on user intent and environment

## Portability Rule

The wording should stay portable:
- “shareable HTML view”
- “browser-viewable artifact”
- “when sharing is configured”

Avoid embedding Pi-only runtime concepts into the shared visualization contract.
