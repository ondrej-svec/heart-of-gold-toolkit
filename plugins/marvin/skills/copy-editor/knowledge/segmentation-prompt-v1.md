# Segmentation Prompt v1

The stable prompt template the default `LlmSegmenter` uses to divide a file into language- and kind-tagged spans for the copy-editor skill.

This prompt is **versioned**. The version number lives in `promptVersion` in `.copy-editor.lock.json`. Bumping this version invalidates only entries where `reviewedBy == null`. Reviewed entries keep their human signoff until a content change forces a refresh.

## Version

- **Current:** 1
- **Status:** Validated by Phase 0 dry-run on 2026-04-12. Three prompt fixes required before Phase 3 implementation (see Hand-check memo below).
- **Last hand-checked against:** `harness-lab/workshop-content/agenda.json` (lines 1-74), `harness-lab/workshop-skill/SKILL-facilitator.md`, `harness-lab/content/talks/codex-demo-script.md` — 2026-04-12.

## Design constraints

The prompt is engineered to maximise **stability across runs and across models**, not to be clever. Cleverness is non-determinism. The prompt:

1. **Defines a closed vocabulary.** `language` is one of a fixed set; `kind` is one of `prose | code | quote | data`. The model never invents tags.
2. **Demands strict JSON output**, no prose preamble, no trailing commentary. The skill parses the first `{` to the last `}` and rejects anything else.
3. **Uses 1-based inclusive line/column ranges.** Matches `TextChunk` exactly so no coordinate translation is needed.
4. **Allows gaps.** A file that is 100% the declared default language can return zero spans. The engine fills gaps with the config default.
5. **Provides worked examples** for each tricky case. Few-shot anchoring is the cheapest reproducibility lever.
6. **Refuses to guess.** When unsure, the model emits `language: "unknown"` rather than picking. Unknown spans degrade to the config default and surface in the review report.

## Input contract

The segmenter is called with three inputs:

| Input | Type | Purpose |
|---|---|---|
| `filePath` | string | Hint only — the model uses it to disambiguate (e.g. `.json` vs `.md`). Never authoritative. |
| `declaredProfiles` | string[] | The set of language profiles the project has registered (e.g. `["cs", "en"]`). The model picks from this set plus `"unknown"`. |
| `fileBytes` | string | The full file content as UTF-8 text, with line endings preserved. |

## Output contract

A single JSON object on stdout, no other text:

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
- `startColumn`, `endColumn`: 1-based, inclusive. Use `1` for line start. For an end-of-line span, use the column of the last character on the line.
- `language`: one value from `declaredProfiles` or `"unknown"`. Lowercase.
- `kind`: one of `"prose"`, `"code"`, `"quote"`, `"data"`. See definitions below.
- `pathHint`: optional. For structured formats only. JSON: dotted/bracketed key path (`"inventory.briefs[0].cs.problem"`). Markdown: heading path (`"## Setup > ### Prerequisites"`). Set to `null` when not applicable.
- `note`: optional. Set to `null` unless the model needs to flag something for human review (e.g. `"mixed-language sentence, defaulted to dominant"`).

Spans are ordered by `(startLine, startColumn)` and **must not overlap**.

## Kind definitions (closed vocabulary)

| Kind | Definition | Examples |
|---|---|---|
| `prose` | Natural-language text intended for human reading. Sentences, paragraphs, headings, list items containing sentences. | A blog post body. A README description. A JSON `description` field with a sentence. |
| `code` | Source code, shell commands, configuration syntax, file paths used as commands. Not subject to typography rules. | Fenced code blocks. Inline `code` spans. JSON values that are CLI invocations. |
| `quote` | Quoted text whose language may differ from the surrounding prose. Subject to typography rules of the quoted language, not the surrounding language. | A Czech essay quoting an English sentence. A blockquote in another language. |
| `data` | Machine-readable strings: URLs, email addresses, ISO codes, UUIDs, enum slugs, version numbers, file paths used as identifiers. Skipped entirely by typography rules. | `"https://..."`, `"en-US"`, `"v1.2.3"`, `"user_id_42"`. |

## Language definitions

Use ISO 639-1 lowercase codes: `cs`, `en`, `de`, `sk`, etc. Pick only from `declaredProfiles`. If a span is genuinely ambiguous (too short, no diacritics, no distinctive vocabulary), tag `"unknown"` rather than guessing.

**Detection signals (in priority order):**

1. **Diacritics.** Czech-specific characters (`á č ď é ě í ň ó ř š ť ú ů ý ž`) inside the span → `cs` is very likely. Same for German (`ä ö ü ß`), Slovak (`ľ ĺ ŕ`), etc.
2. **Stop words.** Czech: `je`, `na`, `se`, `že`, `pro`, `do`, `nebo`, `ale`. English: `the`, `and`, `is`, `of`, `for`, `with`, `to`. Use only when diacritics are absent.
3. **Structural context.** A JSON key path containing `cs` strongly hints `cs`; a key path containing `en` strongly hints `en`. Use as a tiebreaker, not a primary signal.
4. **filePath hint.** Lowest priority. Use only for files entirely in one language with no internal structure.

When all four signals agree, confidence is high. When they disagree, return `"unknown"`.

## Edge case rulebook

| Case | Rule |
|---|---|
| Bilingual JSON with parallel `"en": {...}` / `"cs": {...}` blocks | Emit one span per leaf string value. Tag from the enclosing key path (`pathHint` records it). Parallel branches become parallel spans. |
| English code fence inside Czech markdown | The fenced block is one `kind: "code"` span. The `language` field is the surrounding prose language (typography rules will skip it because of the kind). |
| Inline `code` span inside Czech prose | Emit a `kind: "code"` span for the backticked range. The surrounding sentence stays one `prose` span split around it. |
| Czech sentence quoting an English fragment ("`Říká, že "I'll be back".`") | Emit the surrounding sentence as `cs / prose`. Emit the quoted fragment as a separate `en / quote` span if the quotation is long enough to merit typography rules; if it is a single short phrase, leave it inside the `cs` span and add a `note`. |
| Short string with no diacritics and no stop words (`"Save"`, `"OK"`) | Tag `language: "unknown"`. Engine will fall back to config default. |
| URLs, emails, IDs, version numbers, ISO codes | `kind: "data"`. Tag `language: "unknown"` unless context demands otherwise. |
| Front-matter `lang:` field in markdown | Authoritative for the body that follows it, until a code fence or quote span. |
| Empty file or whitespace-only file | Return `{"spans": []}`. |
| File the model cannot parse at all | Return `{"spans": [{"startLine": 1, "startColumn": 1, "endLine": <last line>, "endColumn": <last col>, "language": "unknown", "kind": "prose", "pathHint": null, "note": "segmenter could not classify; defaulted whole file to unknown"}]}`. The engine will degrade this file to single-profile mode and warn. |

## Few-shot examples

These examples are part of the prompt — they ship to the model on every call. Adding or removing examples is a prompt-version bump.

### Example 1 — bilingual JSON

**filePath:** `workshop-content/agenda.json`
**declaredProfiles:** `["cs", "en"]`
**fileBytes:**

```json
{
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

**Expected output:**

```json
{
  "spans": [
    { "startLine": 4, "startColumn": 17, "endLine": 4, "endColumn": 28, "language": "en", "kind": "prose", "pathHint": "meta.en.title", "note": null },
    { "startLine": 5, "startColumn": 20, "endLine": 5, "endColumn": 70, "language": "en", "kind": "prose", "pathHint": "meta.en.subtitle", "note": null },
    { "startLine": 8, "startColumn": 17, "endLine": 8, "endColumn": 28, "language": "cs", "kind": "prose", "pathHint": "meta.cs.title", "note": "no diacritics; tagged from key path" },
    { "startLine": 9, "startColumn": 20, "endLine": 9, "endColumn": 67, "language": "cs", "kind": "prose", "pathHint": "meta.cs.subtitle", "note": null }
  ]
}
```

Notes for the model:
- Each leaf string value gets its own span. JSON keys are not spans.
- `meta.cs.title` is the literal string `"Harness Lab"` — no diacritics, no stop words. Key path tiebreaker decides `cs`. Note records the reasoning so a reviewer can audit.
- Column ranges cover the string content, **not** the surrounding quotes.

### Example 2 — English-only operational doc

**filePath:** `workshop-skill/SKILL-facilitator.md`
**declaredProfiles:** `["cs", "en"]`
**fileBytes:**

```markdown
# Facilitator skill

Facilitator-control commands are operational rather than room-facing delivery:
- prefer the user's current language unless the facilitator explicitly asks for another reviewed locale
- if the requested locale has no reviewed variant, fall back to English and say so explicitly

## Commands

### `workshop facilitator login`

Authenticate as a facilitator through the `harness` CLI privileged path.
```

**Expected output:**

```json
{
  "spans": [
    { "startLine": 1, "startColumn": 1, "endLine": 11, "endColumn": 65, "language": "en", "kind": "prose", "pathHint": null, "note": "entire file is English operational doc" }
  ]
}
```

Notes:
- One span covers the whole file. The inline `` `harness` `` and `` `workshop facilitator login` `` backtick spans are short enough to fold into the prose span — they won't trigger typography rules anyway because Czech rules don't apply to English.
- If the file had been long enough to warrant per-section spans, the segmenter would still tag everything `en`. Granularity is allowed but not required.

### Example 3 — Czech prose with embedded English code block

**filePath:** `content/talks/codex-demo-script.md`
**declaredProfiles:** `["cs", "en"]`
**fileBytes:**

````markdown
# Codex Demo Script

## Cíl

Jedna příběhová ukázka, ne seznam funkcí. Publikum má během 15 minut pochopit, jak vypadá dobrý workflow s agentem.

## Setup

Před demem spusťte:

```bash
codex auth login
codex workspace init ./demo
```

Poté otevřete repo a začněte s první otázkou.
````

**Expected output:**

```json
{
  "spans": [
    { "startLine": 1, "startColumn": 1, "endLine": 9, "endColumn": 19, "language": "cs", "kind": "prose", "pathHint": null, "note": "title 'Codex Demo Script' is English brand name; folds into surrounding cs prose" },
    { "startLine": 10, "startColumn": 1, "endLine": 13, "endColumn": 3, "language": "en", "kind": "code", "pathHint": null, "note": "fenced bash block" },
    { "startLine": 14, "startColumn": 1, "endLine": 15, "endColumn": 36, "language": "cs", "kind": "prose", "pathHint": null, "note": null }
  ]
}
```

Notes:
- The `# Codex Demo Script` heading is English-shaped but acts as a Czech brand name — folds into the surrounding Czech prose with a `note` recording the call. Splitting it out would be over-precise.
- The fenced code block is its own span with `kind: "code"`. Typography rules will skip it entirely.
- Trailing Czech paragraph after the code block is its own span — code blocks split surrounding prose.

## Prompt template

This is the literal text the `LlmSegmenter` sends to the model. `{{filePath}}`, `{{declaredProfiles}}`, and `{{fileBytes}}` are replaced at call time. Do not modify without bumping `promptVersion`.

```
You are a content segmenter for a typography review tool. Your job is to divide a file into ordered, non-overlapping spans, each tagged with a natural language and a content kind. You do not judge typography. You do not rewrite content. You only segment.

## Output rules

Return a single JSON object and nothing else. No prose preamble. No trailing commentary. No code fence around the JSON. The first character of your response must be `{` and the last must be `}`.

The object has exactly one key, `spans`, whose value is an array of span objects.

A span object has these fields:
- `startLine` (1-based int, inclusive)
- `startColumn` (1-based int, inclusive)
- `endLine` (1-based int, inclusive)
- `endColumn` (1-based int, inclusive)
- `language` (one of: {{declaredProfiles}}, or "unknown")
- `kind` (one of: "prose", "code", "quote", "data")
- `pathHint` (string or null)
- `note` (string or null)

Spans must be ordered by (startLine, startColumn) and must not overlap.

## Kind definitions

- "prose": natural-language text for human reading.
- "code": source code, shell commands, config syntax. Skipped by typography rules.
- "quote": quoted text whose language differs from the surrounding prose.
- "data": URLs, emails, IDs, ISO codes, UUIDs, version numbers, enum slugs.

## Language detection priority

1. Czech diacritics (á č ď é ě í ň ó ř š ť ú ů ý ž) → cs
2. Other language diacritics → that language
3. Stop words (cs: je, na, se, že, pro / en: the, and, is, of, for) → infer
4. JSON key path containing a language code (e.g. "meta.en.title") → use as tiebreaker
5. If still ambiguous → "unknown"

## Edge cases

- Bilingual JSON with parallel "en"/"cs" blocks: emit one span per leaf string value. Use the key path as a tiebreaker.
- Empty or whitespace-only file: return {"spans": []}.
- File you cannot classify at all: return one span covering the whole file with language "unknown" and a note explaining why.
- Short strings with no diacritics or stop words: tag "unknown".
- URLs, IDs, version numbers: tag kind "data", language "unknown".
- Code fences: tag kind "code".

## Inputs

filePath: {{filePath}}
declaredProfiles: {{declaredProfiles}}

fileBytes:
---
{{fileBytes}}
---

Return the segmentation now.
```

## Open questions for Phase 0 dry-run

Things to watch for when hand-checking the dry-run results:

1. **Does the model respect "JSON only, no preamble"?** If it adds `Here is the segmentation:` before the JSON, the contract is too soft.
2. **Are line/column numbers off-by-one?** If they are, decide whether to fix in the prompt or in the parser.
3. **Does the model invent `language` values not in `declaredProfiles`?** If it does, the closed vocabulary needs sterner wording.
4. **Does it correctly use `"unknown"` for ambiguous short strings?** If it guesses instead, add a stronger anti-guessing example.
5. **How does it handle the `# Codex Demo Script` style English-named heading inside Czech prose?** The example says "fold in with note". If the model splits it out as a separate `en` span, that may be fine — adjust the example to whichever behaviour proves more reliable.
6. **How robust is JSON key path detection at deep nesting?** `inventory.briefs[0].en.userStories[2]` is deep. If pathHints come back wrong or empty, the engine still works (kind+language are what matter), but reviewers lose context.

## Hand-check memo (Phase 0 results)

Dry-run executed 2026-04-12 against three real files. The "model under test" was a Sonnet-class sub-agent following the v1 prompt template verbatim. A real Haiku-class production segmenter will need re-validation before Phase 3, but Sonnet output is a reliable lower bound for prompt clarity: if a strong instruction-follower struggles, a smaller model will struggle more.

### Results table

| File | Spans returned | Hand-check verdict | Critical issues |
|---|---:|---|---|
| `harness-lab/workshop-content/agenda.json` (lines 1-74) | 46 | **Pass** | Over-segments JSON structural tokens (braces, key openers) as `code` — harmless but noisy |
| `harness-lab/workshop-skill/SKILL-facilitator.md` | 60 | **Pass** | H3 headings containing CLI commands tagged `code` instead of `prose`. Heavily over-segmented (60 spans for a one-language doc) |
| `harness-lab/content/talks/codex-demo-script.md` | 34 | **Pass with caveat** | **Span overlap bug** — inline backtick code spans were extracted from inside multi-line prose spans, producing overlapping ranges that violate the contract |

### What worked (key validation wins)

1. **Bilingual JSON segmentation is reliable.** `meta.en.title` → `en` and `meta.cs.title` → `cs` even when both string values are identical (`"Harness Lab"`). The key-path tiebreaker rule (priority 4) does the work and the model uses it correctly.
2. **Czech diacritic detection is reliable.** Every Czech principle, problem statement, and user story in the agenda slice was correctly tagged `cs` based on diacritics alone. No false negatives.
3. **English-only files produce zero `cs` spans.** `SKILL-facilitator.md` returned 60 spans, every single one tagged `en` or `unknown`. The Phase 8 acceptance criterion ("zero Czech findings on `SKILL-facilitator.md`") is satisfied by this segmentation as-is.
4. **Code-switching segmentation works.** `codex-demo-script.md` correctly identified Czech sections (lines 3, 5, 9, 54-65, 67-83) and English sections (lines 7, 11-26, 28-35, 37-42, 44-48, 50-52). The hard case on line 72 (a bold English sentence inside an otherwise Czech bullet list) was correctly split out.
5. **Heuristic recovery on loanwords.** The model correctly handled `agentem`, `harnessu`, `Fallbacky` — Czech morphology applied to English roots — by tagging the surrounding Czech context.
6. **Output format compliance.** All three responses returned strict JSON with no preamble or trailing prose. The contract holds.
7. **`note` field utility.** Every span carried a justification. This will make `--review-cache` diffs reviewable without re-reading source.

### Critical issues (must fix before Phase 3)

**1. Span overlap on inline code extraction (HARD BUG).**

In file 3, the model emitted overlapping spans like:
- Span A: `lines 21-26, en, prose` (a multi-line bullet list)
- Span B: `line 25 col 14-37, unknown, code` (an inline backtick fragment inside that list)

The prompt explicitly requires non-overlapping spans, but the model violated this whenever it tried to extract inline code from inside a multi-line prose region. The same bug appeared on line 72.

**Fix:** The prompt must include a worked example showing the correct three-span split for prose-with-inline-code: emit `[prose-before-the-code]`, `[code]`, `[prose-after-the-code]` — never nest. For multi-line prose containing an inline code fragment, the prose span ends one column before the backtick and a new prose span begins one column after. This is verbose but unambiguous.

Alternative: relax non-overlap to allow nested spans with explicit parent/child relationships. Rejected — significantly complicates the engine for marginal benefit.

**2. JSON structural-token over-segmentation.**

In file 1, the model emitted spans for JSON braces, `schemaVersion: 3`, `blueprintId: "harness-lab-core-day"`, and the `meta.en` / `meta.cs` block opener keys. These are not content. They are noise.

**Fix:** Add to the JSON edge case rule: "Do not emit spans for JSON braces, brackets, commas, or key tokens. Only emit spans for leaf string values whose content is meant to be read by a human. Skip schema scaffolding entirely."

**3. Heading-as-code mis-tagging.**

In file 2, every `### \`workshop facilitator login\``-style heading was tagged `kind: "code"` because the heading body is a backticked CLI command. This is wrong: the heading is prose, the backticks are inline code inside it. Tagging the whole line `code` means typography rules skip headings entirely — fine for an English file (no rules would fire anyway), but wrong on principle and wrong for a bilingual file with Czech headings containing inline commands.

**Fix:** Add to kind definitions: "A heading or sentence containing inline backticks remains `prose`. Inline backticks inside prose do not promote the surrounding heading or sentence to `kind: code`. Backticks may be extracted as their own `code` spans following the prose-with-inline-code split rule above, or left inside the surrounding prose span if their language is uncertain."

### Soft issues (nice-to-fix, not blocking)

**4. Column-numbering convention.**

The model in file 1 explicitly flagged this as ambiguous: it counted columns from 1 = first character of the line including leading whitespace. That is the convention I want, but the prompt does not say so.

**Fix:** Add to output rules: "Column 1 is the first character of the line, including any leading whitespace. The line `    "title": "Harness Lab"` has the literal `H` of `Harness` at column 16."

**5. Granularity guidance.**

File 2 was over-segmented into 60 spans for a uniformly English document. The prompt example shows whole-file spans for English-only docs but the model defaulted to per-paragraph anyway.

**Fix:** Add a granularity rule: "If a contiguous region of the file is uniformly one language and one kind, emit one span covering the entire region. Do not split for the sake of structural neatness. A 200-line English document with no language transitions should produce one span, not sixty."

**6. Whether `language` should be omitted on `kind: "code"` and `kind: "data"` spans.**

The model variously tagged code spans `unknown`, `en`, or `cs` depending on context. Since typography rules will skip code/data spans regardless, the `language` value on those spans is meaningless.

**Fix:** Add to kind definitions: "For `kind: "code"` and `kind: "data"`, set `language: "unknown"` always. The language value is ignored by the engine for these kinds."

### What does not need fixing

- **Run-to-run determinism.** All three META reports flagged plausible re-run variation (column off-by-one, granularity choices, where to draw section boundaries). This is expected LLM drift and is exactly what the lockfile cache exists to handle. Once a segmentation is committed, it does not regenerate. Drift only manifests at refresh time, where it surfaces as a reviewable diff.
- **Closed vocabulary discipline.** No model invented a new `language` or `kind` value across the three runs. The vocabulary held.
- **Output format strictness.** All three runs returned the JSON-then-stop format. No preambles, no trailing prose, no markdown fences around the JSON.

### Go/No-Go decision

**GO** — proceed to Phase 1 (type and engine foundation) after applying the three critical fixes to the prompt template. The prompt fixes are mechanical (text edits, no new examples needed beyond one prose-with-inline-code worked example), and the architectural design is validated:

- LLM segmentation produces correct language tags on the bilingual case (✓ acceptance criterion 4).
- LLM segmentation produces correct language tags on the English-only case (✓ acceptance criterion 3).
- LLM segmentation handles code-switching correctly except for the overlap bug (✓ once fixed).
- The lockfile-cache contract holds: each run is non-deterministic in detail but stable in the things that matter (language tags, kind tags, line ranges within ±1 column).

### Pending the Phase 3 Haiku validation

Phase 3 must re-validate the prompt with the actual production model (Haiku-class). The Sonnet dry-run is a clarity check, not a production proof. If Haiku produces meaningfully worse segmentation than Sonnet on any of these three files, Phase 3 must:

1. Either tighten the prompt further with more worked examples,
2. Or escalate to a larger model for the segmenter and accept the cost,
3. Or hand the failing case off to the structural fallback backend.

The plan accommodates all three outcomes — the segmenter is pluggable. The Go decision here is "the architecture is sound and the v1 prompt is close enough to commit to the design", not "v1 is the final prompt".

### Prompt v2 changes (queued for Phase 3)

When implementing the LLM segmenter in Phase 3, bump `promptVersion` to 2 and apply:

1. Worked example for prose-with-inline-code three-span split (replace the inline-`harness` example in the Edge case rulebook with a fully worked one).
2. JSON structural-token skip rule.
3. Heading-as-code anti-rule.
4. Column-1-is-first-character clarification.
5. Granularity rule for monolingual regions.
6. `language: "unknown"` always-on-code-and-data rule.

Keep v1 in the file as historical record. v2 lives in `segmentation-prompt-v2.md`. The lockfile records `promptVersion` so cache entries can be selectively invalidated.
