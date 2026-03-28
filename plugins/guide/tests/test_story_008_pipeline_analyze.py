"""
STORY-008: /guide:pipeline — Analyze phase

Tests verify:
- SKILL.md instructs scoring each signal 1-5 on relevance to user's themes
- SKILL.md instructs deduplication against last 3 briefs using URL or 85% Jaccard title similarity
- SKILL.md instructs grouping signals into 2-4 content angles
- Each angle includes: internal signal connection, external signal connection, "why now" hook, format
- SKILL.md instructs ranking angles by strength (topic alignment + freshness + personal connection)
- SKILL.md instructs writing analysis to content/pipeline/YYYY-MM-DD/analysis.md
- Edge cases: fewer than 3 signals, all signals deduplicated, no personal connection, multiple signals same topic
"""
import os
import pytest
from conftest import GUIDE_ROOT

SKILL_MD = os.path.join(GUIDE_ROOT, "skills", "pipeline", "SKILL.md")


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def test_story_008_skill_scores_signals_1_to_5():
    """STORY-008: SKILL.md must instruct scoring signals on a 1-5 relevance scale."""
    assert os.path.exists(SKILL_MD), f"SKILL.md not found at {SKILL_MD}"
    content = open(SKILL_MD).read()
    # Must mention the 1-5 scale explicitly
    assert "1-5" in content or ("1" in content and "5" in content and "score" in content.lower()), (
        "SKILL.md must instruct scoring each signal on a 1-5 relevance scale."
    )


def test_story_008_skill_scores_against_configured_themes():
    """STORY-008: SKILL.md must score relevance against user's configured themes."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "theme" in content, (
        "SKILL.md must reference themes when scoring signal relevance — "
        "signals are scored against the user's configured themes."
    )


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def test_story_008_skill_deduplicates_signals():
    """STORY-008: SKILL.md must instruct deduplicating signals against last 3 briefs."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "dedup" in content or "duplicat" in content, (
        "SKILL.md must instruct deduplication of signals against recent briefs."
    )


def test_story_008_skill_deduplicates_by_url():
    """STORY-008: SKILL.md must instruct deduplication by URL match."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "url" in content and ("dedup" in content or "duplicat" in content or "appeared" in content), (
        "SKILL.md must instruct skipping signals whose URL appeared in last 3 briefs."
    )


def test_story_008_skill_deduplicates_by_jaccard_similarity():
    """STORY-008: SKILL.md must instruct title-based deduplication using 85% Jaccard similarity."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "85" in content and ("jaccard" in content.lower() or "similar" in content.lower()), (
        "SKILL.md must specify 85% Jaccard similarity for title-based deduplication."
    )


# ---------------------------------------------------------------------------
# Content angles
# ---------------------------------------------------------------------------

def test_story_008_skill_creates_content_angles():
    """STORY-008: SKILL.md must instruct grouping signals into content angles."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "angle" in content, (
        "SKILL.md must instruct creating content angles from grouped signals."
    )


def test_story_008_skill_creates_2_to_4_angles():
    """STORY-008: SKILL.md must specify producing 2-4 content angles."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "2-4" in content or ("2" in content and "4" in content and "angle" in content.lower()), (
        "SKILL.md must specify grouping signals into 2-4 content angles."
    )


def test_story_008_skill_angle_includes_internal_signal():
    """STORY-008: Each angle must include an internal signal connection (from captures/thoughts)."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "internal" in content and ("capture" in content or "thought" in content), (
        "SKILL.md must require each angle to include an internal signal connection "
        "(from the user's captures or thoughts)."
    )


def test_story_008_skill_angle_includes_external_signal():
    """STORY-008: Each angle must include an external signal connection (from sources)."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "external" in content and ("source" in content or "signal" in content), (
        "SKILL.md must require each angle to include an external signal connection."
    )


def test_story_008_skill_angle_includes_why_now_hook():
    """STORY-008: Each angle must include a 'why now' hook."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "why now" in content, (
        "SKILL.md must require each angle to include a 'why now' hook explaining timeliness."
    )


def test_story_008_skill_angle_includes_suggested_format():
    """STORY-008: Each angle must include a suggested format (LinkedIn/blog)."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "format" in content and ("linkedin" in content or "blog" in content), (
        "SKILL.md must require each angle to include a suggested format (LinkedIn or blog)."
    )


def test_story_008_skill_ranks_angles_by_strength():
    """STORY-008: SKILL.md must instruct ranking angles by strength."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "rank" in content and "angle" in content, (
        "SKILL.md must instruct ranking angles by strength "
        "(topic alignment + freshness + personal connection)."
    )


# ---------------------------------------------------------------------------
# Output file
# ---------------------------------------------------------------------------

def test_story_008_skill_writes_analysis_md():
    """STORY-008: SKILL.md must instruct writing analysis to analysis.md."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "analysis.md" in content, (
        "SKILL.md must instruct writing the analysis output to analysis.md."
    )


def test_story_008_skill_analysis_goes_in_pipeline_directory():
    """STORY-008: analysis.md must be written to the dated pipeline directory."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "analysis.md" in content and (
        "pipeline" in content.lower() or "YYYY-MM-DD" in content
    ), (
        "SKILL.md must write analysis.md inside content/pipeline/YYYY-MM-DD/."
    )


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_story_008_skill_handles_fewer_than_3_signals():
    """STORY-008: SKILL.md must handle fewer than 3 signals — still produce angles."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "fewer than 3" in content
        or "fewer than three" in content
        or ("1 signal" in content)
        or ("single signal" in content)
        or ("even 1" in content)
    ), (
        "SKILL.md must handle the edge case of fewer than 3 signals — "
        "even a single signal can be turned into an angle."
    )


def test_story_008_skill_handles_all_signals_deduplicated():
    """STORY-008: SKILL.md must handle all signals deduplicated — produce 'quiet day' brief."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "quiet day" in content or (
        "all" in content and "dedup" in content
    ) or "revisiting older" in content, (
        "SKILL.md must handle the edge case where all signals are deduplicated — "
        "it should produce a 'quiet day' brief and suggest revisiting older angles."
    )


def test_story_008_skill_handles_missing_personal_connection():
    """STORY-008: SKILL.md must handle angles with no personal connection — flag missing_voice."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "missing_voice" in content or (
        "no personal" in content.lower() and "flag" in content.lower()
    ), (
        "SKILL.md must flag 'missing_voice' when no personal connection can be found for an angle."
    )


def test_story_008_skill_clusters_signals_on_same_topic():
    """STORY-008: SKILL.md must cluster multiple signals on the same topic into one angle."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "cluster" in content or (
        "same topic" in content and ("all" in content or "cite" in content)
    ), (
        "SKILL.md must instruct clustering multiple signals on the same topic "
        "into a single angle that cites all sources."
    )
