# hog_ask visual preview — revision 03

**Browser design prototype. Not installed, not a native-terminal screenshot, and not a real approval surface.** Human visual acceptance is pending. Production code, immutable releases, package versions and Pi settings remain unchanged.

[Open revision 03](https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--0173761f/) · [Plan and review gate](../../plans/2026-09-13-design-hog-ask-visual-preview-plan.md) · [Cross-harness research](../../reviews/2026-09-13-harness-question-approval-ux.md)

## The revision

- **One stable input.** Down moves through options into custom entry; Up at the start of the text returns to the last option. Tab/Shift-Tab follow the same route. Type-to-write and paste remain shortcuts. Focus alone does not select an answer.
- **A coherent mouse target.** Click the text, marker, or row padding to write. Hover highlights without stealing typing focus. The same textarea stays mounted on focus; direct text clicks preserve native caret placement and drag selection. Back preserves text, selection and caret position.
- **Distinct approval intents.** **Approve as written / Request changes / Not now**. Approve and pause retain canonical option IDs. Request changes opens the existing custom-answer route (up to 2,000 characters) and returns `needs_discussion`, `approved: false`. It does not manufacture an empty answer.
- **No approval-plus-note surprise.** Approval review has no generic note field, warning or policy banner. Feedback is visibly feedback from the beginning. Optional notes remain available for ordinary decisions.
- **No discarded conditions.** A nonempty feedback draft prevents bare approval until explicitly cleared. The row explains “Clear your feedback first”; the clear action appears only when there is text. Switching focus cannot clear it.
- **Deliberate review and Send.** Initial review focus is Back. Ctrl+Enter in an editor only opens review; repeated Enter cannot carry through to Send. Pointer activation ignores continuing multi-clicks, and pointer Send arms 500ms after review opens to reject rapid clicks whose click count resets across reflow. Keyboard Send remains immediate and explicit.
- **Keyboard fallback.** From review Back, approval uses Tab → Send → Enter. Decisions use Tab → optional note → Tab → Send → Enter. Escape goes back; from entry it leaves editing first, then dismisses.

The static review sheet includes light/dark, normal/36-column, feedback draft, bare approval, long scope and four-alternative scenarios. Its controls outside the terminal surface are not proposed Pi tabs. No external fonts/assets are fetched.

## Review findings repaired

The initial **54 checks passed but missed two real defects**. Independent review reproduced:

1. **P1: double-click reflow could authorize.** At 36 columns, an entry option and the subsequent Send overlapped at the same pointer coordinate. The second click could approve without a deliberate review. The revised suite asserts actual rectangle overlap, then sends coordinate-based double/triple clicks and rapid reset-detail clicks at both 1280px and 390px browser widths. Continued clicks stay blocked even after the settling interval; fresh explicit Send still works.
2. **P2: Back reset the caret.** `xyz → review → Back → Q` became `Qxyz`. Selection start/end/direction are now captured and restored, and prefilled demos begin at the end. Tests verify both selection retention and `xyzQ` continuation.

A separate narrow follow-up review confirmed both fixes and reran **72/72** browser checks. This is a verified preview checkpoint, not subjective visual acceptance or production approval.

## Verification checkpoint

- **72 headless browser checks passed against the shared HTTPS URL**, with real coordinate-based pointer events for answer controls (not `element.click()`). Scenario/viewport setup uses the surrounding review sheet.
- Tests cover stable node identity/geometry, arrows/Tab/Shift-Tab, real Shift+Enter, caret/selection, whole-row click targets, hover, drag, reflow/multi-click safety, draft preservation, separate feedback/approval/pause, explicit keyboard/pointer Send, Unicode/escaped text, bidi rejection, full 2,000-character feedback, over-limit text preservation, notes, dismissal, scrolling and bounds. No runtime exceptions.
- **29 existing core/native UI/RPC regression tests passed.** These confirm the unchanged implementation's baseline, not native compatibility of the new browser design.
- Served HTML/CSS/modules match the fresh bundle hashes byte-for-byte; JavaScript MIME types and unchanged controller identity verified over HTTPS.
- Light/dark and normal/narrow screenshots inspected. At narrow widths, long scope takes priority; scrolling and navigation expose the input while the footer remains fixed. Incidental hover is moved outside the frame for initial-state screenshots.
- [Verification results](verification.json) · [Verified asset manifest](verified-manifest.json). Screenshot evidence: `/tmp/hog-ask-preview-r3-proof/`.

## Boundaries

The adapter uses a byte-identical build-time copy of `extensions/pi/hog-ask-core.mjs`. It does not call Pi, execute actions, persist responses or grant actual permissions. Full text is validated by the existing core rather than truncated by textarea `maxlength`.

**Browser behavior is not native-terminal proof.** Pi 0.85.1 documents fullscreen component mouse handling, but this design still requires native hit-region/focus integration, drag/refocus and multi-click/reflow protection, configurable keybindings, paste/IME, lifecycle and RPC proof. Regular mode leaves mouse ownership to terminal scrollback. Some terminals cannot distinguish Ctrl+Enter; Pi fullscreen reserves PageUp/Down for the transcript. No terminal configuration was changed.

Dawn's background/text/secondary/accent are sampled from the supplied screenshot; new light surfaces use Rosé Pine tokens. Moon uses the checked-in Calm palette. The separately managed Dawn Calm source was not found. Local JetBrains Mono is preferred, with system monospace fallback.

## Reproduce

```sh
node docs/previews/hog-ask-v2/build.mjs
```

This prints a fresh temporary static-site directory. Serve with a local static server or configured `share-html` helper. Opening unbuilt source HTML directly is unsupported. Build output uses `.js` because the share server serves `.mjs` as `application/octet-stream`; `manifest.json` hashes all four assets and identifies the unchanged controller.

```sh
BROWSER_CDP_MODULE=/absolute/path/to/web-browser/scripts/cdp.js \
BROWSER_DEBUG_PORT=9337 \
node docs/previews/hog-ask-v2/verify-browser.mjs \
  https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--0173761f/ \
  /tmp/hog-ask-preview-r3-proof

node --test tests/pi-hog-ask*.test.mjs tests/pi-rpc-smoke.test.mjs
```

The verifier creates and closes only its own isolated browser target. CDP modifiers use the documented bitmask (Shift **8**, Ctrl **2**); the older helper's Shift value **1** meant Alt, which this iteration caught when adding Shift-Tab coverage. No model calls or credentialed operations occur.

Earlier artifacts remain available: [revision 01](https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--85d53b33/), [revision 02](https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--36963640/). The [plan](../../plans/2026-09-13-design-hog-ask-visual-preview-plan.md) retains the human acceptance and later native/production gates.
