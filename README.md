# Heart of Gold Toolkit

> **Don't Panic.**

31 skills for AI coding agents. Five plugins. Works with **Claude Code, Codex, OpenCode, Pi**, and any tool supporting the [agentskills.io](https://agentskills.io) standard. Named after *The Hitchhiker's Guide to the Galaxy* because the universe is absurd and your tools should at least have personality.

## Installation

### Claude Code
```bash
/plugin marketplace add ondrej-svec/heart-of-gold-toolkit
/plugin install deep-thought@heart-of-gold-toolkit
```

### Codex
```bash
bunx @heart-of-gold/toolkit install --to codex
```

The Codex target also applies Codex-specific wording transforms for flagship shared skills so interactive flows like `brainstorm` and `plan` more strongly encourage Codex's structured user-input UI instead of falling back to plain text when richer selection UX is available. It also rewrites slash-command references in installed skill text — both plain (`/plan`, `/work`) and plugin-prefixed (`/deep-thought:review`, `/marvin:compound`) — to Codex-style `$...` skill invocations.

### OpenCode
```bash
bunx @heart-of-gold/toolkit install --to opencode
```

### Pi Coding Agent
```bash
# Option A: install the package directly in Pi to get skills + pi-native extensions
pi install npm:@heart-of-gold/toolkit

# Option B: install shared skills only into Pi's native skill directory
bunx @heart-of-gold/toolkit install --to pi
```

**Important:** choose one Pi install path or the other.
Do **not** use both the Pi package install and `install --to pi` at the same time, or Pi will report duplicate skill collisions on reload.

The CLI now refuses `install --to pi` when your Pi settings already reference `@heart-of-gold/toolkit` as a package. If you intentionally want both paths for debugging, rerun with `--force`.

Pi also discovers skills from the shared `~/.agents/skills/` location, so installs done with the OpenCode target are usable from Pi too.

When installed as a Pi package, Heart of Gold exposes Pi-native extension commands for the flagship workflows:
- `/deep-thought-brainstorm` — start a brainstorm (collaborative discovery)
- `/deep-thought-plan` — start planning (research and produce a plan document)
- `/deep-thought-architect` — turn brainstorm decisions into stories and architecture docs
- `/share-html` — publish an HTML file or static site directory through the portable `share-html` skill
- `/share-server-setup` — set up or adopt the local share server through the portable `share-server-setup` skill
- `/share-server-control` — control the local share server lifecycle through the portable `share-server-control` skill
- `/marvin-work` — start executing a plan (with always-on safety guardrails)

Pi package installs also include a Pi-only guided workflow enhancer for supported Heart of Gold skills. For `brainstorm`, `plan`, and `architect`, when the assistant asks a high-confidence structured question, Pi can upgrade it into a custom interactive TUI and feed the answer back into the same workflow. Shared skills remain plain-text portable in every other harness.

For extension debugging, Pi also exposes `/deep-thought-guided-debug` to toggle notices explaining when a guided prompt was extracted, skipped, dismissed, or answered.

The skills themselves enforce their own boundaries (read-only for brainstorm/plan, safe commands for work) via `allowed-tools` and prompt constraints — no manual mode switching needed.

The work extension also provides always-on guardrails that protect `.env`, `.git/`, and `node_modules/` from edits, block `git add .` and destructive `rm`, and require confirmation for `git push` / `npm publish`.

### List available skills
```bash
bunx @heart-of-gold/toolkit list
```

## Security & Trust

Some skills in this repository can, when configured by the user, interact with personal services and local tooling such as:

- Gmail and newsletter content
- iMessage or Slack notifications
- audio/image provider APIs
- external URLs discovered in newsletters or prompts

Treat skills and helper scripts as executable automation, not passive text. Review their contents before installing them, especially for plugins like **Guide** and **Babel Fish** that can access personal data or third-party services.

---

## The Five Plugins

### [Deep Thought](plugins/deep-thought/) — The Answer Computer

Nine ways to think clearly about hard problems.

Brainstorm before you plan. Plan before you build. Investigate when something breaks. Review when it ships. And when the stakes are high, simulate an expert panel that argues with itself until the right answer falls out.

9 skills · 9 agents · 16 knowledge files

```
/deep-thought:brainstorm          # explore before committing
/deep-thought:plan                # structured planning with dependency ordering
/deep-thought:think               # expert panels, devil's advocate, tradeoff analysis
/deep-thought:investigate         # Sherlock + Poirot + Columbo root cause analysis
/deep-thought:review              # focused code/doc/architecture review, one deep pass
/deep-thought:architect           # user stories, architecture doc, ADRs from brainstorm
/deep-thought:architecture-review # failure modes, scaling, ADRs
/deep-thought:cto                 # strategic CTO advisor (grounded in the leadership canon)
/deep-thought:craft-skill         # meta: generate SKILL.md files
```

### [Marvin](plugins/marvin/) — The Paranoid Android

The unglamorous work that compounds.

Execute plans task by task with tests after every change. Quick-review code with an emphasis on simplicity — catch YAGNI violations, premature abstractions, and code that solves problems that don't exist yet. Document solutions so the next person doesn't waste time re-discovering what you already figured out.

10 skills · 2 agents · 3 knowledge files

```
/marvin:work                 # execute plans — implement, test, commit, ship
/marvin:quick-review         # fast opinionated quality pass (simplicity, tests, correctness)
/marvin:compound             # document solved problems for future reference
/marvin:redteam              # adversarial review — find weaknesses, expose with failing tests
/marvin:scaffold             # prepare project structure, configs, dependencies
/marvin:test-writer          # write failing tests from user stories
/marvin:copy-editor          # two-layer copy editor (typography audit + LLM judgment)
/marvin:share-server-setup   # set up local artifact sharing infrastructure
/marvin:share-server-control # start, stop, and inspect local share server lifecycle
/marvin:share-html           # publish HTML/static output to a browser URL
```

### [Guide](plugins/guide/) — The Hitchhiker's Guide

Your personal content engine.

Configurable sources (RSS, Gmail, HN, web search), narrative briefs, LinkedIn drafts, blog outlines, voice fidelity checking, iMessage delivery, and two-way captures.

7 skills · 2 agents · 5 scripts

```
/guide:setup       # configure your sources, themes, and voice
/guide:pipeline    # run the full content engine
/guide:capture     # morning/evening thought capture
/guide:write-post  # guided blog writing (7 phases)
/guide:claude-code # Claude Code CLI guidance
/guide:codex       # Codex CLI guidance
/guide:gemini      # Gemini CLI guidance
```

### [Babel Fish](plugins/babel-fish/) — Universal Translator

Turn words into audio. Turn ideas into images. Visualize anything as a terminal mind map. Stitch screenshots into a LinkedIn-ready carousel PDF.

4 skills

```
/babel-fish:audio             # TTS, podcasts, voice cloning, sound effects
/babel-fish:image             # AI image generation and editing
/babel-fish:visualize         # terminal mind maps from any structured content
/babel-fish:linkedin-carousel # screenshots → LinkedIn document-post PDF with matched backgrounds
```

### [Quellis](plugins/quellis/) — AI Coaching Companion

ICF-grounded coaching methodology. Powerful questions, anti-sycophancy, structured reflection.

4 skills · 1 knowledge file

```
/quellis:coach        # ICF coaching conversation (FLOW + REVIEW frameworks)
/quellis:reflect      # guided reflection (FLOW, REVIEW, SCARF)
/quellis:goal-setting # SMART+V goal-setting with obstacle pre-mortem
/quellis:goal-checkin # accountability check-in with commitment scaling
```

---

## CLI Usage

The toolkit ships as an npm package with a CLI for installing skills into any supported tool:

- `--to pi` installs to Pi's native `~/.pi/agent/skills/`
- `--to opencode` installs to shared `~/.agents/skills/`, which Pi also discovers
- `pi install npm:@heart-of-gold/toolkit` adds the package to Pi settings, then Pi installs and loads it as a package with shared skills plus pi-native extensions

```bash
# Install all plugins into Codex
bunx @heart-of-gold/toolkit install --to codex

# Install all plugins into Pi
bunx @heart-of-gold/toolkit install --to pi

# Install a specific plugin
bunx @heart-of-gold/toolkit install deep-thought --to codex

# List all plugins and skills
bunx @heart-of-gold/toolkit list

# List skills in a specific plugin
bunx @heart-of-gold/toolkit list deep-thought

# Show supported targets
bunx @heart-of-gold/toolkit targets

# Manage the local share server reference implementation
bunx @heart-of-gold/toolkit share-server health
bunx @heart-of-gold/toolkit share-server install
```

## Release Safety

Before publishing to npm, run the safety checks:

```bash
npm run check:publish-safety
npm run check:security
npm run check:compat
```

- `check:publish-safety` verifies the `npm pack` file list and fails if the publish would include blocked files such as `.env` or obvious secrets such as private keys, Slack webhooks, GitHub tokens, npm tokens, or AWS access keys.
- `check:security` runs lightweight regression checks for sensitive Guide scripts and is also enforced in GitHub Actions.
- `check:compat` ensures the flagship shared skills (`brainstorm`, `plan`, `work`) keep their harness-neutral interaction contract rather than drifting toward pi-only or Claude-only assumptions.

## Requirements

- **Codex/OpenCode/Pi**: Bun runtime (for `bunx`)
- **Claude Code**: No additional requirements
- **Guide plugin**: Python 3.10+, `feedparser`, `pyyaml`, `jq`, `curl`, `zip`
- **Babel Fish audio**: ElevenLabs API key
- **Babel Fish image**: OpenRouter API key
- **iMessage delivery**: macOS (optional)
- **Private tailnet viewer exposure**: Tailscale CLI (optional)

## Acknowledgments

**The Hitchhiker's Guide to the Galaxy** — Plugin names, quotes, and thematic elements are inspired by Douglas Adams' *The Hitchhiker's Guide to the Galaxy*. All Hitchhiker's Guide references are the intellectual property of the Estate of Douglas Adams. Used here as fan tribute, not commercial endorsement.

**Compound Engineering** — The cross-platform installer pattern (CLI structure, plugin loader, target converters) is adapted from [@every-env/compound-plugin](https://github.com/EveryInc/compound-engineering-plugin) by [EveryInc](https://every.to). Their open-source work on making Claude Code plugins portable to Codex and other tools made this possible.

**Agent Skills Standard** — Skills follow the [agentskills.io](https://agentskills.io) open specification, stewarded by the Agentic AI Foundation under the Linux Foundation.

## License

MIT

---

*"In the beginning the Universe was created. This has made a lot of people very angry and been widely regarded as a bad move."*

*This toolkit, on the other hand, has been regarded as mildly useful.*
