---
title: "feat: add cross-agent shareable HTML visualizations for structured workflow docs"
type: plan
date: 2026-04-14
status: approved
brainstorm: null
confidence: high
---

# feat: add cross-agent shareable HTML visualizations for structured workflow docs

Add a portable visualization path that turns brainstorm, plan, and architecture documents into shareable HTML artifacts using the local share server, while keeping markdown documents canonical and preserving terminal/plain-text fallbacks across all supported coding agents.

## Problem Statement

Heart of Gold currently has two adjacent capabilities that are not yet connected well:

1. `babel-fish/visualize` can render terminal-native mind maps from markdown.
2. The new share-server / `share-html` flow can publish HTML/static artifacts to a browser-viewable URL.

The current workflow handoffs in shared flagship skills such as `brainstorm` and `plan` still frame visualization as a terminal-only action. That works, but it is clumsy for deeper visual review, collaboration, or browser-based inspection. At the same time, shareable HTML artifacts should not be Pi-only because the underlying concept is portable across Claude Code, Codex, Pi, OpenCode, and manual shell usage.

The toolkit needs a shared artifact-view pattern: markdown remains canonical, and HTML becomes an optional derived preview that can be published and opened in a browser when sharing infrastructure is configured.

## Target End State

- `visualize` can generate an HTML mind map artifact in addition to terminal output
- when `share-html` infrastructure is present, `visualize` can publish the generated HTML and return a viewer URL
- shared flagship workflows (`brainstorm`, `plan`, and `architect`) can offer a shareable visualization option in their handoffs
- markdown docs remain the source of truth
- if share infrastructure is unavailable, the workflow degrades safely to terminal visualization or plain markdown output
- no harness-specific runtime is required for the shared HTML path

## Scope and Non-Goals

### Scope
- bring the portable share skills into the repo source tree
- connect `visualize` to the share-html publish path
- update flagship workflow handoffs to mention shareable visualization
- keep the visualization/share flow cross-agent and harness-neutral

### Non-Goals
- making browser visualization mandatory
- replacing markdown docs as canonical output
- making this feature Pi-only
- implementing bespoke HTML diagram systems for every workflow in this phase

## Proposed Solution

1. Restore the portable share skills into the repository source tree under Marvin.
2. Add a helper script in `babel-fish/visualize` that:
   - locates the mind-map renderer
   - generates HTML via the existing `--html` path
   - locates `share-html/scripts/publish.sh`
   - publishes the generated artifact and prints the JSON result
3. Update the `visualize` skill contract so it can:
   - render to terminal for quick local inspection
   - generate shareable HTML when the user wants browser viewing or sharing
4. Update the `brainstorm`, `plan`, and `architect` handoffs so they can offer visualization as:
   - shareable HTML when available
   - otherwise the existing terminal mind-map path

## Acceptance Criteria

- `plugins/marvin/skills/share-html` and `share-server-setup` exist in the repo source tree
- `visualize` supports a documented shareable HTML flow using the existing share server contract
- shared skill handoffs mention the shareable visualization path without requiring any one harness
- terminal visualization still works when sharing is not configured
- all documentation remains portable and avoids Pi-only assumptions
