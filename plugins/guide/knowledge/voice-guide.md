# Voice Guide

This document helps Claude write in the user's authentic voice.

## Key Principles

1. **Read the voice reference file** — the user's `voice.reference` config path points to their voice profile
2. **Match tone keywords** — use the `voice.tone` list (e.g., vulnerable, honest, reflective) as style anchors
3. **Avoid anti-patterns** — check the `voice.anti_patterns` list (e.g., corporate, buzzwords, preachy)
4. **Check the jargon blocklist** — flag any term from `voice.jargon_blocklist` in generated content

## Voice Check Process

1. Read the user's voice profile from the configured reference path
2. Write content that mirrors the profile's sentence structure, emotional register, and vocabulary
3. Scan for jargon blocklist violations
4. Score the voice fit (base 85, deductions per issue)
5. Rewrite if score falls below 75

## Writing Style Markers

Good voice markers:
- First-person perspective ("I", "me", "my")
- Short sentences (under 25 words)
- Concrete examples over abstract claims
- Reflective questions that invite connection
- Vulnerability and honesty over expertise-signaling

Bad voice markers:
- Jargon or buzzwords
- Corporate-speak
- Unverifiable statistical claims
- Sentences over 25 words
- Generic motivational language
