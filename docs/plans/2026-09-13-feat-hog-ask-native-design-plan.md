---
title: "feat: implement the accepted hog_ask design in Pi"
type: plan
date: 2026-09-13
status: complete
confidence: medium
readiness: "Implementation verified, committed and pushed; publication/activation excluded"
preview_status: approved
---

# Native hog_ask: stable input and explicit approval

Implement the [accepted design](2026-09-13-design-hog-ask-visual-preview-plan.md#design-acceptance--2026-09-13), including plain Enter on approval confirmation, in the actual Pi component and its RPC presentation.

## Authorization and boundaries

Ondrej approved the design, then said **"ok lets work on it then"**. This authorizes the follow-up plan and implementation of that design, tests, documentation and source commits/pushes. It does not authorize npm publication, installation/activation, settings/keybinding/theme changes, or modifying immutable releases. Keep all unrelated workstation work untouched.

The old release plan and completed browser-preview plan remain historical records. R3 at `daf1be4` is an immutable proof reference, not a native implementation or proof of the later Enter amendment.

## Problem / target outcome

The installed card still mixes checkbox-like answer markers with custom/dismiss actions, replaces the editor layout, repeats approval warnings, and lacks mouse routing. The accepted replacement is calm and compact: the question leads, focus is clear, custom text is part of the normal focus route, and feedback is not a disguised approval.

**End state:**

- Only real alternatives in the answer list; strong themed focus, subdued hover, no radio/checkbox markers.
- A persistent inline native Editor reachable by Down/Up, Tab/Shift-Tab, printable typing/paste and whole-row pointer clicks. Navigation/Back retain its text and caret. Do not recreate it on focus or switch it to a different form.
- Separate **Approve as written / Request changes / Not now** intents. Request changes enters free-text feedback, requiring a nonempty reviewed answer. Feedback always returns `needs_discussion`, `approved: false`; pending feedback must be explicitly cleared before bare approval. No generic approval note field. Ordinary decisions retain optional notes.
- Exact scope/artifact/revision remain readable; bounded scrolling leaves controls available in narrow terminals.
- Approval confirmation accepts a subsequent deliberate Enter, with Esc to go back. The opening event, key repeat, pointer drag, continued clicks or reflow cannot submit. Ordinary decisions retain neutral review focus and explicit Send.
- RPC retains ID-based dispatch, explicit review, abortable select/input and conservative results while adopting the same approval-vs-feedback intent presentation. RPC clients own their keyboard transport; do not assume native key guarantees there.

## Proposed solution and rationale

Retain `hog-ask-core.mjs` and the public schema/outcome contract unchanged. Refactor only presentation/input handling and mapped RPC workflow. Use the actual Pi Editor for grapheme/caret/paste/IME behavior; keep separate answer/note editor instances to preserve their independent buffers/cursors. Present a cell-based scrolling body with a fixed shortcut footer and map mouse hit targets from the very lines actually rendered. Forward `handleMouse` and `wantsKeyRelease` through `presentTui` without weakening its owner/disposal lifecycle.

Avoid a new form framework, questionnaire engine, automatic extraction, secondary model, persistent/global shortcut listeners, or direct terminal mode/settings changes. One evidence-driven exception is necessary for fullscreen window-focus safety: while this card alone is active, passively observe only raw focus reports before Pi's viewport consumes them; retain at most two trailing bytes, never consume/transform input, and remove the observer on every lifecycle exit. Pi 0.85.1 exposes no usable public focus callback or priority input subscription; independent review verified the listener ordering and this bounded exception. Use injected keybindings and current theme callbacks. Small pure presentation helpers may share labels across native/RPC without moving authorization into rendering.

### Version-aware findings / compatibility question

Installed Pi/TUI **0.85.1** supports `handleMouse`, `wantsKeyRelease`, `isKeyRepeat` and `isKeyRelease`. `ProcessTerminal` requests Kitty flags 7, including event types, but its public `kittyProtocolActive` boolean does not expose the negotiated mask. Therefore do not infer release support from that boolean alone. Observe the relevant release event before arming direct approval confirmation, and never treat a release/repeat itself as submission.

**Legacy limitation:** a stream of raw CRs cannot distinguish fresh presses from held-key repeats. Timeouts are not proof. Ondrej explicitly selected **“Tab → Enter on older terminals”** in `hog-ask-legacy-confirmation` (answered decision, option `legacy-tab-enter`). This authorizes the fallback on paths without observed release provenance, preserving plain Enter after the opening activation's release. It does not authorize publication or activation. Never restore mandatory Ctrl+Enter or claim the fallback detects physical release in raw byte streams; it requires an intervening explicit Tab action rather than accepting Enter-only repeats.

Fullscreen mouse events include local/screen coordinates and optional click counts. Regular mode does not capture the mouse. Native Editor leaves drag handling to the fullscreen renderer's screen selection/copy path; it uses synthesized clicks for caret positioning. Preserve that behavior rather than replacing it with browser assumptions.

## Ready phases and tasks

### 1. Grounding and baseline (agent-owned)
- [x] Inspect accepted design, current card/controller/runtime/tests and installed Pi documentation/source; identify pointer/key protocol constraints.
- [x] Record the legacy-only keyboard fallback disposition before finalizing that dependent path.
- [x] Run existing native/core/RPC baseline checks and retain their outcome (29 passed, `/tmp/hog-ask-native-baseline.log`).

### 2. Native presentation and input (ready independently of legacy disposition)
- [x] Replace mixed checkbox menus with accepted hierarchy, scoped approval intents, stable inline native editors, retained drafts/caret, whole-row focus and a bounded fixed footer.
- [x] Integrate fullscreen mouse forwarding/hit regions, hover without focus theft, native caret placement, drag preservation, scroll coordinates, resize and multi-click/reflow protection.
- [x] Implement explicit review/submission and release/repeat guards, including the agreed legacy disposition; never infer an answer from focus.
- [x] Add focused tests for keyboard and pointer paths, data bounds, paste expansion, Unicode, disposal and narrow/long-content rendering.

### 3. RPC and contract compatibility (ready)
- [x] Align approval labels and the request-changes/free-text path, remove approval's generic note action, retain decision notes and explicit Send.
- [x] Keep exact IDs/scopes, cancellation, invalid UI response rejection, owner locking and stale-session guards; update offline RPC tests without weakening assertions.

### 4. Native proof before completion (depends on phases 2–3)
- [x] Exercise actual CLI/PTY in regular and fullscreen modes at normal/narrow sizes, including enhanced-key release/repeat streams, legacy behavior, SGR mouse coordinates, text/feedback/bare approval, cancellation and long scope.
- [x] Inspect real rendered captures against accepted R3 (not just string tests); verify pointer routing through the actual custom-component wrapper and editor dock.
- [x] Run independent correctness/safety review; fix findings and rerun affected proof.
- [x] Run relevant Pi/interaction/package checks; update runtime documentation, compatibility limits and proof evidence. Prepare source version if required by changed distributable behavior, but do not publish/install.
- [x] Commit/push only verified implementation scope and verify unrelated dirty work is preserved. Mark complete only when required implementation/proof tasks are done.

Publication, activation and any final live usability review are separate later gates. This plan does not authorize them; do not add them as selectable task alternatives or ask for per-task approval inside the ready implementation scope.

## Verified implementation checkpoint

Source version **0.2.4** is prepared. [Native proof](../reviews/2026-09-13-hog-ask-native-proof.md): **32 actual CLI/PTY scenarios**, **47 focused native/core/RPC tests**, full working-tree prepublish/visualization checks, and a clean verification export with **37 interaction-policy / 143 Pi / 148 tracked workstation / 2 visualization tests**, no skips. All **284** curated package-file hashes were verified against the intended source (excluding unrelated workstation drafts). Independent review findings were fixed; two narrow follow-ups found no important residual issue in their scopes.

Captured native cells were inspected in light/dark and narrow layouts. Physical-terminal/OS IME and live-model usability are explicitly not certified by emulated PTY input; those remain rollout checks, not grounds to relabel browser proof as native proof. Installed immutable 0.2.3 and user settings remain unchanged. Private `.pi` state is now excluded and blocked by package safety checks after working-tree pack inspection exposed it; nothing was published.

## Completion

Implementation commit **`369ab9edbae2c682143643e71db3bdc7196db638`** was pushed to `feat/workstation-guide`. All 284 verified distributable hashes were checked again against the committed files. Implementation-owned paths are clean. Intentionally preserved unrelated changes remain in `.github/workflows/workstation.yml`, `workstation/**` and private `.pi/**`; none entered the implementation commit.

The source implementation is complete. Publication, immutable-release preparation/activation and live-session reload were not performed and remain separately authorized rollout work.

## Acceptance / rejection criteria

- Keyboard focus, hover, pointer press/drag/release and retained drafts cannot create an outcome.
- Input stays in the same logical location on focus; the same Editor and its caret survive navigation/review/Back.
- Approve/feedback/pause are distinguishable before submission; no note can be dropped to produce approval.
- Review opens once per action. Plain Enter confirmation is explicit and held/repeated input never crosses into approval. A compatibility exception must be documented and accepted, not hidden behind a timer.
- No click continuation can hit a relocated Send and authorize. Only an explicit fresh submission gesture is accepted.
- Every rendered row fits width; long scope, editor contents and essential controls remain reachable at 36×24, including fullscreen where PageUp/Down may target the transcript.
- Existing cancellation, owner lifecycle, print/JSON unavailability, RPC and `/answer` coexistence remain intact. No model/network/action invocation in proof fixtures.
- Reject checkbox ambiguity, warning-heavy approval, lost text/caret, hidden scope, dead pointer targets, unsafe legacy Enter assumptions, fake native proof, or edits to active installs/unrelated work.

## Assumptions / risks

| Assumption | Evidence and owner |
|---|---|
| Design is approved | Explicit acceptance at `616e3c8`, with the Enter amendment. No need to repeat this gate. |
| Core can stay unchanged | R3 reused it byte-identically; presentation can map feedback to existing custom-answer outcomes. Agent verifies in regression tests. |
| Fullscreen supports pointer integration | Installed 0.85.1 docs and implementation confirm component events. Actual wrapper/dock/coordinate proof remains agent-owned. |
| Native Editor can preserve caret/IME/paste | Existing Editor API and live R3 failure demonstrate why persistent instances are needed. Public render/mouse API reuse; no private state mutation. |
| All terminals can safely use immediate Enter→Enter | **False** for legacy byte streams. The explicit `legacy-tab-enter` decision resolves the product disposition; prove the fallback separately from enhanced key release. |
| 500ms browser pointer protection is a universal terminal guarantee | **Unverified**; native gesture provenance/click-count behavior and actual multi-click tests must be examined, not blindly ported. |
| Tests establish visual fidelity | False: native captures must also be inspected. Later live usability acceptance is not implied by source checks. |

## References / taste contract

Positive reference: [R3 artifact](https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--0173761f/), accepted Enter/Esc amendment, current Calm theme, native Pi Editor.

Anti-reference: original `( )` rows, mixed answers/actions, repeated warnings, Tab-only custom islands, replacing the input on focus, direct instant-submit permission menus and approval comments delivered after execution.

Representative proof slice: one internal/public decision and one exact-scope approval, each with custom input, Back, mouse and keyboard submission, narrow layout, cancellation and qualification. Prove this slice before broadening any interface. No browser-to-native fidelity claim before actual PTY/render verification.

Primary implementation references: `extensions/pi/hog-ask.ts` and its `hog-ask-*` companions, `tests/pi-hog-ask*.test.mjs`, `scripts/pi-hog-ask-proof.py`, and installed Pi `docs/{extensions,tui,keybindings,terminal-setup,rpc,themes}.md` plus their relevant component examples. Grounding reused the pinned [cross-harness research](../reviews/2026-09-13-harness-question-approval-ux.md); no new external harness design was adopted.
