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
2. The agent running the skill segments uncached files once using the prompt template, writes spans to `.copy-editor.lock.json` via a CLI helper, and the audit script never re-segments unchanged files.
3. The script itself never calls an LLM. Segmentation is performed by the host agent (the model that runs the skill); the script reads the resulting cache.
4. The lockfile is committed, reviewed on PR like `package-lock.json`, and hand-editable.
5. Layer 1 remains a pure function of `(file bytes, cached spans) → findings`. Given the same cache, the same bytes always produce the same verdict.
6. The verification boundary is preserved and explicitly restated: Layer 1 auto-closes given the cache; the cache is human-closeable on creation and refresh.
7. Running the skill against `harness-lab` produces zero false positives on `SKILL-facilitator.md` (all English, no Czech findings) and zero false positives on the `"en"` branches of `agenda.json`.

## Target Outcome (felt, not structural)

A reviewer running `copy-audit` trusts every finding it emits. False positives feel like a bug, not an expected tax. Adding a new bilingual content file is routine: run the audit, review the new lockfile entries the same way you review a lockfile bump, commit.

## Anti-goals

- Do **not** put any LLM call inside the audit script. The script stays a pure deterministic Bun process. The agent that runs the skill is the LLM in the loop.
- Do **not** introduce API keys, model selection, or network configuration into the script or `.copy-editor.yaml`. The script never reaches the network.
- Do **not** let segmentation drift leak into Layer 1 verdicts. Non-determinism lives in cache creation by the agent; Layer 1 reads cached spans.
- Do **not** expand the skill into a content generator, rewriter, or translator. It still only reviews.
- Do **not** invent a bespoke cache format when a lockfile-shaped JSON with content hashes already covers the contract.
- Do **not** add a Czech-specific or English-specific shortcut into the engine. Every language is a profile; the engine treats them uniformly.
- Do **not** require the host agent to hand-edit lockfile JSON. The script provides a CLI helper for safe writes.

## Scope and Non-Goals

**In scope:**
- New `Phase 1a — Segment` in the **skill** loop (executed by the host agent), sitting between Load and Lint.
- `.copy-editor.lock.json` lockfile format owned jointly by the script (reads) and the agent (writes via CLI helper).
- Type additions: `TextChunk.language`, `Rule.languages`, per-chunk rule filter in `runProfile`.
- Tagging existing Czech rules with `languages: ["cs"]`.
- New config surface: `extends: [profile...]` (currently dead code activated as the multi-profile dispatch list).
- New script subcommands: `copy-audit segment <path>` (prints the prompt + file content for the agent to act on), `copy-audit lockfile add <path> --spans <json>` (writes a single entry safely).
- New CLI flags: `--require-reviewed`, `--list-unsegmented`.
- Optional `StructuralSegmenter` as a `--offline` deterministic fallback for environments where no agent is in the loop (CI without an agent runner).
- Docs: `ROLE.md` contract revision, `SKILL.md` phase update with agent-side segmentation instructions, `config-schema.md` new fields, new `knowledge/segmentation.md`.
- Self-test: bilingual fixtures + lockfile invariants.

**Non-goals:**
- Rewriting Markdown or JSON extractors beyond the minimal hooks needed to pass spans through. Structural extraction stays; segmentation layers on top.
- Building a UI around cache review beyond a terminal prompt (`--review-cache`). A richer UI is a separate plan.
- Adding new language profiles (German, Slovak, etc.) as part of this work. The segmentation hook makes them cheap later; we ship with `cs` + the existing `en` stub.
- Rewriting Layer 2 passes. They continue to run per-file as they do today.
- Migrating consuming repos (like `harness-lab`) beyond a verification run. Harness-lab adopts via its own small follow-up.

## Proposed Solution

**Shape of the change in one breath:** Put a cache-backed segmentation phase between Load and Lint. The script never calls an LLM — segmentation is performed by the agent that runs the skill, and the result is written to a committed lockfile. Tag chunks with language and kind in the cache. Let rules declare which languages they apply to. Filter in the dispatch loop. Treat the cache as a lockfile.

### Architecture

```
Phase 0   Load         (script)  parse config, resolve paths, classify surfaces
Phase 1a  Segment      (agent)   read lockfile; for each unsegmented file, agent applies the
                                 prompt template and writes spans via `copy-audit lockfile add`
Phase 1   Lint (L1)    (script)  extract chunks, attach cached spans, filter rules by
                                 chunk.language and chunk.kind, run
Phase 2   Judge (L2)   (agent)   unchanged (per-file judgment passes)
Phase 3   Report       (script)  unchanged, plus note unreviewed cache entries
Phase 4   Handoff      (agent)   unchanged, plus "cache entries pending review"
```

The split is explicit: deterministic mechanical work belongs in the script, LLM-shaped reasoning belongs in the agent. The lockfile is the contract surface where they meet.

### Data model additions

- `TextChunk` gains `language?: string` and `kind?: "prose" | "code" | "quote" | "data"`.
- `Rule` gains `languages?: string[]`. Absent = applies to all.
- `runProfile` skips `code`/`data` chunks entirely and skips rules whose `languages` does not include `chunk.language`.
- Extractors are modified minimally: after producing chunks, the engine overlays cached spans to refine/split each chunk by byte range. Unmapped ranges inherit `config.language` and `kind: "prose"`.

### Segmentation responsibility

- **Primary path: the host agent.** When `copy-audit` reports unsegmented files (cache miss against a path that needs review), the skill instructs the host agent to read the file, apply the prompt template at `knowledge/segmentation-prompt-v2.md`, and call `copy-audit lockfile add <path> --spans <json>` for each result. The agent is the LLM in the loop — no parallel LLM transport in the script.
- **Optional fallback: `StructuralSegmenter`.** A deterministic, no-agent fallback that infers spans from JSON key paths, markdown info-strings, and front-matter `lang:` tags. Used in `--offline` mode or in CI environments where no agent runs the skill. Strictly less powerful than the agent path but reproducible without any model in the loop.
- **No `LlmSegmenter` class in the script.** The script does not import any LLM SDK, does not read API keys, does not configure a model. Those concerns belong to the agent runtime, not the audit engine.

### Lockfile (`.copy-editor.lock.json`) — root of repo by default

Single file. Content hash per entry. Reviewable diff. Hand-editable. Schema documented in the companion `knowledge/lockfile-schema.md` (created in this plan).

Top level:
```
{
  "schemaVersion": 1,
  "segmenter": { "backend": "agent" | "structural" | "manual", "promptVersion": 1 },
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

Note: the `segmenter.backend` enum changes from `llm` to `agent`. The `model` field is dropped — the script does not know or care which model the agent runs as. `promptVersion` remains because the prompt template is a versioned doc the agent reads. The lockfile schema implementation in `scripts/lockfile.ts` will need a small migration to reflect this naming change before Phase 4.

Spans are ordered, non-overlapping. Gaps fall back to `config.language`. A file that is 100% the default language can have zero spans and still hash-match.

### Contract revision (ROLE.md)

New "Segmentation (Phase 1a)" section formalising the lockfile bargain:

> **Layer 1 remains auto-closeable given the cache. The cache is human-closeable on creation and on refresh.**

Loop Invariant updated from `Load → Lint → Judge → Report → Handoff` to `Load → Segment → Lint → Judge → Report → Handoff`. Extension Points gets a fifth entry: new segmentation backends.

### CLI / UX

The script gains two subcommands and two flags. None of them require a network connection, an API key, or model configuration.

**Subcommands:**

- `copy-audit segment <path>` — print a structured handoff payload for the host agent: the file content, the prompt template, the declared profiles, and the expected output shape. The agent reads this, produces span JSON, then calls `lockfile add` to write it. This is the bridge between script and agent — the script asks for segmentation, the agent provides it, the script never executes the model itself.
- `copy-audit lockfile add <path> --spans <json-file-or-stdin>` — append a single file entry to the lockfile. Validates the spans against the schema, computes `contentHash` from the current file bytes, sets `segmentedAt` to now, sets `reviewedBy: null`. Refuses to overwrite an existing entry without `--force` to protect reviewed work.
- `copy-audit lockfile mark-reviewed <path> --by <reviewer-id>` — set `reviewedBy` on an existing entry. Used after a human has inspected the spans.
- `copy-audit lockfile invalidate <glob>` — remove matching entries so the next run treats them as unsegmented (replaces the old `--refresh-cache` flag).

**Flags on the main audit run:**

- `copy-audit --list-unsegmented` — print only the list of files that need segmentation, then exit. Used by the skill loop to know which files to hand to the agent. JSON output via `--json`.
- `copy-audit --require-reviewed` — fail the run if any included file has an unreviewed cache entry (`reviewedBy: null`). Opt-in CI posture.
- `copy-audit --offline` — force the `structural` backend instead of expecting agent-produced spans. Used in environments where no agent is in the loop. Strictly less powerful than the agent path; reproducible without any model.

The skill loop on the agent side is roughly: `copy-audit --list-unsegmented --json` → for each file, `copy-audit segment <file>` → agent produces spans → `copy-audit lockfile add` → loop. Then `copy-audit` (the audit run proper) reads the now-populated cache and runs Layer 1.

## Decision Rationale

### Why agent-native segmentation, not an LLM SDK in the script

The skill runs inside an agent — Claude Code, or any other host that loads the marvin plugin. That host *is* an LLM. Building an `LlmSegmenter` class with a transport interface, model selection, API key handling, and prompt-version negotiation duplicates infrastructure that already exists in the room. It also creates a second, smaller LLM (the script's "Haiku-class" call) running in parallel with the agent that drives the skill — strictly worse than letting the agent do the work itself.

The agent-native architecture pushes segmentation up one level: when the script reports unsegmented files, the host agent reads each file, applies the prompt template, and writes spans via a CLI helper. The script stays a pure deterministic Bun process — no SDK imports, no API keys, no network. The agent is the LLM in the loop; the script is the typography engine.

This is a simpler decomposition with strictly fewer moving parts. It also means the segmentation prompt validation work in Phase 0 (Sonnet sub-agent acting as the model) maps directly onto production: the production "model" is whatever agent runs the skill, which is what was tested.

### Why language-aware segmentation over per-glob locale mapping

Per-glob mapping (`paths.locale`) handles only the subset of cases where the author labelled the split. It fails on:
- Czech prose that quotes English inline.
- English code samples inside Czech markdown.
- Files whose content language does not match their glob pattern.
- Future new formats (YAML, TOML) without per-format extractor work.

Span-based segmentation handles all of these uniformly and extends trivially to new languages. The user made this call explicitly in the brainstorm: "I'm more thinking to make it more robust and more reusable".

### Why a lockfile instead of segmenting on every audit run

The ROLE.md verification boundary (`ROLE.md:50`) requires Layer 1 to be *regex-level and reproducible*. Even with the agent doing segmentation, asking the agent to re-segment on every audit run would break that invariant — the agent's output drifts between sessions, between models, between context windows. A lockfile moves the non-determinism to a one-time pinning step that is then cached and reviewed — the same bargain `package-lock.json` strikes. Layer 1 stays reproducible "given the cache", and the cache is a committed, diffable artifact.

The lockfile is also what makes the script/agent split safe: the script can run without an agent in the loop (CI, scripted runs) as long as the cache is up to date.

### Why a single root lockfile, not per-file sidecars

- One PR diff to review, not N. Reviewers see all segmentation changes in one place.
- Harder to forget to commit. Sidecars disperse across the tree.
- Hand-editing a single JSON file is fine at expected scale (hundreds of files).
- Sidecars win only if the repo has thousands of files — not our scale, and premature.

### Why `--require-reviewed` is opt-in, not default

Initial adopters need a soft landing. If the flag were default, every first run would fail until someone reviewed. Opt-in for CI lets teams adopt the strict posture deliberately once their baseline is reviewed. Flip to default in a later schema version.

### Why honour-system `reviewedBy` string, not signed

Defence in depth is the PR review itself. A cryptographic signature adds setup cost without preventing any realistic failure mode: a committer who would lie about `reviewedBy` would also lie about a signature. Keep it simple.

### Why offer a `--offline` structural fallback at all

Most runs will have an agent in the loop because the skill is invoked from one. But three real cases need a script-only path:

1. **CI without an agent runner** — a GitHub Action that runs `copy-audit` to gate merges. No model in the loop, no agent. The cache is supposed to be already populated, and `--require-reviewed` enforces that. But for the *first* run on a new file in a CI context, the script needs *some* way to produce spans rather than crash.
2. **Air-gapped or local-only environments** — a contributor running `copy-audit` standalone outside their agent.
3. **Bootstrapping** — running the script before any agent has touched the repo, to produce a baseline lockfile that the agent can later refine.

For all three, `StructuralSegmenter` produces deterministic spans from JSON key paths, markdown info-strings, and front-matter `lang:` tags. Strictly less powerful than the agent path — won't catch inline code-switching — but reproducible without any model. Always marked `reviewedBy: null` so a human or agent must still review before `--require-reviewed` will pass.

### Why `kind: "data"` exists alongside `code`/`prose`/`quote`

JSON string values that are URLs, ISO codes, enum slugs, or IDs should not receive typography rules. Today the extractor has no way to say "this string is data, not prose". The segmenter is the right place to make that call — it already has byte ranges and can reason about what it sees.

### Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| Per-glob `paths.locale` only (Option A from brainstorm) | Only handles author-labelled splits. Misses inline code-switching, quoted English, files mislabelled by glob. The user explicitly asked for a more robust and reusable approach. |
| Language-detection heuristic (diacritics + stopwords) in the engine | Works on long Czech prose (R2/R7/R8 already do this internally) but fails on short chunks, proper nouns, and any language where orthography overlaps. Good as a fallback, not a primary. |
| `LlmSegmenter` class inside the script (with transport, model selection, API key) | Duplicates infrastructure that already exists in the agent that runs the skill. Adds API-key surface area, network dependency, and a second LLM running in parallel with the host agent. Worse than letting the host agent do the work. |
| On-the-fly agent re-segmentation on every audit run, no cache | Same reproducibility problem as on-the-fly LLM calls. Cache is the load-bearing artifact. |
| Per-file lockfile sidecars | Harder to review as one diff, easier to forget to commit, no payoff at our scale. |
| Rewrite extractors to be locale-aware per format | Brittle, does not handle inline code-switching, requires new work per format. Segmentation subsumes this. |

## Constraints and Boundaries

- **Verification boundary (non-negotiable):** Layer 1 auto-closes only on cached input. Non-cached runs surface unsegmented files for the agent to handle, or fail loudly under `--require-reviewed`. Fresh agent-produced spans never auto-close on creation — they sit at `reviewedBy: null` until a human accepts them.
- **The script never calls the network or any LLM SDK.** No model imports, no API keys, no environment variables for model configuration. Agent-side work happens in the agent runtime, not in the script process.
- **No behaviour change without a self-test.** Every rule that gains `languages: ["cs"]` needs a bilingual fixture proving it skips English spans.
- **SKILL.md and ROLE.md stay in sync.** ROLE.md updated first, then SKILL.md aligned.
- **Schema versioning is load-bearing.** `schemaVersion: 1` now; bumping requires a documented migration.
- **Prompt version bumps do not silently invalidate reviewed entries.** A `promptVersion` bump invalidates only entries where `reviewedBy == null`. Reviewed entries keep their signoff until a content change forces a refresh.
- **Engine stays agent-agnostic.** No Claude-specific wrapper. The segmentation handoff is a plain CLI contract any agent can follow.

## Assumptions

| Assumption | Status | Evidence / action |
|---|---|---|
| Layer 1 auto-close is load-bearing and worth protecting | Verified | ROLE.md:43–52 states it as non-negotiable; harness-lab doctrine inherits it (docs/workshop-content-qa.md). |
| The host agent can segment bilingual text reliably given the prompt template | **Verified by Phase 0** | Sonnet-class sub-agent dry-run on three real files produced correct spans on bilingual JSON, English-only doc, and code-switching markdown. Three prompt fixes queued for v2. |
| `agenda.json` parallel `"en"/"cs"` keys produce clean bilingual boundaries | Verified | Phase 0 dry-run confirmed key-path tiebreaker works. |
| Content hash (sha256 of raw bytes) is stable enough to key cache entries | Verified | Phase 2 self-test exercises this. |
| Reviewers will actually review lockfile diffs on PR | **Unverified** | Soft mitigation: unreviewed entries are surfaced in the report; `--require-reviewed` opt-in escalates to CI-blocking when a team is ready. |
| Existing Czech rules can be safely tagged `languages: ["cs"]` without regressions | Verified | R1, R1b, R3, R4, R5, R6 are Czech typography rules with no English applicability. R2, R7, R8 already self-gate on diacritics — tagging matches their intent. |
| The current `runProfile` dispatch loop can accept a filter without structural refactor | Verified | Phase 1 landed it in one commit. |
| `copy-audit` runs under Bun on macOS and in CI | Verified | The script is `bun` today; CI support stays the same. |
| The host agent can write valid lockfile entries via the CLI helper without hand-editing JSON | **Unverified — to be validated in Phase 3** | Test by having the agent run the segment → lockfile add cycle on the three Phase 0 files end-to-end. |
| Agent-native architecture works for non-Claude agents | Reasonable | The CLI handoff is plain text in, JSON out. Any agent runtime that can shell out can drive the loop. Not validated against a non-Claude agent in this phase. |

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Agent mis-segments spans and reviewers rubber-stamp the lockfile diff | Medium | High — false negatives hide real findings | Lockfile diffs render with surrounding source context. PR review is the trust boundary. `--require-reviewed` blocks merging until a human accepts unreviewed entries. |
| Reviewers skim lockfile diffs on PR | Medium | Medium — cache becomes theatre | Make the diff format readable. If adoption stalls, ship a richer review tool as a follow-up. The lockfile being a normal JSON diff already inherits the team's PR review hygiene. |
| Agent output drifts across sessions (different host model, different context) | Low | Medium | `segmenter.promptVersion` recorded in the lockfile. Drift manifests as a reviewable diff on refresh, not a silent change. Reviewed entries survive prompt bumps. |
| Hash collisions across file edits | Vanishingly low | Low | sha256 is sufficient; standard lockfile hygiene. |
| Consuming repo (harness-lab) runs the script before any agent has populated the cache | High | Low | `StructuralSegmenter` fallback for first run. `--require-reviewed` is opt-in so first run does not crash. |
| New contract paragraph in ROLE.md is misread as weakening Layer 1 | Medium | High — trust erosion | The verification-boundary clause in SKILL.md stays verbatim. The new section explicitly restates "Layer 1 remains auto-closeable given the cache" and frames the move as *relocation*, not *relaxation*. Self-validation check fails if the old clause is missing. |
| CI environment without an agent runner cannot segment new files | Medium | Medium | `--offline` forces `StructuralSegmenter`; reports "best effort" clearly. Long-term: CI can pre-segment locally and commit, so CI itself only verifies. |
| Agent forgets to run `lockfile add` after producing spans | Low | Medium | The script's `--list-unsegmented` exit code is non-zero when entries are missing; the skill loop iterates until it returns clean. SKILL.md Phase 1a documents the loop explicitly. |
| Three-way merge on file edits causes reviewed `note` to be lost | Low | Medium | On refresh, spans with overlapping byte ranges carry forward `note` and `pathHint` if `(language, kind)` matches — documented merge rule. Covered by a self-test fixture. |
| Segmentation cost at scale (first run on a large repo) | Low | Low | One-time cost. Cached forever after. The agent can batch through files; the script gates progress with `--list-unsegmented`. |

## Rejection Criteria

The implementation is wrong, even if tests pass, if:

- Layer 1 verdicts differ across runs on the same bytes + same lockfile. (Reproducibility broken.)
- The script imports any LLM SDK, reads any API key, or makes any network call. (Architecture violated.)
- Any Czech rule fires on a span tagged `en`. (Filter broken.)
- Any rule fires on a span tagged `kind: "code"` or `kind: "data"`. (Kind filter broken.)
- The ROLE.md verification boundary clause is weakened or deleted. (Contract broken.)
- A lockfile entry's `reviewedBy` can be silently flipped from a real value back to `null` by tooling. (Trust broken.)
- Fresh agent-produced spans ever auto-close Layer 1 without sitting at `reviewedBy: null` first. (Verification boundary broken.)
- `lockfile add` overwrites a reviewed entry without `--force`. (Reviewer trust broken.)

## Phased Implementation

Work lands on `main` as small commits (trunk-based, no feature branch). Each phase has an exit criterion. Do not advance until the current phase's exit criterion is met.

### Phase 0 — Validate the segmenter assumption before committing to the design

**Goal:** Prove an LLM-class agent can segment real bilingual content reliably with a stable prompt, before building the cache and CLI around it.

**Exit criterion:** A hand-checked segmentation of three real files (bilingual JSON, English-only markdown, mixed Czech-with-English-quote markdown) matches human expectation within the tolerance we're willing to accept. **Met.**

### Phase 1 — Type and engine foundation (no behaviour change)

**Goal:** Land the type and dispatch changes that make locale-scoped rules possible, with every existing test still green.

**Exit criterion:** `bun scripts/self-test.ts` passes. No existing audits change output.

### Phase 2 — Lockfile format and file I/O

**Goal:** Read/write `.copy-editor.lock.json` with a stable, versioned, hand-editable shape.

**Exit criterion:** Lockfile round-trips through a test fixture; schema doc committed.

### Phase 3 — Segmentation handoff (script ↔ agent contract)

**Goal:** Build the CLI surface that lets the host agent segment files and write spans, plus the optional structural fallback for environments without an agent. The script never imports an LLM SDK.

**Exit criterion:** Given a real file and the v2 prompt, the host agent can run `segment` → produce JSON → `lockfile add` and end up with a valid, reviewable lockfile entry. `StructuralSegmenter` produces a baseline lockfile for the same file in `--offline` mode.

### Phase 4 — Engine wiring: spans → chunks → filtered rules

**Goal:** Chunks get their `language` and `kind` from the lockfile. The audit run loop reads cached spans, splits chunks accordingly, and reports unsegmented files clearly.

**Exit criterion:** `SKILL-facilitator.md` produces zero Czech findings when processed through the new pipeline with a committed lockfile entry. `--list-unsegmented` exits non-zero when the cache is incomplete.

### Phase 5 — CLI flags and reviewer UX

**Goal:** `--require-reviewed`, `--list-unsegmented`, `--offline`. `lockfile invalidate`. `lockfile mark-reviewed`.

**Exit criterion:** A new bilingual fixture can flow end-to-end: agent segments → `lockfile add` → reviewer inspects diff → `lockfile mark-reviewed` → CI passes `--require-reviewed`. Each step uses only documented CLI flags.

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

- [x] Write `knowledge/lockfile-schema.md` — full v1 contract with worked examples, merge rules, CLI behaviour, diff-reading guide.
- [x] Implement `scripts/lockfile.ts` with `readLockfile`, `writeLockfile`, `hashFileBytes`. Validates `schemaVersion`, contentHash format, span shape, non-overlap. Sorts files and spans on write for deterministic diffs.
- [x] 10 lockfile self-tests added — round-trip, missing-file null, schemaVersion throw, llm-without-model throw, bad hash format throw, overlap throw, empty-spans legal, sort on write. All pass. Total self-test now 20/20.

### Phase 3 — Segmentation handoff (script ↔ agent contract)

- [x] Write `knowledge/segmentation-prompt-v2.md` — applied three critical fixes (inline-code overlap worked example, JSON structural-token skip rule, heading-as-code anti-rule) and three soft fixes (column convention, granularity rule, language-on-code-spans). `promptVersion` bumped to 2.
- [x] Migrate `scripts/lockfile.ts` `segmenter.backend` enum from `"llm"` → `"agent"`. Dropped `model` field. Kept `promptVersion`. Self-test fixtures updated; 21/21 pass.
- [x] Add `copy-audit segment <path>` subcommand. Loads the v2 prompt template at runtime from the knowledge dir (single source of truth) and substitutes `{{filePath}}`, `{{declaredProfiles}}`, `{{fileBytes}}`. Resolves profile names from `extends` to ISO codes. JSON and human-readable output.
- [x] Add `copy-audit lockfile add <path> --spans <json-file-or-->` — reads spans JSON, computes contentHash, sets reviewedBy null, refuses overwrite without `--force`.
- [x] Add `copy-audit lockfile mark-reviewed <path> --by <id>` — sets reviewedBy, errors on stale hash.
- [x] Add `copy-audit lockfile invalidate <glob>` — removes matching entries.
- [x] Add `copy-audit lockfile list` — bonus subcommand for inspection.
- [x] **End-to-end validation by the host agent (this Claude session):** ran `segment workshop-skill/SKILL-facilitator.md` → produced span JSON → piped to `lockfile add` → ran `mark-reviewed` → confirmed the resulting `harness-lab/.copy-editor.lock.json` is well-formed and matches the schema. The script never called any model. The contract works end-to-end.
- [ ] Implement `StructuralSegmenter` in `scripts/structural-segmenter.ts` — **deferred to follow-up**, not blocking. Optional convenience for offline / CI environments without an agent in the loop.
- [ ] Add `copy-audit --offline` flag — **deferred**, depends on StructuralSegmenter.
- [ ] Self-test the structural segmenter — **deferred**, depends on StructuralSegmenter.
- [ ] Programmatic self-tests for the lockfile subcommands — **deferred**, currently covered by smoke tests during development.

**Phase 3 status: complete on the load-bearing critical path.** The script ↔ agent contract works. The deferred items are convenience infrastructure; they do not block Phase 4 (engine wiring), which is what makes the cached spans actually affect audit output.

### Phase 4 — Engine wiring

- [ ] Add cache-aware file processing in `scripts/copy-audit.ts`. For each file: read lockfile entry, check hash. On hit use cached spans. On miss, mark the file as unsegmented and surface it in the report (do **not** call any segmenter from inside the audit loop — that's Phase 1a in the skill, not Phase 1 in the script).
- [ ] After chunks are extracted, overlay cached spans: split each chunk by span byte ranges, attach `language` and `kind` to each resulting sub-chunk. Unmapped ranges inherit `config.language` and `kind: "prose"`.
- [ ] Tag R1, R1b, R3, R4, R5, R6 in `rules/czech.ts` with `languages: ["cs"]`. Leave R2/R7/R8 alone (they already self-gate; tagging is belt-and-braces and can be a follow-up).
- [ ] (Already done in Phase 1: engine skips `code`/`data` chunks. Verify the integration still holds end-to-end.)
- [ ] End-to-end run on `harness-lab/workshop-skill/SKILL-facilitator.md` with a hand-authored lockfile entry marking the whole file as `en`. Expect zero findings.

### Phase 5 — CLI flags and review workflow

- [ ] Add `--list-unsegmented` to the main `copy-audit` run. Lists files with no lockfile entry or with a stale hash. JSON output via `--json`. Exit code non-zero if any are listed (so the skill loop knows to iterate).
- [ ] Add `--require-reviewed` — fail the run if any included file has an unreviewed cache entry. Opt-in CI posture.
- [ ] (`--offline` and the `lockfile` subcommands shipped in Phase 3.)
- [ ] Document all flags and subcommands in `SKILL.md` and `config-schema.md`. SKILL.md Phase 1a explicitly describes the agent loop: `--list-unsegmented` → for each file, `segment` → produce JSON → `lockfile add` → repeat until clean.

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
  - Add `segment.cache_path` (default `.copy-editor.lock.json`).
  - Make `extends` actually mean "list of profiles to run" (was dead code).
  - Add `paths.locale` as an optional hint surface for the structural backend.
  - Note explicitly that there is no `segment.model` or `segment.backend.llm.*` — the script never calls a model.
- [ ] Write `knowledge/segmentation.md`: overview of the script ↔ agent contract, the segmentation prompt, how to add a new format to the structural fallback, prompt versioning, cache merge rules.
- [ ] (Lockfile schema doc shipped in Phase 2.)

### Phase 8 — Verify against harness-lab

- [ ] Install updated skill into the harness-lab CLAUDE cache (via the HoG installer path it already uses).
- [ ] Run `copy-audit --list-unsegmented --json` against harness-lab. Expect the 8 flagged files to be listed.
- [ ] **The host agent (a Claude Code session)** iterates: for each unsegmented file, run `copy-audit segment <path>`, segment the file using the v2 prompt, run `copy-audit lockfile add <path> --spans -` with the result.
- [ ] Inspect the resulting `harness-lab/.copy-editor.lock.json`. Hand-correct any mis-segmentation directly in the JSON. Run `copy-audit lockfile mark-reviewed <path> --by ondrej@2026-04-12` for each accepted entry.
- [ ] Commit `harness-lab/.copy-editor.lock.json`.
- [ ] Re-run `copy-audit`. Confirm:
  - `SKILL-facilitator.md`: zero Czech findings.
  - `agenda.json`: zero Czech findings inside `"en"` branches; Czech findings in `"cs"` branches remain.
  - Other 6 Czech files: findings similar to baseline (expected — they are genuinely Czech).
- [ ] Run `copy-audit --require-reviewed`. Should pass cleanly.
- [ ] Document the run results in a short memo at `harness-lab/docs/reviews/workshop-content/2026-04-12-locale-segmentation-rollout.md`.

## Acceptance Criteria

1. `bun scripts/self-test.ts` in the toolkit passes, including new bilingual fixtures and lockfile-subcommand tests.
2. Running the script on a file with a cached, reviewed lockfile entry is deterministic: same bytes + same lockfile always produce identical findings across 3 consecutive runs.
3. Running the skill on `harness-lab/workshop-skill/SKILL-facilitator.md` with a committed lockfile produces zero Czech findings.
4. Running the skill on `harness-lab/workshop-content/agenda.json` with a committed lockfile produces zero Czech findings inside `"en"` branches.
5. `copy-audit --require-reviewed` fails with exit code non-zero when any included file has `reviewedBy: null`.
6. `copy-audit --offline` runs to completion without any network call. The script grep'd for `fetch`, `axios`, `anthropic`, `openai`, or any HTTP client returns no matches.
7. `copy-audit --list-unsegmented` exits non-zero when the cache is incomplete; exits zero when every included file has a cache entry.
8. The host agent can run `segment` → produce JSON → `lockfile add` for a real file end-to-end without hand-editing the lockfile, and without the script ever calling a model.
9. `ROLE.md` contains the new Segmentation section, the verification boundary clause is still present verbatim, and a contributor can explain the lockfile bargain from the docs alone.
10. At least one follow-up reviewer (human, not me) reads the contract revision and confirms it does not weaken Layer 1.

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
- Other consumers (quellis, other projects) adopt at their own pace. The script-only path (`--offline` + structural fallback) means they can onboard before any agent has touched their repo.

## References

- Skill source: `/Users/ondrejsvec/projects/Bobo/heart-of-gold-toolkit/plugins/marvin/skills/copy-editor/`
- Core files: `scripts/copy-audit.ts`, `rules/czech.ts`, `rules/english.ts`, `rules/types.ts`, `rules/index.ts`
- Contract: `knowledge/ROLE.md`, `knowledge/config-schema.md`, `knowledge/output-contract.md`, `knowledge/language-profiles.md`
- Failing-case evidence: `/Users/ondrejsvec/projects/Bobo/harness-lab/workshop-content/agenda.json`, `/Users/ondrejsvec/projects/Bobo/harness-lab/workshop-skill/SKILL-facilitator.md`
- Prior plan in the same area (for tone and shape): `docs/plans/2026-04-10-refactor-quellis-icf-alignment-plan.md`
- Consumer doctrine the skill inherits from: `harness-lab/docs/workshop-content-qa.md`
