---
title: "design: hog_ask visual and interaction preview"
type: plan
date: 2026-09-13
status: complete
confidence: medium
readiness: "Design accepted with Enter-to-send on approval confirmation; implementation and native proof remain separately gated"
preview_status: approved
---

# hog_ask: a clear single-choice interaction

Create a styled, interactive design preview before touching the released Pi implementation.

## Problem and evidence

The first live demo exposed a usability gap that the accepted mechanical proof did not settle. Ondrej's screenshot (`img_20260913-163923_BpZ.png`) looks like a multi-select: `( )` markers imply Space toggles, while Enter actually opens review. Answer choices, custom entry, and dismissal look like peers. Repeated recommendation prose and demo instructions dominate the actual question. Focus has insufficient visual weight.

The two alternatives are not the problem; adding more alternatives would disguise rather than solve the mismatch.

## Authorized scope

Ondrej said "lets go thebn" after the recommendation to make actual styled previews of selection, custom text, and approval before another implementation or release. This authorizes the preview phase, its checks, and documentation—not production implementation, npm publication, activation, settings changes, or edits to immutable releases.

The previous [interaction plan](2026-09-13-fix-pi-question-interaction-plan.md) remains a completed historical release record. This is a new design iteration, not a retrospective claim that its implementation tests failed.

## Design acceptance — 2026-09-13

Ondrej explicitly said **"alright makes sense then I approve the design now"** after reviewing revision 03 and agreeing to this amendment on the approval-confirmation screen (`img_20260913-192354_5ti.png`):

- **Enter → Send approval**, after the explicit review screen has opened.
- **Esc → Back**. Ctrl+Enter must not be required to confirm approval.
- The opening keypress, held/repeated input and continued pointer gestures must not carry through into authorization. Native protection remains an implementation-stage proof obligation, not a capability established by this design approval.

This accepts the revision-03 design **with that keybinding amendment** and closes this preview/design-review plan. It does not authorize production implementation, npm publication, activation, or changes to settings/releases. A follow-up implementation plan and explicit execution authorization are still required.

**Evidence boundary:** the published R3 artifact and source at `daf1be4` still use Ctrl+Enter and initial Back focus on approval review. They are retained unchanged as tested evidence. The 72 browser checks do **not** verify the accepted Enter amendment; implementing and testing it belongs to the follow-up implementation scope. The amendment concerns the approval confirmation shown, not an implicit change to ordinary decision/note shortcuts.

## Target end state and subjective contract

**Direction:** calm, compact, terminal-native picker. Strong hierarchy comes from spacing, bold text, a focused-row background, and restrained theme accents—not icons, checkbox/radio symbols, gradients, or ornamental cards.

- Lead with the question; make title/purpose secondary. Say “Choose one.”
- Use one clear focused row. Focus is not a draft answer or submission.
- Keep consequences with alternatives and recommendation rationale with its option, once.
- Custom text has a distinct, directly editable answer area, not another answer option.
- Dismissal belongs in the footer. Keyboard help stays visible while content scrolls.
- Preserve explicit review before Send. Approval confirmation uses a subsequent deliberate Enter to send, with Esc to go back; ordinary decision review retains neutral Back focus. See the accepted amendment above, which supersedes R3's approval-review shortcut.
- Keep exact approval scope and revision readable. Any custom answer or nonempty approval note still means discussion, not approval.
- Pointer and keyboard routes are both first-class in the preview. Native fullscreen pointer integration is a later proof obligation; regular Pi mode does not capture the mouse.

**Positive references:** native command-palette focus, Pi's existing native editor, workstation Rosé Pine Moon Calm theme, the supplied light-theme screenshot.

**Anti-reference:** the supplied screenshot; a wall of equally weighted text followed by mixed checkbox-like actions. Also reject a polished web form whose typography/layout cannot be reproduced with terminal cells.

**Typography and layout:** one monospace size inside the terminal surface, regular/bold weights, whole-line spacing, bounded approximately 72-column reading width, wrapping at 36 columns, a separate persistent footer. The surrounding browser review sheet may use editorial typography, but must not be confused with the proposed Pi component.

**Color:** screenshot-matched light background/text plus Rosé Pine theme tokens; exact checked-in Moon Calm colors. The separately managed `rose-pine-dawn-calm` file has not been located, so do not claim the light preview reproduces that missing theme exactly. Do not repair or alter theme configuration in this task.

## Representative proof slice

One interactive local-only browser artifact with: initial decision; writing and reviewing a custom answer; reviewing a qualified approval; an approval with no note; long scope and Unicode/paste; dismissal; light/dark and narrow/normal layouts. Example outcomes are simulations, not actual permission records. No model requests, commands, credential operations, or external resources in the artifact.

Reuse the existing pure controller in the preview bundle instead of inventing a second approval policy. Bundle a verified copy for serving; the production source remains untouched.

## Tasks and phase readiness

### Ready: preview construction (authorized)
- [x] Inspect screenshot, existing controller/renderer, local themes, and preview/share tooling.
- [x] Author the isolated interactive preview and short reproduction notes.
- [x] Verify browser keyboard flow, focus vs selection, draft preservation, explicit Send, conservative approval, dismissal, and text safety.
- [x] Inspect screenshots in light/dark and normal/narrow layouts; check scrolling and persistent footer.
- [x] Share the preview and record source/check evidence without changing installed code.

### Ready: revision 02 (requested in review)

Ondrej found revision 01 better, but disliked the discussion/no-approval warning and asked for a cleaner, keyboard-led interface. This is a request to refine the preview, not blanket acceptance or authorization to change production.

- [x] Replace the warning block with neutral copy and **Send feedback**, retaining the conservative approval outcome.
- [x] Replace button navigation and boxed/resizable editors with compact shortcut hints and terminal-style text entry; test the keyboard paths without mouse interaction.
- [x] Recheck screenshots, bounded layout, served assets, and documentation for the revised artifact.

Keyboard proposal: arrows focus alternatives; Enter reviews; typing or Tab starts a custom reply. Review still begins on neutral Back, but a dedicated **Ctrl+Enter** shortcut sends from review without tabbing through buttons. In a text editor that shortcut only opens review—never both reviews and sends. Plain Enter on initial review focus still goes Back. Escape goes Back inside the flow and dismisses from the initial choice. Keep a keyboard-accessible explicit Send fallback. Ctrl+Enter transport and fullscreen paging routing are **unverified native-terminal details**, owned by the agent and blocking later implementation/rollout, not browser-preview delivery.

### Ready: revision 03 (authorized after research)

Ondrej's "ok go" authorizes the proposed next preview, not production changes or release.

- [x] Keep one stable inline editor while focusing, clicking, typing and navigating; include it in the arrow/Tab focus route and make its marker/padding clickable.
- [x] Present **Approve as written / Request changes / Not now** as separate intents. Approve/pause retain their canonical IDs; Request changes opens a free-text feedback answer (the existing custom response contract, up to 2,000 characters). Remove the generic note from approval review. Retain optional notes for ordinary decisions.
- [x] Prevent a nonempty feedback draft from being silently discarded by bare approval; clearing feedback must be an explicit action. Preserve drafts on Back.
- [x] Add real coordinate-based pointer checks, focus/geometry and caret checks, drag/refocus safety, keyboard fallback and semantic regression tests; inspect both themes and narrow layout.
- [x] Publish the verified browser artifact, refresh evidence/docs, and record the still-pending visual/native gates.

No semantics are inferred from hover or focus. Clicking an ordinary option opens review, never submits; only an explicit reviewed Send records an outcome. A Request changes activation focuses the editor without manufacturing a blank answer. Keep the unchanged core and no production/API/settings edits.

### Complete: human visual review
- [x] Ondrej reviewed the actual styled preview and explicitly accepted the design with the approval-confirmation Enter/Esc amendment recorded above. Automated tests alone were not treated as visual acceptance.

Production implementation is out of scope for this plan. It requires accepted design, a follow-up implementation plan with native TUI/RPC regression checks, and explicit execution authorization. Publication and activation remain separate actions.

## Acceptance / rejection criteria

- Exactly the real alternatives occupy the answer list; no fake checkboxes and no dismissal/custom row inside it.
- The first screen reads as single-choice without needing an explanation from the assistant.
- Custom input, note editing, review, and dismissal are discoverable and keyboard usable.
- Navigation never sends. Choosing opens review, not submission. Approval confirmation accepts a subsequent deliberate Enter, never the event/gesture that opened it or held-key carry-through; Esc goes back. Ordinary decision review keeps neutral Back focus.
- Approval and feedback are visibly different intents. Feedback produces `needs_discussion`, `approved: false` without a warning or an “Approve + note” intermediate state; bare approval has no generic note field.
- Long scope/content is reachable; controls stay visible at 36-column/24-row-style bounds.
- No live tools, runtime extensions, immutable releases, settings, package versions, or unrelated workstation work changed.
- Reject on continued multi-select ambiguity, low-contrast focus, hidden essential scope, excessive visual noise, lost qualifications, unsafe Send focus, or web-only effects posing as terminal proof.

## Assumptions and risks

| Assumption | Evidence / owner and next verification |
|---|---|
| The semantic controller can be reused unchanged | Verified: pure ESM, no Pi/browser/I/O imports in `hog-ask-core.mjs`. |
| Theme colors and focused background are native-feasible | Verified by Pi themes documentation (`selectedBg`, `text`, `accent`, borders); HTML remains a design approximation. |
| The new visual grouping will resolve ambiguity | Design accepted by Ondrej with the Enter/Esc amendment; native usability and input-safety proof are still required before rollout. |
| Browser behavior will transfer to the real TUI | Not yet proven: agent owns later native-editor, keybinding, paste/IME, focus, fullscreen and RPC checks; blocks later rollout. |

The browser proof must not be called a new native-terminal implementation. Native rendering fidelity and ergonomics remain a later gate. The artifact must not submit an actual approval through `hog_ask` or invoke any real action.

## Preview checkpoints

### Revision 01 — reviewed, refinements requested

- [Original interactive preview](https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--85d53b33/); [source and reproduction notes](../previews/hog-ask-v2/README.md).
- **25 actual headless browser checks passed**, with screenshots inspected in light/dark and normal/narrow layouts. An independent read-only review found no blocking or important correctness findings. Neither result substitutes for human visual acceptance or native-terminal proof.
- The normal approval review keeps its note visible; narrow layouts keep the overflow hint, warning and controls fixed within a 24-row-style budget. The share-server module MIME issue was resolved in the preview build by serving byte-identical `.js` files, not by changing the server.
### Revision 02 — reviewed, further changes requested

- [Keyboard-first preview](https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--36963640/): lighter text entry, no action-button row, type-to-reply, contextual send chord, quiet qualification copy, and explicit keyboard fallback.
- **34 headless browser checks passed.** The main response flows use keyboard events. Normal/narrow and light/dark screenshots were inspected. Independent review found no important behavior or safety defects; its stale-proof finding was resolved by refreshing the recorded verification and manifest.
- Pi's keybinding/terminal setup documentation confirms that native Ctrl+Enter support and fullscreen paging must be verified later. No native compatibility claim or configuration change is implied by the browser proof.
- Installed 0.2.3 remains untouched. The only remaining plan gate is Ondrej's visual review; later production work still requires its own plan and execution authorization.

### Revision 03 — design accepted with keybinding amendment

- [Unified input and approval preview](https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--0173761f/). Stable inline entry supports arrows, Tab, whole-row pointer focus and typing; approval and feedback are different intents with no generic approval note.
- **72 browser checks passed against HTTPS**; **29 existing core/native UI/RPC regressions passed**. Served asset hashes, module MIME and unchanged core identity verified; screenshots inspected in both themes and narrow/normal layouts.
- Independent review found two defects missed by the initial 54 checks: same-coordinate double-click could hit Send after reflow, and Back lost the caret. Continuing multi-clicks and pointer Send during a 500ms review-settling interval are now suppressed; keyboard Send remains deliberate and immediate. Selection/caret are restored. Exact overlap tests at 1280px and 390px and a narrow independent follow-up confirmed both fixes (72/72).
- This pointer-settling behavior is a browser design measure, not a native compatibility claim. Native multi-click/refocus/reflow protection is explicitly required in later implementation proof. No production code, settings, package versions or immutable release changed.
- Human visual acceptance is now recorded above; all preview-plan tasks are complete. The accepted Enter amendment is not implemented in this retained artifact. Production implementation, its native verification, and rollout remain separate, unauthorized phases.

## Research after revision 02

Ondrej found the visual direction good, but requested natural pointer/arrow access to custom entry and better approval behavior, with research into other harnesses. This is qualified feedback, not final acceptance.

[Research and reproducible findings](../reviews/2026-09-13-harness-question-approval-ux.md) compare pinned Codex, current OpenCode, Gemini CLI and official Claude Code sources. In our browser preview, Down excludes custom entry, the `›` marker loses focus when clicked, and entering the textarea moves it by 133px in the tested viewport. The actual text field itself accepts click-and-type; the issue is not a complete lack of mouse support. Existing 34 checks did not cover these boundaries.

The next proposed interaction uses a stable inline editor in the normal focus route, full-row click targets, hover feedback without stolen typing, and explicit approve/request-changes/pause intents. Generic approval-plus-note should not masquerade as approval and then change meaning. This proposal preserves the existing conservative response contract and explicit Send gate; it does not authorize production implementation or waive human review.

Pi 0.85.1 documents real component mouse support in fullscreen mode; integrating it should be a native proof obligation, not dismissed as a browser-only convenience. Regular mode still leaves mouse handling to terminal scrollback. No preview code, native extension, settings, release or package version changed during this research checkpoint.

## References

- [Interaction contract](../architecture/interaction-contract.md)
- [Original mechanical proof](../reviews/2026-09-13-hog-ask-proof.md)
- `extensions/pi/hog-ask-core.mjs` and `extensions/pi/hog-ask-ui.ts`
- `pi-workstation/themes/rose-pine-moon-calm.json` (sibling repository, read only)
