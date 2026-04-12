# Segmentation Prompt v2

The stable prompt template the host agent uses to divide a file into language- and kind-tagged spans for the copy-editor skill.

This prompt is **versioned**. The version number lives in `promptVersion` in `.copy-editor.lock.json`. Bumping this version invalidates only entries where `reviewedBy == null`. Reviewed entries keep their human signoff until a content change forces a refresh.

See `segmentation-prompt-v1.md` for the previous version and the Phase 0 hand-check memo that drove v2. v2 applies the three critical fixes plus three soft fixes documented there.

## Version

- **Current:** 2
- **Predecessor:** v1 (see `segmentation-prompt-v1.md`)
- **Changes since v1:**
  1. **Inline-code overlap** — added a worked example for the three-span split (`[prose-before, code, prose-after]`) to prevent the overlap bug observed in v1.
  2. **JSON structural-token skip** — explicit rule: emit spans only for leaf string values, not for braces, brackets, keys, or commas.
  3. **Heading-as-code anti-rule** — explicit rule: a heading containing inline backticks stays `prose`; backticks inside prose do not promote the surrounding heading to `code`.
  4. **Column convention** — explicit: column 1 is the first character of the line, including any leading whitespace.
  5. **Granularity rule** — explicit: a contiguous region that is uniformly one language and kind produces one span, not many.
  6. **Code/data language rule** — explicit: for `kind: "code"` or `kind: "data"`, set `language: "unknown"` always.

## Architecture: who runs this prompt

**The host agent that runs the copy-editor skill runs this prompt.** The audit script (`copy-audit`) does not call any model. When the script reports unsegmented files via `copy-audit --list-unsegmented`, the skill instructs the agent to:

1. Read the file.
2. Apply this prompt template mentally.
3. Produce span JSON.
4. Call `copy-audit lockfile add <path> --spans -` to write the result (piping JSON via stdin).

The agent is the LLM in the loop. The script is the typography engine. They meet at the lockfile.

## Input contract

The agent is called with three inputs:

| Input | Type | Purpose |
|---|---|---|
| `filePath` | string | Repo-relative path. Hint for format disambiguation (`.json` vs `.md`). Never authoritative for language. |
| `declaredProfiles` | string[] | The set of language profiles the project has registered (e.g. `["cs", "en"]`). Pick from this set plus `"unknown"`. |
| `fileBytes` | string | The full file content as UTF-8 text, with line endings preserved. |

## Output contract

A single JSON object:

```json
{
  "spans": [
    {
      "startLine": 1,
      "startColumn": 1,
      "endLine": 12,
      "endColumn": 80,
      "language": "en",
      "kind": "prose",
      "pathHint": "meta.en.subtitle",
      "note": null
    }
  ]
}
```

Field rules:

- `startLine`, `endLine`: 1-based, inclusive.
- `startColumn`, `endColumn`: 1-based, inclusive. **Column 1 is the first character of the line, including any leading whitespace.** The line `    "title": "Harness Lab"` has the literal `H` of `Harness` at column 16.
- `language`: one value from `declaredProfiles` or `"unknown"`. Lowercase. **For `kind: "code"` or `kind: "data"`, set to `"unknown"` always** — the language field is ignored by the engine on these kinds, so setting it `"unknown"` prevents noise.
- `kind`: one of `"prose"`, `"code"`, `"quote"`, `"data"`.
- `pathHint`: optional. JSON: dotted/bracketed key path (`"inventory.briefs[0].cs.problem"`). Markdown: heading path (`"## Setup > ### Prerequisites"`). `null` when not applicable.
- `note`: optional. `null` unless you need to flag something for human review.

Spans are ordered by `(startLine, startColumn)` and **must not overlap**. Even by one column. See the worked example below for how to split prose that contains inline code.

## Kind definitions

| Kind | Definition | Examples |
|---|---|---|
| `prose` | Natural-language text intended for human reading. Sentences, paragraphs, headings, list items, bullet points. **A heading or sentence that contains inline backticks is still `prose`.** Inline backticks inside prose do not promote the surrounding heading or sentence to `code`. |
| `code` | Source code, shell commands, configuration syntax inside fenced blocks or standalone backtick blocks. Not subject to typography rules. | Fenced code blocks, standalone shell commands, JSON values that are CLI invocations. |
| `quote` | Quoted text whose language differs from the surrounding prose. Subject to typography rules of the quoted language, not the surrounding language. |
| `data` | Machine-readable strings: URLs, email addresses, ISO codes, UUIDs, enum slugs, version numbers, file paths used as identifiers. Skipped entirely by typography rules. |

## Language definitions

Use ISO 639-1 lowercase codes: `cs`, `en`, `de`, `sk`. Pick only from `declaredProfiles`. If a span is genuinely ambiguous, tag `"unknown"` rather than guessing.

**Detection signals (in priority order):**

1. **Diacritics.** Czech-specific characters (`á č ď é ě í ň ó ř š ť ú ů ý ž`) inside the span → `cs` is very likely. Same for German (`ä ö ü ß`), Slovak (`ľ ĺ ŕ`), etc.
2. **Stop words.** Czech: `je`, `na`, `se`, `že`, `pro`, `do`, `nebo`, `ale`. English: `the`, `and`, `is`, `of`, `for`, `with`, `to`. Use only when diacritics are absent.
3. **Structural context.** A JSON key path containing `cs` strongly hints `cs`; a key path containing `en` strongly hints `en`. Use as a tiebreaker, not a primary signal.
4. **filePath hint.** Lowest priority. Use only for files entirely in one language with no internal structure.

When all signals agree, confidence is high. When they disagree, return `"unknown"`.

## Granularity rule (new in v2)

**If a contiguous region of the file is uniformly one language and one kind, emit one span covering the entire region.** Do not split for structural neatness.

- A 200-line English markdown document with no language transitions → **one** span covering the whole file.
- A 50-line Czech paragraph with four embedded inline code tokens → **nine** spans: four `code` + five `prose` segments (prose-before-1, code-1, prose-between-1-2, code-2, prose-between-2-3, code-3, prose-between-3-4, code-4, prose-after-4).
- A bilingual JSON file with 20 leaf string values across `en` and `cs` branches → 20 spans.

The rule is: split only when language, kind, or pathHint changes. Do not split just because a new paragraph, heading, or list item starts.

## Critical rule: no overlapping spans (new worked example in v2)

**Every byte in the file belongs to at most one span.** Spans must be ordered by `(startLine, startColumn)` and must not overlap — not even touching. If span A ends at column 10, span B must start at column 11 or later (or on a later line).

When prose contains inline backticks, split the prose into a three-span sequence:

### Worked example: prose with inline code

**Input (line 21):**

```
**Folder B: repo with harness**
- Workshop skill installed (`harness skill install`)
```

**Wrong output (overlapping spans):**

```json
{ "startLine": 22, "startColumn": 1, "endLine": 22, "endColumn": 56, "language": "en", "kind": "prose" },
{ "startLine": 22, "startColumn": 30, "endLine": 22, "endColumn": 53, "language": "unknown", "kind": "code" }
```

The second span is nested inside the first. This violates the contract.

**Correct output (three non-overlapping spans):**

```json
{ "startLine": 22, "startColumn": 1, "endLine": 22, "endColumn": 28, "language": "en", "kind": "prose", "note": "prose before inline code" },
{ "startLine": 22, "startColumn": 29, "endLine": 22, "endColumn": 54, "language": "unknown", "kind": "code", "note": "inline command: harness skill install" },
{ "startLine": 22, "startColumn": 55, "endLine": 22, "endColumn": 56, "language": "en", "kind": "prose", "note": "closing paren after inline code" }
```

The three spans touch but do not overlap: `1-28`, `29-54`, `55-56`. Column ranges are inclusive and disjoint.

If the "closing paren after inline code" span is not worth emitting (one character), you may extend the `code` span's `endColumn` to absorb it, or drop it and leave the gap — the engine fills gaps with the config default. **Dropping the after-span is preferred for single-character tails.**

### Worked example: simpler case when inline code is at end of line

**Input (line 52):**

```
Whether `harness` CLI should have a `demo-setup` command that scaffolds both folders automatically.
```

**Correct output (five spans):**

```json
{ "startLine": 52, "startColumn": 1,  "endLine": 52, "endColumn": 8,  "language": "en", "kind": "prose" },
{ "startLine": 52, "startColumn": 9,  "endLine": 52, "endColumn": 17, "language": "unknown", "kind": "code" },
{ "startLine": 52, "startColumn": 18, "endLine": 52, "endColumn": 37, "language": "en", "kind": "prose" },
{ "startLine": 52, "startColumn": 38, "endLine": 52, "endColumn": 49, "language": "unknown", "kind": "code" },
{ "startLine": 52, "startColumn": 50, "endLine": 52, "endColumn": 98, "language": "en", "kind": "prose" }
```

### When you can leave inline code inside prose

**If the prose region is long (many lines) and contains one very short inline code token (a file name, a single command), and the typography rules would not fire on the code token anyway** (the surrounding language is `en` and the token contains no Czech diacritics or nbsp-eligible prepositions), you may leave the token inside the prose span and add a `note` explaining it.

This is the "single line with one inline `backtick.md`" case. Splitting into three spans is correct but verbose; leaving it inside is pragmatic when the typography rules provably cannot fire inside the backtick region. Prefer splitting when in doubt.

## JSON structural-token skip rule (new in v2)

**Do not emit spans for JSON structural syntax.** This includes:

- Opening and closing braces `{` `}`
- Opening and closing brackets `[` `]`
- Commas
- Colons after keys
- Key strings themselves (`"meta":`, `"title":`)

**Emit spans only for leaf string values** whose content is intended to be read by a human or processed as data/code.

### Worked example: bilingual JSON

**Input (lines 1-16):**

```json
{
  "schemaVersion": 3,
  "blueprintId": "harness-lab-core-day",
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
}
```

**Wrong output (pollutes lockfile with structural spans):**

```json
{ "startLine": 1, "startColumn": 1, "endLine": 1, "endColumn": 1, "language": "unknown", "kind": "code", "note": "JSON opening brace" },
{ "startLine": 2, "startColumn": 3, "endLine": 2, "endColumn": 22, "language": "unknown", "kind": "data", "note": "schemaVersion key" },
...
```

**Correct output (leaf string values only):**

```json
{ "startLine": 3, "startColumn": 20, "endLine": 3, "endColumn": 39, "language": "unknown", "kind": "data", "pathHint": "blueprintId", "note": "enum slug" },
{ "startLine": 6, "startColumn": 16, "endLine": 6, "endColumn": 28, "language": "en", "kind": "prose", "pathHint": "meta.en.title", "note": "no diacritics; tagged from key path" },
{ "startLine": 7, "startColumn": 19, "endLine": 7, "endColumn": 72, "language": "en", "kind": "prose", "pathHint": "meta.en.subtitle" },
{ "startLine": 10, "startColumn": 16, "endLine": 10, "endColumn": 28, "language": "cs", "kind": "prose", "pathHint": "meta.cs.title", "note": "no diacritics; tagged from key path" },
{ "startLine": 11, "startColumn": 19, "endLine": 11, "endColumn": 68, "language": "cs", "kind": "prose", "pathHint": "meta.cs.subtitle" }
```

`schemaVersion: 3` is skipped entirely — it's a number, not a string, and has no typography surface. `"harness-lab-core-day"` is `kind: data` because it's an identifier slug. Everything else is a leaf string value tagged by key path or diacritics.

## Heading-as-code anti-rule (new in v2)

**A markdown heading or sentence that contains inline backticks is still `prose`.** Inline backticks inside prose do not promote the surrounding heading or sentence to `kind: code`.

### Worked example

**Input:**

```markdown
### `workshop facilitator login`

Authenticate as a facilitator through the `harness` CLI privileged path.
```

**Wrong output (heading tagged as code):**

```json
{ "startLine": 1, "startColumn": 1, "endLine": 1, "endColumn": 33, "language": "unknown", "kind": "code", "note": "H3 heading containing CLI command" }
```

**Correct output (heading is prose; backticks may be extracted as code or left in):**

Option A — extract the backtick range into a code span (more precise):
```json
{ "startLine": 1, "startColumn": 1, "endLine": 1, "endColumn": 4, "language": "en", "kind": "prose", "note": "H3 marker" },
{ "startLine": 1, "startColumn": 5, "endLine": 1, "endColumn": 33, "language": "unknown", "kind": "code", "note": "CLI command" }
```

Option B — leave the backticks inside the prose span (pragmatic; valid when the command contains no diacritics or typography-triggering characters):
```json
{ "startLine": 1, "startColumn": 1, "endLine": 1, "endColumn": 33, "language": "en", "kind": "prose", "note": "H3 heading with inline CLI command" }
```

Either is correct. **What is wrong** is tagging the whole heading line as `kind: "code"` because it "looks like" a command — that strips the heading of its prose status and would make typography rules skip headings in general.

## Edge case rulebook

| Case | Rule |
|---|---|
| Bilingual JSON with parallel `"en": {...}` / `"cs": {...}` blocks | Emit one span per leaf string value. Tag from the enclosing key path (`pathHint` records it). Parallel branches become parallel spans. Skip structural tokens. |
| English code fence inside Czech markdown | The fenced block is one `kind: "code"` span with `language: "unknown"`. The surrounding Czech prose is split into `prose-before` and `prose-after` spans around the fence. |
| Inline `code` span inside prose | See the three-span worked example above. Split into `[prose-before, code, prose-after]`. |
| Czech sentence quoting an English fragment | If the quotation is long enough to warrant typography rules, emit it as a separate `en / quote` span. If it is short (≤ a few words), leave it inside the `cs` prose span with a note. |
| Short string with no diacritics and no stop words (`"Save"`, `"OK"`) | Tag `language: "unknown"`. Engine will fall back to config default. |
| URLs, emails, IDs, version numbers, ISO codes | `kind: "data"`, `language: "unknown"`. |
| Front-matter `lang:` field in markdown | Authoritative for the body that follows it, until a code fence, quote span, or new front matter. |
| Empty file or whitespace-only file | Return `{"spans": []}`. |
| Uniformly one language, no transitions | Return `{"spans": []}`. The engine fills from the config default. No need to emit a single whole-file span just to be explicit. |
| File you cannot classify at all | Return one span covering the whole file with `language: "unknown"`, `kind: "prose"`, and a `note` explaining why. |

## The literal prompt template

This is the text the host agent uses when performing segmentation. `{{filePath}}`, `{{declaredProfiles}}`, and `{{fileBytes}}` are replaced at call time (e.g. by `copy-audit segment` when it prints the handoff payload). Do not modify without bumping `promptVersion`.

```
You are a content segmenter for a typography review tool. Your job is to divide a file into ordered, non-overlapping spans, each tagged with a natural language and a content kind. You do not judge typography. You do not rewrite content. You only segment.

## Output rules

Return a single JSON object and nothing else. No prose preamble. No trailing commentary. No code fence around the JSON. The first character of your response must be `{` and the last must be `}`.

The object has exactly one key, `spans`, whose value is an array of span objects.

A span object has these fields:
- startLine (1-based int, inclusive)
- startColumn (1-based int, inclusive) — column 1 is the first character of the line, including leading whitespace
- endLine (1-based int, inclusive)
- endColumn (1-based int, inclusive)
- language (one of: {{declaredProfiles}}, or "unknown" — set to "unknown" for code and data kinds)
- kind (one of: "prose", "code", "quote", "data")
- pathHint (string or null)
- note (string or null)

Spans must be ordered by (startLine, startColumn) and MUST NOT overlap. Not even by one column. If prose contains inline code, split into [prose-before, code, prose-after] — three non-overlapping spans.

## Kind definitions

- "prose": natural-language text for human reading. A heading or sentence containing inline backticks is still prose — do not promote the surrounding line to "code".
- "code": fenced code blocks, standalone backtick blocks, shell commands, config syntax. Skipped by typography rules.
- "quote": quoted text whose language differs from the surrounding prose.
- "data": URLs, emails, IDs, ISO codes, UUIDs, version numbers, enum slugs.

## Granularity

If a contiguous region is uniformly one language and one kind, emit ONE span covering the whole region. Do not split for structural neatness. A 200-line uniformly-English file produces one span, not sixty.

## Language detection priority

1. Czech diacritics (á č ď é ě í ň ó ř š ť ú ů ý ž) → cs
2. Other language diacritics → that language
3. Stop words (cs: je, na, se, že, pro / en: the, and, is, of, for) → infer
4. JSON key path containing a language code (e.g. "meta.en.title") → use as tiebreaker
5. If still ambiguous → "unknown"

## JSON files: emit spans for leaf string values only

Do NOT emit spans for JSON braces, brackets, commas, or key tokens. Emit spans only for leaf string values meant to be read by a human or processed as data.

## Empty or uniform files

- Empty or whitespace-only file → return {"spans": []}.
- File that is uniformly the config default language with no internal transitions → return {"spans": []}. The engine fills from the default.
- File you cannot classify at all → one span covering the whole file with language "unknown" and a note.

## Inputs

filePath: {{filePath}}
declaredProfiles: {{declaredProfiles}}

fileBytes:
---
{{fileBytes}}
---

Return the segmentation now.
```

## Open questions for future versions

- Should `quote` spans carry a `quoteKind` field to distinguish block-quoted from inline-quoted? Not yet worth it.
- Should the prompt have a self-check instruction ("before returning, verify no spans overlap")? Would increase latency but might prevent the v1 overlap bug even without the worked example. Consider for v3 if v2 still shows the bug in practice.
- Should headings carry a `level` hint? No — pathHint already captures heading structure.
