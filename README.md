# Heart of Gold Toolkit

> **Don't Panic.**

25 skills for AI coding agents. Five plugins. Works with **Claude Code, Codex, OpenCode, Pi**, and any tool supporting the [agentskills.io](https://agentskills.io) standard. Named after *The Hitchhiker's Guide to the Galaxy* because the universe is absurd and your tools should at least have personality.

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

### OpenCode
```bash
bunx @heart-of-gold/toolkit install --to opencode
```

### Pi Coding Agent
```bash
# Install shared skills into Pi's native skill directory
bunx @heart-of-gold/toolkit install --to pi

# Or install the package directly in Pi to get skills + pi-native extensions
pi install npm:@heart-of-gold/toolkit
```

Pi also discovers skills from the shared `~/.agents/skills/` location, so installs done with the OpenCode target are usable from Pi too.

When installed as a Pi package, Heart of Gold also exposes pi-native enhancement commands for flagship workflows:
- `/hog-brainstorm` — guided brainstorm intake for the shared `brainstorm` skill
- `/hog-plan` — planning mode entrypoint with pi-friendly tool defaults
- `/hog-work` — execution mode entrypoint with stronger work guardrails

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

6 skills · 2 agents · 3 knowledge files

```
/marvin:work         # execute plans — implement, test, commit, ship
/marvin:quick-review # fast opinionated quality pass (simplicity, tests, correctness)
/marvin:compound     # document solved problems for future reference
/marvin:redteam      # adversarial review — find weaknesses, expose with failing tests
/marvin:scaffold     # prepare project structure, configs, dependencies
/marvin:test-writer  # write failing tests from user stories
```

### [Guide](plugins/guide/) — The Hitchhiker's Guide

Your personal content engine.

Configurable sources (RSS, Gmail, HN, web search), narrative briefs, LinkedIn drafts, blog outlines, voice fidelity checking, iMessage delivery, and two-way captures.

6 skills · 2 agents · 4 scripts

```
/guide:setup       # configure your sources, themes, and voice
/guide:pipeline    # run the full content engine
/guide:capture     # morning/evening thought capture
/guide:write-post  # guided blog writing (7 phases)
/guide:codex       # Codex CLI guidance
/guide:gemini      # Gemini CLI guidance
```

### [Babel Fish](plugins/babel-fish/) — Universal Translator

Turn words into audio. Turn ideas into images. Visualize anything as a terminal mind map.

3 skills

```
/babel-fish:audio     # TTS, podcasts, voice cloning, sound effects
/babel-fish:image     # AI image generation and editing
/babel-fish:visualize # terminal mind maps from any structured content
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
- `pi install npm:@heart-of-gold/toolkit` installs the package directly in Pi, including the shared skills plus pi-native extensions

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
- **Guide plugin**: Python 3.10+, `feedparser`, `pyyaml`, `jq`, `curl`
- **Babel Fish audio**: ElevenLabs API key
- **Babel Fish image**: OpenRouter API key
- **iMessage delivery**: macOS (optional)

## Acknowledgments

**The Hitchhiker's Guide to the Galaxy** — Plugin names, quotes, and thematic elements are inspired by Douglas Adams' *The Hitchhiker's Guide to the Galaxy*. All Hitchhiker's Guide references are the intellectual property of the Estate of Douglas Adams. Used here as fan tribute, not commercial endorsement.

**Compound Engineering** — The cross-platform installer pattern (CLI structure, plugin loader, target converters) is adapted from [@every-env/compound-plugin](https://github.com/EveryInc/compound-engineering-plugin) by [EveryInc](https://every.to). Their open-source work on making Claude Code plugins portable to Codex and other tools made this possible.

**Agent Skills Standard** — Skills follow the [agentskills.io](https://agentskills.io) open specification, stewarded by the Agentic AI Foundation under the Linux Foundation.

## License

MIT

---

*"In the beginning the Universe was created. This has made a lot of people very angry and been widely regarded as a bad move."*

*This toolkit, on the other hand, has been regarded as mildly useful.*
