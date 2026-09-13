# hog_ask visual preview — revision 02

**Browser design prototype. Not installed, not a native-terminal screenshot, and not a real approval surface.** Further interaction changes were requested after visual review; production code, immutable releases, and Pi settings are unchanged.

[Open revision 02](https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--36963640/) · [Plan and review gate](../../plans/2026-09-13-design-hog-ask-visual-preview-plan.md)

Ondrej found [revision 01](https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--85d53b33/) better, but asked for quieter approval copy and a cleaner keyboard-first interface. This revision responds to that feedback; it is not yet accepted for production.

## Further review findings

[Cross-harness research and local reproduction](../../reviews/2026-09-13-harness-question-approval-ux.md) found gaps beyond the 34 keyboard checks: Down does not enter custom input, clicking the `›` marker loses focus, and focusing the text field replaces the layout and moves it. The actual text input itself accepts click-and-type. Approval needs clearer separate approve/feedback intents. This revision remains unchanged as evidence; it is not the final accepted interaction.

## The revision

- **Type to reply.** Arrows focus real alternatives; typing or Tab opens a custom answer, preserving the first character and any retained draft.
- **A terminal-style editor, not a web form.** No boxed/resizable textareas or rectangular action-button row. The footer is a compact shortcut strip; browser clicks remain optional conveniences.
- **Quiet feedback.** “Let’s resolve your note first” and **send feedback** replace the discussion/no-approval warning block. The qualification is not an error. Conservative approval semantics are unchanged.
- **Review without a button tour.** Ctrl+Enter sends from review. While editing, it only opens review; a held key cannot carry through into submission. Initial review focus remains Back, so plain Enter does not submit by default.
- **Keyboard fallback.** From Back, Tab moves directly to the note, then Tab to explicit Send; Enter activates it. Escape backs out of the current stage and dismisses from initial choice.
- **Less chrome.** The question, answer, and note do the work. Machine-readable result details are collapsed behind a disclosure instead of dominating the simulated completion.

Review-sheet controls outside the terminal surface are not proposed Pi tabs. The page includes light/dark, 36-column, bare approval, long scope and four-alternative cases.

## Boundaries

The browser adapter uses a build-time byte-identical copy of `extensions/pi/hog-ask-core.mjs`. It does not call Pi, execute actions, persist responses, or grant actual permissions. Any custom approval answer or nonempty note still yields `needs_discussion`, `approved: false`.

**Browser key behavior is not native-terminal proof.** Pi documents that some terminals cannot distinguish Ctrl+Enter, and its fullscreen mode reserves PageUp/Down for transcript scrolling. Native key transport/routing, configurable bindings, paste/IME and lifecycle checks are agent-owned gates before later implementation/rollout. No terminal configuration was changed to make the browser demo work.

Dawn's background/text/secondary/accent are sampled from the supplied screenshot; new light surfaces use Rosé Pine tokens. Moon uses the checked-in Calm palette. The separately managed `rose-pine-dawn-calm` source was not found. Local JetBrains Mono is preferred, with system monospace fallback; no font download occurs.

## Reproduce

```sh
node docs/previews/hog-ask-v2/build.mjs
```

This prints a fresh temporary static-site directory. Serve it with a local static server or the configured `share-html` helper; opening unbuilt source HTML directly is unsupported. The build uses `.js` output because the share server serves `.mjs` as `application/octet-stream`, which browsers reject for modules. `manifest.json` hashes all four served assets and identifies the unchanged controller.

For the optional browser proof, start the workstation browser helper on an unused isolated port:

```sh
BROWSER_CDP_MODULE=/absolute/path/to/web-browser/scripts/cdp.js \
BROWSER_DEBUG_PORT=9337 \
node docs/previews/hog-ask-v2/verify-browser.mjs \
  http://127.0.0.1:4816/s/your-preview/ /tmp/hog-ask-preview-r2-proof
```

The script creates and closes only its own browser target. Scenario/view setup uses the review sheet; answering, editing, backing out, sending and dismissing are exercised with keyboard events, not clicks on answer controls. It makes no model calls or credentialed operations.

## Verification checkpoint

- **34 headless browser checks passed**, including type-to-reply, review-only chords while editing, repeat protection, explicit Send fallback, conservative approval, text/line-limit safety, paging and narrow bounds. No runtime exceptions.
- Light/dark and normal/narrow screenshots inspected. The revised narrow approval fits its scope, response and note without needing the previous large warning/button region.
- Independent review found no important behavior or safety defects; its stale-proof finding was resolved by refreshing both versioned evidence files and these references.
- [Verification results](verification.json) · [verified asset manifest](verified-manifest.json). Screenshots: `/tmp/hog-ask-preview-r2-proof/`.
- Human visual acceptance and native-terminal proof remain outstanding; the [plan](../../plans/2026-09-13-design-hog-ask-visual-preview-plan.md) owns that boundary.
