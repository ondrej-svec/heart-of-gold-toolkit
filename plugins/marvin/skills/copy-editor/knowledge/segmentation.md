# Segmentation — script ↔ agent contract

How the copy-editor skill divides bilingual or mixed-content files into language- and kind-tagged spans, and how those spans flow from the host agent into the audit engine via a committed lockfile.

This document is the contract surface. If you are extending the skill with a new format, a new language, a new segmentation backend, or a new content kind, start here.

## Why segmentation exists

Real content is not locale-uniform. Concrete cases the audit must handle without false positives:

- A bilingual JSON file with parallel `"en": {...}` / `"cs": {...}` branches.
- A Czech markdown document that quotes English inline.
- A README in English that references Czech identifiers in code blocks.
- A workshop guide whose front matter is YAML, body is Czech prose, and command examples are English shell.

Applying a single language profile to the whole file produces hundreds of false positives that erode trust in Layer 1. The fix is to tag each contiguous region of the file with its actual language and kind, then run rules per-region.

## The architecture in one diagram

```
Phase 0   Load         (script)  parse config, resolve paths
Phase 1a  Segment      (agent)   for each unsegmented file:
                                    copy-audit segment <path>      ← script: print handoff
                                    [agent applies prompt]         ← agent: produce span JSON
                                    copy-audit lockfile add ...    ← script: write entry
Phase 1   Lint (L1)    (script)  read lockfile, run rules,
                                  post-filter findings by spans
Phase 2   Judge (L2)   (agent)   per-file judgment passes
Phase 3   Report       (script)  emit findings + review note
Phase 4   Handoff      (agent)   summary + pending review list
```

The split is deliberate: deterministic mechanical work belongs in the script; LLM-shaped reasoning belongs in the agent. The lockfile is where they meet.

## Why the script never calls a model

The skill runs inside an agent runtime (Claude Code, or any other host that loads the marvin plugin). That host **is** an LLM. Building an `LlmSegmenter` class with a transport interface, model selection, API key handling, and prompt-version negotiation would duplicate infrastructure that already exists in the room. It would also create a second smaller LLM running in parallel with the agent that drives the skill — strictly worse than letting the agent do the work itself.

The agent-native split pushes segmentation up one level:

1. The script reports unsegmented files.
2. The host agent reads each file, applies the prompt template, produces span JSON.
3. The script writes the result via a CLI helper.

The script stays a pure deterministic Bun process — no SDK imports, no API keys, no network. The agent is the LLM in the loop; the script is the typography engine.

This decomposition means:

- **Phase 0 validation** (Sonnet sub-agent acting as the model) maps directly onto production: the production "model" is whatever agent runs the skill.
- **No transport, no API keys, no rate limiting, no retries** — the agent runtime handles all of that.
- **Any agent runtime works** — the CLI contract is plain text in, JSON out. Not Claude-specific.
- **Cost is amortised across the agent's existing context window** — no separate LLM bill for segmentation.

## Why a lockfile

The ROLE.md verification boundary requires Layer 1 to be *regex-level and reproducible*. Even with the agent doing segmentation, asking the agent to re-segment on every audit run would break that invariant — agent output drifts between sessions, between models, between context windows.

A lockfile moves the non-determinism to a one-time pinning step that is then cached and reviewed — the same bargain `package-lock.json` strikes. Layer 1 stays reproducible *given the cache*, and the cache is a committed, diffable artifact.

Concretely:

- **Cache hit:** Layer 1 reads spans from the lockfile. No agent involvement. Pure function of `(bytes, cached spans) → findings`.
- **Cache miss or stale hash:** the script reports the file via `--list-unsegmented`. The skill loop hands it to the agent. New entries land at `reviewedBy: null` and surface to the human reviewer.
- **Reviewer accepts:** `copy-audit lockfile mark-reviewed <path> --by <id>` sets the signoff. Errors if the file's contentHash has changed since segmentation.
- **CI gate:** `copy-audit --require-reviewed` exits non-zero if any included file has `reviewedBy: null` or no entry. Opt-in.

The verification boundary moves one level up but does not weaken:

> **Layer 1 remains auto-closeable given the cache. The cache is human-closeable on creation and on refresh.**

See `knowledge/ROLE.md` → "Segmentation (Phase 1a)" for the full contract restatement.

## The prompt

The current prompt is `segmentation-prompt-v2.md`. It is the canonical text the agent applies during Phase 1a. The literal template lives in a fenced code block under "## The literal prompt template" — the script extracts that block at runtime when assembling the handoff payload.

### Prompt versioning

- The current version lives in `segmentation-prompt-v<N>.md`.
- The version number is recorded in the lockfile as `segmenter.promptVersion`.
- A version bump invalidates only entries where `reviewedBy == null`. Reviewed entries keep their human signoff until a content change forces a refresh.
- When you bump the version, **create a new file** (`segmentation-prompt-v<N+1>.md`) rather than overwriting v<N>. The previous version stays as historical record. Update `CURRENT_PROMPT_VERSION` and `PROMPT_V<N>_FILENAME` in `scripts/copy-audit.ts`.
- The prompt itself is a single source of truth. Do not duplicate it in TypeScript constants.

### When to bump the prompt version

- A real bug in segmentation that the prompt needs to teach around (e.g. v1 → v2 added the inline-code overlap worked example).
- A new edge case the rulebook needs (e.g. a new format that needs explicit handling).
- A material change in output schema (e.g. adding a new `kind` value).

Cosmetic edits or clarifications that do not change agent behaviour do **not** need a version bump. Use judgment.

## Backends

The lockfile records which segmenter produced its entries via `segmenter.backend`:

| Backend | When used | Status |
|---|---|---|
| `agent` | Primary path. The host agent (Claude Code or equivalent) runs the prompt and writes spans via the CLI helpers. | Implemented. Validated end-to-end. |
| `structural` | Fallback for `--offline` / CI environments without an agent in the loop. Walks JSON key paths, markdown front matter, and markdown info-strings deterministically. | **Deferred to follow-up.** Optional convenience; the agent path covers all real use cases. |
| `manual` | Lockfile hand-authored from the start. No backend in the traditional sense — used for tests and edge cases. | Implicit; honoured by the validator. |

### Adding a new backend

If you want to add a new backend (e.g. a structural format-specific walker, or a different model integration):

1. Decide whether the backend is a **script-side** path (deterministic, no agent) or a **handoff** to an external runtime.
2. For script-side: implement under `scripts/<name>-segmenter.ts`. Export a function with signature `segment(filePath: string, fileBytes: string, declaredProfiles: string[]): LockfileSpan[]`. Add a CLI entry point (e.g. a flag on the audit run) that uses it.
3. For handoff: extend the `copy-audit segment` subcommand to print whatever payload the new runtime needs.
4. Update `scripts/lockfile.ts` `SegmenterBackend` enum to include the new backend name. Update validation to require any backend-specific fields.
5. Document trade-offs in this file under "Backends".
6. Add a self-test exercising the new backend's validation path.

The agent backend will always be the primary path because it requires no per-format engineering and handles arbitrary mixed content. New backends should be motivated by a real environment constraint (no agent in the loop, deterministic offline runs, etc.).

## Cache merge rules

When a file changes (`contentHash` mismatch), the lockfile entry is stale. On the next refresh:

1. **If the previous entry has `reviewedBy == null`:** replace wholesale. Nothing to preserve.
2. **If the previous entry has `reviewedBy != null`:** the agent re-segments the file. The new entry inherits `note` and `pathHint` from previous spans whose `(language, kind)` matches and whose byte range overlaps the new span (best-effort line-based intersection — exact byte ranges will not survive content edits).
3. **`reviewedBy` is reset to `null`** after refresh, regardless of merge success. A human reviews the new spans before the entry is considered closed again. Carrying forward `reviewedBy` blindly across content changes would defeat the contract.
4. **The reviewer's diff** (the lockfile change in the PR) shows old vs new spans. Carried-forward `note`/`pathHint` survive; everything else is presented for fresh approval.

The merge logic is currently informal — when an agent re-segments a stale file, it can read the previous entry from the lockfile (it is plain JSON), preserve relevant `note`/`pathHint` values manually, and write the new entry. A formal three-way merge helper is a future enhancement if the manual workflow proves tedious.

## Span shape (quick reference)

See `lockfile-schema.md` for the full field contract. Quick view:

```json
{
  "startLine": 5,
  "startColumn": 7,
  "endLine": 12,
  "endColumn": 80,
  "language": "en",
  "kind": "prose",
  "pathHint": "meta.en.subtitle",
  "note": null
}
```

Invariants:
- 1-based inclusive line and column ranges.
- Column 1 is the first character of the line, including leading whitespace.
- Spans are ordered by `(startLine, startColumn)` and **must not overlap**.
- Gaps between spans fall back to `config.language` and `kind: prose`.
- For `kind: code` and `kind: data`, set `language: "unknown"` always (the engine ignores the language field on those kinds).

## What segmentation does NOT do

- **Does not judge typography.** Spans report "bytes N–M are language L, kind K". Layer 1 rules judge the typography. Layer 2 judges the writing.
- **Does not rewrite content.** The skill is read-only on source files.
- **Does not call a model from inside the script.** No exceptions. If you find yourself adding a fetch, an SDK import, or an API key field to the script, stop and reconsider.
- **Does not auto-close on fresh agent output.** New entries land at `reviewedBy: null`. Layer 1 only auto-closes once a human (or the same agent acting as the reviewer) calls `mark-reviewed`.
- **Does not silently re-segment.** A stale entry surfaces in `--list-unsegmented`; the agent must explicitly act on it.

## See also

- `ROLE.md` — verification boundary and loop invariant.
- `SKILL.md` — agent-facing phase reference.
- `lockfile-schema.md` — `.copy-editor.lock.json` field contract.
- `segmentation-prompt-v2.md` — the canonical prompt (current version).
- `config-schema.md` — `.copy-editor.yaml` fields, including `segment.cache_path` and the deliberate omissions.
