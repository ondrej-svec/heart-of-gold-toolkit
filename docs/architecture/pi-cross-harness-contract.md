# Heart of Gold — Shared Skill Portability Contract

This document defines the canonical split between shared Heart of Gold skills and harness-specific enhancements.

## Canonical Rule

**Shared `SKILL.md` files are the source of truth.**

They define:
- workflow phases
- user intent and triggers
- boundaries
- reasoning standards
- expected outputs
- helper scripts, references, and file conventions

Harness-specific behavior must enhance this contract, not replace it.

## Layer Model

### Layer 1 — Shared skill core
Portable across Claude Code, Codex, pi, OpenCode, and other Agent Skills-compatible harnesses.

Belongs here:
- skill frontmatter
- workflow phases
- decision rules
- validation checklist
- output formats
- portable references to scripts/docs/assets

### Layer 2 — Harness adapters
Thin translations that adjust wording, conventions, or packaging for a specific harness.

Belongs here:
- path transforms
- small wording adjustments for slash commands or skill invocation conventions
- packaging/discovery integration

Adapters must not redefine the workflow itself.

### Layer 3 — pi-native enhancement layer
Optional runtime improvements implemented as pi extensions.

Belongs here:
- structured question UI
- progress/status lines
- tool restrictions or workflow guardrails
- richer TUI rendering
- session-aware helpers and commands

pi enhancements must remain optional. The shared skill must still be usable without them.

## Portable Interaction Contract

Shared skills should describe interaction intent in harness-neutral language.

Prefer wording like:
- "Ask one question at a time"
- "Prefer explicit options when there are 2-4 natural choices"
- "Use the harness's structured choice UI if available; otherwise present concise plain-text options"
- "Pause after each question and wait for the user's answer"

Avoid treating a single harness primitive as canonical.

## Anti-Rules

Do **not** make the shared skill depend on:
- Claude-specific tool names such as `AskUserQuestion` as the canonical requirement
- pi-only slash commands or extension commands
- harness-specific task/progress tools as the only tracker
- TUI-only behaviors as the only usable interaction path

If a harness-specific feature exists, shared skills should describe it as an optional realization:
- use the structured UI **when available**
- otherwise fall back to concise plain-text interaction

## Flagship Workflow Policy

For high-value workflows such as `brainstorm`, `plan`, and `work`:
- the shared skill remains canonical
- pi may add a richer UX layer
- Claude Code and Codex must remain viable through the shared skill alone

## Review Checklist

Before shipping a change to a flagship shared skill, verify:
- the workflow still makes sense in plain text
- no harness-only command is required to complete the skill
- any structured UI language has a plain-text fallback
- the skill's outputs remain the same across harnesses
- pi enhancements accelerate the workflow but do not redefine it
