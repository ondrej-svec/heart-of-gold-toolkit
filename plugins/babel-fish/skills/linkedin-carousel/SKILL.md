---
name: linkedin-carousel
description: >
  Turn a set of screenshots or images into a LinkedIn document-post PDF (carousel)
  with per-page background matching so padding disappears into the source.
  Triggers: linkedin carousel, carousel pdf, document post, slide pdf, screenshots to pdf, linkedin pdf, carousel from images.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

# LinkedIn Carousel — Babel Fish

Translating a stack of screenshots into a feed-ready document post. The trick isn't the PDF — it's making the padding invisible.

## Boundaries

- **MAY:** read source images, run `magick`, write PNGs and PDFs to the requested output path.
- **MAY NOT:** upload to LinkedIn, post on the user's behalf, or modify the source images in place.

## Prerequisites

- ImageMagick installed (`magick` on PATH). Check with `which magick`.
- Sources are raster images (PNG/JPG). For non-image inputs, ask the user to export first.

## Phase 0 — Understand

**Entry:** User asked for a LinkedIn carousel.

Gather, asking only what's missing:

- **Sources**: ordered list of image paths (order = page order in the carousel).
- **Slug**: kebab-case filename for the PDF (e.g. `harness-lab-carousel`). If the user gives a topic, derive it; otherwise ask.
- **Output path**: default `thoughts/social-media/carousels/<slug>.pdf` if the repo has that dir; otherwise ask.
- **Aspect preference**: portrait (best feed performance), square, or landscape. If the user has no preference, **infer from sources** in Phase 1.

**Exit:** Source list, output path, and aspect intent are known.

## Phase 1 — Plan

**Entry:** Inputs gathered.

Reason step-by-step before generating:

1. Run `magick identify` on each source to get width × height.
2. **Pick canvas aspect** to minimize padding:
   - User asked for portrait → `1080×1350` (×2 = `2160×2700`).
   - User asked for square → `1080×1080` (×2 = `2160×2160`).
   - **No preference** → if the sources cluster around one aspect, pick the **median** w/h ratio — this minimizes total padding across the deck. If sources span a wide range (e.g. 1.6:1 → 2.6:1), pick the aspect that makes the *most* pages padding-free, and accept that the outliers will get bands.
3. **Sample background color per page** — the move that makes seams invisible. Need the dimensions first, then sample three corners:
   ```bash
   read W H < <(magick identify -format "%w %h" "$src")
   magick "$src" -format \
     "tl=%[pixel:p{5,5}] tr=%[pixel:p{$((W-5)),5}] bl=%[pixel:p{5,$((H-5))}]\n" \
     info:
   ```
   If all three corners agree, use that color. If they disagree, the source has no clean border — fall back to `#F4EFE3` (or another neutral the user prefers) and tell them.
4. Render at **2× target resolution** with Lanczos resampling. 300 DPI in the final PDF.

**Exit:** Canvas dimensions chosen, per-page background colors sampled.

## Phase 2 — Build

**Entry:** Plan complete.

Write the build script to a temp file (avoids shell quoting traps), then run it:

```bash
#!/bin/bash
set -e
OUT=/path/to/output/dir
SLUG=harness-lab-carousel        # from Phase 0
CANVAS=2160x2700                 # from Phase 1
declare -a SRCS=(/path/1.png /path/2.png /path/3.png)
declare -a BGS=('#EFF1F5' '#EFF1F5' '#F2ECEB')   # from Phase 1 sampling

mkdir -p "$OUT"
PAGES=()
for i in "${!SRCS[@]}"; do
  # Zero-pad page number so glob ordering survives 10+ pages.
  n=$(printf "%02d" $((i+1)))
  page="$OUT/page${n}.png"
  magick "${SRCS[$i]}" \
    -filter Lanczos \
    -resize "$CANVAS" \
    -background "${BGS[$i]}" \
    -gravity center \
    -extent "$CANVAS" \
    -quality 95 \
    "$page"
  PAGES+=("$page")
done

# Pass pages explicitly in array order — never rely on shell glob ordering.
magick "${PAGES[@]}" -density 300 -quality 95 "$OUT/${SLUG}.pdf"
```

**Notes:**
- `-resize WxH` (without `>` or `!`) fits inside the box preserving aspect; `-extent` then pads to exact canvas using `-background`.
- Pages are passed to the final `magick` call from the `PAGES` array, not via glob — `page*.png` would put `page10.png` before `page2.png` lexicographically and reorder the carousel.
- Keep the intermediate `page*.png` files — useful for spot fixes without rebuilding everything.
- LinkedIn document posts cap at **100 MB** and **300 pages**. A 3–10 page carousel at 2× is typically 1–5 MB.

**Exit:** PDF and page PNGs exist at the output path.

## Phase 3 — Review

**Entry:** PDF built.

Open the PDF for the user (`open <path>` on macOS). Report:

- Output path
- Page count, canvas dimensions, file size
- Per-page background colors used
- Any fallbacks (e.g., "page 2's corners disagreed — used neutral cream")

Ask whether any page needs a different aspect or a tighter crop. Common follow-ups:

- "Page X has too much padding" → re-sample with a different canvas aspect, or crop that source before rebuilding.
- "Backgrounds don't match" → the source likely has anti-aliased edges; sample further from the corner (`{20,20}`).
- "Quality looks soft" → confirm 2× and Lanczos; check the source isn't already low-res.

## Constraints

- Never modify source images in place.
- Never upload, share, or post the output. Hand the file to the user.
- Default to per-page background sampling. Single-color fallback only when sources disagree.
- Always render at 2× target and downsample at PDF assembly time — not the other way around.
- Keep the intermediate PNGs unless the user asks to clean them up.

## Output

The user receives:

- `<output-dir>/<slug>.pdf` — the carousel, ready to upload via LinkedIn's "Add a document".
- `<output-dir>/page1.png`, `page2.png`, … — per-page renders for inspection.
- A short summary message with path, dimensions, page count, and any fallbacks taken.
