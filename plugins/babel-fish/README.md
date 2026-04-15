# Babel Fish — Universal Translator

> "The Babel fish is small, yellow, leathery, and probably the oddest thing in the universe."
> It also translates your words into audio and your ideas into images.

A media generation plugin for Claude Code. Turns text into audio, ideas into images, structured content into terminal mind maps, and screenshots into LinkedIn-ready carousel PDFs.

## Security & Trust

Babel Fish uses third-party media APIs when you enable its workflows. Review the skill instructions and helper scripts before use, and keep provider credentials in environment variables or local secret files outside the repository.

Generated media may also be sent to external providers, so treat prompts and source material accordingly.

## Skills

### `/babel-fish:audio`
Generate audio content powered by ElevenLabs:
- Text-to-speech with voice selection
- Podcast-style narration
- Voice cloning
- Sound effects
- Speech-to-speech transformation
- Audio isolation

Works with both the ElevenLabs Python SDK and CLI. Includes ready-to-run generator scripts.

### `/babel-fish:image`
AI image generation and editing:
- Text-to-image generation
- Style transfers
- Image editing with prompts
- Logo generation with text

Supports Gemini and FLUX models via OpenRouter API.

### `/babel-fish:visualize`
Render mind maps and tree visualizations directly in the terminal using Unicode box-drawing characters and ANSI colors. Works over SSH — no browser needed. Use it on brainstorm docs, plan docs, markdown files, or any structured content.

### `/babel-fish:linkedin-carousel`
Turn an ordered set of screenshots or images into a LinkedIn document-post PDF (carousel). Auto-samples each source's corner pixel so per-page padding blends invisibly into the image, picks a sensible canvas aspect from the source dimensions, and renders at 2× with Lanczos resampling. Powered by ImageMagick.

## Requirements

- ElevenLabs API key (for audio)
- OpenRouter API key (for image generation)
- ImageMagick (`magick` on PATH) — for `linkedin-carousel`

## Install

```
/plugin install babel-fish@heart-of-gold-toolkit
```
