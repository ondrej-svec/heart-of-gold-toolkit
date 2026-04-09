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

The skill runs Load → Lint (L1) → Judge (L2) → Report → Handoff, in that order, never out of order. No step is skippable. If Lint fails to execute (engine missing, config invalid), the skill halts and reports the failure — it does not attempt Layer 2 on partial data.

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

1. **New language profile** — add `rules/<lang>.ts` (see `language-profiles.md`), register in `rules/index.ts`, add fixtures to self-test. No change to the engine.
2. **New Layer 1 rule within an existing profile** — add a `Rule` object, append to the profile's `rules` array, add a self-test fixture pair. No change to the engine.
3. **New Layer 2 pass** — document it in this file, add it to `SKILL.md` Phase 2 with order and scope, give it a citation format. Update validation list.
4. **New `.copy-editor.yaml` field** — document it in `config-schema.md`, version the schema, ensure the engine and skill handle its absence gracefully.

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
| False positive in Layer 1 | User reports | Add ignore marker in the file, or refine the rule with a self-test fixture |

## Maintenance

- The verification boundary clause is the load-bearing invariant. Any change to it requires a plan update.
- Passes are ordered; the order is documented here. Reordering is a behavioural change and requires a test.
- Self-tests are the regression safety net. New rules must include fixtures before landing.
- `SKILL.md` and this file are kept in sync. Update this file first; then align `SKILL.md`.
