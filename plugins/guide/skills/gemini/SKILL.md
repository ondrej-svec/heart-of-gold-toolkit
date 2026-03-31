---
name: gemini
description: Use when the user asks to run Gemini CLI (gemini, gemini resume) or references Google Gemini for code analysis, refactoring, or automated editing
---

# Gemini CLI Skill Guide

## Available Models

| Model | Best for |
| --- | --- |
| `gemini-3.1-pro` | Most capable — complex reasoning, agentic tasks, coding, long-context |
| `gemini-3-flash` | High-performance at lower cost, general-purpose |
| `gemini-3.1-flash-lite` | Fastest and cheapest — lightweight tasks, high-volume |
| `gemini-2.5-pro` | Advanced reasoning, deep coding (stable, well-tested) |
| `gemini-2.5-flash` | Best price-performance ratio, low-latency |

Default recommendation: `gemini-3.1-pro` for complex tasks, `gemini-3-flash` for speed.

## Running a Task
1. Ask the user (via `AskUserQuestion`) which model to use (default: `gemini-3.1-pro`) AND which approval mode (`default`, `auto_edit`, `yolo`, or `plan`) in a **single prompt with two questions**.
2. Assemble the command:
   - `-m, --model <MODEL>` — the model to use
   - `--approval-mode <MODE>` — `default` (prompt), `auto_edit` (auto-approve edits), `yolo` (auto-approve all), `plan` (read-only)
   - `-p, --prompt "<PROMPT>"` — run in non-interactive (headless) mode
   - `-o text` — text output format for clean parsing
3. Run the command, capture output, and summarize the outcome for the user.
4. **After Gemini completes**, inform the user: "You can resume this Gemini session at any time by saying 'gemini resume' or asking me to continue."

### Quick Reference
| Use case | Approval mode | Key flags |
| --- | --- | --- |
| Read-only review or analysis | `plan` | `--approval-mode plan -o text` |
| Apply local edits (auto-approve edits) | `auto_edit` | `--approval-mode auto_edit -o text` |
| Full auto (approve everything) | `yolo` | `-y -o text` |
| Resume recent session | Inherited | `-r latest -p "new prompt" -o text` |
| Include extra directories | Match task needs | `--include-directories <DIR>` |

## Following Up
- After every `gemini` command, immediately use `AskUserQuestion` to confirm next steps, collect clarifications, or decide whether to resume.
- When resuming, use: `gemini -r latest -p "new prompt" -o text`. The resumed session uses the same context from the original session.
- Restate the chosen model and approval mode when proposing follow-up actions.

## Resuming Sessions
- Resume the latest session: `gemini -r latest -p "follow-up prompt" -o text`
- Resume by index: `gemini -r 5 -p "follow-up prompt" -o text`
- List available sessions: `gemini --list-sessions`

## Critical Evaluation of Gemini Output

Gemini is powered by Google models with their own knowledge cutoffs and limitations. Treat Gemini as a **colleague, not an authority**.

### Guidelines
- **Trust your own knowledge** when confident. If Gemini claims something you know is incorrect, push back directly.
- **Research disagreements** using WebSearch or documentation before accepting Gemini's claims.
- **Remember knowledge cutoffs** — Gemini may not know about recent releases, APIs, or changes.
- **Don't defer blindly** — evaluate suggestions critically, especially regarding model names, library versions, or evolving best practices.

### When Gemini is Wrong
1. State your disagreement clearly to the user
2. Provide evidence (your own knowledge, web search, docs)
3. Optionally resume the Gemini session to discuss the disagreement. **Identify yourself as Claude** so Gemini knows it's a peer AI discussion:
   ```bash
   gemini -r latest -p "This is Claude (<your current model name>) following up. I disagree with [X] because [evidence]. What's your take?" -o text
   ```
4. Frame disagreements as discussions, not corrections — either AI could be wrong
5. Let the user decide how to proceed if there's genuine ambiguity

## Error Handling
- Stop and report failures whenever `gemini --version` or a `gemini` command exits non-zero; request direction before retrying.
- Before using `--approval-mode yolo` or `-y`, ask the user for permission using `AskUserQuestion` unless already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `AskUserQuestion`.
