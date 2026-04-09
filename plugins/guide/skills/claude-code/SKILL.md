---
name: claude-code
description: Use when the user asks to run Claude Code CLI (`claude`, `claude resume`) or asks for a second opinion, review, analysis, refactor, or follow-up specifically from Claude Code.
---

# Claude Code CLI Skill Guide

Use this skill to hand a bounded task to Claude Code from the current harness, capture the output, and summarize it back to the user.

## Defaults

- Default model: `sonnet`
- Default permission mode for review or analysis: `plan`
- Default permission mode for requested edits: `acceptEdits`
- Default effort: `medium`

Prefer the harness's structured question UI when available; otherwise ask plainly in text and wait for the answer before continuing.

## Running a Task

1. Ask the user which model to use if they care. Default to `sonnet`.
2. Ask for permission mode only when it materially affects safety:
   - `plan` for review, analysis, and read-only second opinions
   - `acceptEdits` when the user explicitly wants Claude Code to make local changes
   - `bypassPermissions` only with explicit user approval
3. Resolve the bundled runner relative to this skill:
   - `scripts/run-claude-code.sh`
4. Build a concrete prompt for Claude Code. For review requests, include scope and output shape:
   - Ask for findings ordered by severity
   - Ask for file paths in each finding
   - Ask for a short final verdict
5. Run the bundled script:

```bash
bash <skill-dir>/scripts/run-claude-code.sh \
  --prompt "<PROMPT>" \
  --model <MODEL> \
  --permission-mode <MODE> \
  --effort <EFFORT>
```

6. Capture stdout and summarize the result for the user.
7. If the user wants a follow-up, resume the latest Claude Code session instead of starting from scratch:

```bash
bash <skill-dir>/scripts/run-claude-code.sh \
  --resume latest \
  --prompt "<FOLLOW_UP_PROMPT>" \
  --model <MODEL> \
  --permission-mode <MODE> \
  --effort <EFFORT>
```

## Quick Reference

| Use case | Permission mode | Suggested prompt shape |
| --- | --- | --- |
| Read-only code review | `plan` | "Review the current diff and return findings ordered by severity with file paths." |
| Architecture second opinion | `plan` | "Assess this design and name the top risks, tradeoffs, and missing tests." |
| Targeted implementation | `acceptEdits` | "Implement X, keep changes minimal, and explain what changed." |
| Continue prior thread | prior mode | Resume with a narrow follow-up prompt instead of restating everything |

## Prompting Guidance

- Keep prompts bounded. Claude Code performs better when the scope is explicit.
- Name the artifact under review: current diff, specific files, or a directory.
- For reviews, ask for bugs, regressions, missing tests, and risky assumptions first.
- For implementation requests, specify what must not change.
- If you disagree with the result, treat Claude Code as a colleague and challenge it with evidence.

## Examples

### Review the current diff

```bash
bash <skill-dir>/scripts/run-claude-code.sh \
  --prompt "Review the current git diff. Return only findings, ordered by severity, with file paths and concise explanations." \
  --model sonnet \
  --permission-mode plan \
  --effort medium
```

### Ask Claude Code to inspect a single file

```bash
bash <skill-dir>/scripts/run-claude-code.sh \
  --prompt "Review src/server.ts for correctness, edge cases, and missing tests. Keep the response concise." \
  --model sonnet \
  --permission-mode plan \
  --effort high
```

### Continue the latest Claude Code session

```bash
bash <skill-dir>/scripts/run-claude-code.sh \
  --resume latest \
  --prompt "Focus only on the migration risk you mentioned. What is the safest rollout plan?" \
  --model sonnet \
  --permission-mode plan \
  --effort medium
```

## Script

Use the bundled runner instead of assembling `claude` commands ad hoc:

- `scripts/run-claude-code.sh --check` verifies that Claude Code is installed
- `scripts/run-claude-code.sh --help` prints usage

The wrapper keeps flag handling deterministic and portable when this skill is installed into Codex, Pi, or other agent harnesses.

## Error Handling

- Stop and report failures when `claude --version` or the runner exits non-zero.
- If Claude Code is missing, tell the user to install or authenticate Claude Code before retrying.
- If output is partial or Claude reports permission issues, summarize that clearly and ask whether to retry with a different permission mode.
- Do not use `bypassPermissions` unless the user explicitly approves it.
