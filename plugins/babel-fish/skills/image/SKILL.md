---
name: image
description: >
  AI image generation and editing. Text-to-image, style transfer, and logo generation.
  Powered by GPT Image 2 (via Codex CLI, no API key), Gemini, and FLUX.
  Triggers: generate image, create image, make image, draw, illustrate, logo, visual, picture.
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - Agent
  - Glob
---

# Image Generation — Babel Fish

Translating your thoughts into pictures. The Babel Fish handles all languages, including visual ones.

## Boundaries

- MAY: generate images, save files, call image APIs
- MAY NOT: send images to external services or share outputs without explicit confirmation

## Backends

| Backend | When to Use | Key |
|---------|-------------|-----|
| GPT Image 2 via Codex CLI (`gpt-image-2`) | Default — strong prompt adherence, text in images, no API key | ChatGPT OAuth (`codex login`) |
| Gemini (`gemini-3-pro-image-preview`) | Style transfer with reference images, multi-turn iteration, 4K | `GEMINI_API_KEY` |
| FLUX via OpenRouter (`black-forest-labs/flux.2-pro`) | Artistic, stylised work | `~/.claude/secrets/openrouter.json` |

## Backend selection (ask first)

Before generating, ask via `AskUserQuestion` which backend to use — list the three above as options with GPT Image 2 first (default). Skip the question only when:

- The user already named a backend in their prompt ("use Gemini", "with FLUX", "via codex")
- The request **forces** a specific one:
  - Reference images for style matching → Gemini (the codex path does not accept reference images)
  - True native transparent background → Gemini, or codex with explicit `gpt-image-1.5`
  - 4K+ output above 3840px per edge → Gemini (codex caps at 3840)

Announce the chosen backend in one line before running so the user has clarity.

Requires: `codex-cli >= 0.124.0-alpha.2` for GPT Image 2. Install: `npm install -g @openai/codex@0.124.0-alpha.2`.

## Phase 0 — Understand

Gather before generating. Ask if unclear:
- **Subject**: what's in the image?
- **Style**: photorealistic, illustration, logo, watercolor, etc.
- **Aspect ratio**: `1:1` (default), `16:9`, `9:16`, `4:3`, `3:2`
- **Resolution**: `1K` (default/fast), `2K` (balanced), `4K` (quality)
- **Purpose**: blog post, social media, UI asset, logo
- **Output path**: where to save (default: `./generated_image.jpg`)

## Phase 1 — Generate

### GPT Image 2 via Codex (default)

Runs through codex's built-in `image_gen` tool — uses your ChatGPT OAuth, no API key, no per-image billing (counts against your ChatGPT plan limits).

```bash
plugins/babel-fish/skills/image/scripts/generate_image_codex.sh \
  --output ./output.png \
  --size 1024x1024 \
  --quality high \
  "your prompt here"
```

Constraints:
- Sizes: `auto` or `WxH` — max edge ≤ 3840px, edges multiples of 16, 655k–8.3M total pixels.
- Quality: `low` | `medium` | `high` | `auto`.
- Does **not** support `background=transparent` — use Gemini or ask codex for `gpt-image-1.5` explicitly if true transparency is required.

Equivalent raw invocation (skip the wrapper for multi-variant riffs):

```bash
codex exec --skip-git-repo-check --sandbox workspace-write --full-auto \
  "Use your built-in image_gen tool to generate: <PROMPT>. After it returns, copy the file to <OUT_PATH> and print the path."
```

### Gemini

```python
import os
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["Your refined prompt here"],
    config=types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",  # adjust per request
            image_size="1K",      # 1K | 2K | 4K
        ),
    ),
)

for part in response.parts:
    if part.text:
        print(part.text)
    elif part.inline_data:
        img = part.as_image()
        img.save("output.jpg")  # Gemini returns JPEG — always use .jpg
```

**Critical:** Gemini returns JPEG by default. Use `.jpg` extension. If PNG is needed, pass `format="PNG"` explicitly to `img.save()`.

### FLUX via OpenRouter

```bash
curl https://openrouter.ai/api/v1/images/generations \
  -H "Authorization: Bearer $(cat ~/.claude/secrets/openrouter.json | python3 -c 'import json,sys; print(json.load(sys.stdin)["api_key"])')" \
  -H "Content-Type: application/json" \
  -d '{"model": "black-forest-labs/flux.2-pro", "prompt": "your prompt", "n": 1}' \
  | python3 -c 'import json,sys,base64,urllib.request; d=json.load(sys.stdin); urllib.request.urlretrieve(d["data"][0]["url"], "output.png")'
```

## Phase 2 — Review

Show the output path. Ask if it matches the intent and whether style, composition, or content needs adjusting.

## Phase 3 — Iterate

If refinement is needed, use Gemini's multi-turn chat for continuity:

```python
chat = client.chats.create(
    model="gemini-3-pro-image-preview",
    config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])
)
response = chat.send_message("Create a logo for 'Acme'")
# save, then refine:
response = chat.send_message("Make the font bolder and add a blue gradient")
```

Adjust the prompt and regenerate until approved.

## Phase 4 — Deliver

Save to the requested output path. Report:
- Final file path
- Model used
- Prompt that produced the result (for reproducibility)

## Prompt Craft

- **Specific beats vague**: "a golden retriever in autumn leaves, warm light" not "a dog"
- **Name the style**: "watercolor illustration", "photorealistic", "flat vector logo"
- **Specify light**: "soft morning light", "dramatic shadows", "studio three-point lighting"
- **Text in images**: use Gemini Pro — put exact text in quotes, specify font style
- **Logos**: "clean sans-serif, black and white, [motif]" — Gemini handles this well
