---
title: "feat: evolve visualize into smart html artifact selection instead of default mind maps"
type: plan
date: 2026-04-14
status: approved
brainstorm: null
confidence: high
---

# feat: evolve visualize into smart html artifact generation instead of default mind maps

Refactor the shared `visualize` capability so it generates one polished HTML artifact using the best visual strategy for the user's intent instead of defaulting to a markmap-style mind map for all structured documents.

## Problem Statement

The current cross-agent visualization flow successfully publishes browser-viewable HTML artifacts, but it still overfits one representation: the mind map.

That works well for concise, branching brainstorms. It works much less well for:
- implementation plans with phases, dependencies, and long task descriptions
- architecture docs with multiple sections and explicit contracts
- review outputs with findings, severity, and verdicts
- evidence-heavy documents with long prose blocks, risks, and assumptions

The screenshot from a recent real plan review confirms the issue: the tool produced a technically correct markmap, but the result was visually dense, horizontally sprawling, and cognitively misaligned with the structure of the document. The problem is no longer “can we render HTML?” It is “are we choosing the right visual form?”

A better skill contract is: visualize the artifact in the best form for comprehension, product thinking, or explanation. Mind maps remain one renderer, not the universal default.

## Target End State

- `visualize` becomes a smart visualization entrypoint rather than a mind-map-only wrapper
- the skill classifies both the source artifact and the visualization intent
- the skill generates one polished HTML artifact as the primary output
- that HTML artifact can be published via `share-html` when sharing is configured
- modes are chosen by content type, document shape, and user intent, with a terminal/plain fallback when needed
- markdown remains canonical; HTML remains a derived view layer
- the skill stays portable across Claude Code, Codex, Pi, OpenCode, and manual shell usage

## Scope and Non-Goals

### Scope
- define the new visualization contract, intent families, and mode-selection rules
- define strong default design rules so generated HTML looks polished by default
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

Refactor `visualize` into a four-part system:

1. **Intent classifier**
   - determine whether the user needs a structure visualization, a product/UI mock, or an explainer artifact
   - inspect the user request, source path, frontmatter, headings, and document shape

2. **Artifact classifier**
   - determine whether the source is most likely a brainstorm, plan, architecture doc, review, generic markdown, or product concept

3. **Renderer selector**
   - choose the visualization mode best suited for the intent + artifact
   - initial structure modes:
     - `mindmap` — best for concise branching brainstorms
     - `outline` — best for long, section-heavy docs
     - `roadmap` — best for plans/phases/tasks
     - `architecture` — best for architecture docs and story/ADR overviews
   - future renderer families:
     - `mockup` — static HTML UI/product concepts
     - `explainer` — polished narrative/stakeholder pages
   - if uncertain, default to `outline`, not `mindmap`

4. **HTML generator + publisher**
   - generate one polished HTML artifact for the selected mode
   - apply shared design rules and component/layout conventions
   - publish via `share-html` when configured
   - otherwise provide local HTML and terminal fallback where appropriate

## Decision Rationale

### Why not keep mind maps as the default?

Because diagram type should follow information type. Mind maps are good for ideation trees, not for every structured artifact. Plans and architecture docs often need grouped sections, dependency ordering, summary cards, and collapsible panels more than radial branching.

### Why should the agent choose the mode?

Because asking the user to manually pick a diagram type for every artifact is too much friction for everyday workflow handoffs. The tool should make a strong default choice and let the user override it when desired.

### Why classify intent, not just file type?

Because “visualize” can mean different things: sometimes a structural diagram, sometimes a polished explainer, sometimes a UI mock of a proposed web app. File type alone is not enough. The tool must infer whether the user needs structure, mockup, or explanation.

### Why add explicit design rules?

Because "generate HTML" is not enough for good output. Tools like Vercel v0 succeed by combining strong structural defaults with clear design-system rules. Heart of Gold should do the same: spacing, typography, hierarchy, color restraint, accessibility, and progressive disclosure should be first-class constraints, not left to luck.

### Why default to HTML first for workflow docs?

Because browser space, navigation, typography, and interaction make larger structured artifacts much easier to understand than cramped terminal rendering. The terminal remains valuable as fallback and for quick SSH usage, but it should not anchor the primary design.

### Why keep markdown canonical?

Because markdown is versioned, reviewable, harness-neutral, and durable. HTML is a presentation layer, not the source of truth.

## Visualization Intent Guidance

### Structure
Use when the goal is to understand hierarchy, sequence, dependencies, decisions, or system shape.

Typical fit:
- brainstorms
- plans
- architecture docs
- reviews

### Mockup
Use when the goal is to imagine what a product or UI could look like.

Typical fit:
- new web app concepts
- dashboard ideas
- settings/detail screens
- static prototype-like previews

### Explainer
Use when the goal is to communicate or share an idea clearly with another person.

Typical fit:
- stakeholder summaries
- annotated proposal pages
- comparison layouts
- narrative walk-throughs

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

## Design Rules Baseline

Generated HTML should follow a shared visual doctrine:
- consistent spacing system (8px grid)
- strong typography scale and readable body text
- clear visual hierarchy with one primary focal area per view
- restrained color system with semantic usage
- accessibility-conscious contrast and responsive layout
- progressive disclosure for dense material
- avoid flashy, noisy, or over-decorated AI-generated styling

## Acceptance Criteria

- `visualize` no longer assumes mind map as the universal default
- there is a documented intent-classification and renderer-selection strategy
- there is a documented default design doctrine for generated HTML artifacts
- `visualize` is defined as producing one HTML artifact as its primary result
- there is at least one non-mindmap HTML mode implemented in the first follow-up phase
- plans default to a non-mindmap representation
- architecture docs default to a non-mindmap representation
- brainstorms still support mind maps, but only when they fit the content
- mockup and explainer intents are explicitly accounted for in the architecture even if not fully implemented in the first follow-up phase
- all shared wording remains portable across harnesses
- HTML publish/share still works through the existing share infrastructure

## Implementation Tasks

- [ ] Write an architecture note for smart visualization mode selection and intent families
- [ ] Write a shared design-rules note for generated HTML artifacts
- [ ] Define a small internal visualization mode schema (`mindmap`, `outline`, `roadmap`, `architecture`, later `mockup`, `explainer`)
- [ ] Define intent classification rules (`structure`, `mockup`, `explainer`)
- [ ] Define artifact classification rules using path + frontmatter + heading patterns
- [ ] Refactor `visualize` documentation to describe intent + mode selection rather than generic mind maps
- [ ] Implement a shared polished HTML foundation (layout, tokens, typography, cards, section chrome)
- [ ] Implement a first non-mindmap HTML renderer for plans (`roadmap` or `plan dashboard`)
- [ ] Implement a generic outline HTML renderer for section-heavy markdown
- [ ] Make `visualize` choose intent and mode automatically, with a user override path available later
- [ ] Ensure `visualize` outputs one HTML artifact as the primary result and can hand it to `share-html`
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
- dedicated mockup renderers for app concepts and screens
- dedicated explainer renderers for stakeholder-facing artifacts
