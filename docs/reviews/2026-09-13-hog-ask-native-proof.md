---
title: "hog_ask native design: implementation proof"
type: verification
date: 2026-09-13
status: verified
---

# Native design implementation — source 0.2.4

**Historical implementation evidence, not final usability acceptance.** After the later local activation and user-reported reload, Ondrej rejected the ordinary Enter-to-Back interaction. Publication was stopped. The [question-style correction](../plans/2026-09-14-fix-hog-ask-question-ux-plan.md) supersedes that part of this design; the recorded test results below still describe the original implementation.

Scope: the [accepted design and Enter amendment](../plans/2026-09-13-design-hog-ask-visual-preview-plan.md#design-acceptance--2026-09-13), implemented under [the native plan](../plans/2026-09-13-feat-hog-ask-native-design-plan.md). Ondrej authorized implementation with “ok lets work on it then” and subsequently selected **Tab → Enter on older terminals** in the answered `hog-ask-legacy-confirmation` decision (`legacy-tab-enter`). Continuing to completion does not expand the plan's explicit publication/activation exclusions.

**At the implementation handoff, source 0.2.4 was not published or activated.** The active immutable source then remained `0.2.3-6a1713667c14`. That implementation did not change installed releases, user settings, themes, keybindings, credentials, or unrelated workstation work. The subsequent [0.2.4 rollout record](../plans/2026-09-14-chore-hog-ask-024-rollout-plan.md) tracks separately authorized activation and publication. Core/schema semantics remain byte-identical to HEAD before this implementation.

Implementation **`369ab9edbae2c682143643e71db3bdc7196db638`** is committed and pushed on `feat/workstation-guide`. All 284 curated distributable hashes match that committed source. Only unrelated workstation/private working state remains dirty.

## Implemented slice

- Persistent answer/note Editors retain drafts and caret. Arrows, Tab/Shift-Tab, typing/paste and whole-row pointer focus share one entry surface. Focus is not a selected answer; hover does not steal typing focus.
- Approval separates **Approve as written / Request changes / Not now**. Feedback is required, reviewed custom text and always `needs_discussion`, never approval. Pending feedback requires explicit clearing. Ordinary decisions retain optional notes; approval has no generic note field.
- Approval confirmation uses the next deliberate Enter after the opening activation's release. When release provenance is unavailable, Tab → Enter is the explicit fallback. Back and refocus disarm both. Raw Enter-only repetition and reported Enter/Tab repeats cannot submit/arm. The fallback is not a claim that raw streams expose physical releases.
- Fullscreen mouse routing uses actual rendered cells, guards continuing/reflowed gestures, preserves native caret/drag behavior, and never refocuses a disposed card after Send. Regular mode retains terminal-owned mouse/scrollback.
- Scope/review text and validation remain keyboard-accessible at 36×24. Ctrl+C (the host clear-editor action) can dismiss even invalid drafts; Escape remains Back.
- RPC adopts the same intent labels/feedback path while preserving mapped IDs, explicit neutral review, abortable dialogs, lifecycle ownership and conservative outcomes.

## Evidence

```sh
node --test tests/pi-hog-ask*.test.mjs tests/pi-rpc-smoke.test.mjs
uv run scripts/pi-hog-ask-proof.py --output /tmp/hog-ask-native-proof-r10
uv run --with pyyaml npm run prepublishOnly
npm run test:visualize
```

- **32 actual CLI/PTY scenarios passed** in regular/fullscreen, enhanced/legacy profiles, light/dark themes and normal/36×24 layouts. Includes exact result text/notes/scope, opening release/repeat, Tab fallback, remapped F6/F7 confirmation/cancellation, narrow scope/validation scrolling, native SGR caret/marker/drag/hover, wheel-scrolled hit coordinates, resize during a pending gesture, explicit feedback clearing, fresh mouse Send, next-dialog input after pointer completion, and same-chunk window refocus plus keyboard/pointer activation.
- Full working-tree checks: **37 interaction-policy, 143 Pi, 254 workstation and 2 visualization tests**; publish-safety, security and harness-compatibility checks passed. Workstation counts include preserved unrelated development tests, not a clean release certification.
- A verification-only clean source export also passed **37 interaction-policy, 143 Pi, 148 tracked workstation and 2 visualization tests**, with no skips. Its **284 packaged files** exclude unrelated workstation drafts. Distributable changes were compared with the working source; intentionally excluded edits to workstation files were compared with their tracked HEAD versions. This is not npm publication or an activated immutable release.
- Native component tests use the actual Pi Editor and prove its cursor anchor, Unicode/grapheme caret, expanded paste, full invalid-draft preservation, editor/selector binding separation, Back, feedback clearing and owner-safe disposal. Public core/schema/outcome contracts remain unchanged.
- The [retained verification record](2026-09-13-hog-ask-native-proof.json) stores case verdicts, suite counts and exact source hashes. `/tmp/hog-ask-native-proof-r10/` contains `verification.json`, terminal `.txt` captures, cell-attribute `.html` captures and selected PNG rasterizations. These are actual PTY cell results, not the R3 browser implementation. Local source hashes identify the tested implementation.
- Inspected entry, custom, feedback-review, narrow-scope and legacy-fallback captures. The inline field stays recognizable while unfocused; there are no checkbox/radio menus or duplicate editor/footer borders. Rendering is themed through Pi callbacks.

The proof starts only owned temporary offline Pi processes, uses a private result sidecar instead of matching stale transcript outcomes, and terminates its own children. Browser rasterization created and closed an isolated context/target in a private temporary profile; its owned browser/watcher were stopped. Unknown existing debug endpoints were left alone.

## Findings that changed the implementation

| Finding | Resolution / regression |
|---|---|
| Wrapper omitted mouse and key-release forwarding | Forward both through the actual custom component; wrapper and real CLI proof. |
| Fullscreen consumes focus reports before public input listeners | Card-lifetime passive TTY `prependListener`, recognizing only focus reports and retaining at most a two-byte escape prefix. Disarm before same-chunk host dispatch; remove on every exit. No input consumption or terminal-mode changes. |
| Fullscreen review could not inspect all scope text | Approval arrows scroll; decision review scrolls at focus edges. Real 36×24 start/end scope checks. |
| Old note displayed after replacing an answer, but omitted from Send | Synchronize note display to the committed answer on identity changes. |
| Mouse “review note” navigated Back | Separate action matching keyboard note review. |
| Ctrl+Enter opening release ignored | Match the opening primary key, including when Ctrl is released first; next plain Enter can send feedback. |
| Host custom-UI setup threw/rejected after creating the view | Outer `finally` disposes the view/observer even without a host disposer or `done`; a failing-before/fixed-after test covers throw, rejection and lost results. |
| Host `setFocus` toggles false/true even for the same owner | Do not request redundant focus during an already-owned mouse gesture. |
| Completed mouse Send reclaimed focus from the restored editor | Never return a focus request after disposal; prove the next dialog can open. |
| Function-key releases detected but not matched by Pi 0.85.1 | Normalize unmodified CSI-tilde spelling only for binding matching, classifying event type from original bytes; real F6 release/repeat proof. |
| Narrow validation could hide below the editor | Follow the validation message, retain the full draft and allow explicit cancellation. |
| Working-tree pack included private `.pi` todo state | Exclude `.pi/` and add a publish-safety block/contract regression. No package was published. |

The initial native component suite passed despite multiple integration defects. A completed independent Sol review requested changes; a completed narrow Terra follow-up found no important residual issue in the reviewed fixes. The later F6 matcher defect was found and fixed by real PTY proof, with a focused regression. A final narrow independent review of physical-key matching/reset bookkeeping also found no important issue (25 native tests passed). The last host-failure cleanup fix followed those reviews; it passed the regression, full suites and all 32 PTY scenarios, but was not independently re-reviewed. No review is misrepresented as physical-terminal testing.

The proof harness also needed corrections: uppercase `ESC` was not the real displayed binding, blind cleanup Esc presses opened Pi's session tree after an already-completed result, short Escape delays merged into Alt chords, and unframed command text/CR could coalesce under load. It now waits for raw-mode/editor readiness, frames command pastes, waits for rendering and stops a failing profile rather than guessing modal state. Scrolled pointer probes require the editor content row—not merely its caption—to be visible before deriving a click coordinate. Failed intermediate runs are not counted as final proof.

## Limits and rollout boundary

Pi/TUI **0.85.1**, Node **25.6.1** were exercised. PTY packets emulate terminal transports: this is not certification of every physical terminal, OS IME candidate window, or live-model facilitation. Unicode/committed text, native cursor-marker emission and real cell placement are covered; physical IME/live usability remain rollout checks. Stock light/dark themes were exercised, not a pixel-perfect claim about a separately managed Calm theme.

R3's retained **72 browser checks** remain historical browser evidence; they are not relabeled as native or Enter-amendment proof. A working-tree pack smoke is also **not** a release artifact: unrelated workstation drafts remain dirty. Publication must use a verified clean tracked-source export and requires separate authorization, as do immutable-release activation and any live-session reload.
