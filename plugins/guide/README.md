# Guide — The Hitchhiker's Guide to Content Creation

> "A towel is about the most massively useful thing an interstellar hitchhiker can have."
> Your daily brief is pretty useful too.

The **Guide** plugin is an automated content creation pipeline for Claude Code. It fetches signals from RSS feeds, Gmail newsletters, and Hacker News, then produces a personalized daily reading digest, LinkedIn post drafts, and blog post outlines — all written in your authentic voice.

## Quick Start

1. **Install the plugin**:
   ```
   /plugin install guide
   ```

2. **Create your config** — copy the default configuration to your project:
   ```
   cp plugins/guide/defaults/config.yaml content/config.yaml
   ```
   Then customize `content/config.yaml` with your RSS feeds, themes, and voice profile.

3. **Run the pipeline**:
   ```
   /guide:pipeline
   ```
   This fetches signals, analyzes relevance, and generates your daily brief + drafts.

## Available Skills

### /guide:pipeline
The main content pipeline. Runs five phases:
1. **Scout** — Fetch signals from RSS, Gmail, Hacker News
2. **Analyze** — Score relevance, deduplicate, find content angles
3. **Create** — Generate daily brief, LinkedIn draft, blog outline
4. **Edit** — Voice fidelity check against your profile
5. **Deliver** — Write output files, send notifications

### /guide:capture
Daily thought capture for morning intentions or evening reflections. Works standalone — no pipeline dependency.

```
/guide:capture
```

### /guide:write-post
Guided 7-phase blog writing process: context, scaffold, dictate, shape, iterate, publish-prep, audio.

```
/guide:write-post
```

## Configuration Reference

The pipeline reads configuration from `content/config.yaml` in your project. See `defaults/config.yaml` for the full schema with comments.

### Key Sections

| Section | Purpose |
|---------|---------|
| `voice` | Voice profile path, tone keywords, jargon blocklist |
| `themes` | Personal and professional topics for relevance scoring |
| `sources` | RSS feeds, Gmail label, Hacker News settings |
| `cadence` | LinkedIn/blog posting frequency targets |
| `notifications` | iMessage and Slack notification settings |
| `output` | Directory paths for briefs, drafts, pipeline state |

### Voice Configuration

```yaml
voice:
  reference: thoughts/writing-voice.md  # path to your voice profile
  tone: [vulnerable, honest, reflective]
  jargon_blocklist:
    - synergy
    - leverage
    # ... 17 terms total
```

### Source Configuration

```yaml
sources:
  rss:
    - url: https://blog.pragmaticengineer.com/feed
      freshness_hours: 72
  gmail:
    enabled: true
    label: Content-Feed
    max_items: 20
  hackernews:
    enabled: true
    max_items: 30
```

## Example Output

Here's what a daily brief looks like:

```markdown
---
date: 2026-03-28
sources_count: 3
signals_fetched: 42
angles_count: 3
---

## What's on Your Mind

You've been thinking about the tension between shipping fast and maintaining
quality — yesterday's capture mentioned feeling pulled between "good enough"
and "right."

## Reading Digest

### Must-Read
- **[The Engineering Leader's Dilemma](https://example.com/post)** — Mirrors
  your current challenge with balancing speed and craft. The author's framework
  for "quality budgets" could be useful.

### Worth-a-Look
- **[AI Tools Are Changing How We Write](https://example.com/ai)** — Relevant
  to your AI product work. Interesting data on adoption patterns.

### Rabbit-Holes
- **[The History of Cycling in Czechia](https://example.com/cycling)** — Pure
  joy reading for your cycling interest.

## Content Ideas

1. **"Good Enough" Is a Leadership Decision** — Your capture about quality
   tension + the engineering dilemma article. Why now: you're living this.
   Format: LinkedIn post.
```

## Scheduling

The pipeline can run automatically via macOS launchd. See `scripts/com.heart-of-gold.pipeline.plist` for the launchd configuration.

Default schedule: **6:00 AM daily**.

### Setup

1. Copy the plist to `~/Library/LaunchAgents/`
2. Edit the `WorkingDirectory` to point to your project
3. Adjust the schedule time if needed — modify the `Hour` value in `StartCalendarInterval`
4. Load: `launchctl load ~/Library/LaunchAgents/com.heart-of-gold.pipeline.plist`

The pipeline uses a lock file at `content/pipeline/.pipeline.lock` to prevent duplicate concurrent runs. If the machine is asleep at the scheduled time, launchd runs the job on next wake.

Pipeline logs go to `content/logs/pipeline-stdout.log` and `content/logs/pipeline-stderr.log`.

The headless Claude invocation looks like:
```
claude -p "Run /guide:pipeline..." --allowedTools "Bash,Read,Write,Edit,Glob,Grep,WebFetch" --model sonnet
```

To customize the schedule time, edit the plist and change the `Hour` value.

## Dependencies

- Python 3.10+ with `feedparser` and `pyyaml`
- `curl` and `jq` on PATH
- Optional: `gws` CLI (Gmail), `osascript` (iMessage notifications)
