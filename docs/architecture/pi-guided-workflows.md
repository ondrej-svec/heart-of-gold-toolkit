# Pi Guided Workflows

This note defines the Pi-only enhancement layer for guided Heart of Gold workflows.

## Purpose

Heart of Gold shared skills remain portable and usable in plain text. Pi may add richer interaction for workflows that naturally benefit from structured questions, explicit option selection, and focused answer entry.

The first guided workflows are:
- `brainstorm`
- `plan`

## Canonical Boundary

The shared `SKILL.md` files remain the source of truth for:
- workflow phases
- reasoning behavior
- expected outputs
- plain-text fallback interaction

The Pi extension may:
- detect when the user entered a supported workflow
- inspect the last assistant response
- upgrade a high-confidence question into interactive UI
- send the chosen answer back as a normal user message

The Pi extension may not:
- redefine the workflow
- require Pi-specific primitives in shared skills
- change the semantic meaning of the assistant's question
- auto-answer on the user's behalf

## Activation Rules

Guided enhancement only activates for known Heart of Gold workflow entrypoints.

Currently supported:
- `/skill:brainstorm`
- `/brainstorm`
- `/deep-thought:brainstorm`
- `/deep-thought-brainstorm`
- `/skill:plan`
- `/plan`
- `/deep-thought:plan`
- `/deep-thought-plan`

Guided enhancement resets when the user enters a different slash command outside the supported set.

## Prompt Kinds

The first implementation supports only conservative prompt kinds.

### 1. Single choice

Used when the assistant clearly presents 2-4 explicit options, for example:

- numbered options
- short bullet options
- next-step handoff menus

Pi realization:
- `ctx.ui.select(...)`

Fallback:
- shared skill already remains usable in plain text

### 2. Focused free-text question

Used when the assistant asks one clearly scoped question and expects a short text answer.

Pi realization:
- `ctx.ui.editor(...)`

Fallback:
- user can answer in ordinary text

## Extraction Strategy

The current implementation uses conservative parsing heuristics rather than a model-backed extractor.

This keeps the first version simple and predictable:
- explicit option lists become `single_choice`
- the last focused question becomes `text`
- ambiguous responses are ignored

Future versions may adopt a small-model extraction pass inspired by Mitsuhiko's `/answer` extension once the prompt schema stabilizes.

## Delivery Strategy

Collected answers are injected with `pi.sendUserMessage(...)` so the assistant sees them as normal user replies and the shared workflow continues naturally.

If the agent is still active, the message is queued as a follow-up.

## Why This Exists

This design preserves the multi-harness contract:
- Claude Code, Codex, OpenCode, and other harnesses continue to use the shared skills directly
- Pi gets richer UX only through `extensions/pi/`
- the workflow remains portable even when Pi-specific UI is unavailable
