---
name: claude-code
description: Use when the user asks to run Claude Code CLI (`claude`, `claude resume`) or asks for a second opinion, review, analysis, refactor, or follow-up specifically from Claude Code.
---

# Claude Code CLI Skill Guide

## Available Models

| Model | Best for |
| --- | --- |
| `sonnet` | Default recommendation for most coding, review, and analysis tasks |
| `opus` | Stronger reasoning for ambiguous or high-stakes reviews |
| `haiku` | Faster and cheaper for lightweight follow-ups |

Default recommendation: `sonnet` for most tasks, `opus` when depth matters more than speed.

## Running a Task
1. Ask the user which model to use (default: `sonnet`) AND which permission mode to use (`plan`, `acceptEdits`, `default`, `auto`, or `bypassPermissions`) in a single prompt when both matter.
2. Default to `--permission-mode plan` for reviews, read-only analysis, and second opinions.
3. Assemble the command with the appropriate options:
   - `-p, --print` for non-interactive output
   - `--output-format <text|json|stream-json>`
   - `--model <MODEL>`
   - `--permission-mode <MODE>`
   - `--effort <low|medium|high|max>`
   - `--add-dir <DIR>` when Claude Code must read outside the current working directory
   - `"your prompt here"` as the final positional argument
4. Prefer `--output-format text` unless the caller explicitly needs JSON.
5. Run the command, capture stdout/stderr, and summarize the outcome for the user.
6. After Claude Code completes, tell the user they can resume by asking for `claude resume` or another Claude Code follow-up.

### Quick Reference
| Use case | Permission mode | Key flags |
| --- | --- | --- |
| Read-only review or analysis | `plan` | `-p --output-format text --permission-mode plan` |
| Apply local edits | `acceptEdits` | `-p --output-format text --permission-mode acceptEdits` |
| Stronger review pass | `plan` | `--model opus --effort high` |
| Resume recent session | Inherited | `-r latest -p "new prompt" --output-format text` |

## Recommended Commands

### Review the current diff

```bash
claude -p \
  --output-format text \
  --model sonnet \
  --permission-mode plan \
  --effort medium \
  "Review the current git diff. Return findings ordered by severity with file paths and concise explanations."
```

### Review a specific file

```bash
claude -p \
  --output-format text \
  --model sonnet \
  --permission-mode plan \
  --effort high \
  "Review src/server.ts for correctness, regressions, and missing tests. Keep the response concise."
```

### Continue the latest Claude Code session

```bash
claude -r latest -p \
  --output-format text \
  "Focus only on the migration risk you mentioned. What is the safest rollout plan?"
```

## Optional Wrapper

This skill also ships a convenience wrapper at `scripts/run-claude-code.sh`.

Use it only as a thin helper around the direct `claude` commands above:

- `scripts/run-claude-code.sh --check` verifies that Claude Code is installed
- `scripts/run-claude-code.sh --prompt "..." --permission-mode plan` mirrors the direct CLI usage

Prefer the direct `claude` commands in this document when debugging, because they are easier to inspect and adapt.

## Following Up

- After every Claude Code command, confirm whether the user wants a follow-up, a resume, or a different model / permission mode.
- When resuming, keep the new prompt narrow instead of restating the whole task.
- Restate the chosen model, effort, and permission mode when proposing a retry.

## Critical Evaluation of Claude Code Output

Claude Code is a colleague, not an authority.

### Guidelines
- Trust your own knowledge when confident.
- Push back if Claude Code makes a claim that conflicts with the code or docs in front of you.
- Research disagreements before accepting them for high-impact decisions.
- Do not defer blindly on models, tool flags, or fast-moving best practices.

### When Claude Code Seems Wrong
1. State the disagreement clearly to the user.
2. Provide evidence from the codebase, documentation, or your own verification.
3. Optionally resume the Claude Code session with a corrective prompt:

```bash
claude -r latest -p \
  --output-format text \
  "I disagree with your earlier conclusion because [evidence]. Re-evaluate only that point."
```

4. Treat the exchange as a discussion, not a correction ritual.

## Error Handling

- Stop and report failures whenever `claude --version` or a `claude -p` command exits non-zero.
- If Claude Code reports permission issues, retry only after choosing the correct `--permission-mode`.
- Do not use `bypassPermissions` unless the user explicitly approves it.
- If debugging a failing wrapper invocation, fall back to the direct `claude` command first.
