# Heart of Gold Toolkit

> **Don't Panic.**

37 skills for AI coding agents. Five plugins. Works with **Claude Code, Codex, OpenCode, Pi**, and any tool supporting the [agentskills.io](https://agentskills.io) standard. Named after *The Hitchhiker's Guide to the Galaxy* because the universe is absurd and your tools should at least have personality.

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

The Codex target preserves the shared conversation-first policy: structured UI is optional for meaningful decisions or approvals, with plain-text answers and qualifications always valid. It rewrites actual skill-command references — both plain (`/plan`, `/work`) and plugin-prefixed (`/deep-thought:review`, `/marvin:compound`) — to Codex-style `$...` invocations without rewriting prose such as `read/review` or file paths.

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

Workflow replies now stay conversational: lists, progress reports, and questions never automatically open a form or call a second extraction model. Answer in plain text. If your separately installed workstation package provides `/answer`, you may invoke it yourself; Heart of Gold neither supplies nor requires it.

The automatic guided enhancer and `/deep-thought-guided-debug` are retired; there is no legacy-mode switch. Explicit launcher input dialogs and work-guard confirmations remain available in TUI and RPC.

Source **0.2.4** includes the accepted **`hog_ask`** native redesign: stable inline input, keyboard/fullscreen mouse navigation, and distinct **Approve as written / Request changes / Not now** intents. Decisions retain optional notes; approval feedback never silently becomes consent. Review precedes Send. Approval confirmation uses Enter after the opening key's release, or the explicitly accepted Tab → Enter fallback without release provenance. Print/JSON returns `unavailable`; no answer executes an action automatically.

Publication and local activation are separate: source commits and `/reload` alone do not replace a pinned immutable release. See the [0.2.4 rollout record](docs/plans/2026-09-14-chore-hog-ask-024-rollout-plan.md), [interaction architecture](docs/architecture/pi-guided-workflows.md), [native implementation proof](docs/reviews/2026-09-13-hog-ask-native-proof.md), and [historical 0.2.3 proof](docs/reviews/2026-09-13-hog-ask-proof.md).

The skills themselves enforce their own boundaries (read-only for brainstorm/plan, safe commands for work) via `allowed-tools` and prompt constraints — no manual mode switching needed.

The work extension also provides always-on guardrails that protect `.env`, `.git/`, and `node_modules/` from edits, block `git add .` and destructive `rm`, and require confirmation for `git push` / `npm publish`.

### List available skills
```bash
bunx @heart-of-gold/toolkit list
```

## Offline workstation guide — proof slice

Learn shell commands, finding, tmux, Neovim and writing workflows without an AI call:

```sh
node workstation/bin/workstation-guide.mjs "find a file"
node workstation/bin/workstation-guide.mjs doctor
```

The [workstation module](workstation/README.md) is Node-only and independently runnable. Search with optional fzf, then read complete Markdown lessons in Neovim; `--plain`/missing-editor fallbacks keep reference available everywhere. Opening a card never runs its examples. The host also delegates through `heart-of-gold workstation …`. An opt-in zsh `help` wrapper is included; sourcing it replaces that alias explicitly. Running the guide itself does not install aliases, change editor bindings or execute AI writing actions.

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

Ten ways to think clearly about hard problems.

Brainstorm before you plan. Plan before you build. Investigate when something breaks. Review when it ships. Map where it could go when you can't see the futures yet. And when the stakes are high, simulate an expert panel that argues with itself until the right answer falls out.

11 skills · 9 agents · 18 knowledge files

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
/deep-thought:improbable-futures  # product cartography — three lovable futures + visual map
/deep-thought:expert-panel        # multi-framework content review with convergent synthesis
```

### [Marvin](plugins/marvin/) — The Paranoid Android

The unglamorous work that compounds.

Execute plans task by task with tests after every change. Quick-review code with an emphasis on simplicity — catch YAGNI violations, premature abstractions, and code that solves problems that don't exist yet. Document solutions so the next person doesn't waste time re-discovering what you already figured out.

11 skills · 3 agents · 3 knowledge files

```
/marvin:work                 # execute plans — implement, test, commit, ship
/marvin:quick-review         # fast opinionated quality pass (simplicity, tests, correctness)
/marvin:compound             # document solved problems for future reference
/marvin:redteam              # adversarial review — find weaknesses, expose with failing tests
/marvin:scaffold             # prepare project structure, configs, dependencies
/marvin:harness-up           # install AGENTS.md doctrine, docs/ taxonomy, and verification rules
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
- `check:compat` protects the seven scoped shared skills (`brainstorm`, `plan`, `architect`, `think`, `investigate`, `review`, `work`) from harness-only interaction requirements. `npm run test:interactions` checks source/transformed policy passages, readiness scenarios, and command-token boundaries. These are static authoring checks, not proof of live-model question quality.

The [interaction contract](docs/architecture/interaction-contract.md) separates conversation, decisions, and progress. New plans default to draft; document status, phase readiness/preview review, and explicit execution intent remain distinct. Required work inside an authorized ready scope is executed, not offered as optional scope.

## Requirements

- **Codex/OpenCode/Pi**: Bun runtime (for `bunx`)
- **Claude Code**: No additional requirements
- **Guide plugin**: Python 3.10+, `feedparser`, `pyyaml`, `jq`, `curl`, `zip`
- **Babel Fish audio**: ElevenLabs API key
- **Babel Fish image**: Codex CLI ≥ 0.124.0-alpha.2 (default, uses ChatGPT OAuth), or `GEMINI_API_KEY`, or OpenRouter API key
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
