# `.copy-editor.yaml` — Configuration Schema

The per-repo configuration file that composes the Heart of Gold baked-in language profile with repo-local style guide, reject list, examples, and voice doctrine.

A consuming repo creates one `.copy-editor.yaml` at its root. The file is YAML, parsed by `js-yaml`. Paths are resolved relative to the directory the config file lives in.

## Minimal example (Czech workshop)

```yaml
extends:
  - czech
language: cs
rules:
  style_guide: ./content/style-guide.md
  reject_list: ./content/czech-reject-list.md
  examples: ./content/style-examples.md
paths:
  include:
    - content/**/*.md
    - workshop-skill/**/*.md
    - materials/**/*.md
    - dashboard/lib/workshop-blueprint-agenda.json
    - dashboard/lib/workshop-blueprint-localized-content.ts
  exclude:
    - "**/locales/en/**"
    - "**/*.test.*"
```

## Full example with surface profiles, voice doctrine, and output

```yaml
# Inherit baked-in language profiles from HoG by language code.
# Multiple entries allow composing (future: cs + slovak shared typography).
extends:
  - czech

# Primary language for this config. Overrideable by --lang CLI flag.
language: cs

# Pointers to repo-local rule sources. All optional but expected.
rules:
  style_guide: ./content/style-guide.md
  reject_list: ./content/czech-reject-list.md
  examples: ./content/style-examples.md
  approved_terms: ./content/style-examples.md#approved-english-terms

# Voice doctrine for Layer 2 injection. Short, directive, opinionated.
# Written in the consuming repo's working language (Czech for this example).
voice_doctrine: |
  Piš jako zkušený peer. Klidně, věcně, akčně.
  Žádný hype, žádný korporát, žádná škola.
  Krátké věty. Slovesa před podstatná jména.

# File scope for the audit.
paths:
  include:
    - dashboard/lib/workshop-blueprint-agenda.json
    - dashboard/lib/workshop-blueprint-localized-content.ts
    - content/**/*.md
    - workshop-skill/**/*.md
    - materials/**/*.md
  exclude:
    - "**/locales/en/**"
    - "**/*.test.*"
    - "**/node_modules/**"

  # Optional: classify paths into surface profiles so Layer 2's
  # clarity pass knows where to be strict and where to be lenient.
  # Values: participant | presenter | hybrid
  # Default (when no pattern matches): hybrid
  surface_profile:
    "content/project-briefs/**": participant
    "content/challenge-cards/**": participant
    "workshop-skill/**": participant
    "materials/**": participant
    "content/talks/**": presenter
    "content/facilitation/**": presenter
    "dashboard/lib/workshop-blueprint-agenda.json": hybrid
    "dashboard/lib/workshop-blueprint-localized-content.ts": hybrid

# Output conventions.
output:
  review_notes_dir: ./docs/reviews/workshop-content/
  structured_findings_dir: ./.copy-editor/findings/

# Ignore marker used to suppress findings on a line or short block.
# The engine looks for this string inside a comment on or just before
# the flagged line.
ignore_marker: "copy-editor: ignore"
```

## Field reference

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `extends` | `string[]` | No | `[]` | Language profile names to inherit (e.g. `czech`, `english`). Currently used for discoverability only; the engine resolves the profile from `language`. |
| `language` | `string` | Yes | — | ISO code of the primary language profile (`cs`, `en`). Overrideable with `--lang` CLI flag. |
| `rules.style_guide` | `string` | No | — | Path to the repo-local style guide markdown. Injected into Layer 2 context pack. |
| `rules.reject_list` | `string` | No | — | Path to the repo-local reject list markdown. Used by Pass A. |
| `rules.examples` | `string` | No | — | Path to repo-local before/after examples. Injected into Layer 2 context pack. |
| `rules.approved_terms` | `string` | No | — | Path (optionally with `#anchor`) to the approved English terms list. Informs Pass A to not flag those terms. |
| `voice_doctrine` | `string` | No | — | Short directive voice guidance. Injected into Pass D. |
| `paths.include` | `string[]` | Yes | — | Glob patterns relative to the config dir. At least one required. |
| `paths.exclude` | `string[]` | No | `[]` | Glob patterns to exclude from the scope. |
| `paths.surface_profile` | `Record<string, "participant" \| "presenter" \| "hybrid">` | No | `{}` | Per-path surface profile classification. Keys are glob patterns, values are profiles. Paths not matching any key default to `hybrid`. |
| `output.review_notes_dir` | `string` | No | — | Where Phase 3 writes the review note draft. If unset, the draft goes to stdout. |
| `output.structured_findings_dir` | `string` | No | — | Where Phase 3 writes the structured JSON. If unset, JSON goes to stdout. |
| `ignore_marker` | `string` | No | `"copy-editor: ignore"` | String the engine searches for to suppress findings on the same line or the line immediately below. |

## Glob patterns

The engine uses a tiny portable glob implementation supporting:

- `**` — any depth of directories
- `*` — any sequence within a single path segment
- `?` — a single character
- literal segments

This is enough for typical `.copy-editor.yaml` scopes. If you need richer patterns (negation, character classes), file an issue — we'll reach for a library before reinventing.

## Ignore markers

Sometimes a rule legitimately fires on text that should not be fixed — for example a quoted English example inside Czech prose, or a code identifier in a markdown heading. Use the ignore marker to suppress:

```markdown
<!-- copy-editor: ignore -->
# Klíčová linka: Ownership & Handoff

This heading uses a foreign-looking colon label on purpose.
```

The marker on a line suppresses findings on that line and the one immediately below. For long blocks, add a marker on each line that should be skipped, or refine the rule with a fixture.

## Schema versioning

The schema is versioned implicitly through this document. Breaking changes (rename, removal, semantic change) require a version bump and a migration note. Additive changes (new optional field) do not.

Current version: **v0.1** (initial).

## Validation

The engine rejects configs that:

- Are not valid YAML
- Lack `language`
- Lack `paths.include`
- Reference a language profile unknown to the registry

It does NOT reject configs that:

- Point at missing rule files (warns and continues)
- Have empty `extends` (future-proofing)
- Have unknown top-level fields (forward-compatibility)
