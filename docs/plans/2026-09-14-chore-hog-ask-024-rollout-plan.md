---
title: "chore: publish and activate the native hog_ask 0.2.4 release"
type: plan
date: 2026-09-14
status: in_progress
confidence: high
readiness: "Clean release preparation authorized; exact publication and activation approvals pending"
preview_status: approved
---

# Finish the hog_ask rollout

Ship the completed [native implementation](2026-09-13-feat-hog-ask-native-design-plan.md) without including unrelated workstation drafts or confusing source preparation with installed activation.

## Scope and authorization

After the status handoff, Ondrej said **"ok lets finnish this then"** and clarified **"the hog ask"**, selecting the hog_ask rollout rather than the background-helper work. Prepare and verify the release now. The assistant explicitly retained separate approval steps for exact publication and live activation; obtain those approvals after the artifact and target are known. No further implementation/design approval is needed for the already accepted native design.

Do not touch the background-helper project, workstation `/answer`, unrelated working-tree files, themes, keybindings, trust, credentials, or existing immutable releases. No model calls or automatic reload of other sessions. Follow normal npm authentication/browser approval if required; never bypass it.

## Target and rationale

- Public `@heart-of-gold/toolkit@0.2.4`, with registry bytes matching the tested archive.
- A new immutable local release, selected by changing only the existing toolkit package source while preserving all filters and other settings.
- Reload and a benign native interaction confirmed separately from package/source checks.
- Keep immutable 0.2.3 intact as the exact local rollback target.

Use a clean Git export, not the dirty working tree. Reuse the verified Pi/TUI **0.85.1** and Node **25.6.1**, with existing test dependencies; no runtime upgrades. The prior 0.2.3 rollout establishes the packaging/activation pattern. Do not invoke the generic version-bumping release script: 0.2.4 is already prepared and unrelated drafts must remain untouched.

The accepted design and [32-case native proof](../reviews/2026-09-13-hog-ask-native-proof.md) remain the taste/proof references. No new UI is being designed. Reject an artifact with changed implementation bytes, missing files, private state, duplicate registration, failed checks, unsafe approval behavior or unverified cleanup. PTY packets do not certify every physical terminal or OS IME.

## Tasks and gates

- [x] Recheck source/upstream identity, installed Pi version, active toolkit source and unrelated working state. Source is `ef62b0864377f5d4d0f238dfa20afde29036ec47`, equal to the remote branch; active toolkit remains immutable 0.2.3.
- [ ] Make packaged release wording time-independent; commit only rollout-owned documentation. Preserve historical implementation proof and private state.
- [ ] Export the committed source; run full prepublish and visualization checks, then fresh actual CLI/PTY proof with no model calls. Verify implementation hashes against the retained native proof.
- [ ] Pack the clean source, verify every archived file, retain hashes/logs and test the extracted candidate's actual registration/RPC behavior in an isolated profile. Do not install or change the live profile yet.
- [ ] Obtain approval for the exact public archive/version/tag; publish that archive and verify unauthenticated registry bytes/integrity. Record actual authentication attempts without exposing credentials.
- [ ] Obtain approval for the exact immutable local release and source-only settings update; stage without overwriting an existing release, seal, activate and verify fresh-process loaded paths/registration plus a benign interaction. Recheck settings and old-release identity before writing.
- [ ] Ask Ondrej to reload this session after activation, then confirm the new source and actual native interaction. Do not force other sessions to reload.
- [ ] Record publication, activation, verification and rollback separately; commit/push intended documentation and report preserved unrelated dirt. Mark complete only after required gates actually close.

## Acceptance and rollback

All applicable tests pass. Archive manifest matches the clean committed source; registry archive matches the approved local bytes. Runtime extension bytes match the native proof. Exactly one `hog_ask` and all intended launchers load; existing `/answer` remains available. No old automatic extraction returns. Settings differ only in the intended toolkit source; old-release contents remain unchanged.

Rollback is a separately authorized replacement of only the new toolkit source with the preserved `0.2.3-6a1713667c14` source, followed by reload. Never restore an entire settings backup over later unrelated changes. Public npm publication is not reversed by local rollback.

## Evidence boundaries

The source implementation is already complete and pushed (`369ab9e`, closure `ef62b08`). This rollout does not reopen it or claim a fresh independent implementation review. The final host-failure cleanup fix had full regression/PTY proof but no subsequent independent re-review; retain that disclosure. New release checks establish the exact packaged runtime, not physical-terminal/IME certification or live-model reasoning.
