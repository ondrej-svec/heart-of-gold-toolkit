# Language Profiles — How to Add One

A language profile is a typed TypeScript module that exports a `LanguageProfile` containing a list of `Rule` objects. Adding a new language is adding a new file under `rules/`, registering it in `rules/index.ts`, and locking behaviour with a fixture pair per rule in `scripts/self-test.ts`.

No engine change is required. The engine is language-agnostic and loads profiles via the registry.

## Files to touch

To add a `slovak` profile (for example):

1. Create `rules/slovak.ts` — exports `slovakProfile: LanguageProfile`
2. Edit `rules/index.ts` — import the profile, add to `PROFILES` map under the `sk` key
3. Edit `scripts/self-test.ts` — add a `TESTS.sk` array with one `{ ruleId, bad, good }` per rule
4. Run `bun scripts/self-test.ts` — every rule must pass
5. Commit

That's it. Nothing else in the skill, the engine, or the CLI needs to change.

## Rule shape

Rules are pure data plus a `check` function:

```typescript
import type { Finding, LanguageProfile, Rule, TextChunk } from "./types.ts";
import { locateInChunk } from "./types.ts";

const SK_R1_UPPERCASE_AFTER_PUNCT: Rule = {
  id: "sk-R1-uppercase-after-punct",
  label: "Capitalise after sentence-ending punctuation",
  severity: "warning",
  description:
    "Slovak capitalises the first letter after `.`, `!`, `?` when the next character starts a new sentence. Rule fires on lowercase letters immediately following sentence punctuation and whitespace.",
  check(chunk: TextChunk): Finding[] {
    const findings: Finding[] = [];
    const re = /[.!?]\s+([a-z])/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(chunk.text)) !== null) {
      const lcIndex = match.index + match[0].length - 1;
      const { line, column } = locateInChunk(chunk, lcIndex);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: SK_R1_UPPERCASE_AFTER_PUNCT.id,
        severity: SK_R1_UPPERCASE_AFTER_PUNCT.severity,
        filePath: chunk.filePath,
        line,
        column,
        snippet: chunk.text.slice(lcIndex, lcIndex + 3),
        message: `Capitalise "${match[1]}" after sentence punctuation.`,
      });
    }
    return findings;
  },
};

export const slovakProfile: LanguageProfile = {
  language: "sk",
  name: "Slovak",
  rules: [SK_R1_UPPERCASE_AFTER_PUNCT],
};

export default slovakProfile;
```

## Rule conventions

- **Rule IDs** follow `<lang>-R<number>-<kebab-topic>`. Examples: `cs-R1-nbsp-prep`, `cs-R7-sentence-case-heading`, `sk-R3-long-vowels`.
- **Severity** is `error` | `warning` | `info`.
  - `error` — blocks the Layer 1 gate. Use when the rule has near-zero false positive rate and represents a clear violation.
  - `warning` — surfaces but does not block. Use when the rule is high-signal but occasionally false-positives (e.g. Czech R1b for `a`/`i` conjunctions).
  - `info` — surfaced only in verbose mode. Use for suggestions.
- **Description** is a 1-3 sentence paragraph explaining the rule and its source. A contributor reading it should understand why the rule exists without external research.
- **Check function** must:
  - Respect `chunk.ignoreLines` (skip findings on ignored lines)
  - Use `locateInChunk(chunk, offset)` to compute absolute file positions
  - Return `Finding[]` (empty array if nothing fires)
  - Be deterministic (same input always produces same findings)

## Text extraction reminder

Rules operate on `TextChunk` objects, not raw files. The engine pre-extracts reviewable text per file type:

- Markdown: code fences and inline code stripped, link URLs blanked
- JSON: string values extracted, keys skipped
- TypeScript/JavaScript: string and template literals extracted

Your rule does not need to worry about source file format. If the chunk contains the text you want to check, the rule fires. If it doesn't, extraction is the issue, not the rule.

## Self-test fixtures

Every rule requires a fixture pair in `scripts/self-test.ts`:

```typescript
{
  ruleId: "sk-R1-uppercase-after-punct",
  bad: "Toto je veta. toto je druhá veta.",
  good: "Toto je veta. Toto je druhá veta.",
}
```

The test asserts:
- The rule fires at least once on `bad`
- The rule does not fire on `good`

If a new rule has multiple failure modes, add multiple fixture pairs — one per mode.

## Rule sources

Every rule should be sourced from a recognised authority so that future contributors understand why the rule exists and can update it when the source changes. Cite in the rule's description or in a comment above.

Recognised authorities per language:

- **Czech**: ÚJČ Internetová jazyková příručka, Mozilla Czech Localization Style Guide, Microsoft Czech Localization Style Guide, Naše řeč
- **English**: Google Developer Documentation Style Guide, Microsoft Writing Style Guide, Chicago Manual of Style, AP Stylebook
- **Slovak**: Jazykovedný ústav Ľ. Štúra SAV (JÚĽŠ), pravidlá slovenského pravopisu
- **German**: Duden, Deutsches Rechtschreibwörterbuch, DIN standards where relevant

If no authoritative source exists for a rule, document the decision rationale in the rule's description.

## When NOT to add a rule here

Do not add rules to a language profile for:

- Reject-list items (`v rámci`, `na denní bázi` etc.) — those live in the repo-local reject list. The profile holds typography and mechanical rules only.
- Voice, tone, or register judgment — those are Layer 2 work, not Layer 1.
- Clarity / ambiguity detection — same, Layer 2.
- Project-specific vocabulary preferences — those belong in the repo-local style guide.

The Layer 1 profile is for rules that are:

1. Deterministic (regex-level)
2. Language-wide (apply to all projects in that language)
3. Mechanical (no judgment required)

Everything else is Layer 2, which lives in `SKILL.md` and consumes repo-local rule sources at invocation time.

## Promoting repo-local rules

If a rule pattern proves itself in one repo's reject list over time and generalises across projects, consider promoting it to the language profile. Discuss in an issue first — promotion is one-way and adds to the long-term maintenance surface of the profile.
