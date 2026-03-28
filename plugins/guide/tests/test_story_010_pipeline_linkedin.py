"""
STORY-010: /guide:pipeline — Create phase (LinkedIn draft)

Tests verify:
- SKILL.md instructs using the #1 ranked angle from analysis
- Draft is 150-300 words in user's configured voice
- Draft structure: hook → personal connection → insight from signal → reflective question
- Draft references specific signals with URLs
- Draft written to content/drafts/YYYY-MM-DD-linkedin.md
- YAML frontmatter: date, angle, sources, word_count, voice_score
- Skip draft if no angle scores above threshold — note in brief
- Edge cases: sensitive angle, similar to recent post, no voice reference file
"""
import os
import pytest
from conftest import GUIDE_ROOT

SKILL_MD = os.path.join(GUIDE_ROOT, "skills", "pipeline", "SKILL.md")


# ---------------------------------------------------------------------------
# Angle selection
# ---------------------------------------------------------------------------

def test_story_010_skill_uses_top_ranked_angle():
    """STORY-010: SKILL.md must instruct using the #1 ranked angle for the LinkedIn draft."""
    assert os.path.exists(SKILL_MD), f"SKILL.md not found at {SKILL_MD}"
    content = open(SKILL_MD).read().lower()
    assert ("#1" in content or "top" in content or "strongest" in content) and "angle" in content, (
        "SKILL.md must instruct using the top-ranked (#1) angle for the LinkedIn draft."
    )


# ---------------------------------------------------------------------------
# Word count
# ---------------------------------------------------------------------------

def test_story_010_draft_is_150_to_300_words():
    """STORY-010: LinkedIn draft must be 150-300 words."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "150" in content and "300" in content, (
        "SKILL.md must specify a 150-300 word count target for the LinkedIn draft."
    )


# ---------------------------------------------------------------------------
# Structure
# ---------------------------------------------------------------------------

def test_story_010_draft_has_hook():
    """STORY-010: LinkedIn draft must open with a hook."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "hook" in content and ("linkedin" in content or "draft" in content), (
        "SKILL.md must instruct starting the LinkedIn draft with a hook."
    )


def test_story_010_draft_has_personal_connection():
    """STORY-010: LinkedIn draft must include a personal connection section."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "personal connection" in content, (
        "SKILL.md must require the LinkedIn draft to include a personal connection."
    )


def test_story_010_draft_has_insight_from_signal():
    """STORY-010: LinkedIn draft must include insight from the signal."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "insight" in content and "signal" in content, (
        "SKILL.md must require the LinkedIn draft to include an insight from the signal."
    )


def test_story_010_draft_ends_with_reflective_question():
    """STORY-010: LinkedIn draft must end with a reflective question."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "reflective question" in content, (
        "SKILL.md must require the LinkedIn draft to end with a reflective question."
    )


def test_story_010_draft_references_specific_signals_with_urls():
    """STORY-010: LinkedIn draft must reference specific signals with URLs."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "url" in content and (
        "signal" in content or "reference" in content or "inspired" in content
    ), (
        "SKILL.md must instruct the LinkedIn draft to reference specific signals with their URLs."
    )


# ---------------------------------------------------------------------------
# Output file and frontmatter
# ---------------------------------------------------------------------------

def test_story_010_draft_written_to_drafts_directory():
    """STORY-010: LinkedIn draft must be written to content/drafts/YYYY-MM-DD-linkedin.md."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "linkedin.md" in content.lower() or (
        "content/drafts" in content or "drafts_dir" in content
    ), (
        "SKILL.md must instruct writing the LinkedIn draft to content/drafts/YYYY-MM-DD-linkedin.md."
    )


def test_story_010_draft_filename_includes_linkedin():
    """STORY-010: Draft filename must include '-linkedin' to distinguish from blog drafts."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "linkedin" in content.lower() and (
        ".md" in content or "draft" in content.lower()
    ), (
        "SKILL.md must include 'linkedin' in the draft filename to distinguish it from blog drafts."
    )


def test_story_010_frontmatter_includes_date():
    """STORY-010: YAML frontmatter must include 'date'."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "date" in content and ("linkedin" in content.lower() or "draft" in content.lower()), (
        "SKILL.md must instruct including 'date' in the LinkedIn draft's YAML frontmatter."
    )


def test_story_010_frontmatter_includes_angle():
    """STORY-010: YAML frontmatter must include 'angle'."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    # 'angle' must appear in frontmatter context — it's a specific field name
    assert "angle" in content and ("frontmatter" in content.lower() or "---" in content), (
        "SKILL.md must instruct including 'angle' in the LinkedIn draft's YAML frontmatter."
    )


def test_story_010_frontmatter_includes_sources():
    """STORY-010: YAML frontmatter must include 'sources'."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "sources" in content and (
        "frontmatter" in content.lower() or "word_count" in content
    ), (
        "SKILL.md must instruct including 'sources' in the LinkedIn draft's YAML frontmatter."
    )


def test_story_010_frontmatter_includes_word_count():
    """STORY-010: YAML frontmatter must include 'word_count'."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "word_count" in content, (
        "SKILL.md must instruct including 'word_count' in the LinkedIn draft's YAML frontmatter."
    )


def test_story_010_frontmatter_includes_voice_score():
    """STORY-010: YAML frontmatter must include 'voice_score' (set by edit phase)."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "voice_score" in content, (
        "SKILL.md must instruct including 'voice_score' in the LinkedIn draft's YAML frontmatter."
    )


# ---------------------------------------------------------------------------
# Threshold: skip draft if no strong angle
# ---------------------------------------------------------------------------

def test_story_010_skips_draft_when_no_strong_angle():
    """STORY-010: SKILL.md must skip the LinkedIn draft if no angle scores above threshold."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "no strong angle" in content
        or "threshold" in content
        or "skip draft" in content
        or ("below" in content and "threshold" in content)
    ), (
        "SKILL.md must handle the case where no angle scores above threshold — "
        "skip the LinkedIn draft and note 'no strong angle today' in the brief."
    )


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_story_010_handles_sensitive_angle():
    """STORY-010: SKILL.md must flag sensitive angles (e.g. leaving job) with sensitive: true."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "sensitive" in content.lower() and (
        "true" in content or "flag" in content.lower()
    ), (
        "SKILL.md must flag sensitive angles (e.g. leaving job, mental health) "
        "by adding 'sensitive: true' to the frontmatter."
    )


def test_story_010_handles_angle_similar_to_recent_post():
    """STORY-010: SKILL.md must prefer #2 angle when #1 is too similar to a recent post."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "recency guard" in content
        or "recent post" in content
        or "#2 angle" in content
        or ("similar" in content and "prefer" in content)
    ), (
        "SKILL.md must handle the recency guard edge case — "
        "if the top angle is too similar to a recent post, prefer the #2 angle."
    )


def test_story_010_handles_missing_voice_reference():
    """STORY-010: SKILL.md must handle missing voice reference file — use config tone defaults."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "voice reference" in content
        or ("voice" in content and "missing" in content)
        or ("no voice" in content)
        or ("tone" in content and "default" in content)
    ), (
        "SKILL.md must handle missing voice reference file — "
        "fall back to config 'tone' field defaults."
    )
