# Heart of Gold Toolkit

> **Don't Panic.**

Sixteen skills for Claude Code. Four plugins. Named after *The Hitchhiker's Guide to the Galaxy* because the universe is absurd and your tools should at least have personality.

```
/plugin marketplace add ondrej-svec/heart-of-gold-toolkit
```

---

## The Four Plugins

### [Guide](plugins/guide/) — The Hitchhiker's Guide

Your personal content engine. Wakes up at 2 AM, reads the internet for you, and texts you the highlights before coffee.

- **Configurable sources** — add your RSS feeds, Gmail newsletters, Hacker News, web search keywords. `/guide:setup` walks you through it in 2 minutes.
- **Narrative briefs** — opens with "here's what's happening in the world", not a bullet list
- **3 LinkedIn drafts** per day, each from a different angle
- **Weekly blog outlines** following an emotional arc
- **Voice fidelity** — checks everything against your writing profile (jargon detector, authenticity scoring)
- **Delivers to your phone** — commits to GitHub, sends a rich iMessage brief with clickable links
- **Two-way captures** — reply to a nudge on your phone, your thoughts feed tomorrow's brief

4 skills · 2 agents · 4 scripts · 300+ tests

```
/guide:setup       # configure your sources, themes, and voice (run once)
/guide:pipeline    # run the full content engine
/guide:capture     # morning/evening thought capture
/guide:write-post  # guided blog writing (7 phases)
```

### [Deep Thought](plugins/deep-thought/) — The Answer Computer

Eight ways to think clearly about hard problems.

Brainstorm before you plan. Plan before you build. Investigate when something breaks. Review when it ships. And when the stakes are high, simulate an expert panel that argues with itself until the right answer falls out.

The CTO skill is grounded in the actual leadership canon — Larson, Fournier, Majors, DHH, Fowler, Team Topologies, DORA. Not generic advice. Frameworks applied to your specific situation.

8 skills · 9 agents · 16 knowledge files

```
/deep-thought:brainstorm          # explore before committing
/deep-thought:plan                # structured planning with dependency ordering
/deep-thought:think               # expert panels, devil's advocate, tradeoff analysis
/deep-thought:investigate         # Sherlock + Poirot + Columbo root cause analysis
/deep-thought:review              # focused code review, one deep pass
/deep-thought:architecture-review # failure modes, scaling, ADRs
/deep-thought:cto                 # strategic CTO advisor
/deep-thought:craft-skill         # meta: generate SKILL.md files
```

### [Marvin](plugins/marvin/) — The Paranoid Android

The unglamorous work that compounds.

Review code with an emphasis on simplicity — catch YAGNI violations, premature abstractions, and code that solves problems that don't exist yet. Document solutions so the next person (or the next AI session) doesn't waste time re-discovering what you already figured out. Execute plans task by task with tests after every change.

3 skills · 2 agents · 3 knowledge files

```
/marvin:compound   # document solved problems for future reference
/marvin:work       # execute plans — implement, test, commit, ship
/marvin:review     # quality-focused code review
```

### [Babel Fish](plugins/babel-fish/) — Universal Translator

Turn words into audio. Turn ideas into images.

Text-to-speech, podcast narration, and voice cloning via ElevenLabs. Image generation and editing via Gemini and FLUX through OpenRouter.

2 skills

```
/babel-fish:audio  # TTS, podcasts, voice cloning, sound effects
/babel-fish:image  # AI image generation and editing
```

---

## Quick Start

Install the marketplace and whichever plugins you need:

```bash
# Add the marketplace
/plugin marketplace add ondrej-svec/heart-of-gold-toolkit

# Install what you want
/plugin install guide@heart-of-gold-toolkit
/plugin install deep-thought@heart-of-gold-toolkit
/plugin install marvin@heart-of-gold-toolkit
/plugin install babel-fish@heart-of-gold-toolkit
```

For the Guide plugin, run the setup wizard:

```
/guide:setup
```

It asks what you read, what you write about, and how you want to be notified. Takes about 2 minutes. Then it offers to run your first pipeline.

## Running the Guide on a Schedule

**Option A: One-shot via launchd** — headless, runs at a set time, exits when done.

**Option B: Persistent session with iMessage** — stays alive in tmux, sends briefs and capture nudges to your phone, you reply to do captures and give feedback. This is the recommended approach if you want two-way interaction.

See the [Guide README](plugins/guide/) for setup details.

## Requirements

- Claude Code
- Python 3.10+ with `feedparser` and `pyyaml` (Guide plugin)
- `jq` and `curl` (Guide plugin)
- ElevenLabs API key (Babel Fish audio)
- OpenRouter API key (Babel Fish image)
- macOS for iMessage delivery (optional — everything else works on any OS)

## License

MIT

---

*"In the beginning the Universe was created. This has made a lot of people very angry and been widely regarded as a bad move."*

*This toolkit, on the other hand, has been regarded as mildly useful.*
