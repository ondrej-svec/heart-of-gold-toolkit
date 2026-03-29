# Marvin — The Paranoid Android

> "Here I am, brain the size of a planet, and they ask me to review your code. Call that job satisfaction? 'Cause I don't."

A quality plugin for Claude Code. Three skills for the unglamorous work that compounds: reviewing code, documenting solutions, and executing plans end-to-end.

## Skills

### `/marvin:compound`
Document solved problems for future reference. Use after fixing non-trivial bugs, creating context for AI, or discovering patterns worth preserving. Writes structured solution docs that future sessions can search and learn from.

Knowledge compounds. Document solutions and future problems get cheaper.

### `/marvin:work`
Execute a plan from start to ship. Reads tasks from a plan document (produced by `/deep-thought:plan`), implements in dependency order, tests after every change, commits incrementally, runs quality checks, and pushes. The plan's checkboxes are the tracker.

### `/marvin:review`
Quality-focused code review with an emphasis on simplicity, correctness, and test integrity. Checks for YAGNI violations, premature abstractions, and code that solves problems that don't exist yet.

## Agents

| Agent | Focus |
|-------|-------|
| `knowledge-architect` | Builds and maintains structured knowledge docs — CLAUDE.md files, onboarding guides |
| `skill-reviewer` | Reviews SKILL.md files against quality criteria, grades A-F |

## Knowledge

| File | What it covers |
|------|---------------|
| `compounding-patterns` | How to write solution docs that compound value over time |
| `context-engineering` | Building context documents that AI consumes effectively |
| `active-memory-integration` | Patterns for retrieving and applying past solutions |

## Install

```
/plugin install marvin@heart-of-gold-toolkit
```
