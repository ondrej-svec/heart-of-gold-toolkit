# Interaction-policy walkthrough — static authoring review

Date: 2026-09-13

Scope: Phase 2 shared-policy text and installer transformations only.

This is a static review of the actual scoped source skills and their
Codex/Pi/OpenCode transformed text. It is **not live-model UX evidence**: string and scenario
inspection cannot prove whether a model asks well in a real conversation. No
Phase 3 card/UI is implemented or claimed here.

| Scenario | Evidence/owner classification | Expected ask | Expected report | Expected proceed |
|---|---|---|---|---|
| Clear request | Repository/context makes scope clear; no user-owned unknown | None | State understood scope and relevant constraints | Brainstorm/plan writes its artifact; no implementation implied |
| Ambiguous scope | Two material directions remain user-owned | One focused prose question with evidence, recommendation, and tradeoff (optional structured UI) | Name the selected decision and rejected tradeoff | Continue the current authoring phase |
| Agent-researchable unknown | Codebase/API evidence is available; agent owns investigation | None until evidence is exhausted | Identify it as investigation, its phase, and any later verification | Research it, then ask only if a consequential user decision remains |
| Missing preview | Preview is a documented subjective readiness gate | Ask only the named reviewer for the missing preview disposition | Report blocked dependent phase and gate owner | Do independent authorized/ready work; do not cross the preview gate |
| Authorized execution | User explicitly says “Implement this plan” or invokes `/work <path>` and ready scope is documented | None for already-settled tasks | State authorized scope, readiness checks, and progress | Execute dependency-ordered tasks autonomously without per-task reapproval |
| Review of a plan path | User asks to review or merely names a path | None unless review target is genuinely ambiguous after inspection | Give review/path result and gates | Do not start work; recommend explicit execution only if appropriate |
| Completed work | Current scope tasks and checks are complete | None by default | Summarize completed scope, checks, and any later gated work | Stop or state one appropriate follow-up; do not show a ritual menu or mark an incomplete multi-phase plan complete |

## Grounding performed

- Read the seven scoped `SKILL.md` files after editing. Each contains its own
  interaction/readiness policy; none refers to this repository document as a
  runtime requirement.
- Applied `transformContentForPi` and `transformContentForOpenCode` to those
  actual source files in `tests/interaction-policy.test.mjs`; the required
  policy survives each installation transform.
- Applied the Codex transform to all seven actual source files and the retired
  blanket-UI fixture. It preserves conditional meaningful-decision wording.
- Ten scenario fixtures check complete source directives in every transform,
  including natural execution, review-only paths, independent phase checkpoints,
  and Architect's standalone/pipeline boundary. They do not assert self-authored
  `starts` booleans as a substitute for checking production instructions.
- Ten command-alias fixtures compare complete expected output. The old regex
  changed `read/review` to `read$review` and corrupted paths/longer commands;
  seven new assertions failed before its token boundaries were corrected.
- The compatibility script checks all seven sources for self-contained policy
  signals, retired canonical question-tool names, old blanket wording, and the
  500-line limit.

## Review disposition

The independent deep review approved Phase 1 and requested five Phase 2 fixes:
recognize natural execution intent, retain quality/push checkpoints for independent
phases, preserve Architect's boundaries/pipeline outputs, remove all-must-ask
assumption rules, and replace tautological tests/fix Codex token corruption.
All five were corrected; a separate read-only resolution check found no remaining
blocker in those fixes and independently passed all 37 interaction-policy tests.

Final source checks: 37 interaction-policy, 96 Pi (including actual offline RPC),
204 workstation, and 2 visualization tests passed. The workstation count includes
pre-existing uncommitted desk tests; those files were not changed or included in
this work. Full `prepublishOnly` passed through `uv run --with pyyaml`, including
publish-safety, security, and compatibility checks. Nothing was published.

The expected behavior above is grounded in static authoring and transformation
inspection. A live-model conversation/proof slice remains future behavioral UX
evidence and is not represented as completed by this walkthrough.
