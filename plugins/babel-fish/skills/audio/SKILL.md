---
name: audio
description: >
  Generate audio content — text-to-speech, podcasts, voice cloning, sound effects,
  speech-to-speech, dubbing, and audio isolation. Currently powered by ElevenLabs.
  Works with both the Python SDK and the ElevenLabs CLI. Includes ready-to-run
  generator scripts that Claude writes to a temp file and executes directly.
  Triggers: audio, elevenlabs, text-to-speech, TTS, podcast, voice, voiceover,
  narration, voice clone, sound effects, dubbing, speech-to-speech, audio isolation.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Write
  - Edit
---

# Audio Production

Generate audio — from single-line TTS to multi-voice podcasts. Currently powered by ElevenLabs.
Includes ready-to-run Python scripts. Claude writes them to a temp file and executes directly.

## Boundaries

**This skill MAY:** install the SDK, generate audio files, list voices, create voice clones, write and execute generation scripts, play audio.

**This skill MAY NOT:** store API keys in code (use env vars or `~/.elevenlabs/api_key`), commit audio files to git, generate audio without user approval of the script first.

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| Hardcode API key in script | Leaks credentials to git history | Security incident |
| Skip voice selection | Default voice may not match content tone | Wasted credits on re-gen |
| Generate full podcast without preview | Long audio = expensive; mistakes compound | Non-refundable credits |
| Use `eleven_v3` for everything | 5,000 char limit — wrong for long-form | Truncated audio |
| Import pydub for concatenation | Broken on Python 3.13+ (audioop removed) | Runtime crash |

## Phase 0: Environment Setup

**Entry:** User wants audio content.

### Step 1: Detect Authentication

Check in order — use the first one found:

```bash
# 1. Check CLI auth (preferred — already logged in)
elevenlabs auth whoami --no-ui 2>/dev/null

# 2. Check env var
echo "${ELEVENLABS_API_KEY:+set}"

# 3. Check stored key file
cat ~/.elevenlabs/api_key 2>/dev/null | head -c 10
```

**API key resolution in Python** (use this in ALL scripts):

```python
import os

def get_api_key() -> str:
    """Resolve ElevenLabs API key from CLI store, env var, or fail."""
    # 1. CLI stored key
    key_file = os.path.expanduser("~/.elevenlabs/api_key")
    if os.path.exists(key_file):
        return open(key_file).read().strip()
    # 2. Environment variable
    key = os.environ.get("ELEVENLABS_API_KEY", "")
    if key:
        return key
    raise RuntimeError(
        "No ElevenLabs API key found. Run `elevenlabs auth login` or "
        "set ELEVENLABS_API_KEY environment variable."
    )
```

### Step 2: Install SDK (if needed)

```bash
# Check if installed
python3 -c "import elevenlabs" 2>/dev/null || uv pip install --system --break-system-packages elevenlabs
```

**IMPORTANT:** Do NOT install pydub. It's broken on Python 3.13+ (audioop removed). The scripts
below use raw MP3 byte concatenation instead — MP3 is a frame-based format and files can be
concatenated directly.

**IMPORTANT:** On Python 3.14+, `client.text_to_speech.convert()` returns a **generator**, not
bytes. All scripts below use a `to_bytes()` helper to normalize this. Never call `f.write(audio)`
directly — always wrap with `to_bytes(audio)` first.

### Step 3: Verify Connection

```bash
python3 -c "
from elevenlabs.client import ElevenLabs
import os

key_file = os.path.expanduser('~/.elevenlabs/api_key')
api_key = open(key_file).read().strip() if os.path.exists(key_file) else os.environ.get('ELEVENLABS_API_KEY', '')
client = ElevenLabs(api_key=api_key)
voices = client.voices.get_all()
print(f'Connected. {len(voices.voices)} voices available.')
for v in voices.voices[:10]:
    labels = dict(v.labels) if v.labels else {}
    print(f'  {v.voice_id} | {v.name:25s} | {labels.get(\"accent\", \"\")} {labels.get(\"gender\", \"\")}')
"
```

**CRITICAL:** Voice IDs are **account-specific**. Never hardcode voice IDs from examples or
documentation — always run Step 3 first to discover the actual IDs available on the user's
account. The same voice name (e.g., "Alice") may have a different ID across accounts.

**Exit:** Auth verified, SDK installed, voices listed.

## Phase 1: Quick Text-to-Speech

**Entry:** User wants a single audio file from text (< 10,000 chars).

Write this script to a temp file and execute:

```python
#!/usr/bin/env python3
"""ElevenLabs TTS generator."""
import os
from elevenlabs.client import ElevenLabs

# --- CONFIG (Claude fills these — run Phase 0 Step 3 to list voice IDs) ---
TEXT = """Your text here."""
VOICE_ID = "FILL_FROM_VOICE_LIST"            # Run voice list first!
MODEL_ID = "eleven_multilingual_v2"           # See model table below
OUTPUT_FORMAT = "mp3_44100_128"
OUTPUT_PATH = "output.mp3"
# --- END CONFIG ---

def to_bytes(audio) -> bytes:
    """Normalize convert() output — returns bytes on <3.14, generator on >=3.14."""
    return audio if isinstance(audio, bytes) else b"".join(audio)

key_file = os.path.expanduser("~/.elevenlabs/api_key")
api_key = open(key_file).read().strip() if os.path.exists(key_file) else os.environ["ELEVENLABS_API_KEY"]
client = ElevenLabs(api_key=api_key)

print(f"Generating {len(TEXT)} chars with {MODEL_ID}...")
audio = to_bytes(client.text_to_speech.convert(
    text=TEXT,
    voice_id=VOICE_ID,
    model_id=MODEL_ID,
    output_format=OUTPUT_FORMAT,
))

with open(OUTPUT_PATH, "wb") as f:
    f.write(audio)

size_kb = os.path.getsize(OUTPUT_PATH) / 1024
print(f"Saved to {OUTPUT_PATH} ({size_kb:.0f} KB)")
```

**Exit:** Audio file saved, size reported.

## Phase 2: Podcast / Long-Form Audio

**Entry:** User wants podcast-style audio (single or multi-voice).

This is the main generator. Write it to a temp file, fill in the CONFIG section, execute.

**IMPORTANT:** Uses raw MP3 byte concatenation (no pydub). For pauses between segments,
generates a short silent audio clip via the API once and reuses it.

### Single-Voice Podcast

```python
#!/usr/bin/env python3
"""ElevenLabs single-voice podcast generator.

Splits long text on paragraph boundaries, generates per-chunk with
previous_text continuity, concatenates MP3 bytes directly.
"""
import os
from elevenlabs.client import ElevenLabs

# --- CONFIG (Claude fills these — run Phase 0 Step 3 to list voice IDs) ---
SCRIPT = """
Your podcast script here.

Split into paragraphs with blank lines.

Each paragraph becomes natural speech.
"""
VOICE_ID = "FILL_FROM_VOICE_LIST"            # Run voice list first!
MODEL_ID = "eleven_multilingual_v2"
OUTPUT_PATH = "podcast.mp3"
CHUNK_SIZE = 4500                             # chars per API call (leave margin under 5k/10k limit)
# --- END CONFIG ---

def to_bytes(audio) -> bytes:
    """Normalize convert() output — returns bytes on <3.14, generator on >=3.14."""
    return audio if isinstance(audio, bytes) else b"".join(audio)

key_file = os.path.expanduser("~/.elevenlabs/api_key")
api_key = open(key_file).read().strip() if os.path.exists(key_file) else os.environ["ELEVENLABS_API_KEY"]
client = ElevenLabs(api_key=api_key)

# Split on paragraph boundaries
paragraphs = [p.strip() for p in SCRIPT.strip().split("\n\n") if p.strip()]
chunks, current = [], ""
for para in paragraphs:
    if len(current) + len(para) + 2 > CHUNK_SIZE:
        if current:
            chunks.append(current)
        current = para
    else:
        current = f"{current}\n\n{para}" if current else para
if current:
    chunks.append(current)

print(f"Script: {len(SCRIPT)} chars -> {len(chunks)} chunks")

# Generate silence for pauses (one short phrase, reuse the bytes)
silence = to_bytes(client.text_to_speech.convert(
    text="...",
    voice_id=VOICE_ID,
    model_id=MODEL_ID,
    output_format="mp3_44100_128",
))

# Generate and concatenate
audio_parts = []
for i, chunk in enumerate(chunks):
    print(f"  [{i+1}/{len(chunks)}] {len(chunk)} chars: {chunk[:50]}...")
    audio_bytes = to_bytes(client.text_to_speech.convert(
        text=chunk,
        voice_id=VOICE_ID,
        model_id=MODEL_ID,
        output_format="mp3_44100_128",
        previous_text=chunks[i - 1][-200:] if i > 0 else None,
    ))
    audio_parts.append(audio_bytes)
    if i < len(chunks) - 1:
        audio_parts.append(silence)

with open(OUTPUT_PATH, "wb") as f:
    for part in audio_parts:
        f.write(part)

size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
print(f"\nSaved to {OUTPUT_PATH} ({size_mb:.1f} MB)")
```

### Multi-Voice Podcast (Dialogue)

```python
#!/usr/bin/env python3
"""ElevenLabs multi-voice podcast generator.

Each segment has a voice_id and text. Generates per-segment,
concatenates MP3 bytes with silence pauses between speakers.
"""
import os
from elevenlabs.client import ElevenLabs

# --- CONFIG (Claude fills these — run Phase 0 Step 3 to list voice IDs) ---
SEGMENTS = [
    # (voice_id, text)
    # Voice IDs are account-specific! Always run the voice list first.
    ("VOICE_ID_HOST", "Welcome to the show. Today we're talking about..."),
    ("VOICE_ID_GUEST", "Thanks for having me. Let's dive into the science."),
    ("VOICE_ID_HOST", "So how does this actually work?"),
    ("VOICE_ID_GUEST", "Great question. It starts with..."),
]
MODEL_ID = "eleven_multilingual_v2"
OUTPUT_PATH = "dialogue-podcast.mp3"
# --- END CONFIG ---

def to_bytes(audio) -> bytes:
    """Normalize convert() output — returns bytes on <3.14, generator on >=3.14."""
    return audio if isinstance(audio, bytes) else b"".join(audio)

# Voice name lookup for logging
VOICE_NAMES = {}

key_file = os.path.expanduser("~/.elevenlabs/api_key")
api_key = open(key_file).read().strip() if os.path.exists(key_file) else os.environ["ELEVENLABS_API_KEY"]
client = ElevenLabs(api_key=api_key)

# Resolve voice names for logging
try:
    voices = client.voices.get_all()
    VOICE_NAMES = {v.voice_id: v.name for v in voices.voices}
except Exception:
    pass

# Generate silence for pauses
silence = to_bytes(client.text_to_speech.convert(
    text="...",
    voice_id=SEGMENTS[0][0],
    model_id=MODEL_ID,
    output_format="mp3_44100_128",
))

print(f"Generating {len(SEGMENTS)} segments...")

audio_parts = []
for i, (voice_id, text) in enumerate(SEGMENTS):
    name = VOICE_NAMES.get(voice_id, voice_id[:12])
    preview = text[:60].replace("\n", " ")
    print(f"  [{i+1}/{len(SEGMENTS)}] {name}: {preview}...")

    audio_bytes = to_bytes(client.text_to_speech.convert(
        text=text,
        voice_id=voice_id,
        model_id=MODEL_ID,
        output_format="mp3_44100_128",
    ))
    audio_parts.append(audio_bytes)
    if i < len(SEGMENTS) - 1:
        audio_parts.append(silence)

with open(OUTPUT_PATH, "wb") as f:
    for part in audio_parts:
        f.write(part)

size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
print(f"\nSaved to {OUTPUT_PATH} ({size_mb:.1f} MB)")
```

**Exit:** Podcast audio file saved.

## Phase 3: Voice Cloning

**Entry:** User wants a custom voice from audio samples.

### Instant Voice Clone (1-5 min of audio)

```python
voice = client.clone(
    name="My Custom Voice",
    description="Professional male, mid-30s, neutral accent",
    files=["sample1.mp3", "sample2.mp3"],
)
print(f"Cloned voice ID: {voice.voice_id}")
```

### Voice Design (Generate New Voice)

```python
audio = client.text_to_speech.convert(
    text="Testing a designed voice.",
    voice_id="custom",
    model_id="eleven_multilingual_v2",
)
```

**Exit:** Custom voice created and tested.

## Phase 4: Sound Effects

```python
audio = client.text_to_sound_effects.convert(
    text="Heavy rain on a tin roof with distant thunder",
    duration_seconds=10.0,
)

with open("rain.mp3", "wb") as f:
    f.write(audio)
```

Tips: be specific ("footsteps on gravel" > "walking sounds"), include environment ("in a cathedral"), specify duration.

## Phase 5: Speech-to-Speech (Voice Transform)

```python
with open("input.mp3", "rb") as f:
    input_audio = f.read()

transformed = client.speech_to_speech.convert(
    audio=input_audio,
    voice_id="target_voice_id",
    model_id="eleven_english_sts_v2",
)

with open("transformed.mp3", "wb") as f:
    f.write(transformed)
```

Preserves timing, emotion, pacing. Changes voice identity.

## Phase 6: Audio Isolation (Noise Removal)

```python
with open("noisy.mp3", "rb") as f:
    noisy_audio = f.read()

clean = client.audio_isolation.audio_isolation(audio=noisy_audio)

with open("clean.mp3", "wb") as f:
    f.write(clean)
```

## Phase 7: Dubbing / Translation

```python
result = client.dubbing.dub_a_video_or_an_audio_file(
    file=open("video.mp4", "rb"),
    target_lang="es",
    source_lang="en",
)
dubbing_id = result.dubbing_id

# Poll for completion
import time
while True:
    status = client.dubbing.get_dubbing_project_metadata(dubbing_id)
    if status.status == "dubbed":
        break
    print(f"Status: {status.status}...")
    time.sleep(10)

dubbed = client.dubbing.get_dubbed_file(dubbing_id, target_lang="es")
with open("dubbed_es.mp4", "wb") as f:
    f.write(dubbed)
```

## CLI Quick Reference

When the ElevenLabs CLI (`elevenlabs`) is installed and authenticated:

```bash
# Auth
elevenlabs auth login              # Interactive API key setup
elevenlabs auth whoami --no-ui     # Check status
elevenlabs auth logout             # Remove stored key

# Agents (conversational AI)
elevenlabs agents init             # Init project
elevenlabs agents add "My Agent"   # Create agent
elevenlabs agents push             # Deploy to ElevenLabs
elevenlabs agents list --no-ui     # List agents

# The CLI is focused on agent management, NOT TTS.
# For TTS/podcast/audio generation, use the Python SDK (this skill).
```

## Model Selection

| Model ID | Best For | Char Limit | Latency | Languages | Cost |
|----------|----------|------------|---------|-----------|------|
| `eleven_v3` | Dramatic, expressive | 5,000 | ~300ms | 70+ | Standard |
| `eleven_multilingual_v2` | Long-form, stable | 10,000 | Standard | 29 | Standard |
| `eleven_flash_v2_5` | Ultra-low latency | 40,000 | ~75ms | 32 | 50% cheaper |
| `eleven_turbo_v2_5` | Quality + speed | 40,000 | ~250ms | 32 | Standard |

```
Need < 75ms latency?
├─ Yes → eleven_flash_v2_5
└─ No → Content > 5,000 chars?
   ├─ Yes → eleven_multilingual_v2
   └─ No → Need dramatic delivery?
      ├─ Yes → eleven_v3
      └─ No → eleven_turbo_v2_5
```

## Voice Settings

| Preset | Stability | Similarity | Use Case |
|--------|-----------|------------|----------|
| Stable narration | 0.8 | 0.75 | Podcasts, audiobooks |
| Expressive | 0.3 | 0.85 | Dramatic reading |
| Balanced | 0.5 | 0.5 | General purpose |

```python
from elevenlabs import VoiceSettings

audio = client.text_to_speech.convert(
    text="...",
    voice_id="...",
    model_id="eleven_multilingual_v2",
    voice_settings=VoiceSettings(stability=0.8, similarity_boost=0.75),
)
```

## Output Formats

| Format | Quality | Use Case |
|--------|---------|----------|
| `mp3_44100_128` | High | Default, general purpose |
| `mp3_44100_192` | Highest MP3 | Archival |
| `mp3_22050_32` | Low | Previews |
| `pcm_44100` | Lossless | Post-processing |

## Error Handling

```python
from elevenlabs.core import ApiError

try:
    audio = client.text_to_speech.convert(...)
except ApiError as e:
    if e.status_code == 401:
        print("Bad API key. Run: elevenlabs auth login")
    elif e.status_code == 429:
        print("Rate limited. Wait and retry.")
    elif e.status_code == 422:
        print(f"Invalid params: {e.body}")
    else:
        raise
```

## Cost Awareness

- Characters are the billing unit — every API call costs characters
- **Preview short clips first** before generating long content
- **Cache generated audio** — don't regenerate the same text
- `eleven_flash_v2_5` is 50% cheaper than other models
- The silence-for-pauses trick costs ~3 characters per pause ("...")

## Validate

- [ ] API key loaded from `~/.elevenlabs/api_key` or env var, never hardcoded
- [ ] Model selected matches content length (see model table)
- [ ] Voice selected and approved by user before generation
- [ ] For podcasts: script reviewed before generation (credits are non-refundable)
- [ ] Output format matches downstream requirements
- [ ] Audio file saved outside git-tracked directories
- [ ] File size and duration reported to user

## What Makes This babel-fish

- **Heart of Gold** — the improbably good ship runs on infinite improbability; this skill turns text into voice with similarly improbable ease
- **Multi-Format Production** — text content becomes audio content in one pass
- **Creative Courage** — ship audio content that would have taken a recording studio
