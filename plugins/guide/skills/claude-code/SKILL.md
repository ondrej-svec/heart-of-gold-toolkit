---
name: claude-code
description: Use when the user asks to run Claude Code CLI (`claude`, `claude resume`) for review, analysis, implementation, refactoring, debugging, or follow-up specifically through Claude Code.
---

# Claude Code CLI Skill Guide

Use this skill to hand a bounded task to Claude Code from the current harness, capture the result, and summarize it back to the user.

This skill is task-based, not review-only. Use `plan` for safe read-only analysis, but use other permission modes when the task requires command execution or edits.

The canonical execution path is direct `claude` CLI usage, mirroring the `codex` skill's direct `codex exec` pattern. The bundled wrapper is optional and must not replace the direct path unless the user explicitly asks for it or you are debugging Claude Code invocation behavior itself.

## Available Models

| Model | Best for |
| --- | --- |
| `default` | Anthropic's recommended default for the current account and environment |
| `sonnet` | Default recommendation for most coding, review, and analysis tasks |
| `opus` | Stronger reasoning for ambiguous, high-stakes, or architecture-heavy work |
| `haiku` | Fast, lightweight follow-ups and narrow questions |
| `opusplan` | Hybrid mode that uses `opus` for planning and `sonnet` for execution |

Prefer aliases over hardcoded snapshot names in this skill, because Anthropic documents aliases as the stable Claude Code interface and moves them forward as newer snapshots ship.

Default recommendation: `sonnet` for most tasks, `opus` when depth matters more than speed, and `opusplan` when the task naturally alternates between planning and execution.

## Permission Modes

Choose the permission mode based on what Claude Code needs to do:

| Mode | Use when | Notes |
| --- | --- | --- |
| `plan` | The task is read-only and Claude does not need to execute commands or edit files | Safest option for reviewing provided diffs, logs, file contents, or design docs |
| `default` | Claude may need to inspect the repo more freely and you can tolerate permission prompts | Good interactive default; less reliable in headless automation unless permissions are pre-arranged |
| `acceptEdits` | Claude should be able to make local code changes | Strong default for implementation, refactors, and fixes |
| `bypassPermissions` | Full automation is required in a trusted sandbox and the user explicitly approves it | High risk; do not default to this |

`plan` is not the general default for this skill. It is only the safe default for bounded read-only tasks.

## Running a Task
1. Always ask the user which model alias to use (default: `sonnet`) before running Claude Code, unless the user already specified the model.
2. Ask for permission mode in the same prompt when the user did not specify it. Default to:
   - `plan` for bounded read-only analysis
   - `acceptEdits` for implementation or refactoring work
   - `default` when Claude needs broader repo exploration without auto-edit authority
3. Decide whether Claude should receive the artifact directly or discover it itself:
   - Pass diffs, logs, or file contents via stdin for safe read-only review
   - Let Claude inspect the working tree when the task requires tool use
4. Assemble the command with the appropriate options:
   - `-p, --print` for non-interactive output
   - `--output-format <text|json|stream-json>`
   - `--model <MODEL>`
   - `--permission-mode <MODE>`
   - `--effort <low|medium|high|max>`
   - `--max-turns <N>` to bound cost and runtime
   - `--allowedTools` / `--disallowedTools` to constrain tool access
   - `--add-dir <DIR>` when Claude must read outside the current working directory
   - `--name <NAME>` when you want a stable, human-readable session
   - `"your prompt here"` as the final positional argument
5. Prefer `--output-format text` for human-readable summaries and `--output-format json` for automation or machine parsing.
6. In headless automation, prefer explicit permissions:
   - `plan` for provided artifacts
   - `acceptEdits` for edit-capable runs
   - `default` only when prompts are acceptable or when permissions are constrained with `--allowedTools`
7. Run the command, capture stdout/stderr, and summarize the outcome for the user.
8. If Claude Code does not actually return output, stop and report that failure. Do not substitute your own review or analysis and present it as if it came from Claude Code.

## Codex Execution

When this skill is used from Codex, the skill cannot bypass Codex sandbox policy on its own. Instead, instruct Codex to choose the correct execution path:

- Prefer the direct `claude` command patterns in this skill. Do not silently substitute the bundled wrapper for the normal path just because it exists.
- Run inside the sandbox first when the task is clearly local and read-only.
- If Claude Code needs network access, auth refresh, access outside the writable sandbox, or the in-sandbox run fails or hangs for likely sandbox reasons, rerun via `exec_command` with `sandbox_permissions: "require_escalated"`.
- Use a concise justification that tells the reviewer why Claude Code needs elevation, for example:
  - "Do you want me to run Claude Code with network access so it can authenticate and complete this review?"
  - "Do you want me to rerun Claude Code outside the sandbox because the in-sandbox headless run appears blocked by permissions?"
- Prefer a narrow approval request. Ask for elevation only for the Claude invocation that needs it, not unrelated commands.
- If the task is high-risk, restate the chosen Claude permission mode when asking for elevation.

## Best Practices

- Use `--max-turns` for automation. It keeps review and implementation runs bounded.
- Use `--output-format json` when another agent or script needs structured output.
- Use `--allowedTools` to make headless runs more reliable and safer.
- Pipe diffs or logs into Claude for read-only analysis instead of asking Claude to execute shell commands just to fetch them.
- Use `acceptEdits` for real implementation work; do not force read-only `plan` mode onto edit tasks.
- Use `bypassPermissions` only in a trusted sandbox and only with explicit user approval.
- Use `-r latest -p` for follow-up instead of re-explaining the entire task.

## Recommended Patterns

### 1. Review a provided diff safely

Pass the diff via stdin and keep Claude in `plan` mode:

```bash
git diff --staged | claude -p \
  --output-format text \
  --model sonnet \
  --permission-mode plan \
  --max-turns 1 \
  "Review this diff. Return findings ordered by severity with file paths and concise explanations."
```

### 2. Ask Claude to inspect the repo and analyze

Use `default` or a constrained tool set when Claude needs to discover context itself:

```bash
claude -p \
  --output-format text \
  --model sonnet \
  --permission-mode default \
  --max-turns 4 \
  --allowedTools "Read,Grep,Glob,Bash(git diff:*),Bash(git status:*)" \
  "Analyze the current changes and explain the main design risks."
```

### 3. Ask Claude to implement or refactor

Use `acceptEdits` when Claude should change files:

```bash
claude -p \
  --output-format text \
  --model sonnet \
  --permission-mode acceptEdits \
  --effort high \
  --max-turns 8 \
  "Implement the requested change in the current repo, keep the diff minimal, and summarize what changed."
```

### 4. Resume the latest Claude Code session

```bash
claude -r latest -p \
  --output-format text \
  "Focus only on the migration risk you mentioned earlier. What is the safest rollout plan?"
```

### 5. Request structured output for automation

```bash
claude -p \
  --output-format json \
  --model sonnet \
  --permission-mode plan \
  --max-turns 1 \
  "Summarize the provided diff as JSON with keys: verdict, findings, risks."
```

## Optional Wrapper

This skill also ships a convenience wrapper at `scripts/run-claude-code.sh`.

Use it as a thin helper around the documented CLI patterns above. It supports:

- `--check`
- `--prompt`
- `--model`
- `--permission-mode`
- `--effort`
- `--max-turns`
- `--output-format`
- `--allowed-tools`
- `--disallowed-tools`
- `--add-dir`
- `--resume`
- `--continue`
- `--name`
- `--no-session-persistence`
- `--verbose`
- `--timeout-seconds`

Do not treat the wrapper as the default execution path for this skill. Use it only when:

- the user explicitly asks to use the wrapper
- you are debugging Claude Code hangs or invocation edge cases
- you need its optional timeout helper for diagnosis

Otherwise, use the direct `claude` commands in this document.

## Following Up

- After every Claude Code command, confirm whether the user wants a follow-up, a resume, or a different model / permission mode.
- Restate the chosen model, effort, and permission mode when proposing a retry.
- Keep resume prompts narrow. Avoid restating the whole task unless context was lost.

## Critical Evaluation of Claude Code Output

Claude Code is a colleague, not an authority.

### Guidelines
- Trust your own knowledge when confident.
- Push back if Claude Code makes a claim that conflicts with the code or docs in front of you.
- Research disagreements before accepting them for high-impact decisions.
- Do not defer blindly on models, permissions, or fast-moving best practices.

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
- If Claude Code hangs or times out, report that Claude did not complete in this environment. Do not continue with a self-authored substitute while implying it came from Claude.
- If Claude Code reports permission issues, choose the correct permission mode or constrain tools explicitly.
- If a headless run gets stuck on permissions, either switch to `plan`, use `acceptEdits`, or provide `--allowedTools` / a permission prompt tool.
- In Codex, if the likely cause is sandboxing or network denial, rerun with reviewer-approved `require_escalated` execution instead of repeatedly retrying the same sandboxed command.
- Do not use `bypassPermissions` unless the user explicitly approves it.
- If the direct `claude` path fails, report that failure directly. Do not route around it by pretending a wrapper run or a self-authored review is equivalent to Claude output.
