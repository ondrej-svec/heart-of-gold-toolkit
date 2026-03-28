# Heart of Gold Toolkit

> **Don't Panic.**

A Claude Code plugin marketplace themed after Douglas Adams's *The Hitchhiker's Guide to the Galaxy*. Four plugins, each named after a character or artifact from the HHGTTG universe, covering content creation, reasoning, quality, and media generation.

## Install

Install the full marketplace:

```
/plugin marketplace add ondrej-svec/heart-of-gold-toolkit
```

Or install individual plugins:

```
/plugin install guide
/plugin install deep-thought
/plugin install marvin
/plugin install babel-fish
```

## Plugins

| Plugin | Theme | Purpose | Status |
|--------|-------|---------|--------|
| **[guide](plugins/guide/README.md)** | The Hitchhiker's Guide | Content creation suite — automated pipeline, daily briefs, LinkedIn drafts, blog writing | Active |
| **[deep-thought](plugins/deep-thought/README.md)** | The Answer Computer (reasoning) | Brainstorming, planning, deep thinking, investigation | Stub (Phase 2) |
| **[marvin](plugins/marvin/README.md)** | The Paranoid Android (quality) | Code review, knowledge compounding, work execution | Stub (Phase 2) |
| **[babel-fish](plugins/babel-fish/README.md)** | Universal Translator (media) | Audio, image, and video content generation | Stub (Phase 3) |

### Guide — The Hitchhiker's Guide

Your personal content creation assistant. Fetches signals from RSS feeds, Gmail newsletters, and Hacker News, then produces a daily reading digest, LinkedIn drafts, and blog outlines — all in your authentic voice.

Skills: `/guide:pipeline`, `/guide:capture`, `/guide:write-post`

### Deep Thought — The Answer Computer

Reasoning tools for brainstorming ideas, planning features, and investigating complex problems. Currently a stub — will be ported from the superpowered-toolkit.

### Marvin — The Paranoid Android

Quality tools for exhaustive code review, documenting solved problems, and executing work plans with high standards. Currently a stub — will be ported from the superpowered-toolkit.

### Babel Fish — Universal Translator

Media generation tools for creating audio (text-to-speech, podcasts), images, and video content. Currently a stub — planned for Phase 3.

## Requirements

- Claude Code >= 1.0.33
- Python 3.10+ (for guide plugin scripts)
- macOS (for iMessage notifications, optional)

## License

MIT
