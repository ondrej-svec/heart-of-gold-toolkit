---
name: codex
description: Use when the user asks to run Codex CLI (codex exec, codex resume) or references OpenAI Codex for code analysis, refactoring, or automated editing
---

# Codex CLI Skill Guide

## Available Models

| Model | Best for |
| --- | --- |
| `gpt-5.5` | Flagship (released 2026-04-23) — complex coding, computer use, knowledge work, research workflows. **ChatGPT sign-in only — not available with API-key auth.** Fall back to `gpt-5.4` if not in the user's model picker yet. |
| `gpt-5.4` | Professional coding with strong reasoning + tool use. Default fallback when `gpt-5.5` is unavailable. |
| `gpt-5.4-mini` | Faster/cheaper for lighter coding tasks and subagents |
| `gpt-5.3-codex` | Complex software engineering with industry-leading coding capabilities |
| `gpt-5.3-codex-spark` | Near-instant real-time coding iteration (ChatGPT Pro research preview) |

Default recommendation: `gpt-5.5` for complex tasks (with `gpt-5.4` fallback), `gpt-5.4-mini` for speed.

## Running a Task
1. Ask the user (via `AskUserQuestion`) which model to use (default: `gpt-5.5`, fallback `gpt-5.4`) AND which reasoning effort (`xhigh`, `high`, `medium`, or `low`) in a **single prompt with two questions**.
2. Select the sandbox mode required for the task; default to `--sandbox read-only` unless edits or network access are necessary.
3. Assemble the command with the appropriate options:
   - `-m, --model <MODEL>`
   - `--config model_reasoning_effort="<xhigh|high|medium|low>"`
   - `--sandbox <read-only|workspace-write|danger-full-access>`
   - `--full-auto`
   - `-C, --cd <DIR>`
   - `--skip-git-repo-check`
   - `"your prompt here"` (as final positional argument)
4. Always use `--skip-git-repo-check`.
5. **IMPORTANT**: By default, append `2>/dev/null` to all `codex exec` commands to suppress thinking tokens (stderr). Only show stderr if the user explicitly requests to see thinking tokens or if debugging is needed.
6. Run the command, capture stdout/stderr (filtered as appropriate), and summarize the outcome for the user.
7. **After Codex completes**, inform the user: "You can resume this Codex session at any time by saying 'codex resume' or asking me to continue."

### Quick Reference
| Use case | Sandbox mode | Key flags |
| --- | --- | --- |
| Read-only review or analysis | `read-only` | `--sandbox read-only 2>/dev/null` |
| Apply local edits | `workspace-write` | `--sandbox workspace-write --full-auto 2>/dev/null` |
| Permit network or broad access | `danger-full-access` | `--sandbox danger-full-access --full-auto 2>/dev/null` |
| Resume recent session | Inherited from original | `echo "prompt" \| codex exec --skip-git-repo-check resume --last 2>/dev/null` |
| Run from another directory | Match task needs | `-C <DIR>` plus other flags `2>/dev/null` |

## Following Up
- After every `codex` command, immediately use `AskUserQuestion` to confirm next steps, collect clarifications, or decide whether to resume with `codex exec resume --last`.
- When resuming, pipe the new prompt via stdin: `echo "new prompt" | codex exec --skip-git-repo-check resume --last 2>/dev/null`. The resumed session automatically uses the same model, reasoning effort, and sandbox mode from the original session.
- Restate the chosen model, reasoning effort, and sandbox mode when proposing follow-up actions.

## Resuming Sessions
- Resume with new prompt: `echo "follow-up prompt" | codex exec --skip-git-repo-check resume --last 2>/dev/null`
- All flags must be inserted between `exec` and `resume`.
- When resuming, don't use configuration flags unless the user explicitly requests a different model or reasoning effort.

## Critical Evaluation of Codex Output

Codex is powered by OpenAI models with their own knowledge cutoffs and limitations. Treat Codex as a **colleague, not an authority**.

### Guidelines
- **Trust your own knowledge** when confident. If Codex claims something you know is incorrect, push back directly.
- **Research disagreements** using WebSearch or documentation before accepting Codex's claims. Share findings with Codex via resume if needed.
- **Remember knowledge cutoffs** — Codex may not know about recent releases, APIs, or changes that occurred after its training data.
- **Don't defer blindly** — evaluate suggestions critically, especially regarding model names, library versions, or evolving best practices.

### When Codex is Wrong
1. State your disagreement clearly to the user
2. Provide evidence (your own knowledge, web search, docs)
3. Optionally resume the Codex session to discuss the disagreement. **Identify yourself as Claude** so Codex knows it's a peer AI discussion:
   ```bash
   echo "This is Claude (<your current model name>) following up. I disagree with [X] because [evidence]. What's your take?" | codex exec --skip-git-repo-check resume --last 2>/dev/null
   ```
4. Frame disagreements as discussions, not corrections — either AI could be wrong
5. Let the user decide how to proceed if there's genuine ambiguity

## Error Handling
- Stop and report failures whenever `codex --version` or a `codex exec` command exits non-zero; request direction before retrying.
- Before using high-impact flags (`--full-auto`, `--sandbox danger-full-access`, `--skip-git-repo-check`) ask the user for permission using `AskUserQuestion` unless already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `AskUserQuestion`.

## Image Generation (codex ≥ 0.124.0-alpha.2)

Codex ships a built-in `image_gen` tool that uses OpenAI's `gpt-image-2` under the user's ChatGPT OAuth — **no `OPENAI_API_KEY` required**. To invoke it:

```bash
codex exec --skip-git-repo-check --sandbox workspace-write --full-auto \
  "Use your built-in image_gen tool to generate: <PROMPT>. After it returns, copy the file to <OUT_PATH> and print the path."
```

- Supported models (server-picked): `gpt-image-2` (default, newest), `gpt-image-1.5` (only one supporting `background=transparent`), `gpt-image-1`, `gpt-image-1-mini`.
- Quality: `low` | `medium` | `high` | `auto`. Sizes: `auto` or `WxH` with max edge ≤ 3840px, edges multiples of 16, 655k–8.3M total pixels.
- Output lands in `$CODEX_HOME/generated_images/<session>/<hash>.png` — ask the agent to copy to the user's target.
- Convenience wrapper (handles prompt assembly + output copy) is at `~/.claude/skills/image-gen/scripts/generate_image_codex.sh`; the `image-gen` skill documents the full UX. Prefer that wrapper over hand-rolling the codex invocation.
- Do **not** use codex's bundled fallback script `scripts/image_gen.py` — it requires an `OPENAI_API_KEY`, which is precisely what the built-in path avoids.
