# Pi workflow interactions

## Current behavior

Shared skills own conversational meaning and workflow policy. The Pi extension owns explicit launch commands, optional decision presentation and existing work guardrails, not interpretation of the assistant's prose. This describes version 0.2.3; the recorded proof is accepted and local activation has been explicitly authorized and verified. npm publication is blocked by authentication; already-open sessions need `/reload`.

- Ordinary answers, questions, task lists, acceptance criteria, and progress reports remain ordinary chat. There is no `agent_end` extraction, workflow-detection state, hidden model routing, heuristic list-to-choice fallback, or automatic answer injection.
- Users answer in plain text. A separately installed workstation may provide a user-invoked `/answer`; Heart of Gold does not register or depend on it.
- `/deep-thought-brainstorm`, `/deep-thought-plan`, `/deep-thought-architect`, `/marvin-work`, and the three sharing launchers remain. Launchers send their intended `/skill:…` with `expandPromptTemplates: true` under the current Pi API, including queued follow-ups. Without that option, current Pi sends the slash text literally instead of expanding the skill.
- Explicit launcher input dialogs still use standard `editor` requests, including over RPC. Work guards still protect paths, block unsafe command patterns, and require their existing publication confirmation. No guard semantics changed.
- `hog_ask` is a deliberately invoked, single-question decision/approval tool. It does not inspect prose, activate a workflow mode, or call another model. The structural direction and [recorded runtime proof](../reviews/2026-09-13-hog-ask-proof.md) were accepted. Subsequent explicit authorization enabled local activation; proof acceptance alone was not treated as permission to publish or install.

## Deliberate decision/approval contract

Decision inputs require 2–4 alternatives with stable IDs, unique normalized labels and consequences. A recommendation references an ID and includes a reason; it does not select anything. Approval inputs name the whole action/scope, relevant artifact/revision and exclusions, with fixed approve/revise/pause responses and no recommendation.

The native editor-area card distinguishes focus, draft selection, review and final **Send**. Custom text and optional notes remain inside the flow. Back changes the draft, not an already recorded answer. Long content wraps and scrolls; menu-edge arrows also scroll because Pi fullscreen reserves PageUp/Down for its transcript. Theme/keybindings come from Pi, and native Editor paste markers are expanded before saving text.

RPC uses standard **select/input**, not custom TUI or `editor`. In Pi 0.85.1, input/select accept AbortSignal but editor does not. Every dialog retains question/scope/recommendation context; option display labels map explicitly to IDs. Review exposes Back, note editing, Send and dismissal; its first action is neutral Back. RPC clients control layout and may use single-line input. Print/JSON and missing UI return `unavailable` without asking the model to guess.

Results include readable Q&A in `content` and structured `details`: the normalized question (including purpose/scope), selected option ID/label or actual custom text, note, status, `approved`, and originating session/leaf IDs when UI was opened. Pi stores tool-result details on the conversation branch; there is no global approval ledger.

| Outcome | Meaning |
|---|---|
| `answered` | Explicitly reviewed and submitted answer; only bare approval option `approve` has `approved: true` |
| `needs_discussion` | Any custom approval answer or nonempty approval note, even “thanks”; always `approved: false` |
| `dismissed` | User declined to answer; no approval |
| `unavailable` | No supported UI, lost/failed UI, or another interaction owns the slot; no approval |
| `aborted` | Tool/session cancellation; no late answer or approval |

Sequential execution and an owner-token lock permit one active interaction. Overlap returns `unavailable` / `interaction_in_progress` without disturbing or queuing behind the owner. Abort and session navigation/shutdown invalidate stale completions. Dismissal, unavailable/aborted outcomes and approval pause request turn termination. Guidance prohibits dependent sibling tools in the same assistant message; it cannot roll back unrelated already-running actions. Answers never dispatch commands, and these records do not replace existing guards.

Input is bounded plain text (no terminal controls or bidi overrides); custom answers are limited to 2,000 characters, notes to 1,000, and text to 32 lines. Invalid text remains editable rather than becoming a default answer. No batching or multi-select is implemented.

## Migration from the automatic enhancer

The old enhancer parsed final assistant messages during supported workflows. It could turn required checklist steps into a single-choice popup, even after the extraction model returned a high-confidence `none` result. Selecting one injected only that task's label as a user reply.

That entire automatic path is retired, not disabled behind a setting. `/deep-thought-guided-debug` and its extraction helpers/fixtures are removed with it. No replacement configuration or command is necessary: keep conversing normally. Users of the old `test:pi-guided` script should use `test:pi-interactions` or the full `test:pi` suite.

The [April enhancer plan](../plans/2026-04-14-feat-pi-guided-workflow-enhancement-plan.md) describes historical behavior, not the current shipped-source contract. Its portable-skills principle survives; its automatic UI design does not.

A source commit or push does **not** update an installed immutable release. Publishing, staging a new release, and changing the pinned Pi source require separate authorization. Never edit an installed release in place. Until activation is explicitly performed, an existing pinned installation may still contain the enhancer.

## Verification

- `tests/pi-interactions.test.mjs` exercises the actual extension entrypoint and registered handlers with mocked context/UI. Required lists, checklists, completion reports, acceptance criteria, mixed report/question messages, and genuine questions produce no unsolicited UI, model access, or synthetic answer across TUI/RPC/no-UI contexts, workflow transitions, and pending follow-ups.
- Launcher tests assert explicit skill expansion, idle/queued delivery, standard editor requests, and cancellation. `tests/pi-work-guard.test.mjs` retains the independent guard regressions.
- `tests/pi-package-contract.test.mjs` checks skill exports and the singular package entrypoint. `tests/pi-rpc-smoke.test.mjs` loads real isolated offline standalone, skills-only and workstation-`/answer`-combined profiles, verifies launchers and drives real RPC decision dialogs. The optional combined test uses `HOG_TEST_WORKSTATION_ANSWER` (or the local sibling checkout); it is explicitly skipped when absent.
- `tests/pi-hog-ask*.test.mjs` cover schema/controller, the actual registered tool and native Editor, stable IDs, conservative approval, custom text/paste/notes, resize/Unicode, keybindings, focus, lost UI, overlap, abort, disposal and session boundaries.
- `uv run scripts/pi-hog-ask-proof.py --output /tmp/hog-ask-proof` drives the real Pi CLI through a PTY in both regular/fullscreen modes with a temporary offline profile. Its benign fixture invokes the registered production definition without a model, captures terminal screens, and executes no selected action. The development-only fixture/script are excluded from publication. This is runtime evidence, not live-model facilitation or human usability approval.
- The old handler was reproduced with stubbed model/UI before deletion: the mandatory-three-steps fixture opened a selector and injected its first item despite the model veto. The replacement event tests assert the absence of that entire behavior rather than testing a new parser.

Validated against local Pi 0.85.1. No user settings, workstation `/answer`, external question packages, credentials, or installed-release files are changed by this migration.

## Related contracts

- [Shared skill portability](pi-cross-harness-contract.md)
- [Intentional-question implementation plan and release/activation gate](../plans/2026-09-13-fix-pi-question-interaction-plan.md)
