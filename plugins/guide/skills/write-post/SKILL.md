# /guide:write-post — Blog Post Writing

> Write a long-form blog post from scratch or from a pipeline-generated outline.

A 7-phase guided writing process that helps you write an authentic blog post in your voice.

## Getting Started

This skill can start two ways:

1. **From a pipeline outline** — If a blog outline exists in `content/drafts/` with `needs_write_post: true` in its frontmatter, offer to pick up from that outline and start from that context.
2. **From scratch** — If no outline exists or the user wants to start fresh, begin with the context phase. This preserves the current behavior of the original /write-post skill.

## Voice Profile

Read the voice profile from `config.yaml` at `voice.reference` path. If the voice profile file is missing or unavailable, fall back to inline voice hints from the `voice.tone` config field. The skill should still work without a voice reference — use the tone keywords as style anchors.

## The 7 Phases

### Phase 1: Context

Gather context for the post:
- What's the core idea or experience?
- Who is the audience?
- What should the reader feel or do after reading?
- Read any existing blog outline (from pipeline or user-provided)

### Phase 2: Scaffold

Create the post structure:
- Build an outline following the emotional arc (hook → scene → mess → moment → reflection → soft landing)
- Map each section to specific experiences, signals, or insights
- Identify the emotional thread that ties everything together

### Phase 3: Dictate

Write the first draft:
- Encourage the user to speak/write freely — capture raw voice
- Don't edit for polish yet — get the ideas down
- Preserve authentic phrasing and emotional moments

### Phase 4: Shape

Shape the raw draft into a structured post:
- Apply the scaffold structure
- Ensure smooth transitions between sections
- Check that the emotional arc flows naturally
- Maintain the user's authentic voice throughout

### Phase 5: Iterate

Refine the draft:
- Read aloud — does it sound like the user?
- Check for jargon, corporate-speak, or generic language
- Tighten sentences (target under 25 words each)
- Ensure first-person voice is consistent
- Get user feedback and incorporate changes

### Phase 6: Publish-Prep

Prepare for publication:
- Write a compelling title (short, honest, curiosity-driven)
- Create a meta description
- Add any required frontmatter (date, tags, slug)
- Format for the target platform

### Phase 7: Audio

Optional audio version:
- Generate a read-aloud version if audio tools are available
- Adjust pacing and emphasis for spoken delivery

## Output

Write the final post to `blog/<slug>/post.md`, preserving the existing blog directory convention.

## Edge Cases

- **No blog outline exists**: Start from scratch (this is the current behavior and should always be supported)
- **Blog outline has `needs_write_post: true`**: Offer to start from that outline as a foundation
- **Voice profile missing**: Use inline voice hints from the `voice.tone` config field as a fallback
