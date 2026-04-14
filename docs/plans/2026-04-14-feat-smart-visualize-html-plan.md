---
title: "feat: evolve visualize into smart html artifact selection instead of default mind maps"
type: plan
date: 2026-04-14
status: approved
brainstorm: null
confidence: high
---

# feat: evolve visualize into smart html artifact selection instead of default mind maps

Refactor the shared `visualize` capability so it chooses the best HTML representation for the artifact being viewed instead of defaulting to a markmap-style mind map for all structured documents.

## Problem Statement

The current cross-agent visualization flow successfully publishes browser-viewable HTML artifacts, but it still overfits one representation: the mind map.

That works well for concise, branching brainstorms. It works much less well for:
- implementation plans with phases, dependencies, and long task descriptions
- architecture docs with multiple sections and explicit contracts
- review outputs with findings, severity, and verdicts
- evidence-heavy documents with long prose blocks, risks, and assumptions

The screenshot from a recent real plan review confirms the issue: the tool produced a technically correct markmap, but the result was visually dense, horizontally sprawling, and cognitively misaligned with the structure of the document. The problem is no longer “can we render HTML?” It is “are we choosing the right visual form?”

A better skill contract is: visualize the artifact in the best form for comprehension. Mind maps remain one renderer, not the universal default.

## Target End State

- `visualize` becomes a smart visualization entrypoint rather than a mind-map-only wrapper
- the skill classifies the source artifact and chooses an appropriate visualization mode
- HTML becomes the primary visualization output for structured workflow docs when sharing is configured
- modes are chosen by content type and document shape, with a terminal/plain fallback when needed
- markdown remains canonical; HTML remains a derived view layer
- the skill stays portable across Claude Code, Codex, Pi, OpenCode, and manual shell usage

## Scope and Non-Goals

### Scope
- define the new visualization contract and mode-selection rules
- support at least a small initial set of visualization modes
- preserve share-server / `share-html` integration
- keep terminal fallback intact
- adapt workflow handoffs to reference a smarter visualization capability rather than “mind map” specifically

### Non-Goals
- replacing markdown as the source of truth
- building a full generic dashboarding platform in this phase
- introducing harness-specific visualization logic into shared skills
- solving every document type at once

## Proposed Solution

Refactor `visualize` into a three-part system:

1. **Artifact classifier**
   - determine whether the source is most likely a brainstorm, plan, architecture doc, review, or generic markdown
   - inspect path, frontmatter, headings, and document shape

2. **Renderer selector**
   - choose the visualization mode best suited for the document
   - initial modes:
     - `mindmap` — best for concise branching brainstorms
     - `outline` — best for long, section-heavy docs
     - `roadmap` — best for plans/phases/tasks
     - `architecture` — best for architecture docs and story/ADR overviews
   - if uncertain, default to `outline`, not `mindmap`

3. **Publisher / presenter**
   - generate HTML for the selected mode
   - publish via `share-html` when configured
   - otherwise provide terminal fallback where appropriate

## Decision Rationale

### Why not keep mind maps as the default?

Because diagram type should follow information type. Mind maps are good for ideation trees, not for every structured artifact. Plans and architecture docs often need grouped sections, dependency ordering, summary cards, and collapsible panels more than radial branching.

### Why should the agent choose the mode?

Because asking the user to manually pick a diagram type for every artifact is too much friction for everyday workflow handoffs. The tool should make a strong default choice and let the user override it when desired.

### Why default to HTML first for workflow docs?

Because browser space, navigation, typography, and interaction make larger structured artifacts much easier to understand than cramped terminal rendering. The terminal remains valuable as fallback and for quick SSH usage, but it should not anchor the primary design.

### Why keep markdown canonical?

Because markdown is versioned, reviewable, harness-neutral, and durable. HTML is a presentation layer, not the source of truth.

## Visualization Mode Guidance

### Mind map
Use when:
- the document is exploratory
- headings are short and branch-like
- the value comes from seeing concept decomposition

Typical fit:
- brainstorms
- idea trees
- lightweight topic overviews

### Outline dashboard
Use when:
- the document is long and section-heavy
- the value comes from navigability and section summaries
- there is too much prose for a clean mind map

Typical fit:
- long brainstorms
- architecture docs
- review docs
- mixed markdown

### Roadmap / phased plan view
Use when:
- the artifact is a plan
- sections imply sequence, phases, or task grouping
- acceptance criteria, risks, and assumptions need separation

Typical fit:
- `docs/plans/*.md`

### Architecture overview
Use when:
- the artifact describes stories, ADRs, dependencies, integrations, or structure
- the user needs a system-level overview rather than a branch map

Typical fit:
- architecture docs
- architect outputs

## Acceptance Criteria

- `visualize` no longer assumes mind map as the universal default
- there is a documented classification and renderer-selection strategy
- there is at least one non-mindmap HTML mode implemented in the first follow-up phase
- plans default to a non-mindmap representation
- architecture docs default to a non-mindmap representation
- brainstorms still support mind maps, but only when they fit the content
- all shared wording remains portable across harnesses
- HTML publish/share still works through the existing share infrastructure

## Implementation Tasks

- [ ] Write an architecture note for smart visualization mode selection
- [ ] Define a small internal visualization mode schema (`mindmap`, `outline`, `roadmap`, `architecture`)
- [ ] Define artifact classification rules using path + frontmatter + heading patterns
- [ ] Refactor `visualize` documentation to describe mode selection rather than generic mind maps
- [ ] Implement a first non-mindmap HTML renderer for plans (`roadmap` or `plan dashboard`)
- [ ] Implement a generic outline HTML renderer for section-heavy markdown
- [ ] Make `visualize` choose mode automatically, with a user override path available later
- [ ] Keep terminal fallback for users who explicitly want terminal output or lack share configuration
- [ ] Update workflow handoffs to talk about “best visualization” instead of implicitly equating visualization with mind maps
- [ ] Add fixture-style examples for mode selection decisions

## Risks

### Risk 1: Over-smart mode selection picks the wrong renderer
Mitigation: keep heuristics simple, deterministic, and inspectable. Prefer safe defaults like `outline` over flashy but brittle choices.

### Risk 2: HTML renderers become too bespoke per skill
Mitigation: build a small reusable renderer set driven by document structure, not one-off templates for every workflow.

### Risk 3: Shared skill wording drifts toward implementation detail
Mitigation: keep shared docs focused on user-visible outcomes (“shareable visualization”, “best view for this artifact”) rather than renderer internals.

## Future Follow-Ups

- user-forced mode overrides (`mode=mindmap`, `mode=roadmap`, etc.)
- richer review/finding dashboards
- architecture-specific visual layouts inspired by C4-style summaries
- transcript- or conversation-derived visual summaries
