---
title: "hog_ask question-style native proof slice"
type: review
date: 2026-09-14
status: preview_pending
---

# Native question-style correction — source 0.2.5

**Verified native preview, not an accepted or activated release.** The [correction plan](../plans/2026-09-14-fix-hog-ask-question-ux-plan.md) follows Ondrej's rejection of Enter → review → Enter Back, and his request to make the design and interaction resemble Pi's bundled question. The [capture gallery](../previews/hog-ask-question-native/index.html) shows real terminal cells from the installed reference and corrected component. Its controls are images, not a browser simulation.

## Changed user journeys

| Journey | Actual input and outcome |
|---|---|
| Preset | Open question → **one Enter** → final `answered`, `internal`; no review/Back or compensating keys |
| Custom | Down twice → type/paste → Enter → final custom answer |
| Custom with note | Down twice → `Support + internal 🦊` → Tab → `Include support` → Enter → final custom text plus note |
| Note, Back, change answer | Tab → `Support first` → Esc → Down → Enter → `public` plus retained note; current association visible before sending |
| Mouse caret and Back | Native field click/edit → Tab to note → Esc → continue editing/drag/padding click → Enter → exact `MabZQcdef` |
| Hover/resize | Hover does not take choice focus; resize invalidates a started mouse gesture; a later fresh click returns exact `Nabc` |
| Approval | Enter opens exact-scope review; matching release followed by a fresh Enter confirms. Repeat/unrelated release/refocus does not confirm |
| Legacy approval | Repeated raw CR stays unsubmitted; explicit Tab → Enter works. No invented physical-release receipt |
| Feedback | Request changes → required text → review → deliberate Send → `needs_discussion`, never approval; valid/invalid/whitespace feedback cannot silently become bare approval |
| Cancellation | Esc goes Back or cancels as labelled; Ctrl+C cancels even invalid custom/note text |

Ordinary answers are intentionally staged through the existing controller internally; that does **not** expose its review state as another user screen. Core/schema, the RPC adapter, passive focus observer and outer host lifecycle implementation are unchanged. RPC still has the previous ordinary review flow until the native preview is accepted and the next phase aligns it.

The reference's compact rules/numbered rows/descriptions/custom row are reused as a design model, not copied wholesale. In particular, the installed example clears custom text on Esc; this correction deliberately retains native text/caret. It also retains optional notes, exact scope, configured bindings, bounded input, normalized results, owner cancellation and native mouse safety, which the minimal example is not a substitute for.

## Checks actually run

- **31 focused native UI tests**, including the replacement for the old “neutral Back review” test. Tests assert one-action final outcomes, not eventual success after extra navigation.
- **57 focused native/core/RPC/package tests** passed; those overlap the full Pi suite below and are not additional independent coverage.
- Full **working-tree** prepublish checks: **37 interaction-policy / 149 Pi / 254 workstation**, plus publish safety/security/compatibility; visualization **2/2**. No failures or skips. The workstation count includes intentionally preserved drafts; it is **not** the clean tracked-release baseline of 148 or archive proof.
- Final corrected native actual CLI/PTY driver: **40/40**, regular/fullscreen, modern/legacy emulation, stock light/dark, 80×40 and 36×24. Includes exact results, long-scope boundaries, invalid drafts, explicit feedback clearing, F6/F7 remaps, hover/caret/drag, resize and raw focus-before-dispatch guards.
- Installed `question.ts` reference: **4/4** actual CLI cases, ordinary preset and custom submission in regular/light and fullscreen/dark. Reference SHA-256: `a1625d2c72a65d859154a7e66bef222d48ca9e3654a8bb910829ad350378a4c4`.
- Python AST checks for both proof drivers; `git diff --check`; documentation/frontmatter/local-link and gallery checks.

Pi/TUI **0.85.1**, Node **25.6.1**, existing `pyte==0.8.2` proof dependencies. Only temporary offline Pi profiles and benign commands were used; no application model calls or actions were triggered. Each PTY profile's owned process is terminated/reaped by its `finally` path. Capture rendering used an owned isolated headless browser context, never a regular browser profile. The browser required forced termination after a bounded normal-stop wait; its exact owned identity was rechecked before that signal, and both browser/watcher process groups were then verified absent via ESRCH. Public PNGs contain only the native card between its visible rules; host paths, runtime identities and private logs were cropped out.

The [machine-readable record](2026-09-14-hog-ask-question-ux-proof.json) binds source/capture hashes and final case results. Raw terminal/log evidence remains private under the retained `hog-question-ux-r4` and `hog-question-reference-r2` temporary artifact directories, not in the package or repository.

## Problems caught rather than concealed

Parent inspection found that relocating approval feedback inline left a hidden fourth focus position. A new failing regression exposed incorrect feedback hints/navigation. Esc/Up now return to the visible Request changes row, and Down at Not now stays at the final visible option. The final tests followed this fix.

The first reference helper assumed the CLI was only two directory levels below its package; the installed CLI is deeper. It now finds the expected named package through bounded actual-path ancestry and verifies the exact version, rather than silently choosing another reference.

The final reference-like spacing made the last custom row scroll off the initial narrow viewport. An intermediate proof run failed because readiness incorrectly waited for that offscreen row. Readiness now waits for the initial focused choice; subsequent real arrow/mouse/validation cases still verify that the custom editor is reachable. The final **40/40** is a fresh complete run after that correction, not a merged total from partial runs.

## Review and release boundaries

The implementation delegate completed and retained a successful result/exit record despite a parent pane-control error; the parent inspected the diff, found/fixed the navigation issue and reran checks. No fresh independent review of the final slice is claimed. The later full-correction gate still requires one.

An isolated user-run preview profile was prepared privately with the same source/fixture settings as the automated proof. Its launcher validates the recorded source hashes before opening the pinned Node/Pi CLI; shell syntax and the source-check-only path passed. It was not automatically launched and does not replace the user's global profile. The handoff supplies its local command so actual keyboard use can be judged before activation.

Human acceptance remains **pending**. The earlier pre-reload “Looks good,” subsequent dismissal and explicit rejection of 0.2.4 do not approve this preview. Native-cell captures and emulated PTY packets are not universal physical-terminal/OS IME or live-model facilitation certification.

No new archive was packed, no npm publication attempted, no installed release edited, and no settings or forced reload applied. Source 0.2.5 is distinct from the rejected active 0.2.4. The active settings, both old/new immutable trees (file bytes and modes), retained 0.2.4 archive and protected unrelated tracked files were checked unchanged. Restored login and user-reported reload are recorded separately from the failed usability gate. Publishing the rejected 0.2.4 archive is stopped; a future corrected candidate requires new exact artifact authorization.
