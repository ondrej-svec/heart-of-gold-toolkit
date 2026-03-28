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

### Source Weighting

Not all sources are equal. When scoring, apply these multipliers:

- **Newsletter/RSS signals (Pragmatic Engineer, SWLW, Every, Lenny, Exponential View, Ozan Varol)**: **1.5x weight** — these are curated by humans the user trusts. A mediocre newsletter item beats a mediocre HN item.
- **Gmail newsletters (TLDR, Morning Brew)**: **1.2x weight** — curated but broader scope.
- **HN signals**: **1.0x weight (base)** — high volume, high noise. Only HN items scoring 200+ on HN itself should be considered "must-read" tier.
- **Voice captures**: **2.0x weight** — the user's own thoughts are the highest-value input. Any angle that connects to a capture gets a significant boost.

### Steps

1. **Score each signal 1-5** on relevance to the user's configured themes (both personal and professional), then apply source weighting
2. **Deduplicate** against the last 3 daily briefs:
   - Skip signals whose URL has appeared in any of the last 3 briefs
   - Skip signals whose title has 85% or higher Jaccard similarity to a title in the last 3 briefs
3. **Group signals into 4-6 content angles**, each containing:
   - **Internal signal connection** — link to a capture or thought from the user
   - **External signal connection** — the source signal(s) that inspired this angle
   - **"Why now" hook** — what makes this angle timely today
   - **Suggested format** — LinkedIn post, blog post, or YouTube/long-form rant
4. **Rank angles** by strength: topic alignment + freshness + personal connection + source weight
5. **Cluster** multiple signals on the same topic into a single angle, citing all sources
6. **Tag each angle** with a content type:
   - **LinkedIn** — short, punchy, personal insight (150-300 words). Aim for at least 3 LinkedIn-worthy angles.
   - **Blog** — longer narrative, emotional arc (1000-2000 words). Flag ~1 per week.
   - **YouTube/Rant** — topics that deserve deeper unpacking, opinions, or real talk. Things you'd want to talk through on camera. Flag when you feel heat in the angle.
7. **Write analysis** to `content/pipeline/YYYY-MM-DD/analysis.md`

### Edge Cases

- **Fewer than 3 signals**: Still produce angles — even 1 signal can be an angle
- **All signals deduplicated**: Produce a "quiet day" brief suggesting revisiting older angles
- **No personal connection found**: Flag `missing_voice` on the angle but still include it
- **Multiple signals on same topic**: Cluster them into one angle and cite all sources

---

## Phase 3: Create — Daily Brief

Generate the daily reading digest — a document worth reading with your morning coffee.

### Structure

The daily brief has four sections:

1. **The Story** (opening narrative, ~300-500 words) — Weave the strongest signals into a coherent narrative about what's happening in the world RIGHT NOW. Don't list items — tell a story. Connect the dots between seemingly unrelated signals. What's the thread? What's the tension? What's shifting?

   **How to write The Story:**
   - Read across ALL the top signals — newsletters, HN, RSS, captures — and find the narrative thread that connects 3-5 of them
   - Write it like a smart friend catching you up over coffee: "So here's what's happening..."
   - Name the tension or contradiction if there is one (e.g., "Everyone's building AI agents while simultaneously proving they can't be trusted")
   - Ground it in specifics — cite actual articles, actual numbers, actual quotes
   - If the user has recent captures, weave their personal context into the story naturally ("...and you're living this — your capture from Tuesday about X maps directly onto...")
   - End with a provocative observation or question that sets up the reading list below
   - This is NOT a summary. It's a narrative. It should feel like the opening of a well-written newsletter.

2. **Reading List** — 8-12 items minimum (up to 15 when signal is strong), organized into tiers:
   - **Must-Read** (3-5) — highest relevance scores, direct alignment with user's themes. Each gets a title, URL, and a 1-2 sentence hook explaining why it matters to YOU specifically.
   - **Worth-a-Look** (3-5) — interesting but not urgent. One line each with URL.
   - **Rabbit-Holes** (2-3) — fascinating tangents for when there's time. One line each.

3. **Content Ideas** — 4-6 ranked content angles from the analysis phase, tagged by format (LinkedIn / Blog / YouTube)

4. **What's on Your Mind** — synthesis of the user's recent captures (skip if no captures in last 7 days). If present, place after The Story as a bridge to the reading list.

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

- **Fewer than 8 signals**: Produce a smaller digest — don't pad with low-quality items. The Story can still be written from even 3-4 strong signals.
- **No captures**: Skip the "What's on Your Mind" section entirely
- **Signal has no readable content**: Use title + URL only and note "couldn't fetch full content"
- **No clear narrative thread**: Fall back to a "three things worth knowing today" structure rather than forcing a bad story

---

## Phase 3B: Create — LinkedIn Drafts (3 minimum)

Generate **at least 3 LinkedIn post drafts**, each from a different angle. The user picks the best one.

### Steps

1. Take the **top 3 ranked LinkedIn-tagged angles** from analysis
2. For each angle, write a **150-300 word** draft in the user's configured voice
3. Structure: **hook** → **personal connection** → **insight from signal** → **reflective question** ending
4. Each draft should feel genuinely different — different tone, different entry point, different vulnerability level. Don't just rephrase the same take three times.
5. Reference specific signals with their URLs
6. Write all 3 to separate files:
   - `content/drafts/YYYY-MM-DD-linkedin-1.md`
   - `content/drafts/YYYY-MM-DD-linkedin-2.md`
   - `content/drafts/YYYY-MM-DD-linkedin-3.md`

### Frontmatter (per file)

```yaml
---
date: YYYY-MM-DD
draft: 1  # or 2, 3
angle: <angle title>
sources: <list of source URLs>
word_count: <actual word count>
voice_score: <set by edit phase>
---
```

### Edge Cases

- **Fewer than 3 LinkedIn angles**: Write as many as you have. Even 1 is better than 0.
- **Sensitive angle** (e.g., leaving job, mental health): Flag for careful tone, add `sensitive: true` to frontmatter
- **Angle similar to recent post** (recency guard): If an angle is too similar to a recent post, skip it and use the next one
- **Missing voice reference file**: Fall back to config `tone` field defaults only

---

## Phase 3C: Create — Blog Outline (weekly)

Generate a blog post outline approximately **once per week** — when a strong angle appears that deserves deeper treatment.

### Triggering Condition

Generate a blog outline when:
- The top angle scores in the **top 10%** (configurable threshold), OR
- It's been more than 7 days since the last blog outline was generated (check `content/drafts/` for `*-blog-outline.md` files), OR
- An angle explicitly connects a personal capture to an external trend (the "intersection" is blog material)

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

- **Multiple strong angles**: Outline only the strongest, mention the runner-up in notes
- **Overlap with existing blog draft** in `blog/` directory: Note the overlap and suggest building on the existing draft
- **Blog cadence not met**: Lower threshold to encourage more outlines when it's been too long since the last one

---

## Phase 3D: Create — YouTube / Long-Form Ideas

Surface topics that deserve deeper unpacking — rants, opinions, real talk that's too meaty for a LinkedIn post and too raw for a polished blog.

### Triggering Condition

Generate a YouTube/long-form idea when:
- An angle generates strong personal heat (connects to frustration, passion, or a contrarian take)
- Multiple signals cluster around a debate where the user has lived experience
- A topic keeps recurring across multiple days (the pipeline should notice this)

### Output

Append to the **Content Ideas** section of the daily brief (not a separate file). Format:

```
### 🎙️ YouTube / Deep Dive: {topic}
Why this has legs: {1-2 sentences on why this deserves 10+ minutes of talking, not 200 words}
Signals: {list of sources}
The rant seed: {one provocative sentence that could be the opening line on camera}
```

This is a suggestion, not a draft. The user decides if it's worth pursuing.

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

Write final output files, commit & push to GitHub, and send an iMessage with links.

### Steps

1. **Ensure directories exist** — create `daily_dir`, `drafts_dir`, `pipeline_dir` if they don't exist (`mkdir -p`)
2. **Write daily brief** to configured `output.daily_dir` (e.g., `content/daily/YYYY-MM-DD.md`)
3. **Write LinkedIn draft** to configured `output.drafts_dir` (e.g., `content/drafts/YYYY-MM-DD-linkedin.md`)
4. **Write blog outline** to configured `output.drafts_dir` (if generated)
5. **Preserve pipeline state** in configured `output.pipeline_dir` (signals.json, analysis.md, edit log)
6. **File collision avoidance**: If a file already exists at the target path, append `-2`, `-3`, etc. to the filename before the extension
7. **Commit and push to GitHub:**
   - `git add` the daily brief, drafts, and pipeline state files
   - Commit with message: `content: daily brief YYYY-MM-DD — {N} signals, angle: {angle_title}`
   - `git push origin main`
   - Determine the GitHub repo URL from `git remote get-url origin` (convert SSH to HTTPS if needed)
   - Build GitHub links to the committed files: `https://github.com/{owner}/{repo}/blob/main/{file_path}`
8. **Send iMessage morning brief** — the primary delivery. Self-contained mini-brief with GitHub links you can tap and read on your phone. Send via `osascript` (AppleScript → Messages.app):

   **iMessage format — The Morning Signal:**

   ```
   ☕ Morning Brief — {date}

   {If captures exist: one punchy sentence about what's on your mind, drawn from recent captures}

   📰 {N} signals scanned. Here's what matters:

   1. {Must-Read #1 title} — {one sentence: why it matters to YOU specifically, not a generic summary}

   2. {Must-Read #2 title} — {one sentence: the insight or tension that makes this worth 5 minutes}

   3. {Must-Read #3 title} — {one sentence: the connection to your work or life}

   💡 Today's angle: "{angle title}"
   {Two sentences max: the hook of the LinkedIn draft — make it feel like a teaser that pulls the most provocative or vulnerable thread and makes you want to go write}

   📄 {GitHub link to daily brief}
   ✏️ {GitHub link to LinkedIn draft}
   ```

   **Rules for the iMessage:**
   - Write it like a friend texting you the highlights, not like a system notification
   - Each must-read gets ONE sentence that answers "why should I care about this TODAY"
   - The angle teaser should make you itch to write — pull the most provocative or vulnerable thread
   - No metadata, no word counts — just signal and spark
   - End with tappable GitHub links to the brief and draft
   - Keep total length under 280 words (roughly 1 phone screen)
   - If no strong angle today, replace the angle section with: "No burning angle today. The brief has rabbit holes worth exploring when you have coffee."

   **Sending:** Use osascript directly via Bash tool:
   ```bash
   osascript -e 'tell application "Messages"
     set targetService to id of 1st account whose service type = iMessage
     set theBuddy to participant "<recipient>" of account id targetService
     send "<message>" to theBuddy
   end tell'
   ```
   Read the recipient from `notifications.imessage.recipient` in config. Escape any double quotes in the message.

   - If iMessage fails (osascript error or timeout), log the error but do NOT fail the pipeline — the brief and draft are already committed and pushed
   - If notifications are disabled in config, skip silently

### Edge Cases

- **Output directory doesn't exist**: Create it with `mkdir -p`
- **Git push fails**: Log error, still send iMessage with local file paths as fallback
- **Notification fails**: Log error, continue — don't fail the pipeline
- **All notifications disabled**: Skip silently
- **Pipeline ran twice today**: Second run creates `-2` suffixed files
