# Smart Visualize Contract

This note defines the next evolution of the shared `visualize` capability.

## Canonical Rule

`visualize` means:
- choose the best visualization form for the artifact
- generate a derived view layer
- prefer browser-viewable HTML for substantial structured workflow docs when sharing is configured
- preserve terminal/plain-text fallback

It does **not** mean:
- always generate a mind map

## Why This Change Exists

The first generation of shareable visualization proved the publish/share path works across coding agents. The next problem is representation quality.

Mind maps are one good representation for branching exploratory content. They are not the best representation for every document. Plans, architecture docs, and review artifacts often benefit more from:
- collapsible structured outlines
- phased plan boards
- decision dashboards
- architecture overviews

## Shared Contract

Shared skills may say:
- “visualize this artifact”
- “generate a shareable visualization”
- “prefer browser-viewable HTML when configured”

Shared skills should not assume:
- mind map specifically
- a Pi-only or Claude-only visualization primitive
- browser access is mandatory

## Renderer Modes

The visualization system should support multiple render modes.

### `mindmap`
Best for concise branching artifacts.

Typical fit:
- brainstorms
- concept trees
- topic overviews

### `outline`
Best for section-heavy markdown where readability and navigation matter more than branching shape.

Typical fit:
- long docs
- reviews
- mixed markdown
- architecture docs with lots of narrative text

### `roadmap`
Best for phased plans, tasks, milestones, and dependency-ordered work.

Typical fit:
- implementation plans

### `architecture`
Best for stories, dependencies, integrations, requirements, and ADR-centered structure.

Typical fit:
- architect outputs
- architecture docs

## Mode Selection Strategy

Mode selection should be deterministic and inspectable.

### Inputs to classification
- file path
- frontmatter (`type`, `title`, etc.)
- heading names
- list/task density
- section names like `Implementation Tasks`, `Acceptance Criteria`, `Risk Analysis`, `Dependencies`, `ADRs`

### Recommended v1 defaults
- `docs/brainstorms/*.md` → `mindmap` when concise/branchy, otherwise `outline`
- `docs/plans/*.md` → `roadmap`
- `*.architecture.md` or architect outputs → `architecture`
- review docs/findings → `outline`
- unknown markdown → `outline`

If classification confidence is weak, default to `outline`.

## Output Model

The source markdown stays canonical.

The visualization output is a derived artifact that may be:
- rendered locally in terminal
- rendered to HTML
- published through `share-html`

## Portability

This contract is shared across coding agents.

- Pi may improve the workflow around it
- Claude Code may invoke it through its plugin system
- Codex and OpenCode may invoke it through shared skills and scripts
- manual shell users may run the same renderer/publish scripts

The visualization mode system must therefore stay harness-neutral.
