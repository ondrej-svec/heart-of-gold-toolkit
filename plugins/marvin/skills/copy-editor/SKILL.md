---
name: copy-editor
description: >
  Two-layer copy editor — deterministic typography audit (Layer 1) plus
  judgment passes (Layer 2) for nominalization, reject-list hits,
  clarity on participant-facing content, voice, and spoken readability.
  Czech ships as a full language profile; English is a stub. Loads a
  repo-local .copy-editor.yaml to compose baked-in rules with
  repo-local style guide, reject list, and voice doctrine.
  Triggers: copy edit, editorial pass, czech review, czech copy review,
  audit copy, check typography, review prose, tighten copy.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Copy Editor

I review copy. Two layers: the mechanical one that a script closes, and the judgment one that I surface but never close. A human always owns the final seal on voice, clarity, and readability.

This skill is agent-agnostic: any agent with Bash and Read can run it. The script is the portable contract.

## Boundaries

**This skill MAY:** read files under the configured scope, run the copy-audit script, parse its JSON output, read the repo-local style guide and reject list, propose rewrites with rationale, draft a review note, report findings.

**This skill MAY NOT:** edit source files directly, mark Layer 2 judgment work as "approved", skip the deterministic Layer 1 pass, invent rules not present in the loaded language profile or repo-local rule files, close any gate the verification boundary assigns to a human.

## Verification Boundary

**Layer 1 (deterministic) is the only layer this skill may auto-close. Layer 2 (judgment) always produces suggestions, never verdicts. This skill will not mark a file or scope as "copy-editor approved" at Layer 2. That seal belongs to a human reviewer, whose signoff is recorded in the review note this skill drafts.**

This clause is non-negotiable. If a repo's doctrine relaxes it, stop and ask before proceeding.

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|--------------|----------|
| "Skip Layer 1, it's just formatting" | Layer 1 is the mechanical gate that lets Layer 2 focus on judgment. Skipping produces noisy Layer 2 reviews where the reviewer keeps finding typography issues instead of voice ones. | Review fatigue; human reviewer spends their attention on the wrong layer. |
| "Mark the scope approved at Layer 2 because nothing looks wrong" | Layer 2 is judgment. The skill does not have the cultural or situational context a human reviewer has. | False confidence; Czech voice drift that the skill cannot detect. |
| "Apply clarity rules to presenter scenes too" | Presenter scenes are outline hints a facilitator explains live. Applying participant-strict rules to them produces noise and misses the point. | Lots of false positives on valid outline-style content; suggestions get ignored. |
| "Invent rules the profile does not contain" | The profile is the contract. Inventing rules breaks reproducibility across runs. | Suggestions vary run to run; the skill becomes unreliable. |

## Phase 0: Load

**Entry:** User invoked the skill, with or without a path argument.

1. **Locate `.copy-editor.yaml`** — check repo root. If absent, stop and ask the user to create one (point them at `knowledge/config-schema.md`).
2. **Parse the config** — extract `language`, `extends`, `paths.include`, `paths.exclude`, `rules.*` pointers, `voice_doctrine`, `ignore_marker`, `output.*`, and the new `paths.surface_profile` map (if present).
3. **Read repo-local rule sources** — `rules.style_guide`, `rules.reject_list`, `rules.examples`, `rules.approved_terms`. If a pointer is missing, log it and continue — the skill degrades gracefully.
4. **Identify the scope** — if the user specified files, use those. Otherwise use `paths.include` from the config.
5. **Classify each path by surface profile** — `participant` (strict clarity bar), `presenter` (outline tone allowed), or `hybrid` (default). Use `paths.surface_profile` matching from the config; fall back to `hybrid` if unspecified.

**Exit:** Scope, config, rule sources, and per-path surface profile resolved.

## Phase 1: Lint (Layer 1, deterministic)

**Entry:** Phase 0 complete.

Invoke the engine:

```bash
bun plugins/marvin/skills/copy-editor/scripts/copy-audit.ts \
  --config <path-to-.copy-editor.yaml> \
  --json
```

From a repo that already has the skill installed via HoG installer, the path resolves relative to the installed skill location; use the host agent's standard skill-script invocation if available.

Parse the JSON output. It conforms to the schema in `knowledge/output-contract.md`:

```json
{
  "totalFiles": 12,
  "totalFindings": 47,
  "errorFindings": 31,
  "warningFindings": 16,
  "infoFindings": 0,
  "byRule": { "cs-R1-nbsp-prep": 28, "cs-R1b-nbsp-conjunction": 12, ... },
  "findings": [ { "ruleId": "cs-R1-nbsp-prep", "severity": "error", "filePath": "...", "line": 5, "column": 52, "snippet": "s A", "message": "..." }, ... ]
}
```

Set `gate_1 = errorFindings === 0 ? "pass" : "fail"`.

**Never claim Layer 1 passed without actually running the script.** If the script is not available, report the inability and stop — do not re-implement rules in the report.

**Exit:** Layer 1 findings collected, gate_1 set.

## Phase 2: Judge (Layer 2, non-blocking)

**Entry:** Layer 1 complete. Iterate file-by-file over the scope.

For each file, build a **context pack**:

- The file's text content
- The style guide (repo-local, from `rules.style_guide`)
- The reject list (repo-local, from `rules.reject_list`)
- The voice doctrine (from config `voice_doctrine`)
- The surface profile (`participant` | `presenter` | `hybrid`)
- Layer 1 findings for this file
- The approved term list (for code-switching awareness)

Then run the judgment passes **in this order**, each producing suggestions with rationale:

### Pass A — Reject-list hit detection

Grep the file text for every entry in the reject list. For each hit:
- Cite the reject-list entry and its Why line
- Propose a rewrite using the preferred alternative
- Keep the suggestion short and concrete

### Pass B — Nominal-style detection

Find sentences dominated by `-ní`/`-ost`/`-ace` nouns, especially chains of 3+ in genitive (`správa konfigurace nastavení`). For each:
- Propose a verbal restructure around an active verb
- Reference the Slovesné vs jmenné vyjadřování section of the style guide

### Pass C — Clarity / ambiguity pass (participant-facing strict)

**Applied strictly when surface_profile is `participant`. Applied loosely or skipped when `presenter`. Applied with judgment when `hybrid`.**

Check for:
- **Directional nouns without upřesnění**: `další kroky`, `první validace`, `příprava prostředí` where the referent is unclear. Ask: *if the reader must mentally answer "čeho?" or "kterého?", the sentence failed.*
- **Imperatives without object**: `validujte.`, `zkontrolujte.`, `zmapujte.` standing alone with no specified target.
- **Vague quantifiers**: `několik`, `pár`, `různé`, `nějaký` — propose enumeration or a concrete number.
- **Pronominal chains across 2+ sentences**: `to`, `tohle`, `tímto způsobem` with antecedent far away.
- **Abstract verbs without anchoring**: `zvažte`, `promyslete`, `prozkoumejte` with no specified what.

For each hit, propose a concrete rewrite with the missing target or anchor filled in. Cite `content/style-guide.md` → "Jasnost na participant surfaces" and the relevant reject-list entry.

**Why the strict participant rule exists:** A participant reads on mobile without a facilitator to explain. Grammatically clean sentences like *"Until launch you need to map next steps and first validation"* still fail the participant because they cannot answer "first validation of what?". A presenter scene can get away with outline phrasing because the facilitator adds context live.

### Pass D — Voice / register check

Against the injected `voice_doctrine`. Flag sentences that read as corporate, academic, marketing, or generic AI polish when the doctrine asks for peer tone.

### Pass E — Rhythm / spoken readability read

- Flag paragraphs of metronomic sentence length (no variance)
- Flag 4+ level nested subordinate clauses
- Flag over-reliance on `být + passive participle` or stacked `se` reflexives
- Note paragraphs that are hard to read aloud

**Exit:** Layer 2 suggestions assembled per file, each with rationale and source reference. `gate_2` is never set — Layer 2 has no verdict.

## Phase 3: Report

**Entry:** Both layers complete.

Emit **two artifacts**:

### 3a. Structured findings JSON

Conforms to `knowledge/output-contract.md`. Includes Layer 1 findings and Layer 2 suggestions. Agents consume this directly.

### 3b. Review note markdown draft

Drop a skeleton review note into `output.review_notes_dir` (or stdout if that isn't configured). Format:

```markdown
# Copy-Editor Review — <date> — <scope>

**Layer 1 (typography audit):** <pass | N findings>
**Layer 2 suggestions:** <count>
**Human reviewer signoff:** _pending_

## Layer 1 findings

<grouped by rule, with file:line references>

## Layer 2 suggestions

### Reject-list hits
<list with proposed rewrites>

### Nominal-style rewrites
<list>

### Clarity / ambiguity (participant-facing)
<list>

### Voice / register
<list>

### Rhythm / spoken readability
<list>

## Next safe move

<either "fix Layer 1 errors first" or "review Layer 2 suggestions and apply/skip with rationale">
```

**Never fill in the "human reviewer signoff" line. Leave it `_pending_`.**

## Phase 4: Handoff

**Entry:** Report emitted.

Present to the caller:
- `gate_1` status
- Count of Layer 2 suggestions by category
- The next safe move

Then wait. The skill does not apply fixes on its own. If the user wants fixes applied, they invoke `/marvin:work` or ask directly.

## Validate

Before reporting, verify:

- [ ] Layer 1 actually ran (script output JSON has `totalFiles > 0`)
- [ ] Layer 2 passes ran in the documented order
- [ ] Every Layer 2 suggestion has a rationale citing its source rule or guide section
- [ ] The review note leaves the human signoff line `_pending_`
- [ ] `gate_2` is not set anywhere in the output
- [ ] No suggestion contradicts the verification boundary clause

## What Makes This Heart of Gold

- **Two layers, clear contracts:** Deterministic gate closeable by the script, judgment gate always human-closed. No blurring.
- **Composable rules:** Baked-in language profile + repo-local content rules, joined by one config file.
- **Agent-agnostic:** Shell-invocable script is the portable contract. Any agent with Bash can run it.
- **Respects human judgment:** The skill surfaces, the human decides. The boundary is written into the skill and cannot be weakened by a future revision without breaking loudly.

## Knowledge References

- `knowledge/ROLE.md` — deeper contract: loop, inputs, outputs, verification boundary, extension points
- `knowledge/config-schema.md` — `.copy-editor.yaml` schema reference with full example
- `knowledge/language-profiles.md` — how to add a new language profile
- `knowledge/output-contract.md` — structured findings JSON schema and review note template
