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
| Import pydub for concatenation | Broken on Python 3.13+ (audioop removed) | Runtime crash |
| Use VoiceSettings with cloned voices | Custom settings destabilize cloned voices | Garbled/robotic audio |
| Use `...` for pauses | Causes hesitation/nervousness artifacts | Unnatural stuttering |
| Use large chunks for long content | Quality degrades in second half | Robotic pacing |
| Skip `language_code` with accented speakers | Model guesses language from accent | Chinese/French mid-narration |

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
    key_file = os.path.expanduser("~/.elevenlabs/api_key")
    if os.path.exists(key_file):
        return open(key_file).read().strip()
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
python3 -c "import elevenlabs" 2>/dev/null || uv pip install --system --break-system-packages elevenlabs
```

**IMPORTANT:** Do NOT install pydub. It's broken on Python 3.13+ (audioop removed). The scripts
below use raw MP3 byte concatenation — MP3 is a frame-based format and files can be
concatenated directly.

**IMPORTANT:** On Python 3.14+, `client.text_to_speech.convert()` returns a **generator**, not
bytes. All scripts below use a `to_bytes()` helper to normalize this.

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
documentation — always run Step 3 first to discover the actual IDs available.

**Exit:** Auth verified, SDK installed, voices listed.

## Phase 1: Quick Text-to-Speech

**Entry:** User wants a single audio file from text (< 5,000 chars).

```python
#!/usr/bin/env python3
"""ElevenLabs TTS generator."""
import os
from elevenlabs.client import ElevenLabs

TEXT = """Your text here."""
VOICE_ID = "FILL_FROM_VOICE_LIST"
MODEL_ID = "eleven_multilingual_v2"
OUTPUT_PATH = "output.mp3"

def to_bytes(audio) -> bytes:
    return audio if isinstance(audio, bytes) else b"".join(audio)

key_file = os.path.expanduser("~/.elevenlabs/api_key")
api_key = open(key_file).read().strip() if os.path.exists(key_file) else os.environ["ELEVENLABS_API_KEY"]
client = ElevenLabs(api_key=api_key)

print(f"Generating {len(TEXT)} chars with {MODEL_ID}...")
audio = to_bytes(client.text_to_speech.convert(
    text=TEXT,
    voice_id=VOICE_ID,
    model_id=MODEL_ID,
    output_format="mp3_44100_128",
    language_code="en",  # ALWAYS set for cloned/accented voices
))

with open(OUTPUT_PATH, "wb") as f:
    f.write(audio)
print(f"Saved to {OUTPUT_PATH} ({os.path.getsize(OUTPUT_PATH) / 1024:.0f} KB)")
```

**Exit:** Audio file saved.

## Phase 2: Long-Form Narration (Blog Posts, Articles)

**Entry:** User wants narration of long-form content (> 5,000 chars).

**THIS IS THE CRITICAL PHASE.** Long-form audio requires special handling to maintain
quality throughout. The approach below was battle-tested and is the only one that
produces consistent quality across 10+ minute narrations.

### Step 1: Prepare Speech Text

Create a separate `speech-text.md` adapted for listening:

| Written form | Speech form | Why |
|-------------|-------------|-----|
| `90%` | `ninety percent` | TTS mispronounces digits |
| `1.7 times` | `one point seven times` | Same |
| `2 AM` | `two in the morning` | Natural speech |
| `Kačka` | `Kachka` | Phonetic for TTS |
| `Žaneta` | `Zhaneta` | Phonetic for TTS |
| `Aibility` | `Eigh-bility` | Phonetic — write directly in text |
| `**bold text**` | `bold text` | Strip all markdown |
| `---` | *(remove)* | Strip section breaks |

**Pause control:**
- `<break time="0.7s" />` — sub-section pause (v2 supports SSML break tags)
- `<break time="1.0s" />` — major section transition
- `<break time="1.2s" />` — thesis/key moment (max recommended)
- **NEVER use `...`** — causes hesitation/nervousness artifacts
- **NEVER use more than 5-6 break tags total** — too many cause instability
- Let paragraph breaks and short sentences create natural pacing

**What NOT to do:**
- Don't add verbal filler ("Hey", "So look", "OK so") — sounds like a podcast host
- Don't over-break sentences into fragments — the model handles natural sentence rhythm fine
- Don't use `<lexeme>` tags — they get read aloud as text
- Don't rely on pronunciation dictionaries — they silently fail with some model/voice combos.
  Write pronunciation phonetically directly in the text instead.

### Step 2: Generate with Request Stitching

**Why this approach:** Large chunks (4000+ chars) degrade in quality — the model loses
emotional range and natural pacing in the second half. Small chunks (800-1200 chars)
stay high quality. Request stitching chains them together for continuity.

**CRITICAL for cloned voices:**
- **`language_code="en"` is mandatory** — without it, the model guesses language from
  accent and can switch to Chinese/French mid-narration
- **Do NOT pass VoiceSettings** — default settings produce the best results with cloned
  voices. Every custom setting tested made it worse (garbled, robotic, unnatural)

```python
#!/usr/bin/env python3
"""ElevenLabs long-form narration with request stitching.

Splits text into small chunks, chains via previous_request_ids for
continuity, uses httpx directly to access request-id headers.
"""
import os
import httpx

# --- CONFIG ---
SPEECH_TEXT_PATH = "speech-text.md"
VOICE_ID = "FILL_FROM_VOICE_LIST"
OUTPUT_PATH = "speech.mp3"
CHUNK_SIZE = 1000          # chars per chunk — keep 800-1200 for quality
LANGUAGE_CODE = "en"       # ALWAYS set for cloned/accented voices
# --- END CONFIG ---

api_key_file = os.path.expanduser("~/.elevenlabs/api_key")
api_key = open(api_key_file).read().strip() if os.path.exists(api_key_file) else os.environ["ELEVENLABS_API_KEY"]

with open(SPEECH_TEXT_PATH, "r") as f:
    text = f.read()

# Split into small chunks at paragraph boundaries
paragraphs = text.split("\n\n")
chunks, current = [], ""
for p in paragraphs:
    if len(current) + len(p) + 2 > CHUNK_SIZE and current.strip():
        chunks.append(current.strip())
        current = p
    else:
        current = f"{current}\n\n{p}" if current else p
if current.strip():
    chunks.append(current.strip())

print(f"Script: {len(text)} chars -> {len(chunks)} chunks")
for i, c in enumerate(chunks):
    print(f"  Chunk {i+1}: {len(c)} chars")

url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
headers = {"xi-api-key": api_key, "Content-Type": "application/json"}

all_audio = b""
prev_request_id = None

for i, chunk in enumerate(chunks):
    data = {
        "text": chunk,
        "model_id": "eleven_multilingual_v2",
        "output_format": "mp3_44100_128",
        "language_code": LANGUAGE_CODE,
    }

    # Chain to previous chunk for prosody continuity
    if prev_request_id:
        data["previous_request_ids"] = [prev_request_id]

    # Give forward context from next chunk
    if i + 1 < len(chunks):
        data["next_text"] = chunks[i + 1][:500]

    print(f"  [{i+1}/{len(chunks)}] {len(chunk)} chars...", end=" ", flush=True)

    resp = httpx.post(url, json=data, headers=headers, timeout=60)
    if resp.status_code != 200:
        print(f"ERROR {resp.status_code}: {resp.text[:200]}")
        break

    prev_request_id = resp.headers.get("request-id")
    all_audio += resp.content
    print(f"done ({len(resp.content)//1024} KB)")

with open(OUTPUT_PATH, "wb") as f:
    f.write(all_audio)

size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
print(f"\nSaved to {OUTPUT_PATH} ({size_mb:.1f} MB)")
```

**Always test first:** Generate chunks 1-2 as a preview clip before committing to
the full generation. Credits are non-refundable.

### Step 3: Review and Iterate

Listen to the full audio. If specific sections sound off:
- Regenerate only that chunk using `previous_request_ids` (from the preceding chunk)
  and `next_request_ids` (from the following chunk) to maintain flow
- Request IDs expire after 2 hours — regenerate within that window

**Exit:** Long-form narration audio saved.

## Phase 3: Voice Cloning

**Entry:** User wants a custom voice from their audio.

### Recording Requirements

| Requirement | Details |
|------------|---------|
| Duration | **1-2 minutes** (more than 3 min can be detrimental) |
| Content | Read your own writing — natural intonation matches best |
| Quality | Quiet room, no background noise, consistent distance from mic |
| Format | MP3 128kbps or higher, mono or stereo |
| Style | Consistent pace and tone — the clone replicates EVERYTHING |
| Avoid | Stumbles, "uhm"s, long pauses, whispers, shouting, music |

**CRITICAL:** Do NOT pre-process the recording with ffmpeg filters (silenceremove,
loudnorm, etc.). These strip voice characteristics the clone needs. The only
acceptable preprocessing is trimming to length.

### Instant Voice Clone

```python
from elevenlabs import ElevenLabs

client = ElevenLabs(api_key=get_api_key())

voice = client.voices.ivc.create(
    name="User Voice",
    description="Natural speaking voice for narration",
    files=[open("recording.mp3", "rb")],
    remove_background_noise=False,  # Preserve voice characteristics
)
print(f"Voice ID: {voice.voice_id}")
```

**After cloning, ALWAYS test with a short clip before generating long content:**

```python
audio_gen = client.text_to_speech.convert(
    text="A short test sentence to verify the voice sounds right.",
    voice_id=voice.voice_id,
    model_id="eleven_multilingual_v2",
    output_format="mp3_44100_128",
    language_code="en",
    # DO NOT pass voice_settings — defaults are best for clones
)
```

### Model Compatibility with Cloned Voices

| Model | Works with clones? | Notes |
|-------|-------------------|-------|
| `eleven_multilingual_v2` | **YES** — use this | Best voice fidelity with clones |
| `eleven_v3` | **NO** | Smooth output but voice identity completely lost |
| `eleven_flash_v2_5` | Untested | May work, lower quality expected |
| `eleven_turbo_v2_5` | Untested | May work |

### Voice Settings with Clones

**Do NOT override VoiceSettings for cloned voices.** Default settings produce the
best results. Every combination tested (stability 0.3-0.8, similarity 0.5-1.0,
style 0.3-0.7, speaker boost on/off) made the output worse — garbled, robotic,
or unnatural pacing.

If you must tweak, test with a single sentence first and compare to the no-settings
version before committing to a full generation.

**Exit:** Custom voice created and tested.

## Phase 4: Single-Voice Podcast

**Entry:** User wants podcast-style audio (single voice, long content).

Use the **Phase 2 Long-Form Narration** approach with request stitching.
The old approach (4500-char chunks with `previous_text`) produces lower
quality than small chunks with `previous_request_ids`.

## Phase 5: Multi-Voice Podcast (Dialogue)

```python
#!/usr/bin/env python3
"""ElevenLabs multi-voice podcast generator."""
import os
from elevenlabs.client import ElevenLabs

SEGMENTS = [
    ("VOICE_ID_HOST", "Welcome to the show..."),
    ("VOICE_ID_GUEST", "Thanks for having me..."),
]
MODEL_ID = "eleven_multilingual_v2"
OUTPUT_PATH = "dialogue-podcast.mp3"

def to_bytes(audio) -> bytes:
    return audio if isinstance(audio, bytes) else b"".join(audio)

client = ElevenLabs(api_key=get_api_key())

audio_parts = []
for i, (voice_id, text) in enumerate(SEGMENTS):
    print(f"  [{i+1}/{len(SEGMENTS)}] {text[:50]}...")
    audio_bytes = to_bytes(client.text_to_speech.convert(
        text=text,
        voice_id=voice_id,
        model_id=MODEL_ID,
        output_format="mp3_44100_128",
        language_code="en",
    ))
    audio_parts.append(audio_bytes)

with open(OUTPUT_PATH, "wb") as f:
    for part in audio_parts:
        f.write(part)

print(f"Saved to {OUTPUT_PATH}")
```

## Phase 6: Sound Effects

```python
audio = client.text_to_sound_effects.convert(
    text="Heavy rain on a tin roof with distant thunder",
    duration_seconds=10.0,
)
with open("rain.mp3", "wb") as f:
    f.write(to_bytes(audio))
```

Tips: be specific ("footsteps on gravel" > "walking sounds"), include environment, specify duration.

## Phase 7: Speech-to-Speech (Voice Transform)

```python
with open("input.mp3", "rb") as f:
    input_audio = f.read()

transformed = to_bytes(client.speech_to_speech.convert(
    audio=input_audio,
    voice_id="target_voice_id",
    model_id="eleven_english_sts_v2",
))
with open("transformed.mp3", "wb") as f:
    f.write(transformed)
```

## Phase 8: Audio Isolation (Noise Removal)

```python
with open("noisy.mp3", "rb") as f:
    clean = to_bytes(client.audio_isolation.audio_isolation(audio=f.read()))
with open("clean.mp3", "wb") as f:
    f.write(clean)
```

## CLI Quick Reference

```bash
elevenlabs auth login              # Interactive API key setup
elevenlabs auth whoami --no-ui     # Check status
elevenlabs auth logout             # Remove stored key
```

The CLI is focused on agent management, NOT TTS. For TTS, use the Python SDK.

## Model Selection

| Model ID | Best For | Char Limit | Latency | Clone Support |
|----------|----------|------------|---------|---------------|
| `eleven_multilingual_v2` | **Long-form, cloned voices** | 10,000 | Standard | **YES** |
| `eleven_v3` | Dramatic, expressive (stock voices) | 5,000 | ~300ms | NO — loses identity |
| `eleven_flash_v2_5` | Ultra-low latency | 40,000 | ~75ms | Untested |
| `eleven_turbo_v2_5` | Quality + speed | 40,000 | ~250ms | Untested |

```
Using a cloned voice?
├─ Yes → eleven_multilingual_v2 (only reliable option)
└─ No → Content > 5,000 chars?
   ├─ Yes → eleven_multilingual_v2
   └─ No → Need dramatic delivery?
      ├─ Yes → eleven_v3
      └─ No → Need low latency?
         ├─ Yes → eleven_flash_v2_5
         └─ No → eleven_turbo_v2_5
```

## Pause & Pronunciation Control

### Pauses

| Method | Works? | Notes |
|--------|--------|-------|
| `<break time="0.7s" />` | **YES** (v2 only) | SSML break tag, up to 3s. Use sparingly (max 5-6 per generation) |
| Paragraph breaks | **YES** | Natural, reliable, no cost |
| Short sentences | **YES** | Best method — rhythm from writing |
| `...` ellipsis | **NO** | Causes hesitation/nervousness artifacts |
| Multiple dashes `-- --` | Somewhat | Inconsistent |

### Pronunciation

| Method | Works? | Notes |
|--------|--------|-------|
| Phonetic spelling in text | **YES** | Most reliable: "Eigh-bility" instead of "Aibility" |
| Pronunciation dictionary API | **UNRELIABLE** | Silently ignored with some model/voice combos |
| `<lexeme>` tags in text | **NO** | Read aloud as text |
| `<phoneme>` SSML tags | v2: NO, Flash v2: YES | Only works with specific models |

**Rule: Always use phonetic spelling directly in the speech text.** Don't rely on dictionaries or SSML phoneme tags.

## Output Formats

| Format | Quality | Use Case |
|--------|---------|----------|
| `mp3_44100_128` | High | Default, general purpose |
| `mp3_44100_192` | Highest MP3 | Archival |
| `pcm_44100` | Lossless | Post-processing |

## Cost Awareness

- Characters are the billing unit — every API call costs characters
- **Small-chunk stitching uses ~1.5x the character count** (overhead per request)
- **Preview short clips first** before generating long content
- **Cache generated audio** — don't regenerate the same text
- `eleven_flash_v2_5` is 50% cheaper than other models
- Request IDs expire after 2 hours — regenerate within that window

## Error Handling

```python
# When using httpx directly (for request stitching):
resp = httpx.post(url, json=data, headers=headers, timeout=60)
if resp.status_code == 401:
    print("Bad API key.")
elif resp.status_code == 400 and "quota_exceeded" in resp.text:
    print("Out of credits.")
elif resp.status_code != 200:
    print(f"Error {resp.status_code}: {resp.text[:200]}")
```

## Validate

- [ ] API key loaded from `~/.elevenlabs/api_key` or env var, never hardcoded
- [ ] Model selected matches voice type (v2 for clones, see model table)
- [ ] `language_code` set for cloned or accented voices
- [ ] No VoiceSettings overrides for cloned voices
- [ ] No `...` ellipses in speech text
- [ ] Speech text reviewed — numbers written out, names phonetic
- [ ] Test clip generated and approved before full generation
- [ ] For long-form: using request stitching with small chunks
- [ ] Audio file saved outside git-tracked directories
- [ ] File size and duration reported to user

## What Makes This babel-fish

- **Battle-tested** — every recommendation comes from proven success or documented failure
- **Request stitching** — the key to consistent long-form quality
- **Clone-aware** — different rules for cloned vs stock voices, learned the hard way
