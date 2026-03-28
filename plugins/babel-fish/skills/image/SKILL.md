---
name: image
description: >
  AI image generation and editing. Text-to-image, style transfer, and logo generation.
  Currently powered by Gemini and FLUX via OpenRouter.
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
| Gemini (`gemini-3-pro-image-preview`) | Primary — best quality, text in images, style transfer | `GEMINI_API_KEY` |
| FLUX via OpenRouter (`black-forest-labs/flux.2-pro`) | Fallback — artistic, creative work | `~/.claude/secrets/openrouter.json` |

Check `$GEMINI_API_KEY` first; if unset, fall back to `~/.claude/secrets/openrouter.json`.

## Phase 0 — Understand

Gather before generating. Ask if unclear:
- **Subject**: what's in the image?
- **Style**: photorealistic, illustration, logo, watercolor, etc.
- **Aspect ratio**: `1:1` (default), `16:9`, `9:16`, `4:3`, `3:2`
- **Resolution**: `1K` (default/fast), `2K` (balanced), `4K` (quality)
- **Purpose**: blog post, social media, UI asset, logo
- **Output path**: where to save (default: `./generated_image.jpg`)

## Phase 1 — Generate

### Gemini (primary)

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

### FLUX via OpenRouter (fallback)

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
