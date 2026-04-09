---
name: claude-code
description: Use when the user asks to run Claude Code CLI (`claude`, `claude resume`) for review, analysis, implementation, refactoring, debugging, or follow-up specifically through Claude Code.
---

# Claude Code CLI Skill Guide

Use this skill to hand a bounded task to Claude Code from the current harness, capture the result, and summarize it back to the user.

This skill is task-based, not review-only. Anthropic's `plan` mode is a read-only analysis mode, but because Claude Code frames it as "Plan Mode," do not treat it as the default for reviews. Prefer `default` for normal reviews and `acceptEdits` for implementation work unless you specifically want strict read-only behavior.

The canonical execution path is direct `claude` CLI usage, mirroring the `codex` skill's direct `codex exec` pattern. Keep the workflow simple:

- Ask which model to use.
- Run one direct `claude` command.
- If it works, summarize Claude's output.
- If it fails or hangs, report that clearly and stop.

Do not turn a failed Claude run into an improvised shell pipeline, background polling loop, or manual artifact-concatenation workaround unless the user explicitly asks for that style of invocation.

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
| `plan` | You explicitly want strict read-only analysis with no command execution or edits | Best for exploration, planning, or artifact-only analysis; not the default recommendation for review |
| `default` | Claude may need to inspect the repo more freely and you can tolerate permission prompts | Good interactive default; less reliable in headless automation unless permissions are pre-arranged |
| `acceptEdits` | Claude should be able to make local code changes | Strong default for implementation, refactors, and fixes |
| `bypassPermissions` | Full automation is required in a trusted sandbox and the user explicitly approves it | High risk; do not default to this |

`plan` is not the general default for this skill. Use it only when you specifically want Claude in strict read-only analysis mode.

## Running a Task
1. Always ask the user which model alias to use (default: `sonnet`) before running Claude Code, unless the user already specified the model.
2. Ask for permission mode in the same prompt when the user did not specify it. Default to:
   - `default` for reviews and analysis
   - `acceptEdits` for implementation or refactoring work
   - `plan` only when the user explicitly wants strict read-only analysis
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
   - `default` for most review and analysis runs
   - `acceptEdits` for edit-capable runs
   - `plan` only when you specifically want read-only analysis with no command execution
7. Run the command, capture stdout/stderr, and summarize the outcome for the user.
8. If Claude Code does not actually return output, stop and report that failure. Do not substitute your own review or analysis and present it as if it came from Claude Code.
9. Do not add fallback layers automatically. One direct Claude attempt is the normal path. A retry is acceptable only when the user asks for it or when you have a concrete reason to change one thing, such as model, permission mode, or execution environment.

## Codex Execution

When this skill is used from Codex, the skill cannot bypass Codex sandbox policy on its own. Instead, instruct Codex to choose the correct execution path:

- Prefer the direct `claude` command patterns in this skill. Do not silently substitute the bundled wrapper for the normal path just because it exists.
- Run inside the sandbox first when the task is clearly local and read-only.
- If Claude Code needs network access, auth refresh, access outside the writable sandbox, or the in-sandbox run fails or hangs for likely sandbox reasons, rerun via `exec_command` with `sandbox_permissions: "require_escalated"`.
- If you verify that direct `claude -p` works outside the sandbox but hangs inside it in the current environment, stop treating the sandboxed path as normal. For the rest of that Codex session, prefer reviewer-approved elevated execution as the default path for actual Claude invocations.
- Use a concise justification that tells the reviewer why Claude Code needs elevation, for example:
  - "Do you want me to run Claude Code with network access so it can authenticate and complete this review?"
  - "Do you want me to rerun Claude Code outside the sandbox because the in-sandbox headless run appears blocked by permissions?"
- Prefer a narrow approval request. Ask for elevation only for the Claude invocation that needs it, not unrelated commands.
- If the task is high-risk, restate the chosen Claude permission mode when asking for elevation.

## Best Practices

- Use `--max-turns` for automation. It keeps review and implementation runs bounded.
- Use `--output-format json` when another agent or script needs structured output.
- Use `--allowedTools` to make headless runs more reliable and safer.
- Prefer letting Claude inspect the repo directly for normal review and implementation tasks.
- Pass diffs or logs via stdin only when the user explicitly wants artifact-only review or when direct repo access is intentionally unavailable.
- Use `acceptEdits` for real implementation work; do not force read-only `plan` mode onto edit tasks.
- Use `bypassPermissions` only in a trusted sandbox and only with explicit user approval.
- Use `-r latest -p` for follow-up instead of re-explaining the entire task.
- Avoid giant `cat file1 file2 ... | claude ...` constructions as a default strategy. They are brittle, hard to inspect, and a poor substitute for direct Claude access to the repo.

## Recommended Patterns

### 1. Review the repo directly

Use this as the normal review path:

```bash
claude -p \
  --output-format text \
  --model sonnet \
  --permission-mode default \
  --max-turns 4 \
  "Review how the workshop skill is designed in this repo and whether it should be improved. Return findings ordered by severity."
```

### 2. Review a provided diff only

Use stdin only when you intentionally want a bounded artifact review:

```bash
git diff --staged | claude -p \
  --output-format text \
  --model sonnet \
  --permission-mode default \
  --max-turns 1 \
  "Review this diff. Return findings ordered by severity with file paths and concise explanations."
```

### 3. Ask Claude to inspect the repo and analyze with tighter tool bounds

Use this when Claude should inspect the repo but you want tighter limits:

```bash
claude -p \
  --output-format text \
  --model sonnet \
  --permission-mode default \
  --max-turns 4 \
  --allowedTools "Read,Grep,Glob,Bash(git diff:*),Bash(git status:*)" \
  "Analyze the current changes and explain the main design risks."
```

### 4. Ask Claude to implement or refactor

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

### 5. Resume the latest Claude Code session

```bash
claude -r latest -p \
  --output-format text \
  "Focus only on the migration risk you mentioned earlier. What is the safest rollout plan?"
```

### 6. Request structured output for automation

```bash
claude -p \
  --output-format json \
  --model sonnet \
  --permission-mode default \
  --max-turns 1 \
  "Summarize the provided diff as JSON with keys: verdict, findings, risks."
```

### 7. Use strict read-only analysis mode explicitly

Use `plan` only when you want Claude prevented from executing commands or editing files:

```bash
git diff --staged | claude -p \
  --output-format text \
  --model sonnet \
  --permission-mode plan \
  --max-turns 1 \
  "Analyze this diff and explain the key risks. Keep the response concise."
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
- In Codex, if you have already confirmed that elevated execution works and sandboxed execution hangs, do not re-run the sandboxed path again during the same task.
- Do not use `bypassPermissions` unless the user explicitly approves it.
- If the direct `claude` path fails, report that failure directly. Do not route around it by pretending a wrapper run or a self-authored review is equivalent to Claude output.
- Do not automatically fall back to concatenating many files into stdin just because a direct Claude run failed once.
