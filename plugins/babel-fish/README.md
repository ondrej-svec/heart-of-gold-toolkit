# Babel Fish — Universal Translator

> "The Babel fish is small, yellow, leathery, and probably the oddest thing in the universe."
> It also translates your words into audio and your ideas into images.

A media generation plugin for Claude Code. Turns text into audio content and generates images from prompts.

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

## Requirements

- ElevenLabs API key (for audio)
- OpenRouter API key (for image generation)

## Install

```
/plugin install babel-fish@heart-of-gold-toolkit
```
