"""
STORY-011: /guide:pipeline — Create phase (blog outline)

Tests verify:
- SKILL.md only triggers blog outline when top angle is in top 10% (configurable threshold)
- Outline follows the emotional arc: hook → scene → mess → moment → reflection → soft landing
- Outline has 6-8 bullet points with 1-2 sentence description each
- Each bullet notes which signals/captures feed into that section
- Outline written to content/drafts/YYYY-MM-DD-blog-outline.md
- Frontmatter includes needs_write_post: true
- Edge cases: multiple strong angles (outline only strongest), overlap with existing blog draft
"""
import os
import pytest
from conftest import GUIDE_ROOT

SKILL_MD = os.path.join(GUIDE_ROOT, "skills", "pipeline", "SKILL.md")


# ---------------------------------------------------------------------------
# Triggering condition
# ---------------------------------------------------------------------------

def test_story_011_blog_outline_only_on_strong_angle():
    """STORY-011: SKILL.md must only generate blog outline when angle scores exceptionally high."""
    assert os.path.exists(SKILL_MD), f"SKILL.md not found at {SKILL_MD}"
    content = open(SKILL_MD).read().lower()
    assert (
        "top 10%" in content
        or "threshold" in content
        or "exceptionally" in content
        or "strong" in content
    ) and "blog" in content, (
        "SKILL.md must only trigger blog outline generation when the top angle scores "
        "exceptionally high (top 10%, configurable threshold)."
    )


def test_story_011_blog_outline_threshold_is_configurable():
    """STORY-011: The blog outline threshold must be configurable."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "configurable" in content and "threshold" in content, (
        "SKILL.md must note that the blog outline score threshold is configurable."
    )


def test_story_011_blog_outline_mentions_top_10_percent():
    """STORY-011: SKILL.md must specify the default threshold as top 10%."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "10%" in content or "top 10" in content.lower(), (
        "SKILL.md must specify the default blog outline threshold as top 10%."
    )


# ---------------------------------------------------------------------------
# Emotional arc structure
# ---------------------------------------------------------------------------

def test_story_011_outline_follows_emotional_arc():
    """STORY-011: Outline must follow the emotional arc structure."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "emotional arc" in content, (
        "SKILL.md must specify that the blog outline follows an emotional arc."
    )


def test_story_011_emotional_arc_includes_hook():
    """STORY-011: Emotional arc must include 'hook' step."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "hook" in content, (
        "SKILL.md must include 'hook' in the emotional arc for the blog outline."
    )


def test_story_011_emotional_arc_includes_scene():
    """STORY-011: Emotional arc must include 'scene' step."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "scene" in content, (
        "SKILL.md must include 'scene' in the emotional arc for the blog outline."
    )


def test_story_011_emotional_arc_includes_mess():
    """STORY-011: Emotional arc must include 'mess' step."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "mess" in content, (
        "SKILL.md must include 'mess' in the emotional arc for the blog outline."
    )


def test_story_011_emotional_arc_includes_moment():
    """STORY-011: Emotional arc must include 'moment' step."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "moment" in content, (
        "SKILL.md must include 'moment' in the emotional arc for the blog outline."
    )


def test_story_011_emotional_arc_includes_reflection():
    """STORY-011: Emotional arc must include 'reflection' step."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "reflection" in content, (
        "SKILL.md must include 'reflection' in the emotional arc for the blog outline."
    )


def test_story_011_emotional_arc_includes_soft_landing():
    """STORY-011: Emotional arc must include 'soft landing' step."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "soft landing" in content or "landing" in content, (
        "SKILL.md must include 'soft landing' in the emotional arc for the blog outline."
    )


# ---------------------------------------------------------------------------
# Outline detail
# ---------------------------------------------------------------------------

def test_story_011_outline_has_6_to_8_bullet_points():
    """STORY-011: Outline must have 6-8 bullet points with 1-2 sentence descriptions."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "6-8" in content or ("6" in content and "8" in content and "bullet" in content.lower()), (
        "SKILL.md must specify 6-8 bullet points for the blog outline."
    )


def test_story_011_outline_bullets_have_sentence_descriptions():
    """STORY-011: Each outline bullet must have a 1-2 sentence description."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "1-2 sentence" in content or ("sentence" in content.lower() and "description" in content.lower()), (
        "SKILL.md must specify that each outline bullet has a 1-2 sentence description."
    )


def test_story_011_outline_notes_signals_per_section():
    """STORY-011: Each bullet must note which signals/captures feed into that section."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "signal" in content and (
        "section" in content or "feed" in content or "each" in content
    ), (
        "SKILL.md must instruct noting which signals/captures feed into each outline section."
    )


# ---------------------------------------------------------------------------
# Output file and frontmatter
# ---------------------------------------------------------------------------

def test_story_011_outline_written_to_drafts_directory():
    """STORY-011: Blog outline must be written to content/drafts/YYYY-MM-DD-blog-outline.md."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "blog-outline.md" in content or (
        "blog" in content.lower() and "outline" in content.lower() and (
            "drafts" in content.lower() or "drafts_dir" in content
        )
    ), (
        "SKILL.md must instruct writing the blog outline to "
        "content/drafts/YYYY-MM-DD-blog-outline.md."
    )


def test_story_011_frontmatter_has_needs_write_post_true():
    """STORY-011: Blog outline frontmatter must include 'needs_write_post: true'."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "needs_write_post" in content, (
        "SKILL.md must instruct setting 'needs_write_post: true' in the blog outline frontmatter "
        "to flag it for /guide:write-post follow-up."
    )


def test_story_011_needs_write_post_value_is_true():
    """STORY-011: needs_write_post must be set to true (not just present)."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    idx = content.find("needs_write_post")
    assert idx != -1
    surrounding = content[idx:idx + 30]
    assert "true" in surrounding.lower(), (
        "SKILL.md must set 'needs_write_post: true' — not just mention the field name."
    )


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_story_011_handles_multiple_strong_angles():
    """STORY-011: SKILL.md must outline only the strongest angle when multiple qualify."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "multiple strong" in content
        or ("multiple" in content and "outline only" in content)
        or ("strongest" in content and "runner-up" in content)
        or ("mention runner" in content)
    ), (
        "SKILL.md must handle multiple strong angles — "
        "outline only the strongest and mention runner-up in notes."
    )


def test_story_011_handles_overlap_with_existing_blog_draft():
    """STORY-011: SKILL.md must detect overlap with existing blog drafts in blog/ directory."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "existing" in content and ("draft" in content or "blog/" in content)
        or "overlap" in content
        or "building on" in content
    ), (
        "SKILL.md must check for overlap with existing blog drafts in blog/ "
        "and suggest building on the existing draft."
    )


def test_story_011_handles_blog_cadence_not_met():
    """STORY-011: SKILL.md must lower threshold when blog cadence hasn't been met."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "cadence" in content and (
        "lower threshold" in content
        or "lower" in content
        or "encourage" in content
    ), (
        "SKILL.md must lower the blog outline threshold slightly "
        "when blog cadence hasn't been met, to encourage more outlines."
    )
