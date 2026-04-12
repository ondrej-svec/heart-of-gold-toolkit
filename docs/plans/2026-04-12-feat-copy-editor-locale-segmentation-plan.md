---
title: "feat: locale-aware segmentation for the copy-editor skill"
type: plan
date: 2026-04-12
status: in_progress
brainstorm: null
confidence: high
---

# Locale-aware segmentation for the copy-editor skill

Teach the copy-editor skill to apply Czech rules only to Czech spans, English rules only to English spans, and to skip code/data spans entirely — using an LLM-driven segmentation step whose output is cached as a reviewable lockfile, so Layer 1 stays reproducible.

## Problem Statement

The copy-editor skill today picks a single `LanguageProfile` per run and applies every rule to every chunk of every file (`scripts/copy-audit.ts:692`, `runProfile` at line 526). `TextChunk` has no language tag, `Rule` has no `languages` allowlist, and structural extractors emit chunks without any awareness of the locale they came from.

Real content is not locale-uniform:

- Bilingual JSON sources with parallel `"en": {...}` / `"cs": {...}` branches (e.g. `harness-lab/workshop-content/agenda.json`).
- English-only docs sitting under a glob pattern that catches Czech files alongside them (e.g. `workshop-skill/SKILL-facilitator.md`).
- Czech prose that quotes English inline.
- Czech markdown that embeds English code blocks or CLI examples.

Running a Czech audit against `harness-lab` today produces 197 errors + 448 warnings across 8 files. A non-trivial share are false positives: Czech R1/R1b fire on `I want` and `a developer` inside English JSON strings, and on any English span the current extractor cannot identify. The skill loses trust fast when Layer 1 cries wolf.

Fixing this with per-glob locale mapping (`paths.locale: {...}`) only works when the author already labelled the split. It does not handle inline code-switching, quoted English in Czech prose, or files whose language does not match their glob. For a reusable toolkit skill, the mechanism needs to be content-aware, not path-aware.

## Target End State

When this lands:

1. `copy-audit` on a bilingual file tags each span with its language and kind, then runs only the matching rules on each span.
2. An LLM segments uncached files once, writes spans to `.copy-editor.lock.json`, and never runs again for unchanged files.
3. The lockfile is committed, reviewed on PR like `package-lock.json`, and hand-editable.
4. Layer 1 remains a pure function of `(file bytes, cached spans) → findings`. Given the same cache, the same bytes always produce the same verdict.
5. The verification boundary is preserved and explicitly restated: Layer 1 auto-closes given the cache; the cache is human-closeable on creation and refresh.
6. Running the skill against `harness-lab` produces zero false positives on `SKILL-facilitator.md` (all English, no Czech findings) and zero false positives on the `"en"` branches of `agenda.json`.

## Target Outcome (felt, not structural)

A reviewer running `copy-audit` trusts every finding it emits. False positives feel like a bug, not an expected tax. Adding a new bilingual content file is routine: run the audit, review the new lockfile entries the same way you review a lockfile bump, commit.

## Anti-goals

- Do **not** make segmentation a network call per audit run in the steady state. Cache is the fast path.
- Do **not** let LLM drift leak into Layer 1 verdicts. Non-determinism lives in segmentation creation; Layer 1 reads cached spans.
- Do **not** expand the skill into a content generator, rewriter, or translator. It still only reviews.
- Do **not** invent a bespoke cache format when a lockfile-shaped JSON with content hashes already covers the contract.
- Do **not** add a Czech-specific or English-specific shortcut into the engine. Every language is a profile; the engine treats them uniformly.

## Scope and Non-Goals

**In scope:**
- New `Phase 1a — Segment` in the loop, sitting between Load and Lint.
- New LLM segmentation backend + `.copy-editor.lock.json` lockfile format.
- Type additions: `TextChunk.language`, `Rule.languages`, per-chunk rule filter in `runProfile`.
- Tagging existing Czech rules with `languages: ["cs"]`.
- New config surface: `extends: [profile...]` (currently dead code), `segment.*`.
- New CLI flags: `--refresh-cache`, `--review-cache`, `--require-reviewed`.
- Docs: `ROLE.md` contract revision, `SKILL.md` phase update, `config-schema.md` new fields, new `knowledge/segmentation.md`.
- Self-test: bilingual fixtures + lockfile invariants.
- Fallback path when the LLM is unreachable (degrade to single-profile mode with a loud warning).

**Non-goals:**
- Rewriting Markdown or JSON extractors beyond the minimal hooks needed to pass spans through. Structural extraction stays; segmentation layers on top.
- Building a UI around cache review beyond a terminal prompt (`--review-cache`). A richer UI is a separate plan.
- Adding new language profiles (German, Slovak, etc.) as part of this work. The segmentation hook makes them cheap later; we ship with `cs` + the existing `en` stub.
- Rewriting Layer 2 passes. They continue to run per-file as they do today.
- Migrating consuming repos (like `harness-lab`) beyond a verification run. Harness-lab adopts via its own small follow-up.

## Proposed Solution

**Shape of the change in one breath:** Put a cache-backed segmentation phase between Load and Lint. Tag chunks with language and kind in the cache. Let rules declare which languages they apply to. Filter in the dispatch loop. Treat the cache as a lockfile.

### Architecture

```
Phase 0  Load         parse config, resolve paths, classify surfaces
Phase 1a Segment      read lockfile; on miss → LLM → write lockfile → surface diff
Phase 1  Lint (L1)    extract chunks, attach cached spans, filter rules by chunk.language, run
Phase 2  Judge (L2)   unchanged (per-file judgment passes)
Phase 3  Report       unchanged (plus note unreviewed cache entries)
Phase 4  Handoff      unchanged (plus "cache entries pending review")
```

### Data model additions

- `TextChunk` gains `language?: string` and `kind?: "prose" | "code" | "quote" | "data"`.
- `Rule` gains `languages?: string[]`. Absent = applies to all.
- `runProfile` skips rules whose `languages` does not include `chunk.language`.
- Extractors are modified minimally: after producing chunks, the engine overlays cached spans to refine/split each chunk by byte range. Unmapped ranges inherit `config.language` and `kind: "prose"`.

### Segmentation backend

- Interface: `Segmenter { segment(fileBytes, filePath, declaredProfiles) → Span[] }`.
- Default implementation: LLM backend using a small/fast model (Haiku-class), with a stable prompt template versioned via `segmenter.promptVersion` in the lockfile.
- Alternate implementations registerable: `structural` (JSON key paths + markdown info-strings, deterministic, no LLM), `manual` (lockfile is hand-authored from the start, no backend).
- The default is `llm`; `structural` is the fallback when `--offline` or LLM is unreachable.

### Lockfile (`.copy-editor.lock.json`) — root of repo by default

Single file. Content hash per entry. Reviewable diff. Hand-editable. Schema documented in the companion `knowledge/lockfile-schema.md` (created in this plan).

Top level:
```
{
  "schemaVersion": 1,
  "segmenter": { "backend": "llm", "model": "...", "promptVersion": 1 },
  "files": {
    "<path>": {
      "contentHash": "sha256:...",
      "segmentedAt": "ISO8601",
      "reviewedBy": "<honour-system string> | null",
      "spans": [ { startLine, startColumn, endLine, endColumn, language, kind, pathHint?, note? } ]
    }
  }
}
```

Spans are ordered, non-overlapping. Gaps fall back to `config.language`. A file that is 100% the default language can have zero spans and still hash-match.

### Contract revision (ROLE.md)

New "Segmentation (Phase 1a)" section formalising the lockfile bargain:

> **Layer 1 remains auto-closeable given the cache. The cache is human-closeable on creation and on refresh.**

Loop Invariant updated from `Load → Lint → Judge → Report → Handoff` to `Load → Segment → Lint → Judge → Report → Handoff`. Extension Points gets a fifth entry: new segmentation backends.

### CLI / UX

- `copy-audit --review-cache` — print unreviewed entries, render spans against source with language/kind colours, prompt `accept / edit / skip`. Accept sets `reviewedBy`. Edit opens `$EDITOR` on the span subtree.
- `copy-audit --refresh-cache [<glob>]` — invalidate matching entries and re-segment.
- `copy-audit --require-reviewed` — fail the run if any included file has an unreviewed cache entry. Opt-in flag; typical CI posture. Not default.
- `copy-audit --offline` — force `structural` backend; skip LLM.

## Decision Rationale

### Why LLM segmentation over per-glob locale mapping

Per-glob mapping (`paths.locale`) handles only the subset of cases where the author labelled the split. It fails on:
- Czech prose that quotes English inline.
- English code samples inside Czech markdown.
- Files whose content language does not match their glob pattern.
- Future new formats (YAML, TOML) without per-format extractor work.

LLM segmentation handles all of these uniformly and extends trivially to new languages. The user made this call explicitly in the brainstorm: "I'm more thinking to make it more robust and more reusable".

### Why a lockfile instead of an on-the-fly LLM call

The ROLE.md verification boundary (`ROLE.md:50`) requires Layer 1 to be *regex-level and reproducible*. An LLM call during Layer 1 breaks that invariant. A lockfile moves the non-determinism to a one-time pinning step that is then cached and reviewed — the same bargain `package-lock.json` strikes. Layer 1 stays reproducible "given the cache", and the cache is a committed, diffable artifact.

### Why a single root lockfile, not per-file sidecars

- One PR diff to review, not N. Reviewers see all segmentation changes in one place.
- Harder to forget to commit. Sidecars disperse across the tree.
- Hand-editing a single JSON file is fine at expected scale (hundreds of files).
- Sidecars win only if the repo has thousands of files — not our scale, and premature.

### Why `--require-reviewed` is opt-in, not default

Initial adopters need a soft landing. If the flag were default, every first run would fail until someone reviewed. Opt-in for CI lets teams adopt the strict posture deliberately once their baseline is reviewed. Flip to default in a later schema version.

### Why honour-system `reviewedBy` string, not signed

Defence in depth is the PR review itself. A cryptographic signature adds setup cost without preventing any realistic failure mode: a committer who would lie about `reviewedBy` would also lie about a signature. Keep it simple.

### Why degrade gracefully when the LLM is unreachable

Local development without network must still work. Hard-fail would make the skill brittle. Degrade to `structural` backend (or single-profile mode for files without cached entries), emit a loud warning in the report, and let the human decide whether to accept the degraded run.

### Why `kind: "data"` exists alongside `code`/`prose`/`quote`

JSON string values that are URLs, ISO codes, enum slugs, or IDs should not receive typography rules. Today the extractor has no way to say "this string is data, not prose". The segmenter is the right place to make that call — it already has byte ranges and can reason about what it sees.

### Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| Per-glob `paths.locale` only (Option A from brainstorm) | Only handles author-labelled splits. Misses inline code-switching, quoted English, files mislabelled by glob. The user explicitly asked for a more robust and reusable approach. |
| Language-detection heuristic (diacritics + stopwords) in the engine | Works on long Czech prose (R2/R7/R8 already do this internally) but fails on short chunks, proper nouns, and any language where orthography overlaps. Good as a fallback, not a primary. |
| On-the-fly LLM call per audit run, no cache | Breaks Layer 1 reproducibility. Expensive. Every CI run hits the model. Rejected on contract grounds. |
| Per-file lockfile sidecars | Harder to review as one diff, easier to forget to commit, no payoff at our scale. |
| Rewrite extractors to be locale-aware per format | Brittle, does not handle inline code-switching, requires new work per format. Segmentation subsumes this. |

## Constraints and Boundaries

- **Verification boundary (non-negotiable):** Layer 1 auto-closes only on cached input. Non-cached runs degrade or fail loudly; they do not auto-close with fresh LLM output.
- **No behaviour change without a self-test.** Every rule that gains `languages: ["cs"]` needs a bilingual fixture proving it skips English spans.
- **SKILL.md and ROLE.md stay in sync.** ROLE.md updated first, then SKILL.md aligned.
- **Schema versioning is load-bearing.** `schemaVersion: 1` now; bumping requires a documented migration.
- **Prompt version bumps do not silently invalidate reviewed entries.** A `promptVersion` bump invalidates only entries where `reviewedBy == null`. Reviewed entries keep their signoff until a content change forces a refresh.
- **Engine stays agent-agnostic.** No Claude-specific wrapper. Segmenter backend is pluggable.

## Assumptions

| Assumption | Status | Evidence / action |
|---|---|---|
| Layer 1 auto-close is load-bearing and worth protecting | Verified | ROLE.md:43–52 states it as non-negotiable; harness-lab doctrine inherits it (docs/workshop-content-qa.md). |
| An LLM (Haiku-class) can segment bilingual text reliably with a stable prompt | **Unverified** | Investigation task in Phase 0 below; run the segmenter prompt on `agenda.json` + `SKILL-facilitator.md` + one mixed markdown file and hand-check results before committing to the design. |
| `agenda.json` parallel `"en"/"cs"` keys produce clean bilingual boundaries | Verified | Inspected in brainstorm — structure is regular, parallel blocks. |
| Content hash (sha256 of raw bytes) is stable enough to key cache entries | Verified | Standard approach; matches how all other lockfiles work. |
| Reviewers will actually review lockfile diffs on PR | **Unverified** | Soft mitigation: the Phase 4 handoff lists unreviewed entries; `--require-reviewed` opt-in escalates to CI-blocking when a team is ready. |
| Existing Czech rules can be safely tagged `languages: ["cs"]` without regressions | Verified | R1, R1b, R3, R4, R5, R6 are Czech typography rules with no English applicability. R2, R7, R8 already self-gate on diacritics — tagging matches their intent. |
| The current `runProfile` dispatch loop can accept a filter without structural refactor | Verified | `scripts/copy-audit.ts:526–541` is a plain double loop; adding a conditional is one line. |
| `copy-audit` runs under Bun on macOS and in CI | Verified | The script is `bun` today; CI support stays the same. |
| No external segmenter vendor lock-in | Verified | Backend is an interface; default is swappable. |

**Unverified assumptions become Phase 0 tasks.**

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM mis-segments spans and reviewers rubber-stamp the cache | Medium | High — false negatives hide real findings | Make `--review-cache` diff output dense and readable; show surrounding source; require per-span accept; consider `--review-cache --strict` that forces explicit action on every span. |
| `--review-cache` UX is tedious and reviewers bypass it | Medium | Medium — cache becomes theatre | Phase 2 ships a minimal terminal diff. If adoption stalls, iterate the UX as a follow-up plan. Make the default `accept-all` gesture visible but not silent. |
| LLM output drifts across model versions | Low | Medium | `segmenter.model` + `promptVersion` recorded in the lockfile. Drift manifests as a reviewable diff on refresh, not a silent change. Reviewed entries survive prompt bumps. |
| Hash collisions across file edits | Vanishingly low | Low | sha256 is sufficient; standard lockfile hygiene. |
| Consuming repo (harness-lab) runs the skill before adopting the lockfile workflow | High | Low | Fallback path: degrade to single-profile mode + warn. Opt-in `--require-reviewed` means consumers adopt at their pace. |
| New contract paragraph in ROLE.md is misread as weakening Layer 1 | Medium | High — trust erosion | The verification-boundary clause in SKILL.md stays verbatim. The new section explicitly restates "Layer 1 remains auto-closeable given the cache" and frames the move as *relocation*, not *relaxation*. Self-validation check fails if the old clause is missing. |
| Offline / air-gapped runs can't segment | Medium | Medium | `--offline` forces `structural` backend; reports "best effort" clearly in the Phase 4 handoff. |
| Three-way merge on file edits causes reviewed `note` / `reviewedBy` to be lost | Low | Medium | On refresh, spans with overlapping byte ranges carry forward if the segmenter produces matching `(language, kind)` — documented merge rule. Covered by a self-test fixture. |
| Segmentation cost at scale (first run on a large repo) | Low | Low | One-time cost. Cached forever after. Large repos can pre-segment with a dedicated run and review in batches. |

## Rejection Criteria

The implementation is wrong, even if tests pass, if:

- Layer 1 verdicts differ across runs on the same bytes + same lockfile. (Reproducibility broken.)
- `--review-cache` makes accepting a bad span easier than rejecting it. (Incentive inverted.)
- Any Czech rule fires on a span tagged `en`. (Filter broken.)
- Any rule fires on a span tagged `kind: "code"` or `kind: "data"`. (Kind filter broken.)
- The ROLE.md verification boundary clause is weakened or deleted. (Contract broken.)
- A lockfile entry's `reviewedBy` can be silently flipped from a real value back to `null` by tooling. (Trust broken.)
- Fresh LLM output ever auto-closes Layer 1 without a human-owned cache write. (Verification boundary broken.)

## Phased Implementation

Work lands on `main` as small commits (trunk-based, no feature branch). Each phase has an exit criterion. Do not advance until the current phase's exit criterion is met.

### Phase 0 — Validate the segmenter assumption before committing to the design

**Goal:** Prove an LLM can segment real bilingual content reliably with a stable prompt, before building the cache and CLI around it.

**Exit criterion:** A hand-checked segmentation of three real files (bilingual JSON, English-only markdown, mixed Czech-with-English-quote markdown) matches human expectation within the tolerance we're willing to accept.

### Phase 1 — Type and engine foundation (no behaviour change)

**Goal:** Land the type and dispatch changes that make locale-scoped rules possible, with every existing test still green.

**Exit criterion:** `bun scripts/self-test.ts` passes. No existing audits change output.

### Phase 2 — Lockfile format and file I/O

**Goal:** Read/write `.copy-editor.lock.json` with a stable, versioned, hand-editable shape.

**Exit criterion:** Lockfile round-trips through a test fixture; schema doc committed.

### Phase 3 — LLM segmentation backend

**Goal:** Default backend that takes bytes and produces spans. Pluggable; alternate backends registerable.

**Exit criterion:** Running `copy-audit` on the fixture files produces span lists that match the Phase 0 hand-check.

### Phase 4 — Engine wiring: spans → chunks → filtered rules

**Goal:** Chunks get their `language` and `kind` from the lockfile. `runProfile` filters by `Rule.languages`.

**Exit criterion:** `SKILL-facilitator.md` produces zero Czech findings when processed through the new pipeline with a committed lockfile entry.

### Phase 5 — CLI flags and reviewer UX

**Goal:** `--review-cache`, `--refresh-cache`, `--require-reviewed`, `--offline`.

**Exit criterion:** A new bilingual fixture can be segmented, reviewed, accepted, and committed end-to-end using only documented CLI flags.

### Phase 6 — Rule tagging and self-tests

**Goal:** Existing Czech rules declare `languages: ["cs"]`. New bilingual fixtures assert the filter works.

**Exit criterion:** Self-test suite includes at least two bilingual cases (JSON with parallel keys; markdown with embedded English code block) and they pass.

### Phase 7 — Docs and contract update

**Goal:** `ROLE.md`, `SKILL.md`, `config-schema.md` updated; new `knowledge/segmentation.md` and `knowledge/lockfile-schema.md` written.

**Exit criterion:** A contributor reading only the docs can explain (a) the verification boundary, (b) the lockfile bargain, (c) how to add a new segmentation backend, without opening code.

### Phase 8 — Verification on harness-lab

**Goal:** Run the new skill against the real problem repo. Confirm the false-positive drop. Commit the lockfile there.

**Exit criterion:** `harness-lab` audit shows zero Czech findings on `SKILL-facilitator.md` and zero Czech findings inside `"en"` branches of `agenda.json`. Remaining Czech findings are genuine.

## Implementation Tasks

Dependency-ordered. Each task is self-contained and landable as one commit to `main`.

### Phase 0 — Validate segmenter

- [x] **Write the segmentation prompt draft** — committed to `knowledge/segmentation-prompt-v1.md`.
- [x] **Dry-run the prompt on three real files** — `agenda.json` (lines 1-74), `SKILL-facilitator.md` (full), `codex-demo-script.md` (full). Sonnet-class sub-agent acted as model under test.
- [x] **Hand-check the output.** Memo committed inline in `segmentation-prompt-v1.md`. **Decision: GO** — architecture is validated, v1 prompt has three required fixes queued for v2 in Phase 3 (overlap bug on inline code, JSON structural-token over-segmentation, heading-as-code mis-tagging). Plus three soft fixes (column convention, granularity, language-on-code-spans).

### Phase 1 — Type and engine foundation

- [x] Add `language?: string` and `kind?: ChunkKind` to `TextChunk` in `rules/types.ts`. New `ChunkKind` type exported.
- [x] Add `languages?: string[]` to `Rule` in `rules/types.ts`.
- [x] Update `runProfile` to skip `code`/`data` chunks entirely and to skip rules whose `languages` does not include `chunk.language` (when both are defined). Both conditions guarded so legacy chunks (no `language`, no `kind`) keep current behaviour.
- [x] `bun scripts/self-test.ts` → 10/10 pass. Harness-lab baseline unchanged (645 findings, same rule distribution).

### Phase 2 — Lockfile format

- [ ] Write `knowledge/lockfile-schema.md` documenting `.copy-editor.lock.json` v1: top-level shape, per-file entries, span shape, invariants, examples.
- [ ] Implement `readLockfile(path)` and `writeLockfile(path, data)` in `scripts/copy-audit.ts` (or a new `scripts/lockfile.ts`). Validate `schemaVersion`. Halt on malformed lockfile with a clear error.
- [ ] Implement `hashFileBytes(bytes): "sha256:..."`.
- [ ] Write round-trip test fixture in `self-test.ts`: synthesise a lockfile, write, read, assert equality.

### Phase 3 — Segmentation backend

- [ ] Define `Segmenter` interface in `rules/types.ts` or a new `segmentation/types.ts`.
- [ ] Implement `LlmSegmenter` using the Phase 0 prompt and a small/fast model. Record `model` and `promptVersion`.
- [ ] Implement `StructuralSegmenter` as the offline fallback: JSON key paths, markdown fenced code blocks by info-string, front-matter `lang:`. Deterministic, no LLM.
- [ ] Register backends in a `segmenters/index.ts` map keyed by `backend` name.
- [ ] Add `segment.backend`, `segment.model`, `segment.cache_path` to `CopyEditorConfig` in `scripts/copy-audit.ts` and to the schema doc.

### Phase 4 — Engine wiring

- [ ] Add `Phase 1a — Segment` to the run loop in `scripts/copy-audit.ts`. For each file: read lockfile entry, check hash; on hit use cached spans; on miss call segmenter, write entry with `reviewedBy: null`, surface to report.
- [ ] After chunks are extracted, overlay cached spans: split chunks by span byte ranges, attach `language` and `kind` to each resulting sub-chunk. Unmapped ranges inherit `config.language` and `kind: "prose"`.
- [ ] Tag R1, R1b, R3, R4, R5, R6 in `rules/czech.ts` with `languages: ["cs"]`. Leave R2/R7/R8 alone (they already self-gate; tagging is belt-and-braces and can be a follow-up).
- [ ] Ensure rules skip spans with `kind` in `["code", "data"]` — add this as an engine-level filter, not a per-rule check.
- [ ] End-to-end run on `harness-lab/workshop-skill/SKILL-facilitator.md` with a hand-authored lockfile entry marking the whole file as `en`. Expect zero findings.

### Phase 5 — CLI flags and reviewer UX

- [ ] Add `--refresh-cache [<glob>]` — invalidate matching entries, re-segment on next run.
- [ ] Add `--review-cache` — terminal diff of unreviewed entries with colourised spans and `accept / edit / skip` prompt. Accept sets `reviewedBy` to a configurable string (env var `COPY_EDITOR_REVIEWER` or CLI prompt).
- [ ] Add `--require-reviewed` — fail the run if any included file has an unreviewed cache entry.
- [ ] Add `--offline` — force `structural` backend.
- [ ] Document all flags in `SKILL.md` and `config-schema.md`.

### Phase 6 — Rule tagging and bilingual self-tests

- [ ] Add bilingual fixture #1 to `self-test.ts`: a synthetic JSON blob with parallel `"en"/"cs"` values. Assert R1 fires inside the `cs` span and does not fire inside the `en` span.
- [ ] Add bilingual fixture #2: a synthetic markdown blob with a fenced `bash` code block embedded in Czech prose. Assert typography rules skip the code block entirely.
- [ ] Add a refresh-merge fixture: file content changes, previously reviewed entry merges forward for overlapping `(language, kind)` spans.
- [ ] Add a `--require-reviewed` gate fixture: a file with `reviewedBy: null` fails, same file with `reviewedBy: "tester"` passes.

### Phase 7 — Docs and contract update

- [ ] Update `knowledge/ROLE.md`:
  - Insert the new "Segmentation (Phase 1a)" section between "Loop Invariant" and "Verification Boundary".
  - Update the Loop Invariant to include Segment.
  - Add failure-mode rows for segmenter-unreachable, mis-tagged span, hash drift, lockfile corrupt.
  - Add Extension Point #5 (new segmentation backend).
  - Restate the verification boundary in the new section: *"Layer 1 remains auto-closeable given the cache. The cache is human-closeable on creation and on refresh."*
- [ ] Update `SKILL.md`:
  - Add Phase 1a to the phase list and validate table.
  - Document the new CLI flags.
  - Keep the verbatim verification boundary clause intact.
- [ ] Update `knowledge/config-schema.md`:
  - Add `segment.backend`, `segment.model`, `segment.cache_path`.
  - Make `extends` actually mean "list of profiles to run" (was dead code).
  - Add `paths.locale` as an optional hint surface for the structural backend.
- [ ] Write `knowledge/segmentation.md`: overview, backend interface, how to add a new backend, prompt versioning, cache merge rules.
- [ ] Write `knowledge/lockfile-schema.md` (if not already from Phase 2): field contract, invariants, examples, merge rules.

### Phase 8 — Verify against harness-lab

- [ ] Install updated skill into the harness-lab CLAUDE cache (via the HoG installer path it already uses).
- [ ] Run `copy-audit` with no lockfile. Expect the skill to segment all 8 flagged files, write `harness-lab/.copy-editor.lock.json`, and surface unreviewed entries in the report.
- [ ] Review the lockfile with `--review-cache`. Hand-correct any mis-segmentation.
- [ ] Commit `harness-lab/.copy-editor.lock.json`.
- [ ] Re-run `copy-audit`. Confirm:
  - `SKILL-facilitator.md`: zero Czech findings.
  - `agenda.json`: zero Czech findings inside `"en"` branches; Czech findings in `"cs"` branches remain.
  - Other 6 Czech files: findings similar to baseline (expected — they are genuinely Czech).
- [ ] Document the run results in a short memo at `harness-lab/docs/reviews/workshop-content/2026-04-12-locale-segmentation-rollout.md`.

## Acceptance Criteria

1. `bun scripts/self-test.ts` in the toolkit passes, including new bilingual fixtures.
2. Running the skill on a file with a cached, reviewed lockfile entry is deterministic: same bytes + same lockfile always produce identical findings across 3 consecutive runs.
3. Running the skill on `harness-lab/workshop-skill/SKILL-facilitator.md` with a committed lockfile produces zero Czech findings.
4. Running the skill on `harness-lab/workshop-content/agenda.json` with a committed lockfile produces zero Czech findings inside `"en"` branches.
5. `copy-audit --require-reviewed` fails with exit code non-zero when any included file has `reviewedBy: null`.
6. `copy-audit --offline` runs to completion without any network call.
7. Deleting `.copy-editor.lock.json` and re-running regenerates it and surfaces all entries as unreviewed.
8. `ROLE.md` contains the new Segmentation section, the verification boundary clause is still present verbatim, and a contributor can explain the lockfile bargain from the docs alone.
9. At least one follow-up reviewer (human, not me) reads the contract revision and confirms it does not weaken Layer 1.
10. A reviewer can accept, edit, and skip span decisions via `--review-cache` without editing the lockfile JSON by hand.

## Required Preview Artifacts

Because this touches a trust boundary (the verification contract), autonomous `work` should not begin until:

1. **ROLE.md revision preview** — a draft of the new Segmentation section rendered in context. Already drafted in the conversation; will be committed as a preview artifact at `docs/plans/2026-04-12-copy-editor-role-preview.md` before Phase 7 begins.
2. **Lockfile schema preview** — a worked example of `.copy-editor.lock.json` for one bilingual file and one English-only file. Already drafted in conversation; committed as a preview artifact alongside the ROLE.md draft.
3. **Segmenter prompt draft** — the Phase 0 artifact. Must exist before Phase 3 starts.

Who reviews: Ondrej. Failure mode that sends work back to planning: the contract revision is judged to weaken Layer 1 in any way.

## Rollout Rule

- Land in the toolkit (`heart-of-gold-toolkit`) as trunk commits, one per task.
- Bump the marvin plugin version at the end of Phase 7.
- `harness-lab` adopts via Phase 8, which is a separate, small operation driven by the plan above.
- Other consumers (quellis, other projects) adopt at their own pace. `paths.locale` and `--offline` let them onboard without committing to an LLM segmenter.

## References

- Skill source: `/Users/ondrejsvec/projects/Bobo/heart-of-gold-toolkit/plugins/marvin/skills/copy-editor/`
- Core files: `scripts/copy-audit.ts`, `rules/czech.ts`, `rules/english.ts`, `rules/types.ts`, `rules/index.ts`
- Contract: `knowledge/ROLE.md`, `knowledge/config-schema.md`, `knowledge/output-contract.md`, `knowledge/language-profiles.md`
- Failing-case evidence: `/Users/ondrejsvec/projects/Bobo/harness-lab/workshop-content/agenda.json`, `/Users/ondrejsvec/projects/Bobo/harness-lab/workshop-skill/SKILL-facilitator.md`
- Prior plan in the same area (for tone and shape): `docs/plans/2026-04-10-refactor-quellis-icf-alignment-plan.md`
- Consumer doctrine the skill inherits from: `harness-lab/docs/workshop-content-qa.md`
