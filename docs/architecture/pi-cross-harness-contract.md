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

Shared skills describe intent, not a harness primitive. Inspect evidence before
asking; classify unknowns as user decision, agent investigation, or later
verification, and name the blocking phase and owner. Ask focused questions only
when the answer determines progress (up to three independent related prose
clarifications), recommend from evidence where appropriate, preserve decisions,
and stop when clear.

Structured UI is conditional: use it only for a meaningful choice or named
approval. Plain prose and custom qualifications remain valid in every harness.
Required tasks are obligations/progress, never selectable alternatives. End with
the result and an appropriate next step rather than a fixed handoff menu.

Document existence/status, readiness (including preview gates), and execution
authorization are separate. New plans are drafts unless scope is actually
approved. A path mention or review does not authorize work; explicit execution
intent ("Implement this plan" or `/work <path>`) may authorize stated scope subject
to gates. Literal command syntax is not required.
Once authorized and ready, work remains autonomous without per-task approval;
a blocker stops only dependent work.

Avoid treating a single harness primitive as canonical. See
[interaction-contract.md](interaction-contract.md) for the complete authoring
contract.

## Pi realization: three surfaces

- **Conversation:** ordinary prose, optionally assisted by a separately installed,
  user-invoked `/answer`. No post-turn extraction or answer injection.
- **Decision/approval:** optional agent-invoked `hog_ask`, one question at a time.
  Native TUI card; standard abortable RPC select/input. Ordinary answers submit
  directly, optional notes precede sending, and only approvals require review;
  print/JSON returns `unavailable`. Skills-only installs still work in prose.
- **Progress:** non-interactive reports from the authoritative Markdown plan,
  not a second tracker or a menu of required tasks.

`hog_ask` returns readable Q&A plus structured question/scope, answer ID/text,
notes, status and approval flag. Only a reviewed, explicitly submitted bare
`approve` records the named approval. Custom approval text or any nonempty note
means `needs_discussion`; dismissal, abort and unavailability never imply consent.
This is not a replacement for permissions or existing work/deployment guards.
See the [Pi contract and proof boundaries](pi-guided-workflows.md).

## Anti-Rules

Do **not** make the shared skill depend on:
- Claude-specific tool names such as `AskUserQuestion` as the canonical requirement
- pi-only slash commands or extension commands
- harness-specific task/progress tools as the only tracker
- TUI-only behaviors as the only usable interaction path

If a harness-specific feature exists, shared skills should describe it as an optional realization:
- use structured UI only for a real decision/approval **when available**
- otherwise fall back to concise plain-text interaction with room for qualifications

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
