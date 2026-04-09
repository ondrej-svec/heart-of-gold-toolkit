---
name: claude-code
description: Use when the user asks to run Claude Code CLI (`claude`, `claude resume`) for review, analysis, implementation, refactoring, debugging, or follow-up specifically through Claude Code.
---

# Claude Code CLI Skill Guide

Use this skill to run Claude Code directly, capture Claude's actual output, and summarize it back to the user.

Mirror the `codex` skill's style: short, direct, and command-first. Do not improvise. Do not use the wrapper as the normal path.

## Available Models

| Model | Best for |
| --- | --- |
| `sonnet` | Default recommendation for most coding, review, and analysis tasks |
| `opus` | Stronger reasoning for ambiguous, high-stakes, or architecture-heavy work |
| `haiku` | Fast, lightweight follow-ups and narrow questions |
| `default` | Anthropic's account/environment default |
| `opusplan` | Planning-heavy tasks that intentionally mix planning and execution |

Default recommendation: `sonnet` for most tasks, `opus` when depth matters more than speed.

## Permission Modes

Choose the permission mode yourself based on the task. Do not ask the user unless they explicitly want to control it.

| Mode | Use when |
| --- | --- |
| `default` | Normal review, analysis, debugging, and repo inspection |
| `acceptEdits` | Claude should edit files or implement changes |
| `plan` | The user explicitly wants strict read-only planning / analysis |
| `bypassPermissions` | Only with explicit user approval in a trusted environment |

Hard rule: do not use `plan` for ordinary reviews just because it sounds safe. For normal reviews, use `default`.

## Running a Task

1. Ask the user which model to use (default: `sonnet`) in one short question, unless they already specified it.
2. Infer the permission mode from the task:
   - review / analysis / debugging: `default`
   - implementation / refactor / fix: `acceptEdits`
   - strict read-only planning requested by the user: `plan`
3. Pick a sane `--max-turns`:
   - narrow question or follow-up: `3`
   - normal file or diff review: `6`
   - multi-directory repo review or investigation: `8`
   - implementation / refactor: `10` to `12`
4. Do not add `--effort high` by default. Use the CLI default unless the user explicitly wants deeper reasoning or the task is unusually ambiguous.
5. Assemble the direct `claude` command with the appropriate options:
   - `-p, --print`
   - `--output-format text` for short runs that should complete quickly
   - `--output-format stream-json --verbose` for long repo reviews, investigations, or any run where you need progress visibility
   - `--model <MODEL>`
   - `--permission-mode <MODE>`
   - `--max-turns <N>`
   - `"your prompt here"` immediately after `-p` when using variadic flags like `--allowedTools`
   - `--allowedTools <TOOL> [<TOOL> ...]` only to pre-approve tools without prompting
   - `--disallowedTools <TOOL> [<TOOL> ...]` when you actually need to prevent specific tools
6. Run the command, capture the output, and summarize Claude's actual result.
7. If Claude does not actually return output, stop and report failure plainly.

## Codex Execution

When this skill is used from Codex, use the execution path that actually works here.

- For real Claude runs in this environment, prefer `exec_command` with `sandbox_permissions: "require_escalated"`.
- Do not treat the sandboxed path as normal. Direct `claude -p` has been verified to work outside the sandbox and to hang or misbehave inside it.
- For long repo reviews from Codex, prefer `--output-format stream-json --verbose` so progress is visible. Plain `text` output can remain silent for a long time even when Claude is actively working.
- Use a narrow approval request tied to the Claude invocation, for example:
  - "Do you want me to run Claude Code outside the sandbox so it can complete this review?"
  - "Do you want me to run Claude Code with network/auth access so it can complete this task?"
- Once elevated Claude execution is known to work for the current task, keep using that path. Do not retry the sandboxed path again during the same task.

## Recommended Command Patterns

### 1. Normal repo review

Use this as the default review path:

```bash
claude -p \
  "Review this repository and return findings ordered by severity with file references where possible." \
  --output-format stream-json \
  --verbose \
  --model sonnet \
  --permission-mode default \
  --max-turns 8 \
  --allowedTools "Read" "Grep" "Glob" "LS" "Bash(git status:*)" "Bash(git diff:*)" \
  --disallowedTools "Edit" "Write" "NotebookEdit"
```

### 2. Review current changes only

```bash
git diff --staged | claude -p \
  "Review this diff and return findings ordered by severity with concise explanations." \
  --output-format text \
  --model sonnet \
  --permission-mode default \
  --max-turns 6
```

### 3. Multi-directory repo investigation

Use this when the prompt names several directories or asks for deeper inspection:

```bash
claude -p \
  "Inspect the relevant parts of this repo, evaluate the design, and return evidence-based findings ordered by severity." \
  --output-format stream-json \
  --verbose \
  --model opus \
  --permission-mode default \
  --max-turns 8 \
  --allowedTools "Read" "Grep" "Glob" "LS" "Bash(git status:*)" "Bash(git diff:*)" \
  --disallowedTools "Edit" "Write" "NotebookEdit"
```

### 4. Implementation or refactor

```bash
claude -p \
  "Implement the requested change in this repo, keep the diff minimal, and summarize what changed." \
  --output-format text \
  --model sonnet \
  --permission-mode acceptEdits \
  --max-turns 12
```

### 5. Resume the latest session

```bash
claude -r latest -p "Focus only on the open issue you identified earlier and propose the safest next step." \
  --output-format text
```

## Following Up

- After every Claude run, tell the user which model and permission mode were used.
- Tell the user they can ask to resume the Claude session or rerun with a different model.
- Keep follow-up prompts narrow.

## Error Handling

- Stop and report failures whenever `claude --version` or a `claude -p` command exits non-zero.
- If Claude reaches `max turns`, report that plainly. Do not paraphrase it as a hang.
- If `--output-format text` stays silent during a long repo review, do not assume it is hung. Re-run or start with `--output-format stream-json --verbose` to confirm whether Claude is actively working.
- If Claude truly hangs or returns no output even in streaming mode, report that plainly and stop.
- Do not substitute your own review and imply it came from Claude.
- Do not automatically switch to `plan` after a failed `default` run.
- Do not pass the prompt after `--allowedTools`, because this CLI can consume it as another allowed tool and then fail with "Input must be provided..."
- Do not describe `--allowedTools` as a strict read-only sandbox. It pre-approves tools; it does not, by itself, ban other tools.
- Do not automatically fall back to giant `cat file1 file2 ... | claude ...` pipelines.
- Do not use the bundled wrapper unless the user explicitly asks for it or you are debugging the invocation itself.

## Critical Evaluation

Claude Code is a colleague, not an authority.

- Trust your own technical judgment when the repo contradicts Claude.
- Verify high-impact claims against the code or docs.
- If needed, resume the Claude session with a corrective prompt instead of silently accepting a bad conclusion.
