# Flagship Skill Portability Audit

Date: 2026-04-05
Skills audited:
- `plugins/deep-thought/skills/brainstorm/SKILL.md`
- `plugins/deep-thought/skills/plan/SKILL.md`
- `plugins/marvin/skills/work/SKILL.md`

## Summary

The flagship skills already contain strong portable workflow logic. The main portability issue is not reasoning quality; it is **interaction coupling**.

The shared skills previously treated Claude-oriented affordances such as `AskUserQuestion`, `TaskCreate`, and `TaskUpdate` as if they were part of the canonical contract. That made the intended experience easy to understand in Claude Code but weaker or ambiguous in pi and Codex.

## Findings

### 1. `brainstorm`

**Portable core is strong:**
- reframing before solutioning
- one-question-at-a-time flow
- explicit assumption audit
- structured brainstorm document

**Coupled parts found:**
- direct references to `AskUserQuestion` as the canonical interaction primitive
- decision points expressed in harness-specific tool format instead of neutral interaction intent

**Portable interaction contract:**
- ask one question at a time
- prefer explicit options when natural choices exist
- use structured choice UI if available; otherwise use concise text choices

### 2. `plan`

**Portable core is strong:**
- context detection from brainstorms
- research and memory integration
- detail calibration
- dependency-ordered tasks and acceptance criteria

**Coupled parts found:**
- direct references to `AskUserQuestion` for brainstorm selection and handoff

**Portable interaction contract:**
- ask clarifying questions sequentially
- when multiple brainstorms or next steps exist, present a short explicit option list
- use structured UI if available; otherwise plain text is sufficient

### 3. `work`

**Portable core is strong:**
- plan-first execution
- dependency ordering
- test-after-change discipline
- quality gates before shipping
- explicit push/ship workflow

**Coupled parts found:**
- `AskUserQuestion` treated as required for branch selection and handoff
- `TaskCreate` / `TaskUpdate` treated as the canonical task tracker

**Portable interaction contract:**
- plan checkboxes remain the source-of-truth tracker
- harness task/progress UI is optional acceleration
- task state must still be understandable and visible in plain text

## Recommendation

Keep these three skills as the canonical shared-core workflows. Add pi-native enhancements for:
- richer guided intake and decision handling in `brainstorm`
- visible planning mode and light enforcement in `plan`
- progress UI and stronger execution guardrails in `work`

Do not fork the workflows yet. The audit supports a shared-core + pi-enhancement strategy.
