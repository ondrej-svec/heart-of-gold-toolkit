# Output Contract

What the `copy-editor` skill emits and how consumers parse it.

Two artifacts per run:

1. **Structured findings JSON** — machine-consumable
2. **Review note markdown draft** — human-consumable, human-editable

## Structured findings JSON

Emitted by `bun scripts/copy-audit.ts --json` (Layer 1 only) and by the skill when assembling the full report (Layer 1 + Layer 2).

### Layer 1 shape (from the engine directly)

```json
{
  "totalFiles": 12,
  "totalFindings": 47,
  "errorFindings": 31,
  "warningFindings": 16,
  "infoFindings": 0,
  "byRule": {
    "cs-R1-nbsp-prep": 28,
    "cs-R1b-nbsp-conjunction": 16,
    "cs-R6-dash": 3
  },
  "findings": [
    {
      "ruleId": "cs-R1-nbsp-prep",
      "severity": "error",
      "filePath": "/abs/path/to/content/project-briefs/a.md",
      "line": 5,
      "column": 52,
      "snippet": "s A",
      "message": "Replace regular space after `s` with non-breaking space (\\u00A0)."
    }
  ]
}
```

### Full skill report shape (Layer 1 + Layer 2)

```json
{
  "layer1": { /* Layer 1 shape above */ },
  "layer2": {
    "byPass": {
      "reject_list_hits": 7,
      "nominal_style": 3,
      "clarity_participant": 5,
      "voice_register": 2,
      "rhythm": 1
    },
    "suggestions": [
      {
        "pass": "reject_list_hits",
        "filePath": "/abs/path/to/content/project-briefs/a.md",
        "line": 14,
        "snippet": "v rámci workshopu",
        "rationale": "Reject list entry: Kalk z angličtiny 'v rámci X' → 'při X' / 'v X' / often delete.",
        "source": "content/czech-reject-list.md#kalky-z-angličtiny",
        "proposal": "na workshopu"
      },
      {
        "pass": "clarity_participant",
        "filePath": "/abs/path/to/content/project-briefs/a.md",
        "line": 22,
        "snippet": "Until launch you need to map next steps and first validation",
        "rationale": "Directional noun 'next steps' and 'first validation' without referent; reader cannot answer 'čeho?'. Participant-facing text must be self-contained.",
        "source": "content/style-guide.md#jasnost-na-participant-surfaces",
        "proposal": "Before the build phase: (1) list the three next steps your team will take, (2) define one concrete check you'll run to validate your first change."
      }
    ]
  },
  "gates": {
    "gate_1_deterministic": "fail",
    "gate_2_judgment": "human_required"
  },
  "surface_profile_counts": {
    "participant": 8,
    "presenter": 3,
    "hybrid": 1
  },
  "review_note_path": "/abs/path/to/docs/reviews/workshop-content/2026-04-09-czech-baseline.md"
}
```

### Field semantics

- `gate_1_deterministic` — `"pass" | "fail"`. Derived from Layer 1 error count.
- `gate_2_judgment` — **always** `"human_required"`. Never set to `"pass"` by the skill. This is the verification boundary in structured form.
- `surface_profile_counts` — how many files in scope were classified as each profile. Useful for sanity checks.
- `review_note_path` — absolute path to the draft review note, if `output.review_notes_dir` is configured.
- `suggestions[].source` — citation. Must reference a loaded rule, guide section, or reject-list entry. Bare assertions without a source are forbidden.
- `suggestions[].proposal` — the rewrite. Should be concrete enough that a human can accept or reject it without further context.

### Consumers

- `/marvin:work` can read the JSON and apply Layer 1 fixes deterministically.
- A human reviewer reads the review note and decides on Layer 2 suggestions.
- CI/hook pipelines read `gate_1_deterministic` and exit non-zero on fail.
- Other agents (Codex, Cursor, custom scripts) can consume the JSON identically.

## Review note markdown draft

The skill drops a skeleton into `output.review_notes_dir` for a human to fill in. Template:

```markdown
# Copy-Editor Review — {date} — {scope_description}

**Repo:** {repo_name}
**Language:** {language}
**Files reviewed:** {totalFiles}
**Scope:** {comma-separated top-level paths}

---

## Gates

- **Layer 1 (deterministic typography):** {pass | N findings}
- **Layer 2 (judgment):** human review required — signoff _pending_

---

## Layer 1 findings

{if gate_1 = pass}
All deterministic typography rules pass on the reviewed scope.
{else}

### by rule

{table or list of rule_id → count}

### sample findings

{up to 20 finding entries with file:line and message}
{endif}

---

## Layer 2 suggestions

### Reject-list hits ({count})
{list}

### Nominal-style rewrites ({count})
{list}

### Clarity / ambiguity (participant-facing) ({count})
{list}

### Voice / register ({count})
{list}

### Rhythm / spoken readability ({count})
{list}

---

## Human reviewer signoff

- [ ] Layer 1 clean or remediated
- [ ] Layer 2 suggestions reviewed and decided (applied, deferred, or rejected with rationale)
- [ ] Spoken-readability check passed
- [ ] Visible-surface check passed (if applicable)

**Signed off by:** _pending_
**Date:** _pending_

---

## Notes

{freeform space for the human reviewer}
```

### Rules for the template

- The skill **never** fills in "Signed off by" or "Date". Those remain `_pending_` until a human edits the file.
- The skill **never** checks the human signoff checkboxes. The human toggles them.
- If Layer 1 has zero findings, the Layer 1 section compresses to one line and the reviewer focuses on Layer 2.
- If Layer 2 has zero suggestions in a pass, the pass section still appears with "(0)" so the reader knows the pass ran.

## Why two artifacts

- **JSON for machines.** Consumable by `/marvin:work`, other agents, CI, pipelines. No ambiguity.
- **Markdown for humans.** Narrative, reviewer-editable, lives in the repo forever as the authoritative record of what was decided.

Keeping both in lockstep is the skill's job. If one changes without the other, the skill is out of contract.
