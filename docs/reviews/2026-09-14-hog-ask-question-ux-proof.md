---
title: "hog_ask question-style native proof slice"
type: review
date: 2026-09-14
status: native_preview_accepted
---

# Native question-style correction — source 0.2.5

**Verified correction; subsequent in-session native acceptance is recorded in the [activation and acceptance record](2026-09-14-hog-ask-025-preview-activation.md).** The [plan](../plans/2026-09-14-fix-hog-ask-question-ux-plan.md) follows two explicit rejections: ordinary Enter → review → Enter Back, then mandatory Tab → Enter for final approval. The earlier e8a41e3 preview was approved for local activation but paused before changing the pin. Its approval does not authorize different bytes. Publication of rejected 0.2.4 remains stopped.

## Actual journeys

| Journey | Input and outcome |
|---|---|
| Ordinary preset | One Enter → `answered`, selected ID; no review |
| Custom answer | Down twice or type/paste → Enter → full custom text |
| Custom with note | `Support + internal 🦊` → Tab → `Include support` → Enter → both values |
| Retained note | Tab → `Support first` → Esc → Down → Enter → `public` with the visibly associated note |
| Approval | Enter → exact action/artifact/revision review → Enter → bare `approve`, `approved: true` |
| Legacy approval | Exactly two raw Enters; no Tab or injected key release |
| Feedback | Request changes → text → Enter reviews → Enter sends `needs_discussion`, never approval |
| Escape | Back from review/editing; cancel from choices; Enter never means Back |
| Focus change | Return review to prior entry, retaining feedback/caret; restart the visible two-Enter journey |
| Mouse | Fresh clicks use the same outcomes; refocus, hover, drag, double click and stale/reflowed gestures do not authorize |

Reported activation repeats and all key releases are ignored. **Legacy raw CR cannot distinguish a held Enter from another press: two CR events can confirm.** No timer, Kitty-active flag or release guarantee is substituted for this limitation. Tab is not an approval unlock. Valid, invalid or whitespace feedback must still be explicitly cleared before approving as written. Ctrl+C dismisses even invalid drafts.

Core/schema, RPC, focus observer and outer ownership/lifecycle code are unchanged. Ordinary answers use the controller's internal staging without displaying its review screen. RPC retains its previous ordinary review flow until native acceptance permits alignment.

## Fresh evidence

- Red first: updated UI tests against the old implementation produced **24 pass / 8 fail**. They exposed the rejected Tab/release prerequisite and specified focus restart, rather than preserving the wrong UX in passing assertions.
- Final full working-tree checks: **37 interaction / 151 Pi / 254 workstation / 2 visualization**, zero failures or skips; publish safety/security/compatibility passed. The 254 workstation tests include preserved unrelated drafts, not a clean-release baseline.
- Final UI suite has **33 tests**. Independent reviewer reran UI/core: **50/50**.
- Actual offline Pi CLI/PTY: **40/40**, one complete fresh run (`hog-approval-enter-r1`), regular/fullscreen, modern/legacy, light/dark, 80×40 and 36×24. Includes two-Enter legacy and no-release modern approval, explicit feedback clearing, long scope, invalid drafts, F6/F7 remaps, pointer guards and same-chunk focus before keyboard/mouse dispatch.
- Exact native editor outcomes remain `MabZQcdef` and `Nabc` in pointer/caret/Back/resize journeys.
- Installed reference proof **4/4** is retained historical evidence from `hog-question-reference-r2`, not rerun here. The reference and its driver remain unchanged.

Runtime: Pi/TUI **0.85.1**, Node **25.6.1**, `pyte==0.8.2`. Proof uses disposable offline profiles and benign fixture questions, with no model calls or execution of selected actions. PTY processes are terminated/reaped by their owning `finally` paths.

## Visual provenance

The [gallery](../previews/hog-ask-question-native/index.html) contains actual native-cell PNGs, not interactive browser controls. The six corrected-component crops from the fresh run have **byte-identical cropped cell HTML and styling** to their earlier rasterized inputs. Their existing PNGs are therefore retained, not presented as newly captured screenshots. The reference PNG is historical and unchanged. Cell-equivalence hashes, source/image hashes and all fresh native case outcomes are bound in the [machine-readable record](2026-09-14-hog-ask-question-ux-proof.json).

This correction required no new browser process. The prior approval PNG already displayed `enter send approval` after a release; the corrected component displays that same footer immediately on opening review. The new keyboard tests—not an unchanged image—prove removal of the unlock.

## Independent bounded review

Pi reviewer **openai-codex/gpt-5.6-terra / medium**, session `0d6e1c18-ec4e-4e52-8fc4-1cec434aa596`, reviewed the frozen native UI/test/driver delta against e8a41e3 and relevant unchanged core/host/focus dependencies. **PASS, no important findings established.** Only the permitted UI/core test command was run: **50 passed, 0 failed**. The reviewed Git blob identities are recorded in JSON and rechecked by the parent. This covers the bounded correction, not final cross-harness release readiness or human usability.

## Handoff boundaries

**Activation update:** the exact corrected preview was subsequently authorized in conversation, globally pinned, and verified offline. See the [activation record](2026-09-14-hog-ask-025-preview-activation.md). The source-proof JSON intentionally remains a pre-activation checkpoint. Subsequent approval and ordinary-question tests here received human acceptance, documented separately in the activation record.

The separate launcher was rejected; delivery is a newly identified immutable local preview source for `/reload` **in this session**, not another terminal or browser recreation. Preparation, exact pin authorization, activation, loaded-source verification and human acceptance are separate steps. No npm publication, installed-release patch, dependency/theme/keybinding/trust changes, automatic reload or background-helper work belongs to this scope.

The machine record describes the source-proof checkpoint before activation; any later exact activation belongs in its candidate receipt. Native acceptance was subsequently recorded; RPC/guidance alignment remains unfinished. Earlier pre-reload acceptance, dismissal, historical approval and automated proof do not establish acceptance of this correction. Physical-terminal/OS IME/live-model usability and a full clean release archive remain unclaimed.
