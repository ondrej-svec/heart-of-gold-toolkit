---
name: setup
description: Configure the Guide content pipeline by creating or updating content/config.yaml, sources, themes, and voice profile settings
---

# /guide:setup — Configure Your Content Pipeline

> "Would it save you a lot of time if I just gave up and went mad now?"
> No. Let's set this up properly instead.

Interactive setup for the Guide content pipeline. Creates your `content/config.yaml` by asking what you care about, where you get your information, and how you write.

Run this once. After that, `/guide:pipeline` handles everything.

## When This Runs

- **First time**: User runs `/guide:setup` directly, or `/guide:pipeline` detects no config and suggests it
- **Reconfiguration**: User runs `/guide:setup` again to add sources, change themes, etc. — existing config is read and updated, not overwritten

## Steps

### Step 1: Read Existing State

- Check if `content/config.yaml` already exists
- If yes, read it — this is a reconfiguration, not a fresh setup. Pre-fill answers from existing values.
- Check if `defaults/config.yaml` exists in the plugin directory for the schema reference

### Step 2: Voice Profile

Ask:

> "First — how do you write? Do you have an existing writing voice document, or should we figure it out together?"

**If they have a voice file**: Ask for the path (e.g., `thoughts/writing-voice.md`). Read it to confirm it looks like a voice profile.

**If they don't**: Ask a few questions to build one:
- "Describe your writing style in 3 words"
- "What kind of writing makes you cringe?" (these become anti-patterns)
- "Any corporate jargon that should never appear in your content?" (seed the blocklist)
- Write a basic voice profile to `thoughts/writing-voice.md` and reference it in config

### Step 3: Themes

Ask:

> "What topics matter to you? Think both personal (what you care about as a human) and professional (what you work on)."

Let them list freely. Organize into `themes.personal` and `themes.professional` in the config. Suggest categorization but don't force it.

If they're stuck, offer examples:
- Personal: transformation, fitness, creativity, parenting, travel, vulnerability
- Professional: engineering, AI, leadership, product, design, startups

### Step 4: Sources

Ask:

> "Where do you get your information? Let's set up your signal sources."

Walk through each source type:

**RSS feeds:**
> "Any blogs or newsletters you read regularly? Give me URLs or names and I'll find the RSS feeds."

- If they give names, search for the RSS feed URL (try common patterns: `/feed`, `/rss`, `/atom.xml`)
- Validate each feed actually returns entries
- Set sensible `freshness_hours` defaults (72 for daily, 168 for weekly)

**Gmail newsletters:**
> "Do you get newsletters via email? We can pull those in too."
> "You'll need the `gws` CLI installed and a Gmail label for the newsletters you want to process."

- If they want Gmail: help them pick a label name, explain they need to create a Gmail filter
- If not: set `gmail.enabled: false`

**Hacker News:**
> "Want Hacker News top stories in the mix? (default: yes, 30 stories)"

**Web search:**
> "Any specific topics you'd like web-searched daily? (optional)"

### Step 5: Content Cadence

Ask:

> "How often do you want to create content?"

- LinkedIn: posts per week (default 3), word range (default 150-300)
- Blog: frequency (default biweekly), word range (default 1000-2000)
- YouTube/long-form: interested yes/no

### Step 6: Notifications

Ask:

> "How do you want to receive your daily brief?"

Options:
- **iMessage** (recommended with `--channels`): ask for phone number
- **Slack**: ask for webhook URL
- **Files only**: no notifications, just read them in `content/daily/`

### Step 7: Write Config

- Generate `content/config.yaml` from all answers
- Create `content/` directory structure (`daily/`, `drafts/`, `pipeline/`, `captures/`)
- Show the config to the user for confirmation
- Save it

### Step 8: First Run

Ask:

> "Config saved. Want to run the pipeline now and see your first brief?"

If yes: run `/guide:pipeline`.

## Output

- `content/config.yaml` — the pipeline configuration
- `thoughts/writing-voice.md` — voice profile (if generated)
- `content/daily/`, `content/drafts/`, `content/pipeline/`, `content/captures/` directories created

## Edge Cases

- **Config already exists**: Read it, show current settings, ask what to change
- **RSS feed URL is invalid**: Skip it with a warning, don't block setup
- **No sources configured**: Warn that the pipeline will have limited signal, but allow it
- **User wants to skip steps**: Let them — every field has sensible defaults from `defaults/config.yaml`
