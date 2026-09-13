# hog_ask visual preview — revision 01

**Browser design prototype. Not installed, not a native-terminal screenshot, and not a real approval surface.** Human visual review is pending; production code, 0.2.3 publication, installed releases and Pi settings are unchanged.

[Open the interactive preview](https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--85d53b33/) · [Plan and review gate](../../plans/2026-09-13-design-hog-ask-visual-preview-plan.md)

The page uses one direction across three main states: choose, write a custom answer, and review a qualified approval. Dark/light, 36-column, bare approval, long scope, and four-alternative views are available in its review controls. Controls outside the bordered terminal area are the browser review sheet—not a proposal to add those tabs to Pi.

## What changed visually

- A focused row replaces checkbox-like markers; the list contains only real alternatives.
- The question leads; rationale sits with its recommendation, without duplicate copy.
- Custom answers have their own directly editable field.
- Notes sit beside the draft review instead of behind another menu.
- Back starts focused. Send remains explicit. A qualified approval changes the button to **Send for discussion** and keeps the no-approval warning visible.
- The body can scroll independently; the footer, overflow hint, and keyboard help stay visible in a 24-row-style height budget.

The browser adapter imports a build-time byte-identical copy of `extensions/pi/hog-ask-core.mjs`. It does not call Pi, execute actions, persist responses, or grant actual permissions. Browser clicking, textarea resizing, and DOM accessibility are not promises of equivalent native-terminal behavior. The semantic review contract is preserved; this is not a proposal to make Enter immediately submit an ordinary decision.

Dawn's `#f9f2eb` background, `#4c496c` text, `#6d6a87` secondary text and `#83709d` accent were sampled from the supplied screenshot. New light surfaces use Rosé Pine tokens. Moon uses the checked-in workstation Calm palette. The separate `rose-pine-dawn-calm` source was not found; no configuration repair was attempted. Local JetBrains Mono is preferred, with system monospace fallback; no font download occurs.

## Reproduce

From the toolkit repository:

```sh
node docs/previews/hog-ask-v2/build.mjs
```

This prints a fresh temporary static-site directory. Serve that directory with a local static server or the configured `share-html` helper. Opening the unbuilt source HTML directly is not supported: module files are assembled by the build. `.js` output is intentional because the configured share server serves `.mjs` as `application/octet-stream`, which browsers reject for ES modules.

The build emits `manifest.json` with the source controller SHA-256 and hashes of all four served assets.

For the optional browser proof, start the workstation browser helper on an unused isolated port, then:

```sh
BROWSER_CDP_MODULE=/absolute/path/to/web-browser/scripts/cdp.js \
BROWSER_DEBUG_PORT=9337 \
node docs/previews/hog-ask-v2/verify-browser.mjs \
  http://127.0.0.1:4816/s/your-preview/ /tmp/hog-ask-preview-proof
```

The script creates and closes only its own browser target. It writes cropped screenshots, a whole-page overview, and `verification.json`. It makes no model calls or credentialed operations.

## Verification checkpoint

- **25 headless browser checks passed:** actual keyboard navigation, neutral Back focus, explicit Send, custom/Unicode text, retained drafts and notes, dismissal, blank/line-limit validation, bare/qualified/custom approval outcomes, narrow scrolling, fixed controls, and no runtime exceptions.
- Screenshots inspected: light and dark selection/review, custom entry, 36-column choices and approval, long-scope scrolling, and a small browser viewport.
- Normal-width review displays the qualification without scrolling; narrow views retain a clear overflow hint and the discussion warning.
- Independent read-only review found no blocking or important correctness findings. This is not Ondrej's visual acceptance.
- Native TUI keybindings, paste/IME, terminal cell rendering, fullscreen interaction, RPC compatibility and lifecycle behavior remain future implementation-stage checks.

Evidence for this revision: [25 browser checks](verification.json), [verified asset manifest](verified-manifest.json), and local screenshots in `/tmp/hog-ask-preview-proof/`; the browser-facing tailnet URL above serves the exact verified artifact. The [plan](../../plans/2026-09-13-design-hog-ask-visual-preview-plan.md) owns the human review gate. No production work is authorized by the existence of this preview.
