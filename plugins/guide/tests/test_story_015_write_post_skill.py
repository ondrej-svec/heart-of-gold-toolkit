"""
STORY-015: Port /write-post skill to guide plugin as /guide:write-post

Tests verify:
- plugins/guide/skills/write-post/SKILL.md exists
- Skill includes all 7 phases: context, scaffold, dictate, shape, iterate, publish-prep, audio
- Skill reads voice profile from config (not hardcoded)
- Skill can pick up blog outlines from /guide:pipeline (needs_write_post: true)
- Skill writes output to blog/<slug>/post.md convention
- Skill handles missing blog outline (starts from scratch — existing behavior preserved)
- Skill handles missing voice profile (uses inline voice hints as fallback)
"""
import os
import re
import pytest
from conftest import REPO_ROOT, GUIDE_ROOT

WRITE_POST_SKILL = os.path.join(GUIDE_ROOT, "skills", "write-post", "SKILL.md")

# The 7 required phases as per the story acceptance criteria
REQUIRED_PHASES = ["context", "scaffold", "dictate", "shape", "iterate", "publish-prep", "audio"]


# ---------------------------------------------------------------------------
# Skill file existence
# ---------------------------------------------------------------------------

def test_story_015_write_post_skill_exists():
    """STORY-015: plugins/guide/skills/write-post/SKILL.md must exist."""
    assert os.path.exists(WRITE_POST_SKILL), (
        f"Write-post skill not found at {WRITE_POST_SKILL}. "
        "Create plugins/guide/skills/write-post/SKILL.md"
    )


# ---------------------------------------------------------------------------
# Phase coverage
# ---------------------------------------------------------------------------

def _read_skill():
    assert os.path.exists(WRITE_POST_SKILL), f"SKILL.md not found at {WRITE_POST_SKILL}"
    return open(WRITE_POST_SKILL).read()


@pytest.mark.parametrize("phase", REQUIRED_PHASES)
def test_story_015_skill_includes_all_seven_phases(phase):
    """STORY-015: SKILL.md must include all 7 phases: context, scaffold, dictate, shape, iterate, publish-prep, audio."""
    content = _read_skill()
    assert re.search(phase, content, re.IGNORECASE), (
        f"SKILL.md is missing the '{phase}' phase. "
        f"The /guide:write-post skill must preserve all 7 phases from the original /write-post skill."
    )


def test_story_015_skill_has_seven_distinct_phases():
    """STORY-015: SKILL.md must contain all 7 phases (not just a subset)."""
    content = _read_skill()
    found_phases = [p for p in REQUIRED_PHASES if re.search(p, content, re.IGNORECASE)]
    assert len(found_phases) == len(REQUIRED_PHASES), (
        f"SKILL.md is missing phases: {set(REQUIRED_PHASES) - set(found_phases)}. "
        f"Found {len(found_phases)}/{len(REQUIRED_PHASES)} phases."
    )


# ---------------------------------------------------------------------------
# Voice profile integration
# ---------------------------------------------------------------------------

def test_story_015_skill_reads_voice_profile_from_config():
    """STORY-015: SKILL.md must read the voice profile path from config, not hardcode it."""
    content = _read_skill()
    has_config_voice = (
        "config" in content.lower() and "voice" in content.lower()
        or "voice.reference" in content
        or re.search(r'config.*voice', content, re.IGNORECASE)
        or re.search(r'voice.*config', content, re.IGNORECASE)
    )
    assert has_config_voice, (
        "SKILL.md must read the voice profile from config (voice.reference field), "
        "not hardcode a path like 'thoughts/writing-voice.md'."
    )


def test_story_015_skill_has_fallback_when_voice_profile_missing():
    """STORY-015: SKILL.md must handle missing voice profile gracefully."""
    content = _read_skill()
    has_fallback = (
        re.search(r'missing.*voice', content, re.IGNORECASE)
        or re.search(r'voice.*missing', content, re.IGNORECASE)
        or re.search(r'voice.*not found', content, re.IGNORECASE)
        or re.search(r'voice.*unavailable', content, re.IGNORECASE)
        or re.search(r'fall.?back', content, re.IGNORECASE)
        or re.search(r'inline.*voice', content, re.IGNORECASE)
        or re.search(r'voice.*hint', content, re.IGNORECASE)
    )
    assert has_fallback, (
        "SKILL.md must handle the case where the voice profile file is missing. "
        "It should fall back to inline voice hints rather than crashing."
    )


# ---------------------------------------------------------------------------
# Pipeline outline integration
# ---------------------------------------------------------------------------

def test_story_015_skill_can_use_pipeline_blog_outline():
    """STORY-015: SKILL.md must be able to pick up blog outlines from /guide:pipeline."""
    content = _read_skill()
    has_outline_pickup = (
        "needs_write_post" in content
        or re.search(r'outline', content, re.IGNORECASE)
        or re.search(r'pipeline.*outline', content, re.IGNORECASE)
        or re.search(r'blog.*outline', content, re.IGNORECASE)
        or re.search(r'starting.*context', content, re.IGNORECASE)
    )
    assert has_outline_pickup, (
        "SKILL.md must be able to pick up blog outlines generated by /guide:pipeline. "
        "When an outline has 'needs_write_post: true' in its frontmatter, "
        "the skill should offer to start from that outline."
    )


def test_story_015_skill_references_needs_write_post_frontmatter():
    """STORY-015: SKILL.md must reference the needs_write_post frontmatter flag."""
    content = _read_skill()
    # Check for the specific frontmatter key OR a clear description of the pickup mechanism
    has_frontmatter_ref = (
        "needs_write_post" in content
        or re.search(r'frontmatter.*write.post', content, re.IGNORECASE)
        or re.search(r'write.post.*frontmatter', content, re.IGNORECASE)
        or re.search(r'offer to start from', content, re.IGNORECASE)
        or re.search(r'pick.*up.*outline', content, re.IGNORECASE)
    )
    assert has_frontmatter_ref, (
        "SKILL.md must reference the 'needs_write_post: true' frontmatter flag. "
        "This is how /guide:pipeline signals that an outline is ready for writing."
    )


def test_story_015_skill_works_without_existing_outline():
    """STORY-015: SKILL.md must work without a pre-existing blog outline (start from scratch)."""
    content = _read_skill()
    has_scratch_mode = (
        re.search(r'scratch', content, re.IGNORECASE)
        or re.search(r'no.*outline', content, re.IGNORECASE)
        or re.search(r'outline.*not.*exist', content, re.IGNORECASE)
        or re.search(r'without.*outline', content, re.IGNORECASE)
        or re.search(r'if.*no.*outline', content, re.IGNORECASE)
        or re.search(r'current behavior', content, re.IGNORECASE)
    )
    assert has_scratch_mode, (
        "SKILL.md must support starting without a blog outline (from scratch). "
        "This preserves the existing /write-post behavior."
    )


# ---------------------------------------------------------------------------
# Output path convention
# ---------------------------------------------------------------------------

def test_story_015_skill_outputs_to_blog_slug_post_md():
    """STORY-015: SKILL.md must output to blog/<slug>/post.md convention."""
    content = _read_skill()
    has_output_convention = (
        re.search(r'blog/.*post\.md', content)
        or re.search(r'blog/<slug>', content)
        or re.search(r'blog/\{slug\}', content)
        or re.search(r'blog/.*slug.*post', content, re.IGNORECASE)
        or (re.search(r'\bblog/', content) and re.search(r'post\.md', content))
    )
    assert has_output_convention, (
        "SKILL.md must specify the output path convention: blog/<slug>/post.md. "
        "This preserves the existing convention and keeps blog posts in the blog/ directory."
    )
