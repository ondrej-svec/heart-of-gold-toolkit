---
title: "fix: make hog_ask follow Pi's question interaction"
type: plan
date: 2026-09-14
status: in_progress
confidence: high
readiness: "Exact corrected preview globally pinned and offline verified; user reload here and native acceptance pending"
preview_status: pending
---

# A question, not a confirmation maze

Use Pi 0.85.1's bundled `examples/extensions/question.ts` as the concrete visual and interaction reference for ordinary questions. Retain the owned approval, cancellation and RPC boundaries rather than installing a different tool wholesale.

## Why this correction exists

After the actual reload, Ondrej rejected the ordinary decision flow: selecting a choice with Enter opened review, whose default Enter action was Back. `hog-ask-ui.ts` deliberately set `reviewIndex = 0`; the test named “neutral Back review” explicitly asserted the resulting loop. Passing tests proved that design was implemented, not that it was usable.

The earlier “Looks good” answer preceded a confirmed reload and is not acceptance of the installed redesign. The subsequent card was dismissed, followed by explicit negative feedback. Publication of the retained 0.2.4 archive is stopped. npm login has been restored, but authentication is not the remaining gate.

Ondrej accepted the recommendation to simplify ordinary questions, then requested: **“also lets make sure that ours is similar to the question in design and that we do the user interaction right.”** This authorizes the correction's native proof slice and tests. The existing bundled question is the accepted reference; the completed native slice must be shown for human review before broadening the correction or preparing another rollout. That initial proof-slice authorization did not permit publication, activation, settings changes, forced reload or rollback. The later exact local-preview authorization and completed source-only activation are recorded below. The previously approved archive is not the corrected artifact.

## Interaction contract

| Situation | Enter / primary action | Escape | Optional note |
|---|---|---|---|
| Ordinary preset answer | Submit the highlighted answer immediately | Cancel | Tab opens a note for the highlighted answer before submission |
| Ordinary custom answer | Submit the entered answer | Return to choices, retaining text/caret | Tab opens a note for this answer before submission |
| Editing an ordinary note | Submit the visible answer and note together | Return to answer editing/choices, retaining the note | Tab also returns to the answer without submitting |
| Approval choice | Open exact-scope review | Cancel/back as appropriate | No generic approval note |
| Approval review | Confirm with the next Enter; no Tab unlock or key-release prerequisite | Back | Request changes remains reviewed feedback, never bare approval |

**Enter never means Back.** Ctrl+Enter is not required for ordinary answers. The primary action always advances or submits. Optional notes are composed before submission, never through a default confirmation screen. The note editor must identify the answer it will accompany. Returning/changing a choice must not silently lose valid or invalid note text; its presence stays visible. Invalid input remains editable and prevents submission until corrected or explicitly cancelled.

Arrows move through choices including the custom row; moving into that row or typing from a preset can focus its inline editor directly. Pointer clicks use the same answer semantics, with hover/drag/refocus/resize never treated as submission. Preserve real Editor text/caret, native mouse forwarding, focus cleanup and owned disposal.

## Visual contract / structural preview

Prefer the bundled question's compact composition: thin accent rules, question first, numbered choices with a simple `>` focus marker, indented muted descriptions and a final custom-answer row. Avoid a large title/status stack, checkbox/radio symbols, full-width button-looking options, repeated warnings, an always-empty form taking up space, or a multi-action confirmation dashboard.

```text
──────────────────────────────────────────────
Who should have access first?
A small pilot before wider exposure.

> 1. Internal only
     Validate with support first.
  2. Public
     Wider reach and greater rollout risk.
  3. Type something…

↑/↓ choose · enter send · tab add note · esc cancel
──────────────────────────────────────────────
```

The native editor appears inline under the custom row when used; a retained custom draft remains visible when focus returns to choices. The optional note is similarly inline and on demand, explicitly labelled with its current answer. Notes are not silently cleared when editing or moving through choices. Hints reflect the actual focused editor and configured bindings; show newline help only while editing. Short cards remain short. Long content scrolls within a bounded body while essential actions remain reachable.

Approval shares this quieter visual language, but still shows the exact action/artifact/revision and separates Approve as written, Request changes and Not now. Its review has the primary Send action and Esc Back, with no default Back target. Reported activation repeats and key releases do nothing. Keep feedback-clearing, cancellation and stale-pointer safeguards. On focus change, return approval review to its prior entry (retaining feedback/caret), so the visible Enter → review → Enter journey restarts; the refocusing click cannot send. Raw legacy Enter cannot distinguish a held key from a fresh press: two CR events can confirm. This is an explicit limitation of the requested simple flow, not physical-release protection.

## Ready work and gates

- [x] Inspect the installed `question.ts` and `questionnaire.ts`, active resources, the faulty renderer path and tests. Neither bundled example is enabled in the current profile; `/answer` is a separate helper. The examples' simple input flow is useful, but they are not substitutes for the owned RPC/approval/lifecycle contracts.
- [x] Record the changed ordinary-question contract, reference, visual structure and stopped rollout. Preserve the historical implementation/proof records rather than pretending their acceptance covered this correction.
- [x] Implement the **native proof slice only** in `hog-ask-ui.ts`, with focused regressions for direct preset/custom submission, notes before submission, draft preservation, keyboard/pointer parity and unchanged approval guards. Replace tests that enshrine Enter → Back; do not merely change their expected text.
- [x] Run the actual offline Pi CLI against this component in regular/fullscreen and narrow/light/dark cases. Present native-cell captures of preset, custom, note and approval flows, plus an explicit key-by-key result record. No new browser-only simulation or live settings change.
- [ ] Obtain Ondrej's acceptance of that native preview. Until then, do not broaden RPC/policy changes, prepare publication or modify the active immutable release. If the flow still surprises the user, revise this contract and proof slice first.
- [ ] After preview acceptance, align the RPC ordinary-question path and guidance with the accepted semantics, preserving exact IDs, optional notes, cancellation and conservative approval results. Keep the core/schema outcome contract unless a separately justified change is necessary.
- [ ] Run full native/RPC/interaction/package suites, independent focused review and all updated actual CLI/PTY cases. Record limitations and preserve unrelated workstation/private dirt; commit/push only correction-owned paths.
- [ ] Prepare a newly identified immutable release candidate with a distinct version/source identity, verify its complete archive, and seek new exact publication/activation authorization. Never publish the rejected 0.2.4 archive or patch an installed release in place.

## Final approval correction — authorized to implement

After the native checkpoint, Ondrej explicitly rejected mandatory Tab → Enter on final approval. The exact e8a41e3 local-preview activation was paused before any pin change. His subsequent **“ok then lets do this and deliver it please”** authorizes implementing and proving **Enter → review → Enter confirms; Esc goes back**. The release/Tab requirement above is superseded, not accepted UX. No timer or Kitty-active flag is substituted for physical-release evidence. Native acceptance, exact new preview activation and publication remain separate gates.

- [x] Replace the keyboard unlock with direct next-Enter confirmation; remove the four release/Tab state fields.
- [x] Replace old fail-closed/Tab tests with exact two-input outcomes, reported-repeat/release non-activation, Esc/re-entry, refocus restart and retained feedback/caret.
- [x] Run the corrected actual CLI/PTY driver in all four profiles and remapped bindings: **40/40** (`hog-approval-enter-r1`). Legacy approval needs exactly two raw Enters, no injected releases or Tab.
- [x] Complete focused independent review and fresh source-bound checks/captures: bounded Terra/medium PASS, independent UI/core **50/50**; full working-tree **37 interaction / 151 Pi / 254 workstation / 2 visualization**. Six fresh cropped native-cell inputs are byte-identical to existing PNG inputs; reference proof remains historical. See the current proof record.
- [x] Prepare the corrected committed preview identity and obtain exact local pin authorization: Ondrej answered **“yes”** to `0.2.4-6e9eab3ce023` → `0.2.5-preview-fc565ca7a034`. The paused e8a41e3 activation script was not executed.
- [x] Create/seal the 284 committed files, atomically replace only the global toolkit source, and verify a fresh offline global-profile process. One `hog_ask`, exact new toolkit paths, unchanged `/answer`, standard editor cancellation, zero model calls/errors; verifier exited and was confirmed absent. Other settings/resource filters and all three prior releases remain unchanged. [Exact activation record](../reviews/2026-09-14-hog-ask-025-preview-activation.md).
- [ ] Ondrej: `/reload` here and judge the actual native flow. No forced reload or separate preview launcher. This source pin is not post-reload human acceptance.

## Historical native preview checkpoint (e8a41e3)

Source version **0.2.5** distinguishes this unactivated proof slice from the rejected immutable 0.2.4. Native code, its tests and the actual CLI driver are corrected; RPC logic/core/schema remain unchanged. The [native capture gallery](../previews/hog-ask-question-native/index.html) compares the installed reference with the real corrected component; it is not an interactive browser mockup. [Proof and limitations](../reviews/2026-09-14-hog-ask-question-ux-proof.md) record **40/40** corrected native CLI/PTY cases, **4/4** installed-reference cases, and full working-tree checks **37 interaction / 149 Pi / 254 workstation / 2 visualization**, no failures or skips. The workstation count includes preserved unrelated drafts, not a clean-release baseline.

Parent inspection also caught a hidden fourth approval focus position after moving feedback inline: Back and Up now return to the visible Request changes row; Down at Not now stays at the final visible row. The new regression asserts that navigation, not just the footer label. The final native run followed that fix and the reference-like description/spacing polish.

No source-only check or gallery view is automatically human acceptance. This checkpoint does not complete the plan, align RPC, prepare an archive, activate 0.2.5 or publish either version. Live settings, both immutable releases (files and modes), the retained 0.2.4 archive and protected tracked dirt were reverified unchanged. The mutable private rollout receipt now records restored authentication, user-reported reload, rejection and stopped publication.

## Rejection criteria and evidence

Reject any ordinary Enter → review → Back loop, mandatory Ctrl+Enter for a normal answer, lost custom/note text on Back, a note that accompanies an undisclosed answer, hidden/overlapping narrow controls, or a visual flow unlike the named reference. Reject any reported activation repeat, focus/hover, stale mouse gesture or dismissed/qualified reply granting approval. Do not claim raw legacy repetition is distinguishable from a new press. Keep the legacy release-provenance limitation honest.

The proof must assert the actual number of input actions to a final result, not merely an intermediate state or eventual success after compensating key sequences. User acceptance belongs after a confirmed reload/preview source identity, not before it. A native-cell capture is visual evidence; emulated PTY packets do not certify every physical terminal or OS IME.

## Scope and risks

No new question engine, batch questionnaire, plugin installation, unrelated keyboard remap, theme rewrite or background-helper work. Reuse the current native Editor, bounds, owner token, RPC transport and approval core. The new immediate ordinary submission must not accidentally share the approval branch. Moving notes into entry must preserve invalid drafts and make the submitted answer obvious. Input/mouse cleanup must remain final after direct submission.

References: the installed Pi 0.85.1 question examples; [prior native plan](2026-09-13-feat-hog-ask-native-design-plan.md); [historical native proof](../reviews/2026-09-13-hog-ask-native-proof.md); [paused rollout](2026-09-14-chore-hog-ask-024-rollout-plan.md). `/ground` is not an available skill here; exact installed source and the already completed version-aware native research provide the local grounding. This is a focused correction, not another cross-harness research project.
