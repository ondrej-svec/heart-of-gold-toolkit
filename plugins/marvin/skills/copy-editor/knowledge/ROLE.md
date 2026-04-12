# copy-editor — Role Contract

The canonical role definition. `SKILL.md` is the agent-facing surface; this document is the deeper operating contract a contributor reads before changing the skill, and the place verification boundary, extension points, and loop invariants are recorded.

## Purpose

Review participant-facing and facilitator-facing copy in a repo against a composed rule set (baked-in language profile + repo-local style guide and reject list), produce a structured findings report, and draft a review note for a human reviewer. Layer 1 (typography, deterministic) auto-closes. Layer 2 (judgment) proposes, never decides.

## Non-Goals

- Fix copy automatically. The skill proposes rewrites; a human or a separate agent applies them.
- Replace the human reviewer. The Czech editorial gate (and any analogue in other languages) remains human-closed by doctrine.
- Translate content.
- Invent rules. Every suggestion traces to a loaded rule or a cited style guide section.
- Grow into a general writer or content generator.

## Input Contract

The skill accepts:

1. **Implicit inputs** from the repo:
   - `.copy-editor.yaml` at the repo root — mandatory
   - Repo-local rule files pointed to by the config — optional but expected
   - Files under `paths.include` minus `paths.exclude`

2. **Explicit inputs** from the caller:
   - Optional file path or list to narrow the scope
   - Optional language override (overrides `language:` in config)

If `.copy-editor.yaml` is missing, the skill stops and asks the caller to create one. It does not guess defaults.

## Output Contract

Two artifacts:

1. **Structured findings JSON** — schema in `output-contract.md`. Consumable by any agent or tool.
2. **Review note markdown draft** — stored in `output.review_notes_dir` (or emitted to stdout). Includes Layer 1 summary, Layer 2 suggestions grouped by pass, and a pending human signoff line.

## Loop Invariant

The skill runs Load → Segment (L1a) → Lint (L1) → Judge (L2) → Report → Handoff, in that order, never out of order. No step is skippable. Segment reads from or writes to the lockfile; Lint is a pure function of bytes and the cached spans. If Lint fails to execute (engine missing, config invalid), the skill halts and reports the failure — it does not attempt Layer 2 on partial data. If Segment cannot produce a cache entry for a file and no cached entry exists, the skill degrades that file to single-profile mode and notes the fallback in the report.

## Segmentation (Phase 1a)

Real content is not locale-uniform. A Czech article may quote an English paragraph. A bilingual JSON source carries parallel `en`/`cs` branches. A markdown doc may embed English code samples inside Czech prose. Applying a single language profile to the whole file produces false positives that erode trust in Layer 1.

To handle this without breaking reproducibility, the loop gains one step between Load and Lint:

**Phase 1a — Segment.** The file is divided into spans, each tagged with a language (e.g. `cs`, `en`, `unknown`) and a kind (`prose`, `code`, `quote`, `data`). Layer 1 then runs rules per chunk as before, and a span-aware **post-filter** drops findings whose source position falls inside a span that should not have triggered the rule (wrong language for the rule, or `kind: code`/`data`). A rule tagged `languages: ["cs"]` never produces a surviving finding inside a span tagged `en`.

### Who runs the segmentation

**The host agent that runs the copy-editor skill performs segmentation.** The audit script (`copy-audit`) does not call any model. When `copy-audit --list-unsegmented` reports unsegmented files, the skill instructs the agent to:

1. Run `copy-audit segment <path>` to receive a structured handoff payload with the file content, declared profiles, and the inlined v2 prompt template.
2. Apply the prompt mentally and produce span JSON.
3. Pipe the JSON to `copy-audit lockfile add <path> --spans -`.
4. Loop until `--list-unsegmented` returns clean.

The agent is the LLM in the loop. The script is the typography engine. They meet at the lockfile.

This decomposition is deliberate: building an LLM transport inside the script would duplicate infrastructure that already exists in the host agent, add API-key surface area, and run a second model in parallel with the agent driving the skill. Pushing segmentation up one level keeps the script a pure deterministic Bun process while letting any agent runtime drive the loop through the CLI contract.

### Why this preserves Layer 1 reproducibility

Asking the agent to re-segment on every audit run would break Layer 1's reproducibility guarantee — the agent's output drifts between sessions, between models, between context windows. The skill avoids that by treating segmentation output as a **lockfile**:

- Each segmentation result is keyed by the content hash of the file and stored in `.copy-editor.lock.json` at the repo root (or the path configured in `segment.cache_path`).
- On a cache hit, Layer 1 reads spans from the lockfile. No agent involvement. The result is a pure function of `(bytes, cached spans) → findings` — reproducible given the cache.
- On a cache miss or stale hash, the script reports the file as unsegmented (`copy-audit --list-unsegmented`) and the skill loop hands it to the agent. New entries land at `reviewedBy: null` and surface to the human reviewer.
- The lockfile is committed to the repo. It is a reviewable artifact, the same way `package-lock.json` is reviewed on PR.
- `copy-audit lockfile invalidate <glob>` forces re-segmentation of matching files. Otherwise the cache is authoritative.

The verification boundary moves one level up but does not weaken:

> **Layer 1 remains auto-closeable given the cache. The cache is human-closeable on creation and on refresh.**

This is the same bargain a lockfile strikes: the resolution step is non-deterministic, but once pinned, every downstream consumer sees identical input. Dependency resolvers are not "reproducible" in isolation either — they become reproducible once their output is committed.

### Failure modes specific to segmentation

| Failure | Detection | Mitigation |
|---|---|---|
| Agent unavailable (offline, no agent in the loop) | `--list-unsegmented` reports unsegmented files | Optional `StructuralSegmenter` fallback under `--offline` produces deterministic baseline spans from JSON key paths and markdown info-strings (deferred to a follow-up). Without it, the audit degrades to legacy single-profile mode for those files and warns. |
| Agent mis-segments a span | Human reviewer inspecting the lockfile diff on PR | Override the span in the lockfile directly (it is plain JSON); the next run respects hand-edits. `copy-audit lockfile mark-reviewed` sets the signoff. |
| Content hash drift (file edited after segmentation) | Hash mismatch on the next audit run | Entry is stale; surfaces in `--list-unsegmented`; re-segmented on the next loop iteration. |
| Agent drift between sessions or models | Cache hit prevents recomputation; refresh diffs surface any drift | Treat re-segmentation runs the same as lockfile bumps: one reviewed refresh, committed. `promptVersion` records which template was used. |
| Lockfile deleted or corrupted | File missing or parse error | Missing → regenerated from scratch; reviewer approves the whole new file as they would a new lockfile. Corrupt → halt with a clear error. |
| `lockfile add` overwrites a reviewed entry | Refused without `--force` | The CLI helper protects reviewed work by default. |

### Non-goals for segmentation

- Segmentation does not judge typography. It only reports "bytes N–M are language L, kind K". Judgment stays in Layers 1 and 2.
- Segmentation does not rewrite or reformat content.
- The audit script never calls a model. There is no `LlmSegmenter` class, no API key handling, no model-version field in the config. Those concerns belong to the agent runtime that drives the skill loop.
- Cache hits do not call out to anything in the steady state — Layer 1 reads bytes, reads the cached spans, runs rules, post-filters findings, exits.

## Verification Boundary (non-negotiable)

> Layer 1 (deterministic) is the only layer this skill may auto-close. Layer 2 (judgment) always produces suggestions, never verdicts. The role will not mark a file or scope as "copy-editor approved" at Layer 2. That seal belongs to a human reviewer, whose signoff is recorded in the review note the role drafts.

This clause exists in `SKILL.md` verbatim. If a future revision weakens it, the skill must fail its own validation.

Why non-negotiable:
- The deterministic layer is regex-level and reproducible — the same input always produces the same verdict. That is the only condition under which auto-close is safe.
- Layer 2 is LLM reasoning. It drifts between runs, between models, between context windows. Auto-closing on drift is how false confidence enters a system.
- The doctrine in the consuming repo (e.g. harness-lab's `docs/workshop-content-qa.md`) explicitly says AI may assist but cannot close the blocking Czech gate. This skill inherits that discipline by construction.

## Layer 2 Passes (in order)

Encoded in `SKILL.md` Phase 2. Each pass:

1. Takes the file's context pack (text + rules + doctrine + L1 findings)
2. Runs one kind of check
3. Emits suggestions with rationale and source reference
4. Moves to the next pass

Order matters: reject-list hits run first because they're the most pattern-matchable; clarity runs mid because it is the most nuanced; rhythm runs last because it needs the rest to settle.

| Pass | Type | Scope |
|---|---|---|
| A. Reject-list hits | pattern-match + rewrite | all surfaces |
| B. Nominal-style detection | pattern + judgment | all surfaces |
| C. Clarity / ambiguity | strict judgment | participant-facing only (strict), hybrid (lenient), presenter (skipped) |
| D. Voice / register | judgment against doctrine | all surfaces |
| E. Rhythm / spoken readability | judgment | all surfaces |

Adding a new pass is a bounded operation: add it to this list, to `SKILL.md` Phase 2, with a documented trigger, scope, and rationale format. No silent additions.

## Surface Profiles

`.copy-editor.yaml` supports per-path classification:

```yaml
paths:
  surface_profile:
    "content/project-briefs/**": participant
    "content/facilitation/**": presenter
    "workshop-skill/**": participant
    "content/talks/**": presenter
    "dashboard/lib/workshop-blueprint-agenda.json": hybrid
```

Values:

- **`participant`** — content a participant reads alone on mobile without a facilitator. Strict clarity bar. Pass C (clarity/ambiguity) fires hard.
- **`presenter`** — content a facilitator or presenter uses as an outline and explains live. Outline phrasing is acceptable. Pass C skipped or applied loosely.
- **`hybrid`** — default when no rule matches. Pass C applied with judgment, not strict.

The surface profile shapes Pass C explicitly. Other passes apply uniformly across surfaces.

## Extension Points

1. **New language profile** — add `rules/<lang>.ts` (see `language-profiles.md`), register in `rules/index.ts`, add fixtures to self-test. Tag rules with `languages: ["<code>"]` so the span filter scopes them correctly. No change to the engine.
2. **New Layer 1 rule within an existing profile** — add a `Rule` object, append to the profile's `rules` array, add a self-test fixture pair. Set `languages` if the rule is locale-specific. No change to the engine.
3. **New Layer 2 pass** — document it in this file, add it to `SKILL.md` Phase 2 with order and scope, give it a citation format. Update validation list.
4. **New `.copy-editor.yaml` field** — document it in `config-schema.md`, version the schema, ensure the engine and skill handle its absence gracefully.
5. **New segmentation backend** — implement under `scripts/<backend>-segmenter.ts`, document trade-offs in `knowledge/segmentation.md`, register in the lockfile schema's `SegmenterBackend` enum. The current backends are `agent` (host agent runs the v2 prompt — primary path), `structural` (deterministic JSON/markdown walker — offline fallback, deferred), and `manual` (lockfile hand-authored from the start). Adding a new backend is a contract change to `scripts/lockfile.ts` and requires a self-test for the new validation path.

Extension non-points:

- Do NOT add a Claude-specific wrapper. The skill is agent-agnostic. Skill discoverability for specific agents is the HoG installer's job, not this skill's.
- Do NOT re-implement rules in `SKILL.md`. Every rule lives in `rules/<lang>.ts`. The skill invokes; it does not duplicate.

## Failure Modes and Mitigations

| Failure | Detection | Mitigation |
|---|---|---|
| Engine missing or broken | Lint phase returns error | Halt, report, do not attempt Layer 2 |
| Config malformed | YAML parse error | Halt, report, ask user to fix |
| Rule profile absent for declared language | `getProfile` returns undefined | Halt, list available profiles |
| Repo-local rule pointer missing | File read error | Warn, continue with partial context, note the gap in the review note |
| Layer 2 drift (different suggestions across runs) | Not auto-detectable | The verification boundary makes this non-fatal: human reviewer judges anyway |
| False positive in Layer 1 | User reports | Add ignore marker in the file, or refine the rule with a self-test fixture, or refine the cached spans for the file |
| Lockfile entry stale (file changed) | `contentHash` mismatch on read | Surfaces in `--list-unsegmented`; agent re-segments; reviewer accepts via `lockfile mark-reviewed` |
| Lockfile parse error or corrupt | `readLockfile` throws | Halt with clear error; user fixes or deletes the lockfile |
| Lockfile schema version unknown | `readLockfile` throws | Halt; migration is explicit (no silent upgrade) |
| Span overlap in lockfile | `readLockfile` throws on validation | Halt; reviewer corrects the lockfile manually |
| `lockfile add` overwrites a reviewed entry | Refused without `--force` | CLI guard protects reviewed work |

## Maintenance

- The verification boundary clause is the load-bearing invariant. Any change to it requires a plan update.
- Passes are ordered; the order is documented here. Reordering is a behavioural change and requires a test.
- Self-tests are the regression safety net. New rules must include fixtures before landing.
- `SKILL.md` and this file are kept in sync. Update this file first; then align `SKILL.md`.
