# /guide:pipeline — Daily Content Pipeline

> "Time is an illusion. Lunchtime doubly so." — But your daily brief runs on schedule.

Run the full content pipeline: fetch signals, analyze relevance, create daily brief + drafts, edit for voice fidelity, and deliver output with notifications.

## Prerequisites

- `content/config.yaml` in the user's project (falls back to plugin defaults if missing)
- Python 3.10+ with `feedparser` and `pyyaml`
- `jq` and `curl` on PATH
- Optional: `gws` CLI for Gmail, `osascript` for iMessage

---

## Phase 1: Scout (Fetch Sources)

Run all three fetch scripts to gather external signals. Read the user's config from `content/config.yaml`.

### Finding Scripts

The fetch scripts live in this plugin's `scripts/` directory. Determine the scripts path:
- If this plugin is at `heart-of-gold-toolkit/plugins/guide/`, use `heart-of-gold-toolkit/plugins/guide/scripts/`
- If installed via marketplace, use the plugin installation path's `scripts/` directory
- Locate by searching for `fetch-rss.py` in the project tree if unsure

### Steps

1. **Read config** from `content/config.yaml` (fall back to defaults/config.yaml if missing)
2. **Read voice reference** from the path in `voice.reference` config field
3. **Run fetch scripts** via Bash tool (adjust paths based on plugin location):
   - `python3 <scripts>/fetch-rss.py --config content/config.yaml` — RSS/Atom feeds
   - `bash <scripts>/fetch-gmail.sh --config content/config.yaml` — Gmail newsletters
   - `bash <scripts>/fetch-hn.sh --limit <config.sources.hackernews.max_items>` — Hacker News
4. **Read captures** from `content/captures/` (or configured `captures_dir`) — last 7 days of AM/PM captures
5. **Read recent daily briefs** — last 3 briefs from `content/daily/` for deduplication context
6. **Combine signals** into a single JSON array
7. **Write combined signals** to `content/pipeline/YYYY-MM-DD/signals.json`
   - If pipeline directory already exists for today, append run number (e.g., `signals-2.json`)
8. **Log and report** which sources succeeded and which failed with error details

### Edge Cases

- **All fetch scripts fail**: Notify user "no external signals today" and produce brief from captures only
- **No captures exist**: Proceed with external signals only — skip capture synthesis
- **Pipeline directory already exists**: If `signals.json` already exists, write `signals-2.json`, `signals-3.json`, etc.

---

## Phase 2: Analyze

Score, deduplicate, and group signals into content angles.

### Steps

1. **Score each signal 1-5** on relevance to the user's configured themes (both personal and professional)
2. **Deduplicate** against the last 3 daily briefs:
   - Skip signals whose URL has appeared in any of the last 3 briefs
   - Skip signals whose title has 85% or higher Jaccard similarity to a title in the last 3 briefs
3. **Group signals into 2-4 content angles**, each containing:
   - **Internal signal connection** — link to a capture or thought from the user
   - **External signal connection** — the source signal(s) that inspired this angle
   - **"Why now" hook** — what makes this angle timely today
   - **Suggested format** — LinkedIn post or blog post
4. **Rank angles** by strength: topic alignment + freshness + personal connection
5. **Cluster** multiple signals on the same topic into a single angle, citing all sources
6. **Write analysis** to `content/pipeline/YYYY-MM-DD/analysis.md`

### Edge Cases

- **Fewer than 3 signals**: Still produce angles — even 1 signal can be an angle
- **All signals deduplicated**: Produce a "quiet day" brief suggesting revisiting older angles
- **No personal connection found**: Flag `missing_voice` on the angle but still include it
- **Multiple signals on same topic**: Cluster them into one angle and cite all sources

---

## Phase 3: Create — Daily Brief

Generate the daily reading digest.

### Structure

The daily brief has three sections:

1. **What's on Your Mind** — synthesis of the user's recent captures (skip if no captures exist)
2. **Reading Digest** — 8-12 items organized into tiers:
   - **Must-Read** — highest relevance scores, direct alignment with user's themes
   - **Worth-a-Look** — interesting but not urgent
   - **Rabbit-Holes** — fascinating tangents for when there's time
3. **Content Ideas** — 2-4 ranked content angles from the analysis phase

Each digest item includes: title, URL, and a 1-2 sentence relevance hook explaining why it matters to the user specifically.

### Output

Write to `content/daily/YYYY-MM-DD.md` (or configured `daily_dir`) with YAML frontmatter:

```yaml
---
date: YYYY-MM-DD
sources_count: <number of sources that returned data>
signals_fetched: <total signals before dedup>
angles_count: <number of content angles>
---
```

### Edge Cases

- **Fewer than 8 signals**: Produce a smaller digest — don't pad with low-quality items
- **No captures**: Skip the "What's on Your Mind" section entirely
- **Signal has no readable content**: Use title + URL only and note "couldn't fetch full content"

---

## Phase 3B: Create — LinkedIn Draft

Generate a LinkedIn post draft from the strongest angle.

### Steps

1. Use the **#1 ranked (top/strongest) angle** from analysis
2. Write a **150-300 word** draft in the user's configured voice
3. Structure: **hook** → **personal connection** → **insight from signal** → **reflective question** ending
4. Reference specific signals with their URLs that inspired the angle
5. Write to `content/drafts/YYYY-MM-DD-linkedin.md` (or configured `drafts_dir`)

### Frontmatter

```yaml
---
date: YYYY-MM-DD
angle: <angle title>
sources: <list of source URLs>
word_count: <actual word count>
voice_score: <set by edit phase>
---
```

### Edge Cases

- **No strong angle today**: If no angle scores above the threshold, skip the LinkedIn draft and note in the brief "no strong angle today"
- **Sensitive angle** (e.g., leaving job, mental health): Flag for careful tone, add `sensitive: true` to frontmatter
- **Angle similar to recent post** (recency guard): If the top angle is too similar to a recent post, prefer the #2 angle and note in frontmatter
- **Missing voice reference file**: Fall back to config `tone` field defaults only (no voice profile check)

---

## Phase 3C: Create — Blog Outline

Generate a blog post outline only when the top angle is exceptionally strong.

### Triggering Condition

Only generate a blog outline when the top angle scores in the **top 10%** (configurable threshold). If blog cadence hasn't been met recently, lower the threshold slightly to encourage more outlines.

### Structure — Emotional Arc

The outline follows the emotional arc with **6-8 bullet points**, each with a 1-2 sentence description:

1. **Hook** — grab attention with an opening image or question
2. **Scene** — set the context for the reader
3. **Mess** — the challenge, conflict, or tension
4. **Moment** — the turning point or realization
5. **Reflection** — what you learned or how it changed you
6. **Soft landing** — gentle close, leaving the reader with something to carry

Each bullet notes which signals/captures feed into that section.

### Output

Write to `content/drafts/YYYY-MM-DD-blog-outline.md` with frontmatter:

```yaml
---
date: YYYY-MM-DD
angle: <angle title>
needs_write_post: true
---
```

### Edge Cases

- **Multiple strong angles**: Outline only the strongest angle, mention the runner-up in notes
- **Overlap with existing blog draft** in `blog/` directory: Note the overlap and suggest building on the existing draft
- **Blog cadence not met**: Lower threshold to encourage more outlines when cadence hasn't been met

---

## Phase 4: Edit — Voice Check

Scan all generated content against the user's voice profile.

### Checks

Scan the LinkedIn draft (and blog outline if present) for:

1. **Jargon blocklist** hits — flag any term from `voice.jargon_blocklist` in config (-10 per hit)
2. **Unverifiable statistical claims** — numbers without sources (-5 per claim)
3. **Sentences over 25 words** — flag long sentences (-5 per occurrence)
4. **Missing first-person voice** — content should use "I", "me", "my" (-10 if absent)
5. **Corporate/generic tone** — flag corporate-speak or generic motivational language (-5)

### Voice Fit Scoring

- **Base score: 85**
- Deductions:
  - Jargon blocklist hit: **-10** per term
  - Unverifiable claim: **-5** per claim
  - Long sentence (>25 words): **-5** per occurrence
  - Generic/corporate tone: **-5**
  - No first-person voice: **-10**

### Threshold Logic

- **Score >= 75**: Content is ready. Add `voice_score` to frontmatter. A score of exactly 75 passes (threshold is strictly < 75).
- **Score < 75**: Rewrite the content once, attempting to fix all flagged issues. Re-score after rewrite.
- **Still < 75 after rewrite**: Flag `needs_human_review: true` in frontmatter. Do not attempt further rewrites.

### Transparency

Log all edit changes in the pipeline state (`content/pipeline/YYYY-MM-DD/`) for transparency. Record what was flagged, what was changed, and the before/after scores.

### Edge Cases

- **Voice reference file is missing**: Skip detailed voice check; do basic jargon scan only
- **Score is exactly 75**: Pass — the threshold is `< 75`, not `<= 75`
- **All content flagged for review**: Still deliver the daily brief; just flag the drafts with `needs_human_review: true`

---

## Phase 5: Deliver

Write final output files and send notifications.

### Steps

1. **Ensure directories exist** — create `daily_dir`, `drafts_dir`, `pipeline_dir` if they don't exist (`mkdir -p`)
2. **Write daily brief** to configured `output.daily_dir` (e.g., `content/daily/YYYY-MM-DD.md`)
3. **Write LinkedIn draft** to configured `output.drafts_dir` (e.g., `content/drafts/YYYY-MM-DD-linkedin.md`)
4. **Write blog outline** to configured `output.drafts_dir` (if generated)
5. **Preserve pipeline state** in configured `output.pipeline_dir` (signals.json, analysis.md, edit log)
6. **File collision avoidance**: If a file already exists at the target path, append `-2`, `-3`, etc. to the filename before the extension
7. **Send notification** via configured channels using `<scripts>/notify.sh`:
   - Summary format: `"{N} signals today. Top angle: {angle_title}. Brief: {path}. Draft: {ready|needs review}"`
   - If notification fails, log the error but do NOT fail the pipeline — the brief has already been written
   - If all notifications are disabled in config, skip silently without logging an error

### Edge Cases

- **Output directory doesn't exist**: Create it with `mkdir -p`
- **Notification fails**: Log error, continue — don't fail the pipeline
- **All notifications disabled**: Skip silently
- **Pipeline ran twice today**: Second run creates `-2` suffixed files
