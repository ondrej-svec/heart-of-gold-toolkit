---
name: teach
description: >
  Capture a footgun the agent just hit (or the user just spotted) as a
  proposed trigger via `quellis teach`. Guided flow: gather the
  finding, run the CLI, surface the proposed trigger, leave activation
  to the user. Triggers: teach quellis, capture this footgun, add a
  trigger, remember this rule.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
---

# Teach (capture a footgun as a proposed trigger)

A guided wrapper around `quellis teach`. The CLI exists; this skill exists because most users won't drop to a terminal mid-session to write a TOML trigger by hand. Walks the user through naming the finding, runs the CLI, shows the proposed pack entry, and stops — activation is a deliberate second step.

## Boundaries

**This skill MAY:** ask the user to describe the finding, run `quellis teach --finding "<text>"`, read the proposed trigger output, write a one-line summary to the conversation.
**This skill MAY NOT:** auto-activate the proposed trigger (the CLI's `--dry-run`-and-review contract is the whole point), edit existing triggers, run other `quellis` subcommands without explicit user approval, write to the live pack outside of what `quellis teach` writes.

**Teach never auto-promotes.** The §2.D acceptance-log substrate exists so triggers earn promotion through observed use; bypassing that throws away the compounding loop.

## Common Rationalizations

| Shortcut | Why it fails | The cost |
|---|---|---|
| "Skip the dry-run; just write the trigger directly" | The CLI's classification step produces canonical DON'T/TRIGGER/VERIFICATION/ORIGIN form. Hand-rolled triggers drift from that form and don't compound cleanly into V1.2 personalization. | Pack inconsistency; harder to review patterns later. |
| "Activate immediately because the user said yes" | "Activate immediately" is what §2.D told us doesn't work — the calibration step matters. Proposed triggers sit until the user reviews the pack. | Trigger fatigue from over-eager additions. |
| "Capture every annoying thing as a trigger" | Triggers are for footguns, not preferences. A finding worth a trigger involves real risk — security, destructive, integrity. | Pack noise; real triggers lose signal. |
| "Skip the why — just record the don't" | The CLI writes `ORIGIN: <why>` for a reason. The why is what calibrates later — was this an incident, a near-miss, a hunch? | Future-you can't tell if a trigger still earns its keep. |

## Phase 0: Confirm the finding is trigger-shaped

Before touching the CLI, check that what the user wants to capture actually belongs as a trigger. **Triggers are for:**

- Footguns that have caused (or nearly caused) real damage.
- Patterns the agent keeps reaching for that the user wants blocked.
- Rules whose violation is detectable by regex against tool input or claims.

**Triggers are NOT for:**

- Style preferences (tab vs space, naming) — those go in CLAUDE.md.
- One-off "the agent did this thing once" annoyances — wait for a pattern.
- Architectural decisions — those go in ADRs.
- Things detectable only via semantic analysis — triggers are regex, not LLMs.

If the finding doesn't fit, say so plainly: "This isn't trigger-shaped. <Where it should live instead>." Stop.

## Phase 1: Gather the finding

Ask the user three questions, in order:

1. **What happened?** A one-paragraph description of the footgun. The CLI uses this as the `--finding` text.
2. **What's the rule you want enforced?** E.g., "never write to `migrations/` without `-- backfill:` inline." This becomes the canonical DON'T.
3. **Why now?** Was this an incident, a near-miss, a recurring pattern? This becomes the ORIGIN line — load-bearing for later calibration.

Hold the answers in conversation; do not write to a file yet.

## Phase 2: Run the CLI in dry-run first

Run:

```bash
quellis teach --finding "<the answer to Q1>" --dry-run
```

Capture stdout. The CLI prints the proposed trigger entry it *would* write — in canonical DON'T / TRIGGER / VERIFICATION / ORIGIN form, classified into the right pack.

Show the dry-run output to the user verbatim. Then ask:

- Is the proposed trigger shape correct?
- Is the matching pattern too broad / too narrow?
- Does the target pack look right? (Default is `core`; some findings belong in project-specific packs.)

If anything is off, refine the finding text and re-run dry-run. Iterate until the user is satisfied. **Do not edit the CLI output by hand** — refine the input.

## Phase 3: Write the proposal (still not active)

Run without `--dry-run`:

```bash
quellis teach --finding "<final finding text>" --pack <target>
```

The CLI writes the proposed trigger to the pack file (not to the live trigger array — the file's `[[proposed]]` section, per the CLI's contract). The trigger does NOT fire yet; the activation gate is a separate `quellis` command.

Confirm the write:

```bash
quellis pack list --status proposed
```

If the new entry appears, the proposal is captured.

## Phase 4: Stop and hand off

Tell the user:

```
Proposed trigger captured in pack <target>:

  id:       <id>
  trigger:  <one-line summary>
  origin:   <origin text>

It is NOT active yet — the activation gate runs separately, after the
trigger has seen enough acceptance signal to justify promotion. Until
then, the trigger lives in the pack as a proposal.

Re-run /quellis-architect:teach for additional findings. Run
`quellis pack proposals` to review pending triggers.
```

Do not run activation. Do not advise the user to "force-activate" the trigger. The proposal-to-live transition is the compounding loop's whole point.

## What makes this Quellis-shaped

- **Wraps the CLI, doesn't replace it.** The CLI is the authority; this skill is the gentle path into it.
- **Three questions, not a form.** Forces small commits, surfaces the why (origin) explicitly.
- **Dry-run first, write second.** Catches over-broad patterns before they land.
- **Never activates.** The §2.D maintenance commitment is that triggers earn their place through observed use, not declaration.
