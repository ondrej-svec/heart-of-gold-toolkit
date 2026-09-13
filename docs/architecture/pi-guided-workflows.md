# Pi workflow interactions

## Current behavior

Shared skills own conversational meaning and workflow policy. The Pi extension owns explicit launch commands and existing work guardrails, not interpretation of the assistant's prose.

- Ordinary answers, questions, task lists, acceptance criteria, and progress reports remain ordinary chat. There is no `agent_end` extraction, workflow-detection state, hidden model routing, heuristic list-to-choice fallback, or automatic answer injection.
- Users answer in plain text. A separately installed workstation may provide a user-invoked `/answer`; Heart of Gold does not register or depend on it.
- `/deep-thought-brainstorm`, `/deep-thought-plan`, `/deep-thought-architect`, `/marvin-work`, and the three sharing launchers remain. Launchers send their intended `/skill:…` with `expandPromptTemplates: true` under the current Pi API, including queued follow-ups. Without that option, current Pi sends the slash text literally instead of expanding the skill.
- Explicit launcher input dialogs still use standard `editor` requests, including over RPC. Work guards still protect paths, block unsafe command patterns, and require their existing publication confirmation. No guard semantics changed.
- There is no deliberate decision-card tool yet. The proposed `hog_ask` remains gated on preview review in the [implementation plan](../plans/2026-09-13-fix-pi-question-interaction-plan.md).

## Migration from the automatic enhancer

The old enhancer parsed final assistant messages during supported workflows. It could turn required checklist steps into a single-choice popup, even after the extraction model returned a high-confidence `none` result. Selecting one injected only that task's label as a user reply.

That entire automatic path is retired, not disabled behind a setting. `/deep-thought-guided-debug` and its extraction helpers/fixtures are removed with it. No replacement configuration or command is necessary: keep conversing normally. Users of the old `test:pi-guided` script should use `test:pi-interactions` or the full `test:pi` suite.

The [April enhancer plan](../plans/2026-04-14-feat-pi-guided-workflow-enhancement-plan.md) describes historical behavior, not the current shipped-source contract. Its portable-skills principle survives; its automatic UI design does not.

A source commit or push does **not** update an installed immutable release. Publishing, staging a new release, and changing the pinned Pi source require separate authorization. Never edit an installed release in place. Until activation is explicitly performed, an existing pinned installation may still contain the enhancer.

## Verification

- `tests/pi-interactions.test.mjs` exercises the actual extension entrypoint and registered handlers with mocked context/UI. Required lists, checklists, completion reports, acceptance criteria, mixed report/question messages, and genuine questions produce no unsolicited UI, model access, or synthetic answer across TUI/RPC/no-UI contexts, workflow transitions, and pending follow-ups.
- Launcher tests assert explicit skill expansion, idle/queued delivery, standard editor requests, and cancellation. `tests/pi-work-guard.test.mjs` retains the independent guard regressions.
- `tests/pi-package-contract.test.mjs` checks skill exports and the singular package entrypoint. `tests/pi-rpc-smoke.test.mjs` loads the real package in an isolated, offline Pi RPC profile and cancels a real standard editor request without a model call.
- The old handler was reproduced with stubbed model/UI before deletion: the mandatory-three-steps fixture opened a selector and injected its first item despite the model veto. The replacement event tests assert the absence of that entire behavior rather than testing a new parser.

Validated against local Pi 0.85.1. No user settings, workstation `/answer`, external question packages, credentials, or installed-release files are changed by this migration.

## Related contracts

- [Shared skill portability](pi-cross-harness-contract.md)
- [Intentional-question implementation plan and pending UI preview](../plans/2026-09-13-fix-pi-question-interaction-plan.md)
