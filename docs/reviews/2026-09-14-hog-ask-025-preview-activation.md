---
title: "hog_ask 0.2.5 corrected local preview activation"
type: review
date: 2026-09-14
status: awaiting_user_reload_and_acceptance
---

# Corrected preview pinned — reload here next

This is a **local native preview**, not publication or final design acceptance. The [correction plan](../plans/2026-09-14-fix-hog-ask-question-ux-plan.md) remains in progress. Ordinary answers submit directly; approval uses **Enter → review → Enter confirms**, without a Tab unlock. Esc goes back. Reported activation repeats are ignored; raw legacy Enter cannot distinguish a held key from another press.

## Exact authorization and identity

Ondrej answered **“yes”** to the explicit request to switch only the global toolkit source from `0.2.4-6e9eab3ce023` to `0.2.5-preview-fc565ca7a034`, preserving other settings and old releases, without publishing or forcing a reload. This is fresh ordinary-conversation authorization, not reuse of the paused e8a41e3 approval.

| Field | Exact value |
|---|---|
| Committed source | `fc565ca7a034bf1947ab76347dccaf40c089ed38` |
| Previous global source | `0.2.4-6e9eab3ce023` |
| New global source | `0.2.5-preview-fc565ca7a034` |
| Manifest SHA-256 | `b9bdc6c79f16eb497b95b5acb99b020e525f7629d1b9c4f7a474c4acd8896c3b` |
| Curated distributable files | 284 |
| Packaged changes from 0.2.4 | `README.md`, `extensions/pi/hog-ask-ui.ts`, `package.json` |
| Fresh global-profile verification | `2026-09-14T15:14:44.534Z` |

The private candidate receipt and manifest are retained under the artifact directory named `0.2.5-preview-fc565ca7a034`. No archive was packed or published. Candidate preparation used frozen committed Git blobs, not the dirty working tree, and matched all 14 recorded proof-source hashes. Six candidate RPC/registration checks passed before authorization.

## Activation and verification performed

- Preflight checked every candidate file against its manifest **and exact committed Git blob**, verified packaged modes, unique old source and unchanged settings since preparation. The check-only pass wrote nothing.
- Created a new release directory, copied exactly 284 verified files, and removed write permissions from all files/directories. Rechecked the sealed file set, hashes and modes. No installed release was edited in place.
- Replaced only the toolkit source string using a same-directory atomic settings rename, with exact pre-write comparisons. Parsed settings equal the previous settings with that single package source changed. Resource filters/composition, other packages and all other settings were preserved.
- Verified all three prior release trees (including files, directory modes and ownership), the stopped 0.2.4 archive, and protected unrelated tracked files unchanged.
- Started one fresh **actual global-profile** Pi 0.85.1 process in offline RPC mode with no session persistence and a temporary read-only inspector. Verified the exact new launcher/skill paths, exactly one `hog_ask`, unchanged workstation `/answer`, and no old toolkit command paths.
- Opened the standard plan editor and cancelled it. No model calls, extension errors, invalid JSON or stderr. Terminated/reaped the owned verifier and confirmed its PID absent via ESRCH. The verifier did not change settings.

The [source proof](2026-09-14-hog-ask-question-ux-proof.md) records native **40/40**, independent UI/core **50/50** with bounded PASS, and working-tree **37 interaction / 151 Pi / 254 workstation / 2 visualization**. These are separate evidence from fresh global-profile verification and do not certify every physical terminal or human usability.

## Later settings observation, preserved

The end-of-session full-settings equality check **failed** after successful activation and initial global-profile verification: the only changed top-level key was `theme`. The toolkit source and complete package/resource composition still matched. The actor responsible for that later change was not identified; no setting was overwritten or restored. The original activation settings hash and initial successful verification remain historical records, not a claim that all settings stayed frozen afterward.

One bounded fresh global-profile recheck against the observed current settings passed the same registration, path, `/answer`, editor-cancellation, no-model/no-error and process-exit checks. It left settings unchanged. The failed equality check and subsequent observation/recheck are recorded separately in the private receipt; passing the recheck does not erase the earlier difference.

## Remaining gates

- Ondrej runs `/reload` **in this session**; no session was forcibly reloaded. Future/reloaded sessions use the new global source, while already-running sessions keep their loaded code until reload.
- Confirm post-reload native keyboard/visual behavior. Neither source pin approval nor offline verification is design acceptance.
- After native acceptance, align ordinary RPC/guidance behavior and complete the later clean-release checks and exact release authorization. Publication of rejected 0.2.4 remains stopped.

No runtime/dependency, theme, keybinding, trust, authentication or background-helper changes were made. No background trial or deployment permission is implied. Rollback, if later requested, must be a separately authorized source-only replacement, never restoration of a stale full settings backup.
