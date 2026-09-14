# Pi workflow interactions

## Current behavior

Shared skills own conversational meaning and workflow policy. The Pi extension owns explicit launch commands, optional decision presentation and existing work guardrails, not interpretation of the assistant's prose. Source 0.2.5 is a native question-style proof slice, not a completed release. Immutable local 0.2.4 remains activated and fresh-process verified, but its ordinary Enter-to-Back UX was rejected after a user-reported reload. npm login succeeded; publication was then stopped because of the UX rejection. The [correction plan](../plans/2026-09-14-fix-hog-ask-question-ux-plan.md) requires native preview acceptance before wider RPC/guidance alignment and a newly authorized rollout. See the [rollout record](../plans/2026-09-14-chore-hog-ask-024-rollout-plan.md) for exact scope and status. The [native proof record](../reviews/2026-09-13-hog-ask-native-proof.md) distinguishes source evidence from physical-terminal and live usability claims.

- Ordinary answers, questions, task lists, acceptance criteria, and progress reports remain ordinary chat. There is no `agent_end` extraction, workflow-detection state, hidden model routing, heuristic list-to-choice fallback, or automatic answer injection.
- Users answer in plain text. A separately installed workstation may provide a user-invoked `/answer`; Heart of Gold does not register or depend on it.
- `/deep-thought-brainstorm`, `/deep-thought-plan`, `/deep-thought-architect`, `/marvin-work`, and the three sharing launchers remain. Launchers send their intended `/skill:…` with `expandPromptTemplates: true` under the current Pi API, including queued follow-ups. Without that option, current Pi sends the slash text literally instead of expanding the skill.
- Explicit launcher input dialogs still use standard `editor` requests, including over RPC. Work guards still protect paths, block unsafe command patterns, and require their existing publication confirmation. No guard semantics changed.
- `hog_ask` is a deliberately invoked, single-question decision/approval tool. It does not inspect prose, activate a workflow mode, or call another model. The structural direction and [recorded runtime proof](../reviews/2026-09-13-hog-ask-proof.md) were accepted. Subsequent explicit authorization enabled local activation; proof acceptance alone was not treated as permission to publish or install.

## Deliberate decision/approval contract

Decision inputs require 2–4 alternatives with stable IDs, unique normalized labels and consequences. A recommendation references an ID and includes a reason; it does not select anything. Approval inputs name the whole action/scope, relevant artifact/revision and exclusions, with fixed approve/revise/pause responses and no recommendation.

The native proof slice follows Pi's bundled question layout: thin accent rules, a question, numbered choices, muted indented descriptions and an inline custom-answer row. An ordinary choice or custom answer submits directly with Enter (or a fresh pointer click); focus/hover alone submits nothing. Arrows, typing/paste and whole-row clicks reach the persistent native Editor. Tab adds a note to the displayed answer before submission; Enter sends answer plus note, while Esc/Tab returns without losing valid or invalid drafts/caret. Pending notes remain visible and are validated on submission. Expanded paste text, not display markers, is validated. Approval presents **Approve as written / Request changes / Not now**: Request changes requires reviewed free text, and pending feedback must be explicitly cleared before bare approval. Approval has no generic note field; the core remains conservative for any legacy/custom adapter that supplies one.

Approval uses **Enter → exact-scope review → Enter confirms**, with no Tab unlock or release prerequisite. Reported activation repeats and all key releases do nothing; ordinary editing/navigation repeats still work. Escape returns to entry. Focus changes also restart the visible approval journey from its prior entry, retaining feedback/caret, and discard the refocusing pointer gesture. Raw legacy streams cannot distinguish held Enter from another press: two CR events can confirm. No timer or Kitty-active flag is claimed as physical-release evidence. The earlier release/Tab fallback was explicitly rejected and removed. Ordinary native decisions have no mandatory review or Ctrl+Enter route. Enter never means Back. In approval feedback, Enter/Ctrl+Enter opens review rather than submitting. Escape goes back, while the host clear-editor binding (Ctrl+C by default) dismisses even invalid drafts. Hints show the first configured binding, not every alias.

Long content wraps with fixed controls. Approval-review arrows scroll directly; choice-entry arrows also scroll at focus edges because fullscreen owns PageUp/Down for the transcript. Fullscreen mouse regions come from rendered cells; hover does not take typing focus, native Editor caret/drag behavior is preserved, and continuing/reflowed gestures cannot activate a relocated control. Completed mouse submission does not reclaim focus from Pi's restored editor. Regular mode retains terminal-owned mouse/scrollback rather than promising unsupported pointer controls.

Pi 0.85.1 consumes fullscreen window-focus reports before public input listeners. A passive, active-card-only TTY observer is therefore prepended to stdin to disarm before the host sees a same-chunk focus/activation sequence. It recognizes only focus reports, retains at most a two-byte escape prefix, never consumes/transforms input or changes terminal modes, and is removed on all finish/abort/disposal paths. Unmodified CSI-tilde function-key event spellings are normalized only for binding matching; release/repeat classification still uses the original bytes.

**RPC has not yet adopted the new ordinary-question flow**: its alignment is gated on acceptance of the native proof slice. The existing RPC adapter uses standard **select/input**, not custom TUI or `editor`. In Pi 0.85.1, input/select accept AbortSignal but editor does not. Every dialog retains question/scope/recommendation context; display labels map explicitly to IDs. Request changes opens required feedback input; valid or invalid feedback drafts require explicit clearing before approval is offered again. Review exposes Back, decision-only note editing, Send and dismissal, with neutral Back first. RPC clients own their keyboard transport/layout and may use single-line input. Print/JSON and missing UI return `unavailable` without asking the model to guess.

Results include readable Q&A in `content` and structured `details`: the normalized question (including purpose/scope), selected option ID/label or actual custom text, note, status, `approved`, and originating session/leaf IDs when UI was opened. Pi stores tool-result details on the conversation branch; there is no global approval ledger.

| Outcome | Meaning |
|---|---|
| `answered` | Explicitly submitted answer (reviewed for approvals); only bare approval option `approve` has `approved: true` |
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

The **0.2.5 native proof slice** has its own [question-style proof](../reviews/2026-09-14-hog-ask-question-ux-proof.md) and [actual native capture gallery](../previews/hog-ask-question-native/index.html). The older records below are historical, not acceptance of this correction. Native preview acceptance and RPC alignment remain outstanding.

- `tests/pi-interactions.test.mjs` exercises the actual extension entrypoint and registered handlers with mocked context/UI. Required lists, checklists, completion reports, acceptance criteria, mixed report/question messages, and genuine questions produce no unsolicited UI, model access, or synthetic answer across TUI/RPC/no-UI contexts, workflow transitions, and pending follow-ups.
- Launcher tests assert explicit skill expansion, idle/queued delivery, standard editor requests, and cancellation. `tests/pi-work-guard.test.mjs` retains the independent guard regressions.
- `tests/pi-package-contract.test.mjs` checks skill exports and the singular package entrypoint. `tests/pi-rpc-smoke.test.mjs` loads real isolated offline standalone, skills-only and workstation-`/answer`-combined profiles, verifies launchers and drives real RPC decision dialogs. The optional combined test uses `HOG_TEST_WORKSTATION_ANSWER` (or the local sibling checkout); it is explicitly skipped when absent.
- `tests/pi-hog-ask*.test.mjs` cover schema/controller, the actual registered tool and native Editor, stable IDs, conservative approval, custom text/paste/notes, resize/Unicode, keybindings, focus, lost UI, overlap, abort, disposal and session boundaries.
- `uv run scripts/pi-hog-ask-proof.py --output /tmp/hog-ask-proof` drives the real Pi CLI through a PTY in both regular/fullscreen modes with a temporary offline profile. Its benign fixture invokes the registered production definition without a model, records fresh results through a private sidecar, captures actual terminal cells, and executes no selected action. The proof includes modern/legacy transports, light/dark themes, 36×24 scope/validation scrolling, fullscreen SGR mouse/refocus, and remapped confirmation keys. The development-only fixture/script are excluded from publication. This is runtime evidence, not live-model facilitation or human usability approval.
- The old handler was reproduced with stubbed model/UI before deletion: the mandatory-three-steps fixture opened a selector and injected its first item despite the model veto. The replacement event tests assert the absence of that entire behavior rather than testing a new parser.

Validated against local Pi 0.85.1. No user settings, workstation `/answer`, external question packages, credentials, or installed-release files are changed by this migration.

## Related contracts

- [Shared skill portability](pi-cross-harness-contract.md)
- [Native design implementation plan](../plans/2026-09-13-feat-hog-ask-native-design-plan.md)
- [Historical intentional-question implementation/release plan](../plans/2026-09-13-fix-pi-question-interaction-plan.md)
