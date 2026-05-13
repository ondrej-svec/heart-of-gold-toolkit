# Trigger mockups — review before they ship

This directory contains draft block messages for every V1.0 trigger Quellis Architect plans to install in the `core` pack. **None of this is wired up yet.** The plan's Subjective Contract requires these to be reviewed by Ondrej before they reach `packs/core/*.toml`, because the wrong tone here poisons every subsequent intercept.

Three lists, mirroring the plan:

- [`non-negotiable-pretool.md`](non-negotiable-pretool.md) — 7 PreToolUse triggers (plan 1.D.3)
- [`convention-pretool.md`](convention-pretool.md) — 5 architectural-convention PreToolUse triggers (plan 1.D.4)
- [`evidence-stop.md`](evidence-stop.md) — 3 Stop-time evidence triggers (plan 1.D.5)

## Review checklist for each trigger

Before promoting a mockup into `packs/core/`:

- [ ] **Lead with the concern in 8 words or fewer.** First clause names the problem, then the action.
- [ ] **≤ 200 characters.** The validator enforces this; check it visually.
- [ ] **Complete sentences.** No telegrams, no bullet warnings inside the message itself.
- [ ] **No "should" without a consequence.** "Touching auth code is risky; document why first."
- [ ] **Addresses Claude singular.** Hook output is read by the agent. CLI help is the only place that addresses users plural.
- [ ] **No emojis. No jokes. No cute.** The Subjective Contract is explicit.
- [ ] **The pattern actually catches the thing.** Run the regex against three positive examples and three negative examples before promoting.
- [ ] **The intended Claude response is concrete.** "Show the test run, restate as uncertain, or escalate" — not "do better."

## Promotion process

When a mockup passes review:

1. Append its TOML form to `packs/core/pretool-triggers.toml` (or `stop-triggers.toml`).
2. Run `python3 hooks/lib/validate_pack.py packs/core/*.toml`.
3. Run the unit test suite: `python3 -m unittest discover -s tests`.
4. Add a row to the trigger catalog in this README's table (TODO once review begins).

## Why mockups, not direct authoring

Plan 2026-05-13, Subjective Contract:

> **For V1.0 in-flight row (1.D)**: a markdown mockup of each trigger's block message and intended Claude response. Reviewed by Ondrej before trigger ships. Catches tone drift early.

Tone drift compounds. Catching it in one mockup is cheap; catching it after fifteen triggers have shipped is expensive because every fix risks a partial-rollout problem ("this trigger sounds different from that one"). The mockup pass is the cheap gate.
