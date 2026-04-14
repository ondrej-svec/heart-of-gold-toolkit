---
title: "feat: add pi-only guided workflow TUI for Heart of Gold flagship skills"
type: plan
date: 2026-04-14
status: complete
brainstorm: null
confidence: high
---

# feat: add pi-only guided workflow TUI for Heart of Gold flagship skills

Create a Pi-native enhancement layer that detects selected Heart of Gold workflows and upgrades structured assistant questions into an interactive terminal UI, while keeping shared `SKILL.md` files portable across Pi, Codex, Claude Code, OpenCode, and other harnesses.

## Problem Statement

Heart of Gold currently ships shared skills that are portable and effective in plain text, plus a few thin Pi-native launch commands in `extensions/pi/brainstorm.ts` and `extensions/pi/plan.ts`. That preserves cross-harness compatibility, but it leaves Pi underpowered in exactly the places where Pi can shine: structured questions, explicit option selection, and focused answer entry.

The current Pi wrappers only gather a starting topic and then send `/skill:brainstorm` or `/skill:plan`. After that, the user falls back to ordinary text interaction, even when the skill is intentionally presenting 2-4 natural choices or one focused clarifying question. This is friction for the flagship discovery and planning workflows.

The repo already has an explicit architecture rule in `docs/architecture/pi-cross-harness-contract.md`: shared skills remain canonical, and Pi may add optional runtime improvements such as structured question UI. Mitsuhiko's `/answer` extension (`agent-stuff/extensions/answer.ts`) demonstrates a strong Pi pattern for this: extract structure from the last assistant message, present a custom TUI, and feed the answer back into the conversation.

The missing piece is a reusable Pi-only enhancement layer for Heart of Gold workflows.

## Target End State

When Heart of Gold is installed as a Pi package:

- selected workflows such as `brainstorm` and `plan` can be detected by a Pi extension
- assistant messages in those workflows are inspected for high-confidence structured questions
- when a structured question is found, Pi presents an interactive TUI instead of forcing plain-text answering
- answers are sent back as normal user messages so the shared skill continues naturally
- if no structured question is detected, nothing changes and the conversation remains plain text
- all shared `SKILL.md` files remain portable and do not depend on Pi-specific primitives
- Pi-specific code lives entirely under `extensions/pi/`

## Scope and Non-Goals

### Scope

- design and implement a reusable Pi-only guided workflow enhancement layer
- support `brainstorm` and `plan` first
- preserve the existing thin launch commands or fold them into the new guided layer cleanly
- use extraction prompts and custom TUI only inside Pi extensions
- keep behavior opt-in by workflow detection, not global across all assistant conversations

### Non-Goals

- rewriting `plugins/deep-thought/skills/brainstorm/SKILL.md` or `plan/SKILL.md` to require Pi UI
- making Codex, Claude Code, or other harnesses depend on this feature
- auto-enhancing every assistant question in Pi globally
- implementing a perfect universal form engine for every skill on day one
- changing the core reasoning phases of the shared skills

## Proposed Solution

Build a generic Pi extension module that tracks when the current interaction is inside selected Heart of Gold workflows and enhances only those turns.

The design has four parts:

1. **Workflow tracking**
   - watch user input and extension commands to detect entry into known skills such as `brainstorm`, `plan`, and later `architect`
   - persist lightweight session state so the enhancer knows whether the current branch is in a guided workflow

2. **Question extraction**
   - inspect the last assistant message during guided workflows
   - run a small extraction prompt against a fast/cheap model, following the pattern from `/answer`
   - extract structured prompts only when confidence is high

3. **Interactive TUI**
   - render a Pi-native UI for:
     - single-choice questions
     - focused free-text questions
     - workflow handoff choices
   - keep the UI minimal and robust, optimized for terminal use

4. **Answer injection**
   - compile the user selection or text answer into a normal user message via `pi.sendUserMessage(...)`
   - let the shared skill continue unchanged

This keeps the portable workflow definition in the skill, and moves the richer presentation logic into Pi only.

## Decision Rationale

### Why a generic guided-workflow layer instead of a brainstorm-only extension?

Because the problem is not unique to brainstorm. `plan` already contains the same structured interaction pattern: choose a brainstorm source, refine scope one question at a time, and present explicit options when there are 2-4 natural choices. A reusable guided layer avoids duplicating extraction logic, TUI code, and workflow-state handling.

### Why not modify shared skills to become Pi-aware?

The repo's portability contract explicitly forbids making a harness-specific feature canonical. Shared skills should describe the interaction intent in a harness-neutral way, with structured UI as an optional enhancement. Pushing Pi-specific UX into `SKILL.md` would weaken support for Codex, Claude Code, OpenCode, and any future harness.

### Why use extraction from assistant text instead of hard-coding every question?

The shared skills own the workflow wording and remain the source of truth. Extraction allows the extension to stay loosely coupled: it reads what the assistant actually asked, upgrades it when the structure is clear, and otherwise gets out of the way. This is the same leverage demonstrated by `/answer`.

### Why start with `brainstorm` and `plan`?

They are the highest-value flagship workflows, already have Pi launcher commands, and already express structured interaction patterns in the shared skill text.

## Constraints and Boundaries

- Pi-only behavior must live under `extensions/pi/`
- shared skills remain usable in plain text with no extension support
- the extension must be conservative: if extraction is ambiguous, do nothing
- the extension must not change the meaning of the question being asked
- the extension must not auto-answer or infer user intent
- the extension should avoid interrupting unrelated workflows
- the extension should work in interactive Pi mode and degrade safely when UI is unavailable

## Assumptions

| Assumption | Status | Evidence |
|------------|--------|----------|
| Pi extensions can detect or transform workflow entry before or around skill invocation | Verified | Pi `input` and command hooks in `docs/extensions.md` support interception and transformation before skill expansion |
| Pi extensions can render custom terminal UI for interactive flows | Verified | `docs/extensions.md` documents `ctx.ui.custom()`, and `/answer` uses a custom `QnAComponent` |
| Pi extensions can send follow-up user messages back into the conversation | Verified | `docs/extensions.md` documents `pi.sendUserMessage(...)`; current `extensions/pi/brainstorm.ts` and `plan.ts` already use it |
| A generic extractor can reliably identify at least explicit option lists and focused single questions in flagship workflows | Partially verified | Shared skills already instruct explicit options and one-question-at-a-time behavior, but implementation quality still needs validation in real turns |
| Keeping the enhancement Pi-only will preserve cross-harness portability | Verified | `docs/architecture/pi-cross-harness-contract.md` explicitly defines Pi-native enhancement as an optional Layer 3 |

## Risk Analysis

### Risk 1: Extraction is too eager and opens UI at the wrong time
**Impact:** Annoying or confusing UX.
**Mitigation:** Start with narrow activation rules: only selected HoG workflows, only high-confidence question types, only one enhancement attempt per assistant turn.

### Risk 2: Extraction is too weak and misses many opportunities
**Impact:** Feature feels unreliable.
**Mitigation:** Start with the easiest cases first: numbered option lists, explicit next-step menus, and one focused question. Add telemetry/debug rendering or a development flag while iterating.

### Risk 3: Workflow detection leaks into unrelated sessions
**Impact:** Global Pi behavior becomes intrusive.
**Mitigation:** Track only known HoG workflow entrypoints and clear state when the branch moves away from those interactions.

### Risk 4: Shared skill wording drifts and breaks extraction
**Impact:** UI enhancement silently degrades.
**Mitigation:** Keep extraction schema resilient, add fixture-style tests for representative assistant outputs, and document the contract as "enhance when structure is visible, otherwise do nothing."

### Risk 5: UI adds too much complexity for the first version
**Impact:** Slow delivery and brittle terminal behavior.
**Mitigation:** Start with three prompt kinds only: `single_choice`, `text`, and `handoff`.

## Implementation Tasks

- [x] Create an architecture note for Pi guided workflows under `docs/architecture/` that defines activation rules, supported prompt kinds, and portability boundaries
- [x] Add a new reusable Pi extension module under `extensions/pi/` for guided workflow enhancement
- [x] Add `extensions/pi/index.ts` so the Pi package exposes a single extension entrypoint that loads the guided enhancer plus the existing launcher/guardrail commands
- [x] Implement workflow-state detection for Heart of Gold entrypoints
  - [x] detect `/skill:brainstorm`
  - [x] detect `/skill:plan`
  - [x] detect raw skill aliases such as `/brainstorm`, `/plan`, `/deep-thought:brainstorm`, `/deep-thought:plan`
  - [x] detect existing Pi launcher commands (`/deep-thought-brainstorm`, `/deep-thought-plan`)
- [x] Define the first guided prompt schema for:
  - [x] `single_choice`
  - [x] `text`
- [x] Implement a conservative parser that upgrades explicit option lists and focused single questions while ignoring ambiguous assistant output
- [x] Use Pi interactive UI to collect answers (`ctx.ui.select(...)` and `ctx.ui.editor(...)`) and keep the interaction inside Pi only
- [x] Inject collected answers back as normal user messages using `pi.sendUserMessage(...)`
- [x] Integrate the enhancer with existing Pi commands without breaking current simple launch behavior
- [x] Update `README.md` to explain that Pi package installs include guided workflow UX for supported skills
- [x] Extend the guided workflow enhancer to `architect`
- [x] Replace or augment heuristic parsing with a small-model extractor inspired by `/answer`, while keeping a safe fallback path
- [x] Add custom Pi TUI components for guided selection and focused free-text answering
- [x] Add follow-up notes for future candidates such as extraction fixtures and additional workflow polish

### Deferred follow-up work

- [ ] Add dedicated extraction fixtures or automated tests once the extension code is factored into separately testable helpers
- [ ] Consider richer multi-step guided prompts if real-world usage shows repeated compound question flows
- [ ] Consider optional debug tooling to explain why a given assistant turn was or was not enhanced

## Acceptance Criteria

- [x] Pi package installs continue to expose working HoG extension commands
- [x] `brainstorm` and `plan` remain usable in plain text without any Pi enhancement dependency
- [x] in Pi interactive mode, explicit structured questions in `brainstorm`, `plan`, and `architect` can open Pi interactive UI and return the answer back into the same workflow
- [x] ambiguous assistant messages do not trigger forced UI
- [x] all new code is isolated to Pi extension paths and documentation
- [x] shared skill files remain harness-neutral
- [x] repo documentation clearly explains the split between shared skill contract and Pi-native enhancement

## Decision Rationale Details

### Activation strategy
The first implementation should activate only for known workflow entrypoints rather than trying to infer every possible case from arbitrary conversation text. That keeps the scope narrow and the UX predictable.

### Message transport strategy
Use `pi.sendUserMessage(...)` for answers so the resulting interaction looks like a normal user reply and the shared skill continues naturally. Prefer `followUp` delivery when the agent is still busy.

### State strategy
Prefer lightweight session state persisted through Pi session entries or reconstructable branch inspection instead of complex in-memory state. The enhancer should survive reloads and session continuation.

## Phased Implementation

### Phase 1: Architecture + scaffolding
- Write the architecture note
- Add a new guided workflow extension entrypoint
- Move or wrap existing brainstorm/plan launcher behavior so the future guided layer has one home

**Exit criteria:** Extension structure exists; design is documented; no user-visible regression.

### Phase 2: Workflow tracking + extraction
- Detect supported workflow entrypoints
- Parse last assistant message into a guided prompt schema
- Add safe fallback behavior when extraction fails

**Exit criteria:** Extension can reliably identify whether a supported workflow is active and can extract at least one representative `single_choice` prompt.

### Phase 3: Pi interactive answering
- Implement Pi interactive answering for `single_choice` and `text`
- Feed user answers back into the active conversation

**Exit criteria:** End-to-end flow works for at least one brainstorm and one plan interaction.

### Phase 4: Polish + docs
- Validate edge cases and fallback behavior
- Update README and architectural docs
- Extend support to `architect`
- Replace the first-pass heuristic-only behavior with model-backed extraction plus safe fallback

**Exit criteria:** Feature is documented, constrained, and ready for real use.

## References

- `docs/architecture/pi-cross-harness-contract.md`
- `extensions/pi/brainstorm.ts`
- `extensions/pi/plan.ts`
- `extensions/pi/work.ts`
- Mitsuhiko `/answer` reference: `https://github.com/mitsuhiko/agent-stuff/blob/main/extensions/answer.ts`
- `plugins/deep-thought/skills/brainstorm/SKILL.md`
- `plugins/deep-thought/skills/plan/SKILL.md`

## Future Follow-Ups

- Add `architect` as a supported guided workflow once `brainstorm` and `plan` prove stable
- Consider a small reusable library for guided extraction and TUI components inside `extensions/pi/lib/`
- Consider optional debug tooling to show why a given assistant message was or was not enhanced
