# Pi Guided Workflows

This note defines the Pi-only enhancement layer for guided Heart of Gold workflows.

## Purpose

Heart of Gold shared skills remain portable and usable in plain text. Pi may add richer interaction for workflows that naturally benefit from structured questions, explicit option selection, and focused answer entry.

The first guided workflows are:
- `brainstorm`
- `plan`
- `architect`

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
- `/skill:architect`
- `/architect`
- `/deep-thought:architect`
- `/deep-thought-architect`

Guided enhancement resets when the user enters a different slash command outside the supported set.

## Prompt Kinds

The first implementation supports only conservative prompt kinds.

### 1. Single choice

Used when the assistant clearly presents 2-4 explicit options, for example:

- numbered options
- short bullet options
- next-step handoff menus

Pi realization:
- model-backed extraction when available, with heuristic fallback
- custom TUI selector rendered with `ctx.ui.custom(...)`

Fallback:
- shared skill already remains usable in plain text

### 2. Focused free-text question

Used when the assistant asks one clearly scoped question and expects a short text answer.

Pi realization:
- model-backed extraction when available, with heuristic fallback
- custom TUI editor rendered with `ctx.ui.custom(...)`

Fallback:
- user can answer in ordinary text

## Extraction Strategy

The implementation now prefers a small-model extraction pass inspired by Mitsuhiko's `/answer` extension, with conservative heuristics as fallback.

Current behavior:
- try to extract one prompt from the latest assistant message using a fast model
- accept only non-ambiguous prompts with medium/high confidence
- fall back to heuristics for explicit option lists and focused single questions
- ignore ambiguous responses

This keeps the enhancement useful without making the shared skill depend on model extraction.

## Delivery Strategy

Collected answers are injected with `pi.sendUserMessage(...)` so the assistant sees them as normal user replies and the shared workflow continues naturally.

If the agent is still active, the message is queued as a follow-up.

## Debug Mode

Pi exposes `/deep-thought-guided-debug` to toggle lightweight notices for the guided workflow enhancer.

When enabled, it reports:
- whether extraction used the model-backed path or heuristic fallback
- whether a prompt was skipped and why
- whether the user answered or dismissed the guided prompt

This is Pi-only observability for iteration and does not change the shared skill contract.

## Validation Strategy

The core workflow-detection and heuristic extraction logic is factored into a small shared helper module so it can be validated with Node tests.

Current automated coverage includes fixtures for:
- workflow entrypoint detection
- unrelated command reset behavior
- explicit option-list extraction for `brainstorm` and `architect`
- markdown-wrapped JSON parsing for model output
- rejection of low-confidence prompts

## Why This Exists

This design preserves the multi-harness contract:
- Claude Code, Codex, OpenCode, and other harnesses continue to use the shared skills directly
- Pi gets richer UX only through `extensions/pi/`
- the workflow remains portable even when Pi-specific UI is unavailable
