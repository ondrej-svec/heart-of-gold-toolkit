---
title: "fix: make Pi questions intentional and preserve conversational planning"
type: plan
date: 2026-09-13
status: complete
confidence: medium
readiness: "0.2.3 published, activated and verified; implementing session reload confirmed"
preview_status: "Structural previews and recorded terminal/RPC proof approved; no revisions requested"
related:
  - docs/plans/2026-04-14-feat-pi-guided-workflow-enhancement-plan.md
  - docs/architecture/pi-guided-workflows.md
  - docs/architecture/pi-cross-harness-contract.md
---

# Intentional questions and conversational planning

Stop converting reports into choices. Keep conversation natural, ask deliberately at genuine decision boundaries, and show required work as progress rather than selectable scope.

## Context and authorization

This plan captures the investigation and external research discussed with Ondrej on 2026-09-13. After the planning commit, Ondrej requested implementation ("ok lets go"). Phases 1–2 were completed. After the preview handoff, Ondrej replied "yeah fine,continue", approving the structural direction and authorizing Phase 3. After the working-proof handoff, Ondrej replied "ok I think thats fine", accepting the recorded terminal/RPC proof without requesting revisions. The proof-feedback gate is satisfied. That acceptance alone did not authorize publishing or profile changes. Ondrej subsequently requested "alright then publish and activate?", authorizing both. Local activation and npm publication are now verified. After restoring npm login, Ondrej confirmed readiness for its separate browser approval; publication succeeded. No separate brainstorm document exists for this discussion.

Detail: **standard**, with explicit phase gates because the work changes facilitation and approval semantics. Confidence is high in the reproduced defect and the desired interaction split, medium in routine usability until real use beyond the accepted proof.

## Problem statement

The current enhancer inspects assistant prose at `agent_end`. Its model prompt treats explicit "options or next steps" as candidate choices. A `none` or low-confidence model result falls through to a heuristic that converts the first contiguous 2–5-item list into `single_choice`. No actual request to choose is necessary. Even required checklist items qualify, and a preceding task list can displace a genuine question later in the message.

The investigation reproduced the production handler with model/UI stubs: a high-confidence `none` response explaining that all steps were mandatory still opened a selector, whose chosen label was injected as a user message. All 15 existing focused guided/dialog tests passed; the negative progress fixture had no bullet list and missed this class of failure. This was a local code reproduction, not an attribution to a particular historical session.

Supporting problems:
- The card uses generic branding, fixed colors, and a closed option list without an inline custom-answer route.
- Slash-command workflow state can linger through natural-language transitions; question extraction makes an additional model call with hard-coded model/provider fallback.
- Shared skills encourage fixed handoff menus and ask the user about researchable unknowns.
- `plan` defaults to `status: approved` and recommends `/work` regardless of readiness; `work` equates receiving a plan path with pre-approval.
- Compatibility checks require old structured-UI phrases; Codex transformations reinforce them.

## Target end state

| Surface | Use | Must not do |
|---|---|---|
| Ordinary conversation | Brainstorming, explanations, open feedback; optional user-invoked answer assistance | Open a form because prose contains a list or question |
| Explicit decision card | A real unresolved choice or a named approval boundary | Turn required steps into alternatives or infer approval |
| Progress report | Required tasks, dependencies, blockers, completion | Become a second task tracker or an interactive scope selector |

The main agent owns whether a question is needed. Shared skills own portable conversational policy. Pi owns optional presentation, answer transport, and terminal lifecycle. The Markdown plan remains the authoritative execution tracker.

## Scope and non-goals

**In scope:** the Pi enhancer/entrypoint, a small namespaced decision tool, conversational policy in `brainstorm`, `plan`, `architect`, `think`, `investigate`, `review`, and `work`; relevant documentation, installer transforms, compatibility checks, and regression coverage.

**Not in this change:** installing a community questionnaire package; replacing Pi's editor; a generic form engine; multi-select, conditional forms, or batch dialogs; rewriting all toolkit skills; a new persisted todo system; automatic execution from UI callbacks; a universal permissions/security layer; editing the separate workstation package or its `/answer`; publishing or activating a release without authorization.

Small independent question batches remain possible in prose. More elaborate forms are deferred until real usage demonstrates a need.

## Decisions and rationale

### Retire automatic extraction, rather than tune it indefinitely

Phase 1 removes the post-turn conversion path from the shipped extension. It does not merely make `none` authoritative and then retain a permissive fallback for errors. No automatic legacy mode is retained.

Reason: an inferred modal is unnecessary under the agreed conversation-first policy. Removing the path eliminates both the proven fallback defect and future disagreement between the main agent and a second extractor. Maintaining two automatic question systems would recreate duplicate prompts.

The currently installed workstation `/answer` remains optional and untouched. Standalone toolkit users can always answer in plain text; they do not need that package. A portable toolkit-owned answer-assistance command is a later, separately justified feature, not a dependency of this plan.

### A focused tool, not another workflow mode

Add one Pi tool named `hog_ask` to avoid claiming generic community names such as `ask_user` or the existing `/answer` command. It is deliberately callable by the agent wherever a genuine decision is needed, not activated by inferred skill state. Tool guidance must name `hog_ask` and reinforce the shared policy, not mandate it for every question.

One question per call, with `purpose: decision | approval`. No post-answer command dispatcher, mode switching, or side-effecting callback. Return the user's response to the agent; existing work/deployment guards remain responsible for their own boundaries.

### Short shared rules, self-contained skills

Document the full contract under `docs/architecture/interaction-contract.md` and put the essential rules directly in each touched skill. Installed skills must not depend on repository-only docs or another plugin being installed. Do not add a cross-plugin knowledge-file dependency solely to avoid repeating a short rule block.

Preserve the useful reasoning phases; remove automatic questionnaires and fixed handoff menus, not the underlying research or acceptance standards.

## Shared question and readiness contract

1. Inspect what the agent can inspect before asking. Ask the user for intent, preferences, unavailable facts, or consequential choices that cannot be resolved from evidence.
2. Required work inside an authorized scope is reported and executed in dependency order. Skipping it is a scope change, not an ordinary selection.
3. Ask one focused question when its answer determines the next question. At most three independent, related clarifications may be grouped in prose. Include a recommendation and brief reason where evidence supports one; do not manufacture a default for open-ended discovery.
4. Preserve settled decisions unless new evidence materially changes them. Stop interviewing when the current phase is clear enough to proceed.
5. Classify unknowns as user-owned decisions, agent-owned investigation, or later verification. Name the blocking phase and owner. "Open" does not automatically mean "ask the user now."
6. Use structured UI only for a meaningful decision/approval; ordinary prose is always a valid fallback. Offer non-overlapping alternatives for a single-choice decision. Multi-step obligations are not alternatives.
7. Separate document existence, execution readiness, and authorization. A filename, highlight, recommendation, blank answer, dismissal, or timeout is not approval.
8. New plans start as `draft` unless their scope has actually been approved. Readiness/preview gates remain separate from status. `/work <path>` explicitly requested as execution can authorize the stated scope; merely mentioning a path or requesting its review cannot. Legacy approved plans need not be mass-migrated, but their status alone does not override current user intent or unresolved gates.
9. A blocker prevents only dependent work. Do not offer unrestricted implementation when a current prerequisite or required preview is missing. Resolve agent-owned prerequisites within the authorized phase; request user input only for the missing user-owned decision.
10. End with the result and the appropriate next step, not a ritual menu. Never re-ask an already authorized transition; never cross from planning into implementation on the basis of a suggested next step alone.

For `architect`, route to creating/continuing an execution plan when one is missing; do not advertise unrestricted implementation based on stories alone. For `work`, retain autonomous execution after authorization and readiness checks, and preserve its existing checkbox/progress contract.

## Decision-card contract

- Input: stable question `id`, `purpose`, short contextual `title`, one `question`, necessary `context`, and options with stable `id`, `label`, and short consequences. Decision options: 2–4 genuinely alternative answers; optional recommendation references an option ID. Require unique option IDs and normalized labels; RPC uses an explicit display-label-to-ID map (including disambiguated UI actions), never a guessed index or label-only persisted answer.
- Approval additionally names the concrete action/scope and, when relevant, artifact path/revision. Use fixed outcomes `approve`, `revise`, and `pause`; no recommended or initially selected approval. This is an interaction record, not a new cryptographic authorization mechanism.
- Keep keyboard focus separate from committed selection. Recommendation is a visible badge/rationale, never a submitted answer by default.
- Always expose custom text and an optional note on a selection. The UI supplies the custom-answer action; it is not a model-authored option and is never returned as a literal selection.
- Return structured details containing the question, purpose, scope, selected option ID/label or actual custom text, and note; also return a readable question-and-answer summary in tool `content`.
- Distinguish `answered`, `needs_discussion`, `dismissed`, `unavailable`, and `aborted`. Approval custom text is `needs_discussion`, not an approval. Only an explicit submitted `approve` selection records approval of the named scope.
- Choice plus note is reviewed before sending so the user can qualify it. For v1, any nonempty approval note produces `needs_discussion`, retaining the intended selection and note but not granting approval. The agent resolves the qualification and presents the revised scope if approval is still needed; no heuristic decides whether a note is harmless. Notes on ordinary decisions remain part of the answered result.
- TUI: inline editor-area card using native components and the active theme/keybinding manager. RPC: standard abortable `select`/`input` dialogs preserving context, custom answer, note, and final confirmation (see transport refinement below). Print/JSON: explicit `unavailable`; do not retry automatically or infer consent.
- One active card; sequential tool execution plus a session-local, owner-token lock. An overlapping invocation returns `unavailable` with reason `interaction_in_progress`, opens no UI, and leaves the first card unchanged; do not automatically queue or retry it. Release only the owning lock in `finally`, with abort/session cleanup invalidating stale completions. On dismissal/abort, stop this tool's continuation safely and do not authorize dependent work. Tool guidance prohibits sibling actions that depend on its answer in the same assistant message. This UI does not make already-running unrelated tools transactional.
- Persist question/response data in tool-result details, associated with the active branch. No global mutable decision ledger. No answer injection from stale views after reload, navigation, or shutdown.

## Subjective contract and structural preview

**Target outcome:** a thoughtful collaborator who does the homework, explains the consequential choice, and lets the user answer naturally.

**Anti-goals:** a branded wizard, a requirements interrogation, a form after every reply, decision-making outsourced to the user, or a selector that conceals the actual obligations.

**Taste rules:** task-specific title; branding secondary or absent; recommendation with a reason; concise labels with nearby tradeoffs; active Pi theme and editor conventions; all meaning readable without color; no first-option bias presented as consent.

### A. Required work — ordinary message, no card

```text
Three required steps remain: verify the API contract, add regression
coverage, and update the rollout notes. I'll do them in that order.

Progress: 2 of 5 complete. Next: verify the API contract.
```

This wording applies only within already authorized execution. During planning, say these are implementation tasks; do not imply implementation is starting. Plain progress is sufficient for v1; do not build an independent progress widget or parse arbitrary prose into tasks.

### B. Real decision — approved structural direction

```text
Decision: rollout audience
Who should have access in the first release?

Internal only is my recommendation: it gives us a smaller pilot.

  ( ) Internal only [recommended] — validate before broader exposure
  ( ) Public                     — wider reach, more rollout risk
      Write a different answer

Answer: Internal only
Note:   Include the support team in the pilot.

Review answer                         Send / Back / Dismiss
```

The lower review section appears after selection, not as a prefilled default. Focus styling is independent of the empty selection markers. At narrow widths, descriptions wrap below labels; the decision and its qualifications must remain readable.

### C. Approval — whole scope, not a task checklist

```text
Approval: implement the agreed plan
Scope: the three required tasks in the displayed plan revision.
Does not include deployment or publishing.

  ( ) Approve this scope
  ( ) Revise the scope
  ( ) Pause
      Discuss instead

No option selected. Review before sending.
```

**Required preview/proof gate:** Ondrej reviews these representative states (including custom answer, qualified selection, approval, dismissal, and narrow layout) before Phase 3 implementation. The sketches are a starting artifact, not evidence of usability approval. Revisions belong in this plan first. After implementation, show one real terminal proof slice and RPC equivalent before expanding beyond the single-card scope.

**Rejection criteria:** required work is selectable; uncertainty becomes approval; custom text requires leaving the flow; the question hides its consequences; branding dominates; normal chat triggers a modal; a required answer can be silently skipped; the RPC version drops important context or notes. Any such failure returns the affected phase to revision.

## Implementation tasks and phase gates

Checkboxes track implementation progress. The structural preview, recorded runtime proof, and subsequent release/activation request are approved. Local activation and npm publication are verified. Ondrej confirmed the implementing session's reload; its refreshed context exposes `hog_ask` and the 0.2.3 skill paths. All implementation and release tasks are complete.

### Phase 1 — Remove the false-choice path (independently shippable)

- [x] Add regression fixtures and a mocked production-event test demonstrating required steps, unchecked checklists, completed-work lists, acceptance criteria, and a task list before a real question. Capture the old `none`-to-selector failure before changing behavior.
- [x] Retire automatic `agent_end` extraction and its workflow detection, list heuristics, loader, and hidden extraction-model routing. Remove dead code rather than leave a configurable unsafe path. Keep `brainstorm`, `plan`, `architect`, sharing, and work-guard entrypoints intact.
- [x] Replace obsolete extractor tests with extension-level assertions: no form, secondary model request, or synthetic answer after ordinary assistant output, regardless of slash-command entry, natural-language transition, model-result fixture, or queued follow-up. Preserve tests for still-used standard-dialog helpers; migrate/remove unused helpers with their callers.
- [x] Update `README.md` and `docs/architecture/pi-guided-workflows.md` in this phase: remove active-enhancer/debug claims, document retirement of `/deep-thought-guided-debug`, and explain plain-text answering and the optional separately installed `/answer`. Identify the April enhancer plan as historical. Verify package discovery remains singular and launcher commands actually load the intended skill using the installed Pi API's expansion semantics.
- [x] Run the new event regressions and `npm run test:pi`, including package-load and RPC launcher smoke coverage, before treating Phase 1 as shippable. Any standalone release must also satisfy the Phase 4 release/activation boundaries and applicable publishing checks; do not defer correctness verification until the card exists.

**Exit:** ordinary workflow turns never auto-open question UI; the focused/full Pi checks pass and the migration docs match the shipped behavior. Existing launcher/guard behavior and RPC availability are preserved. This fix does not wait for decision-card preview approval; it requires its own explicit implementation authorization.

### Phase 2 — Align shared policy and planning readiness

Depends on Phase 1's behavioral contract; independent of card implementation.

- [x] Add the authoring contract and concise self-contained rules to the seven scoped skills. Remove mandatory fixed menus, researchable-question outsourcing, and canonical `AskUserQuestion` requirements from the touched skills. Preserve natural choices and plain-text fallback.
- [x] Update `brainstorm` unknown ownership and stopping rules; update `plan` draft/readiness/preview handling; update `architect` plan handoff; update `work` authorization versus path-presence handling without reintroducing per-task approval.
- [x] Update `src/utils/transform.ts` so Codex wording preserves conditional UI use instead of restoring blanket preferences. Verify Pi/OpenCode transformations do not change semantics.
- [x] Update `scripts/check-harness-compatibility.py` and add focused authoring/transform fixtures. Replace obsolete phrase requirements with checks for the new contract, portable fallbacks, and absence of harness-only dependencies. Do not simply delete the compatibility gate.
- [x] Walk through representative conversations: clear request, ambiguous scope, agent-researchable unknown, missing preview, approved execution, review of a plan path, and completed work. Record expected ask/report/proceed behavior and review actual rendered/installed skill text; string checks alone cannot prove question quality.

**Exit:** no touched skill or installer adaptation contradicts the contract. First-phase blockers and subjective gates are visible; approved dependent work does not become optional.

### Phase 3 — One deliberate decision card

Depends on Phases 1–2 and Ondrej's preview approval; do not substitute autonomous approval for this gate.

- [x] Refine and obtain review of the structural preview above, including narrow layout and approval/custom-answer outcomes. Record disposition here before implementing the renderer.
- [x] Add `hog_ask` through `extensions/pi/index.ts`. Separate schema/validation and a pure interaction controller from TUI rendering and transport. Prefer existing dependencies/native components; add a peer dependency only if directly needed under Pi's documented packaging rules.
- [x] Implement the card contract: deliberate invocation, no preselection, inline custom text, selection notes, review/back/send, explicit outcomes, and readable plus structured results. Do not use a secondary model to author or explain the card.
- [x] Implement RPC dialog parity and explicit print/JSON unavailability. Handle cancel, abort, late completion, session changes, and one-active-card cleanup. Keep launchers and existing guards separate.
- [x] Add schema, controller, renderer, event-lifecycle, and RPC tests. Verify duplicate IDs/labels, stable-ID round trips, invalid recommendations, approval notes/custom text, empty inputs, resize, long/Unicode text, configured keybindings, focus propagation, lost UI, and no answer emitted after disposal. Exercise two overlapping invocations in both TUI and RPC: only the owner opens UI; a rejected second call cannot release its lock; cancel/shutdown followed by a new call cannot receive a stale answer. No live model calls or credentialed operations in automated tests.
- [x] Run a terminal proof slice and RPC equivalent with benign fixtures; get Ondrej's feedback on the actual interaction. **Runtime proof completed and [recorded](../reviews/2026-09-13-hog-ask-proof.md); Ondrej accepted it with "ok I think thats fine", with no revisions requested.** Revise within this scope before broader use if subsequent feedback requires it.

**Exit:** one meaningful decision can be answered, qualified, revised, or dismissed without changing its meaning across supported UI modes. No generic batch/multi-select system has been introduced.

### Phase 4 — Verification, documentation, and release handoff

- [x] Extend the Phase 1 migration docs in `README.md` and `docs/architecture/pi-guided-workflows.md`, plus the portability contract, with the now-verified decision-card behavior and three-surface contract. Do not restore automatic enhancement or describe unimplemented UI as available.
- [x] Run focused new tests, `npm run test:pi`, and compatibility/publish/security checks. Use the repository's supported Python environment (for example `uv run` on the check scripts); do not install packages into a global Python environment. Run full prepublish checks for an actual release and classify unrelated baseline failures explicitly.
- [x] Verify standalone Pi package, skills-only install, and a profile containing the existing workstation `/answer`: no duplicate command/tool, no required dependency on that workstation, and no lost RPC path. Use isolated test profiles; do not alter the user's live profile for a smoke test.
- [x] Prepare scoped commits and version changes consistent with `CONVENTIONS.md` (deep-thought/marvin manifests and marketplace versions where affected; root package as appropriate). Update the hard-coded root-version assertion in `tests/pi-package-contract.test.mjs` with any intentional root bump. Do not run the release script over unrelated dirty work or use its `--ship` as a shortcut to unrequested publishing.
- [x] Record source SHA, checks, preview disposition, and activation instructions. Only after explicit release/activation authorization, publish or stage a clean immutable release and update the configured source. Verify the loaded source and a real prompt interaction; pushing a source commit alone does not fix an already pinned installation. **0.2.3 published as npm `latest`; downloaded registry bytes exactly match the verified tarball. Immutable local activation and real interactions are verified. Ondrej confirmed `/reload`; the implementing session now exposes `hog_ask` and skills from the verified 0.2.3 release.**

**Exit:** verified source and a clear release handoff. Production activation is separately recorded, never inferred from a push. If only Phase 1 ships, this overall plan remains incomplete with later tasks unchecked.

## Acceptance criteria

1. The reproduced mandatory-step message never opens a selector or generates a user answer. The same holds for all negative fixtures and mixed report/question messages unless the agent deliberately calls `hog_ask`.
2. No hidden extraction-model call, automatic post-turn question modal, or stale guided-workflow state remains in the shipped path.
3. Shared skills and transformed installs distinguish user decisions, agent research, phase blockers, progress, and execution authorization. Merely reviewing or supplying a plan path does not start work.
4. A user can select an alternative, add a qualification, write a different answer, review/backtrack, or dismiss a decision card. Recommendations are not answers; approval custom text or a nonempty approval note returns `needs_discussion`, not unconditional approval.
5. RPC retains the same decision meaning and information. Print/JSON report unavailability without inventing answers; cancellation/abort cannot produce a late submitted answer.
6. Markdown plan tasks remain authoritative. No per-task scope selector, independent persisted tracker, or automatic side-effect dispatcher is added.
7. Existing commands/guards work; standalone and workstation-combined profiles avoid collisions. Tests cover the actual extension path as well as pure helpers.
8. Preview approval, terminal proof feedback, source verification, and any installed activation are recorded separately and honestly.

## Assumptions, risks, and mitigations

| Assumption / risk | Status / evidence | Handling |
|---|---|---|
| The installed enhancer matches the inspected source | Verified during investigation; Pi extension directories were identical | Recheck configured source before implementation/activation; never patch an installed release in place |
| Removing unsolicited forms is preferable to preserving them behind a flag | Agreed direction: natural conversation plus deliberate decisions | Explain migration; retain plain-text operation; do not replace it with global tool enforcement |
| Pi supports custom TUI, standard RPC dialogs, tool details, and sequential tools | Verified in current installed docs and official/community source | Pin/test the supported runtime at implementation; preserve fallbacks rather than copy TUI-only code |
| A single card with review is comfortable enough for routine use | Recorded proof accepted; routine use remains unverified | Preserve plain conversation as default; proof acceptance is not a claim of hands-on usability testing |
| Updated prompts will reduce unnecessary questions in practice | Unverified behavioral effect | Scenario-based conversation review in Phase 2 and real-use proof; do not claim regex checks establish this |
| Codex adaptations/checks may retain old UI policy | Verified exact-string transforms and required snippets | Change and test authoring plus installer behavior together |
| Generic community tool/command names may collide | Existing workstation `/answer`; many packages own `ask_user` | Namespaced `hog_ask`; no ownership of `/answer` or Pi's `/plan` command |
| Approval UI could be mistaken for a security boundary | A tool cannot retroactively stop unrelated running actions | Explicit scope/result semantics; no dependent sibling calls; keep existing guards intact |
| Source push may be mistaken for installation | User runs a pinned release path | Record distinct source, release, and activation states; activation needs authorization |
| Unrelated workstation changes are already present | Verified at planning time | Stage only owned files, do not stash/reset others, do not publish a dirty checkout |

## Implementation record

### Verified publication and local activation

- Ondrej requested "alright then publish and activate?". This authorizes publication and activation, independently of earlier proof approval. No additional scope was inferred.
- Exported only tracked commit **`6a1713667c14d47a3f5b1d48a383b5766fb1eac8`** (implementation `8d14ba5` plus proof-acceptance documentation). All **389 tracked files** matched their Git blobs; no dirty workstation files entered the build.
- Clean-export checks passed: **37 interaction-policy + 124 Pi + 148 workstation + 2 visualization tests**, full prepublish, security, compatibility and publish-safety (**282 packaged files**). The smaller workstation/package totals exclude previously counted uncommitted work. Installed the four dependency versions from `bun.lock` without lifecycle scripts or saved manifest changes after its stale peer metadata prevented a frozen Bun install.
- Packed `heart-of-gold-toolkit-0.2.3.tgz`; all **282 extracted files** matched the verified export. Sealed a new read-only release at `$HOME/.local/lib/heart-of-gold/releases/0.2.3-6a1713667c14`. The old release was not modified; its tree digest is unchanged.
- Updated **only** the Heart of Gold package source in `$HOME/.pi/agent/settings.json`, preserving its skill filters and every other setting. Settings backup, package, integrity receipt, logs and terminal captures live under `$HOME/.local/lib/heart-of-gold/artifacts/0.2.3-6a1713667c14/`.
- The sealed release passed five RPC checks and actual regular/fullscreen PTY interactions (custom text, note, qualified approval, narrow long-scope navigation and dismissal). A fresh process using the actual global profile confirmed the new extension/skill source paths, exactly one `hog_ask`, the existing `/answer`, no retired debug command or load errors, and a real plan-editor open/cancel. These checks made no model calls.
- **Publication completed:** after npm login was restored (`ondrejsvec`), the first browser-approval attempt timed out. Ondrej then said "ok ready"; a fresh attempt completed npm's normal browser approval and exited successfully. Published the retained tarball as **`@heart-of-gold/toolkit@0.2.3`**, public, with tag **`latest`**. No approval or authentication check was bypassed.
- **Registry verification:** npm reports version/latest **0.2.3**. The registry integrity is `sha512-sYnxacx+acXw9yXMDMh3srGjcnKQVSYmV2ra7cLydBCpbB46RWbZf4xD28TaflRONgZuoN2vPFPgVi0wp9KciA==`; an unauthenticated HTTPS download matched the tested tarball byte-for-byte. `registry-verification.json` and the updated receipt are retained beside the archive. No dirty working-tree content was published.
- **Reload confirmed:** Ondrej reported "reloaded". The implementing conversation's refreshed context now includes `hog_ask` and skills under the verified `0.2.3-6a1713667c14` release; the configured source and package version were rechecked. This closes the final task. Other previously opened sessions may still need `/reload`; none were remotely interrupted.
- **Rollback:** replace only the new source path with the preserved `0.2.0-staging-guard-e1110a118793` source and reload. Do not restore the whole backup over intervening settings changes.

### Proof acceptance and release handoff (before release authorization)

- Ondrej accepted the linked working proof with "ok I think thats fine". No revisions were requested. This closes the Phase 3 feedback gate, not the release/activation gate.
- Verified implementation source: **`8d14ba5`**, pushed to `origin/feat/workstation-guide`; root version **0.2.3**. The verification results below belong to that implementation. This follow-up changes documentation only.
- At that checkpoint, publication and installed activation were **not authorized or performed**. The later authorization and local activation are recorded above; no source implementation task remains.
- After explicit authorization: recheck the configured source and repository state; stage or publish a new immutable release from the verified clean source commit; update the intended Pi source; reload; verify the actual loaded source, ordinary prose without popups, and a benign deliberate question. Never patch the pinned `0.2.0-staging-guard-e1110a118793` release or include unrelated dirty workstation work.

### Phase 3 — verified single-card proof (pre-feedback checkpoint)

- Implemented one `hog_ask` tool through the singular entrypoint: bounded TypeBox schema/runtime validation, pure controller, native Editor card, RPC transport and session-local owner lifecycle. Added only the directly used `typebox` peer; no model/extractor, generic form system or answer dispatcher.
- Outcomes preserve IDs, full question/scope, text/notes, readable Q&A and branch origin. Focus/recommendation/selection/Send are distinct. Only unqualified submitted approve records approval; any custom approval or nonempty note needs discussion. Abort, overlapping calls, lost UI and stale completion are conservative.
- Parent review fixed expanded-paste preservation, bounded scrolling, neutral review focus and cleanup around a stale session manager. Pi fullscreen owns page keys, so menu-edge arrows also expose long scope/review text. A delegated read-only review was interrupted before a verdict and is not counted as independent approval.
- Real offline Pi 0.85.1 PTY proof passed in regular and fullscreen modes, including custom answer, note, qualified approval, resize to 36×24, long-scope scrolling and dismissal. Real RPC preserved the qualifying note and returned `needs_discussion` / `approved: false`; real print/JSON returned `unavailable` without UI/model requests. [Working proof for feedback](../reviews/2026-09-13-hog-ask-proof.md).
- Final source checks: **37 interaction-policy + 124 Pi + 204 workstation + 2 visualization tests passed**; full `prepublishOnly`, compatibility, security, publish-safety (**284 packaged files**), Python AST and whitespace checks passed. Workstation totals include unrelated pre-existing tests. Standalone, skills-only and existing-workstation-`/answer` profiles loaded in isolation; the combined test was run, not skipped.
- Root source version **0.2.3**; no shared skill/plugin versions changed in this phase. Source baseline: `229ec51`; the new scoped commit's SHA is reported in the work handoff. No package publication or installed-profile mutation occurred.
- **Handoff checkpoint:** proof feedback was pending at the implementation push; it is now accepted as recorded above. The plan is now complete: proof acceptance, publication, activation, and the implementing session's reload are recorded above. Never patch the pinned release in place or publish unrelated dirty work.

### Phase 3 kickoff — structural approval, not activation

- Ondrej approved continuing from the linked structural previews with "yeah fine,continue". Implement the one-card scope; actual terminal/RPC proof feedback still remains to be collected. No publication or installed-profile change is authorized.
- API-grounded transport refinement: Pi 0.85.1's `ui.editor(title, prefill)` has no abort option and leaves a pending RPC request until the client responds. Use standard **select/input** dialogs for RPC custom answers/notes so all stages accept an AbortSignal; inputs preserve text and always have a separate review step. TUI uses the native multiline Editor. RPC clients own layout and may present input as a single line. This replaces the planned RPC editor transport, not question/approval semantics.

### Phase 1 — verified source, not activated

- Before deletion, the full Pi suite passed 53 tests. A separate invocation of the actual production handler with a stubbed high-confidence `none` model response failed the required-work assertion: it opened the mandatory-three-steps selector and injected its first label (two effects instead of zero). No real model/UI or publication operation was used.
- Removed the enhancer/core and obsolete extraction/dialog fixtures. Added eight conversational fixtures and actual-entrypoint event/launcher tests. Existing work guards were not changed beyond the launcher's skill-expansion option.
- Current Pi 0.85.1 documents `expandPromptTemplates: true` as required for extension-emitted skill expansion. All seven launchers now opt in, both idle and queued; tests assert the exact target and delivery options. A real isolated offline RPC profile still discovers skills and opens/cancels the standard plan editor.
- Verification: **96 Pi tests passed**, plus compatibility, publish-safety (279 packaged files), security regression, and diff-whitespace checks. Root source version is 0.2.1; no package was published and no installed profile was changed.
- Phase 3 previews remain unreviewed. The separate workstation `/answer` and pre-existing workstation edits remain untouched.

### Phase 2 — verified source; preview gate remains

- Seven scoped skills now carry self-contained conversation/unknown-ownership/readiness rules. New plans default to draft unless scope was actually approved. Natural execution requests and explicit work commands have the same meaning; paths/reviews do not authorize work. Independent ready phases retain quality/commit/push checkpoints without marking the whole plan complete. Architect keeps its stories/architecture boundaries and pipeline outputs, handing off to the plan skill rather than implementing from stories.
- Added `docs/architecture/interaction-contract.md`, updated portability/README guidance and the Codex adapter, and expanded the compatibility gate. Regression fixtures caught the adapter rewriting `read/review` into `read$review`: seven assertions failed before command-token boundaries were fixed.
- Static conversation/installed-text walkthrough: [review record](../reviews/2026-09-13-interaction-policy-walkthrough.md). This is source/transformation evidence, **not live-model facilitation or UI usability proof**. Independent review identified five contradictions/test weaknesses; all were corrected and independently verified as resolved.
- Final checks: **37 interaction-policy + 96 Pi + 204 workstation + 2 visualization tests passed**. Full `prepublishOnly` passed via `uv run --with pyyaml npm run prepublishOnly`, including publish-safety, security, and compatibility. Workstation results include existing uncommitted tests, not newly owned work. Diff checks passed.
- Scoped source versions: toolkit **0.2.2**, deep-thought **0.4.1**, marvin **0.7.1**; manifest/marketplace parity is tested. Phase 1 source commit: `ff81d4c`; Phase 2 is the scoped commit containing this record, whose SHA is reported in the work handoff.
- **Next gate:** user review of the representative Phase 3 previews. No `hog_ask` tool or decision-card renderer was built. All Phase 3 and remaining full-plan release tasks stay unchecked; the plan remains `in_progress`.
- **Activation handoff:** do not patch the pinned `0.2.0-staging-guard-e1110a118793` release. After explicit release/activation authorization, use a clean source commit to stage/publish a new immutable release, update the configured Pi source, reload, and verify the loaded source and real interaction. Until then, the pinned installation can still show the old enhancer. Source push alone is not activation.
- Unrelated `.github/workflows/workstation.yml`, `workstation/README.md`, `workstation/package.json`, and untracked writing-desk work remain untouched and excluded from the scoped commits.

## References and research provenance

Local paths are relative to the toolkit repository root. Proposed new files are identified as such above. Deleted enhancer files and their old tests below refer to the pre-fix source at `66ee035`; they are historical evidence, not current dependencies.

- `extensions/pi/guided-workflows.ts` — extraction fallback, generic card, model routing, `agent_end` orchestration.
- `extensions/pi/guided-workflows-core.js` — arbitrary-list extraction and standard-dialog helper.
- `extensions/pi/index.ts`; `tests/pi-guided-workflows.test.mjs`; `tests/pi-standard-dialogs.test.mjs`; `tests/pi-rpc-smoke.test.mjs` — integration and current coverage.
- `plugins/deep-thought/skills/plan/SKILL.md`; `plugins/deep-thought/skills/brainstorm/SKILL.md`; `plugins/marvin/skills/work/SKILL.md` — current readiness and conversation instructions.
- `src/utils/transform.ts`; `scripts/check-harness-compatibility.py`; `CONVENTIONS.md`; `scripts/release.mjs` — adaptation, validation, and publishing constraints.
- [Prior guided-workflow plan](2026-04-14-feat-pi-guided-workflow-enhancement-plan.md) — historical design; this plan supersedes automatic extraction, not the portability boundary.
- [Pi official examples, inspected commit 71dca871](https://github.com/earendil-works/pi/tree/71dca871bc80b6bc97be37f0ca3189399d651fff/packages/coding-agent/examples/extensions): `question.ts` (deliberate question/custom answer), `questionnaire.ts` (review), `qna.ts` (user-invoked editor assistance), `plan-mode/` (whole-plan choice plus progress). Do not copy prose completion markers as authoritative tracking or example edge cases without tests.
- [Pi TUI guidance](https://github.com/earendil-works/pi/blob/71dca871bc80b6bc97be37f0ca3189399d651fff/packages/coding-agent/docs/tui.md) and [extension API](https://github.com/earendil-works/pi/blob/71dca871bc80b6bc97be37f0ca3189399d651fff/packages/coding-agent/docs/extensions.md) — native components, theme/keybindings, width/focus, lifecycle, and UI-mode distinctions.
- [Mario Zechner: minimal coding agent](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) — observable, versionable file-based plans.
- [Armin Ronacher: Pi](https://lucumr.pocoo.org/2026/1/31/pi/), [discuss.md](https://github.com/mitsuhiko/agent-stuff/blob/122e2994adddb113c04764c5697217dae120fcc6/commands/discuss.md), and [answer.ts](https://github.com/mitsuhiko/agent-stuff/blob/122e2994adddb113c04764c5697217dae120fcc6/extensions/answer.ts) — natural dialogue, evidence-first short rounds, and optional answer assistance. Do not copy hard-coded colors/model fallback as current production policy.
- [datspike/pi-ask-user, a590a191](https://github.com/datspike/pi-ask-user/tree/a590a19199bce22e616213278f178b855a34bf8d) — inline typing, selection notes, draft preservation, responsive details, and RPC fallback patterns.
- [QMahyar/pi-ask, 698252e4](https://github.com/QMahyar/pi-ask/tree/698252e4eaaf2eecd2e60dbb8464698db0c93f37) — separated controller/rendering, structured outcomes, transcript records, and cancellation tests. Its TUI-only boundary and recommendation-prefill behavior are not adopted.
- [skidvis example, bec0e359](https://github.com/skidvis/pi-ask-user-question/blob/bec0e359cb3bca78636229990b98b363d6dc4ff6/extensions/index.ts) — anti-reference: blanket best-judgment fallback is not appropriate for unresolved authorization.

External references were inspected as source/documentation; community packages were not installed or certified. Revalidate relevant API changes at implementation time rather than treating examples or search snippets as guarantees.
