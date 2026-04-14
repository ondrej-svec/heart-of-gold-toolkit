# Smart Visualize Contract

This note defines the next evolution of the shared `visualize` capability.

## Canonical Rule

`visualize` means:
- choose the best visual artifact for the user's intent
- generate one derived HTML artifact as the primary result
- prefer browser-viewable HTML for substantial structured workflow docs and visual concepts when sharing is configured
- preserve terminal/plain-text fallback where useful

It does **not** mean:
- always generate a mind map
- only handle document diagrams

## Why This Change Exists

The first generation of shareable visualization proved the publish/share path works across coding agents. The next problem is representation quality.

Mind maps are one good representation for branching exploratory content. They are not the best representation for every document. Plans, architecture docs, review artifacts, and product concepts often benefit more from:
- collapsible structured outlines
- phased plan boards
- decision dashboards
- architecture overviews
- polished explainer pages
- static HTML mockups

## Shared Contract

Shared skills may say:
- “visualize this artifact”
- “generate a shareable visualization”
- “prefer browser-viewable HTML when configured”
- “show what this could look like”

Shared skills should not assume:
- mind map specifically
- a Pi-only or Claude-only visualization primitive
- browser access is mandatory

## Intent Families

The visualization system should classify the request by intent before choosing a renderer.

### `structure`
For understanding hierarchy, sequence, dependencies, and system shape.

Typical fit:
- brainstorms
- plans
- architecture docs
- reviews

### `mockup`
For showing what a UI, product surface, or experience could look like.

Typical fit:
- new web app concepts
- dashboards
- settings/detail pages
- static prototype-like previews

### `explainer`
For communicating an idea clearly to another person via a polished shareable page.

Typical fit:
- stakeholder summaries
- comparison views
- proposal walkthroughs
- narrative artifact summaries

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

### `mockup`
Best for static HTML concept screens and product surface previews.

### `explainer`
Best for polished narrative summary pages and stakeholder-facing views.

## Mode Selection Strategy

Mode selection should be deterministic and inspectable.

### Inputs to classification
- user wording and intent cues
- file path
- frontmatter (`type`, `title`, etc.)
- heading names
- list/task density
- section names like `Implementation Tasks`, `Acceptance Criteria`, `Risk Analysis`, `Dependencies`, `ADRs`

### Recommended v1 defaults
- explicit UI/product concept request → `mockup`
- explicit stakeholder/share/explain request → `explainer`
- `docs/brainstorms/*.md` → `mindmap` when concise/branchy, otherwise `outline`
- `docs/plans/*.md` → `roadmap`
- `*.architecture.md` or architect outputs → `architecture`
- review docs/findings → `outline`
- unknown markdown → `outline`

If classification confidence is weak, default to `outline`.

## Design Rules Baseline

Generated HTML should follow a strong default visual doctrine:
- consistent spacing grid
- readable typography scale
- clear hierarchy and restrained color usage
- responsive layout and accessible contrast
- progressive disclosure for dense material
- avoid overly flashy or cluttered AI-generated styling

The system should behave more like a good design system than a raw renderer.

## Output Model

The source markdown stays canonical.

The visualization output is one derived HTML artifact that may then be:
- published through `share-html`
- returned as a local file path if publishing is unavailable
- accompanied by terminal/plain fallback where needed

## Portability

This contract is shared across coding agents.

- Pi may improve the workflow around it
- Claude Code may invoke it through its plugin system
- Codex and OpenCode may invoke it through shared skills and scripts
- manual shell users may run the same renderer/publish scripts

The visualization mode system must therefore stay harness-neutral.
