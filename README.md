# Heart of Gold Toolkit

> **Don't Panic.**

A Claude Code plugin marketplace for people who write, think, and build. Four plugins named after *The Hitchhiker's Guide to the Galaxy* — because if you're going to automate your creative process, you might as well have fun doing it.

## What It Does

The **Guide** plugin (the only one fully built so far) is a personal content pipeline. It:

- **Fetches** 100+ signals daily from RSS feeds, Gmail newsletters, and Hacker News
- **Analyzes** them against your themes and interests, scoring and deduplicating
- **Writes** a narrative morning brief ("here's what's happening"), 3 LinkedIn drafts, and blog outlines — in your voice
- **Delivers** the brief via iMessage (when used with the official iMessage plugin) or as committed files on GitHub
- **Captures** your daily thoughts — morning intentions and evening reflections — through interactive conversation
- **Learns** from your voice profile to avoid corporate jargon and maintain authenticity

The pipeline runs on a schedule (launchd or in-session crons), so you wake up to a brief that reads like a well-informed friend catching you up over coffee.

## Install

```
/plugin marketplace add ondrej-svec/heart-of-gold-toolkit
/plugin install guide@heart-of-gold-toolkit
```

## Plugins

| Plugin | Inspired by | What it does | Status |
|--------|-------------|-------------|--------|
| **[guide](plugins/guide/)** | The Hitchhiker's Guide | Content pipeline — briefs, LinkedIn drafts, captures, voice editing | **Active** — 3 skills, 2 agents, 300+ tests |
| **[deep-thought](plugins/deep-thought/)** | The Answer Computer | Reasoning — brainstorming, planning, investigation, CTO advisory | **Active** — 8 skills, 9 agents, 16 knowledge files |
| **[marvin](plugins/marvin/)** | The Paranoid Android | Quality — code review, knowledge compounding, work execution | **Active** — 3 skills, 2 agents, 3 knowledge files |
| **[babel-fish](plugins/babel-fish/)** | Universal Translator | Media — audio (ElevenLabs), image generation (Gemini/FLUX) | **Active** — 2 skills |

## The Guide Plugin

Three skills:

**`/guide:pipeline`** — The daily content engine. Five phases:
1. **Scout** — Fetch RSS, Gmail, HN signals via dedicated scripts
2. **Analyze** — Score against your themes, deduplicate, find 4-6 content angles (weighted: newsletters > HN)
3. **Create** — Narrative brief with "The Story" opening, 3+ LinkedIn drafts, weekly blog outline, YouTube/long-form ideas
4. **Edit** — Voice fidelity scoring (base 85, jargon -10, claims -5, threshold 75)
5. **Deliver** — Commit to git, push to GitHub, send rich iMessage brief with clickable links

**`/guide:capture`** — Daily thought capture. Works from terminal or via iMessage replies (when running with `--channels`). Morning and evening modes with gentle follow-ups and theme detection.

**`/guide:write-post`** — Guided blog writing. Seven phases from context gathering through audio narration.

## Two Ways to Run

### Option A: Scheduled one-shot (launchd)
```bash
# Copy and customize the launchd plist
cp plugins/guide/scripts/com.heart-of-gold.pipeline.plist ~/Library/LaunchAgents/
# Edit paths, schedule time, then load
launchctl load ~/Library/LaunchAgents/com.heart-of-gold.pipeline.plist
```

### Option B: Persistent session with iMessage (recommended)
```bash
# Start Claude with the iMessage channel
claude --channels plugin:imessage@claude-plugins-official

# Inside the session, set up scheduled crons
# (create your own /setup-session skill or use CronCreate directly)
```

This gives you two-way interaction: the pipeline sends briefs to your iMessage, you reply with thoughts for captures, give feedback on drafts, or ask questions about the day's signals.

## Configuration

Copy `plugins/guide/defaults/config.yaml` to `content/config.yaml` and customize:

```yaml
voice:
  reference: thoughts/writing-voice.md    # your voice profile
  tone: [vulnerable, honest, reflective]
  jargon_blocklist: [synergy, leverage, paradigm shift, ...]

themes:
  personal: [transformation, coaching, vulnerability]
  professional: [engineering leadership, AI tools, software craft]

sources:
  rss:
    - url: https://newsletter.pragmaticengineer.com/feed
      freshness_hours: 168
  gmail:
    enabled: true
    label: Content-Feed
    max_items: 20
  hackernews:
    enabled: true
    max_items: 30
```

See `defaults/config.yaml` for the full schema with all options documented.

## Requirements

- Claude Code
- Python 3.10+ with `feedparser` and `pyyaml`
- `jq` and `curl`
- Optional: `gws` CLI (Gmail newsletters), iMessage plugin (two-way delivery)
- macOS (for iMessage; pipeline works on any OS without notifications)

## License

MIT

---

*"The ships hung in the sky in much the same way that bricks don't."*
*Your content pipeline, however, actually works.*
