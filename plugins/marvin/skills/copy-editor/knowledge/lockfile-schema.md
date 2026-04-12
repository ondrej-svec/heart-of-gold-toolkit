# Lockfile schema (`.copy-editor.lock.json`)

The copy-editor skill caches LLM segmentation output as a reviewable lockfile. This document is the contract for the file's shape, invariants, and merge rules.

The lockfile is committed to the repo. It is reviewed on PR the same way `package-lock.json` is reviewed. Layer 1 of the audit is a pure function of `(file bytes, cached spans) → findings`, so given the same lockfile, the same input bytes always produce the same verdict. Reproducibility is preserved by treating the cache as load-bearing committed state.

## Top-level shape

```json
{
  "schemaVersion": 1,
  "segmenter": {
    "backend": "agent",
    "promptVersion": 2
  },
  "files": {
    "<repo-relative path>": {
      "contentHash": "sha256:<hex>",
      "segmentedAt": "2026-04-12T10:30:00Z",
      "reviewedBy": "ondrej@2026-04-12",
      "spans": [
        {
          "startLine": 5,
          "startColumn": 7,
          "endLine": 5,
          "endColumn": 28,
          "language": "en",
          "kind": "prose",
          "pathHint": "meta.en.title",
          "note": null
        }
      ]
    }
  }
}
```

## Field contract

### Top level

| Field | Type | Required | Meaning |
|---|---|:-:|---|
| `schemaVersion` | int | ✓ | Lockfile format version. The reader halts on an unknown version. Bumping requires a documented migration. |
| `segmenter` | object | ✓ | Records which segmenter produced the entries. Used for refresh logic and audit trails. |
| `files` | object | ✓ | Map from repo-relative path to per-file entry. Empty `{}` is legal. |

### `segmenter`

| Field | Type | Required | Meaning |
|---|---|:-:|---|
| `backend` | `"agent" \| "structural" \| "manual"` | ✓ | Which segmenter produced the spans. `agent` = the host agent running the copy-editor skill (the primary path). `structural` = deterministic no-agent fallback used for `--offline` runs. `manual` = hand-authored from the start. The script itself never calls a model, so there is no `llm` backend — segmentation by the host agent happens in the agent runtime, not in the script process. |
| `promptVersion` | int | agent only | Version of the segmentation prompt template the agent used. A bump invalidates only entries where `reviewedBy == null`. Reviewed entries keep their human signoff until a content change forces a refresh. Required when `backend == "agent"`. |

### `files[<path>]`

| Field | Type | Required | Meaning |
|---|---|:-:|---|
| `contentHash` | `"sha256:<hex>"` | ✓ | sha256 of the file's UTF-8 bytes at segmentation time. A mismatch on the next audit run means the file changed and the entry is stale. |
| `segmentedAt` | ISO8601 string | ✓ | UTC creation or refresh timestamp. |
| `reviewedBy` | string \| null | ✓ | Honour-system reviewer identifier (e.g. `"ondrej@2026-04-12"`). `null` means "produced by the segmenter, not yet reviewed". The skill's Phase 4 handoff lists null entries as pending. |
| `spans` | Span[] | ✓ | Ordered, non-overlapping span list. May be empty (`[]`) for a file that is uniformly the config default language and kind. |

### Span

| Field | Type | Required | Meaning |
|---|---|:-:|---|
| `startLine` | int (1-based, inclusive) | ✓ | First line of the span. |
| `startColumn` | int (1-based, inclusive) | ✓ | First column of the span. Column 1 is the first character of the line, including any leading whitespace. |
| `endLine` | int (1-based, inclusive) | ✓ | Last line of the span. |
| `endColumn` | int (1-based, inclusive) | ✓ | Last column of the span on `endLine`. |
| `language` | ISO 639-1 lowercase \| `"unknown"` | ✓ | Locale tag the engine uses to filter rules via `Rule.languages`. `"unknown"` falls back to the config default language. For `kind: "code"` and `kind: "data"`, set to `"unknown"` always — the language value is ignored on those kinds. |
| `kind` | `"prose" \| "code" \| "quote" \| "data"` | ✓ | Content category. Layer 1 typography rules apply to `prose` and `quote`; the engine skips `code` and `data` entirely. |
| `pathHint` | string \| null | ✗ | For structured formats, a hint about where the span came from. JSON: dotted/bracketed key path (`"inventory.briefs[0].cs.problem"`). Markdown: heading path (`"## Setup > ### Prerequisites"`). Purely informational; preserved on refresh. |
| `note` | string \| null | ✗ | Free-form reviewer or segmenter comment. Preserved across refreshes when `reviewedBy` is non-null. |

## Invariants

1. **Span order.** Spans within a file are sorted ascending by `(startLine, startColumn)`. Tools that read or write the lockfile must preserve order.
2. **No overlap.** Two spans within the same file must not share any byte. If a prose region contains an inline code token, the prose is split into `[prose-before, code, prose-after]` — three non-overlapping spans, not nested.
3. **Gaps are legal.** Spans need not cover the entire file. Unmapped byte ranges fall back to the config's top-level `language` and `kind: "prose"` semantics. A file that is 100% the config default with no internal transitions can have `spans: []` and still hash-match.
4. **Hand-edits survive content stability.** A reviewer may edit any span (including `note`, `language`, `kind`, byte ranges) directly in the lockfile. The next `copy-audit` run preserves edits as long as `contentHash` still matches the file. A non-null `reviewedBy` is the signal that hand-edits exist and must be preserved.
5. **Hash mismatch invalidates the entry.** If `contentHash` does not match the current file bytes, the entry is stale. The next audit treats the file as needing refresh and surfaces the diff to the reviewer. Findings on stale entries are not auto-closeable until the entry is refreshed and re-reviewed.
6. **Prompt-version bumps invalidate unreviewed entries only.** When `segmenter.promptVersion` changes, entries where `reviewedBy == null` are invalidated and regenerated on next refresh. Entries with a non-null `reviewedBy` are preserved — a human already accepted them under the previous prompt, and that signoff is sticky until the file content changes.
7. **`reviewedBy` is honour-system.** The skill does not cryptographically verify the value. Defence in depth is the PR review itself. Tools must never silently flip a non-null `reviewedBy` back to `null`.
8. **`schemaVersion` is checked on read.** The reader halts on an unknown version with a clear error. Migration requires explicit user action.

## Merge rules (refresh path)

When a file's content changes (`contentHash` mismatch), the next refresh produces new spans from the segmenter. The skill performs a three-way merge against the previously reviewed entry:

1. **If the previous entry has `reviewedBy == null`**, replace it wholesale. Nothing to preserve.
2. **If the previous entry has `reviewedBy != null`**, attempt to carry forward `note` and `pathHint` for any new span whose `(language, kind)` matches a previous span with overlapping byte ranges (using a best-effort line-based intersection — exact byte ranges will not survive content edits).
3. **`reviewedBy` is reset to `null`** after a refresh, regardless of merge success. A human reviews the new spans before the entry is considered closed again. Carrying forward `reviewedBy` blindly across content changes would defeat the contract.
4. **The reviewer's terminal diff** (via `copy-audit --review-cache`) shows old vs. new spans side by side. Carried-forward `note`/`pathHint` survive; everything else is presented for fresh approval.

## Worked example: bilingual JSON

`workshop-content/agenda.json` slice (lines 4-30):

```json
"meta": {
  "en": {
    "title": "Harness Lab",
    "subtitle": "Workshop operating system for working with AI agents"
  },
  "cs": {
    "title": "Harness Lab",
    "subtitle": "Workshop operating system pro práci s AI agenty"
  }
}
```

Lockfile entry:

```json
{
  "workshop-content/agenda.json": {
    "contentHash": "sha256:1a2b3c...",
    "segmentedAt": "2026-04-12T10:30:00Z",
    "reviewedBy": "ondrej@2026-04-12",
    "spans": [
      {
        "startLine": 6,
        "startColumn": 7,
        "endLine": 6,
        "endColumn": 28,
        "language": "en",
        "kind": "prose",
        "pathHint": "meta.en.title",
        "note": "no diacritics; tagged from key path"
      },
      {
        "startLine": 7,
        "startColumn": 7,
        "endLine": 7,
        "endColumn": 72,
        "language": "en",
        "kind": "prose",
        "pathHint": "meta.en.subtitle",
        "note": null
      },
      {
        "startLine": 10,
        "startColumn": 7,
        "endLine": 10,
        "endColumn": 28,
        "language": "cs",
        "kind": "prose",
        "pathHint": "meta.cs.title",
        "note": "no diacritics; tagged from key path"
      },
      {
        "startLine": 11,
        "startColumn": 7,
        "endLine": 11,
        "endColumn": 65,
        "language": "cs",
        "kind": "prose",
        "pathHint": "meta.cs.subtitle",
        "note": null
      }
    ]
  }
}
```

## Worked example: English-only operational doc

`workshop-skill/SKILL-facilitator.md` (200 lines, all English):

```json
{
  "workshop-skill/SKILL-facilitator.md": {
    "contentHash": "sha256:d4e5f6...",
    "segmentedAt": "2026-04-12T10:30:00Z",
    "reviewedBy": "ondrej@2026-04-12",
    "spans": [
      {
        "startLine": 1,
        "startColumn": 1,
        "endLine": 200,
        "endColumn": 1,
        "language": "en",
        "kind": "prose",
        "pathHint": null,
        "note": "entire file is English operational doc"
      }
    ]
  }
}
```

One span covers the whole file. The Czech profile in `declaredProfiles` has no rules to fire because every prose chunk is tagged `en`.

## Worked example: file with no internal transitions

A file that is uniformly the config default language can omit spans entirely:

```json
{
  "content/talks/all-czech.md": {
    "contentHash": "sha256:9z8y7x...",
    "segmentedAt": "2026-04-12T10:30:00Z",
    "reviewedBy": null,
    "spans": []
  }
}
```

Empty `spans` plus a non-null `contentHash` means "the segmenter inspected this file and found no language transitions worth recording". The engine treats the whole file as the config default.

## CLI behaviour summary

| Flag | Effect on lockfile |
|---|---|
| _(no flag)_ | Read lockfile if present. On hit (hash match) use cached spans. On miss, segment and write a new entry with `reviewedBy: null`. Surface unreviewed entries in the report. |
| `--refresh-cache [<glob>]` | Invalidate matching entries. Re-segment on next run. New entries get `reviewedBy: null` and require review. |
| `--review-cache` | Iterate unreviewed entries. Render spans against source with colourised language/kind. Prompt `accept / edit / skip`. Accept sets `reviewedBy` from `$COPY_EDITOR_REVIEWER` or interactive prompt. Edit opens `$EDITOR` on the entry's `spans` array. |
| `--require-reviewed` | Fail the run with non-zero exit if any included file has `reviewedBy: null`. Typical CI posture; opt-in. |
| `--offline` | Force `structural` backend. Skip the LLM. New entries are produced deterministically from format-aware structural rules (JSON key paths, markdown info-strings, front-matter). |

## Reading a lockfile diff on PR

Reviewers see one diff per file change in the lockfile. A typical diff:

```diff
   "workshop-content/agenda.json": {
-    "contentHash": "sha256:1a2b3c...",
-    "segmentedAt": "2026-04-12T10:30:00Z",
+    "contentHash": "sha256:4d5e6f...",
+    "segmentedAt": "2026-04-15T14:00:00Z",
-    "reviewedBy": "ondrej@2026-04-12",
+    "reviewedBy": null,
     "spans": [
       {
         "startLine": 6,
         "startColumn": 7,
-        "endLine": 6,
-        "endColumn": 28,
+        "endLine": 7,
+        "endColumn": 35,
         "language": "en",
         "kind": "prose",
         "pathHint": "meta.en.title",
-        "note": "no diacritics; tagged from key path"
+        "note": null
       },
```

The reviewer's job: confirm the new spans match what the file actually contains, then run `--review-cache` locally to set `reviewedBy` and commit the result. The `null` reviewedBy in the diff is the signal that the entry needs human attention.

## What this schema does NOT contain

- Per-rule overrides (e.g. "skip R1 on this span"). Use the existing `ignore_marker` mechanism or a per-glob exclude in `.copy-editor.yaml`.
- Per-finding overrides ("this finding is a known false positive"). Out of scope; that's a separate suppression file.
- Comments in the JSON. The lockfile is plain JSON, not JSONC. Notes go in span `note` fields.
- Cryptographic signatures on `reviewedBy`. Honour-system; defence in depth is the PR review.
- Timestamps on individual spans. Only the entry as a whole has `segmentedAt`.
