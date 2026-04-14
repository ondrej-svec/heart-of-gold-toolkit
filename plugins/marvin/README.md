# Marvin — The Paranoid Android

> "Here I am, brain the size of a planet, and they ask me to review your code. Call that job satisfaction? 'Cause I don't."

A quality plugin for Claude Code. Ten skills for the unglamorous work that compounds: executing plans, reviewing code, documenting solutions, scaffolding projects, writing failing tests, adversarial review, keeping copy clean, publishing browser-viewable artifacts, and controlling the local share server lifecycle.

## Skills

### `/marvin:work`
Execute a plan from start to ship. Reads tasks from a plan document (produced by `/deep-thought:plan`), implements in dependency order, tests after every change, commits incrementally, runs quality checks, and pushes. The plan's checkboxes are the tracker.

### `/marvin:quick-review`
Fast opinionated quality pass with an emphasis on simplicity, test integrity, and correctness. One pass, one voice. Catches YAGNI violations, premature abstractions, and code that solves problems that don't exist yet. For depth, use `/deep-thought:review`.

### `/marvin:compound`
Document solved problems for future reference. Use after fixing non-trivial bugs, creating context for AI, or discovering patterns worth preserving. Writes structured solution docs that future sessions can search and learn from.

Knowledge compounds. Document solutions and future problems get cheaper.

### `/marvin:redteam`
Adversarial review — find weaknesses and expose them with failing tests. Checks architecture conformance, stub detection, security, and story completeness. Never modifies implementation.

### `/marvin:scaffold`
Prepare a project for development — create directories, configs, install dependencies. Never creates source or test files. Standalone or pipeline-aware.

### `/marvin:test-writer`
Write failing tests from user stories and architecture docs. Behavioral tests verify WHAT (acceptance criteria); conformance tests verify HOW (architecture compliance). All tests must start in the RED state.

### `/marvin:copy-editor`
Two-layer copy editor. Layer 1 is a deterministic typography audit (regex-level, auto-closeable). Layer 2 is LLM judgment — reject-list hits, nominal-style detection, clarity/ambiguity pass for participant-facing content, voice/register check, and spoken-readability read. Loads repo-local `.copy-editor.yaml` to compose the baked-in language profile with the repo's style guide.

### `/marvin:share-server-setup`
Set up or adopt a local share server for browser-viewable coding-agent artifacts. Supports configuring an existing compatible server, installing the Heart of Gold reference share server, adding macOS LaunchAgent persistence, and optionally exposing only the viewer surface over `tailscale serve`.

### `/marvin:share-html`
Publish a local HTML file or static site directory to the configured share server and return a browser URL. Supports a single `.html` file or a directory containing `index.html`.

### `/marvin:share-server-control`
Control the local share server after setup. Use it to check status, start or stop the macOS LaunchAgent-backed reference server, restart it, or enable or disable private Tailscale viewer exposure.

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
