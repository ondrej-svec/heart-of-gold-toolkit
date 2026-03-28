"""
STORY-009: /guide:pipeline — Create phase (daily brief)

Tests verify:
- SKILL.md instructs generating a daily brief with the three-section structure
- Brief structure: What's on Your Mind → Reading Digest → Content Ideas
- Reading digest has 8-12 items in Must-Read / Worth-a-Look / Rabbit-Holes tiers
- Each item has title, URL, and 1-2 sentence relevance hook
- Content Ideas: 2-4 angles with full angle data
- Brief written to content/daily/YYYY-MM-DD.md
- YAML frontmatter: date, sources_count, signals_fetched, angles_count
- Edge cases: fewer than 8 signals (smaller digest ok), no captures, unreadable signal content
"""
import os
import pytest
from conftest import GUIDE_ROOT

SKILL_MD = os.path.join(GUIDE_ROOT, "skills", "pipeline", "SKILL.md")


# ---------------------------------------------------------------------------
# Brief structure
# ---------------------------------------------------------------------------

def test_story_009_skill_creates_daily_brief():
    """STORY-009: SKILL.md must instruct generating a daily brief."""
    assert os.path.exists(SKILL_MD), f"SKILL.md not found at {SKILL_MD}"
    content = open(SKILL_MD).read().lower()
    assert "daily brief" in content or "brief" in content, (
        "SKILL.md must instruct generating a daily brief."
    )


def test_story_009_brief_has_whats_on_your_mind_section():
    """STORY-009: Brief must include a 'What's on Your Mind' section from capture synthesis."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "What's on Your Mind" in content or "what's on your mind" in content.lower(), (
        "SKILL.md must instruct including a 'What's on Your Mind' section "
        "synthesizing the user's captures."
    )


def test_story_009_brief_has_reading_digest_section():
    """STORY-009: Brief must include a Reading Digest section."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "Reading Digest" in content or "reading digest" in content.lower(), (
        "SKILL.md must instruct including a 'Reading Digest' section in the daily brief."
    )


def test_story_009_brief_has_content_ideas_section():
    """STORY-009: Brief must include a Content Ideas section."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "Content Ideas" in content or "content ideas" in content.lower(), (
        "SKILL.md must instruct including a 'Content Ideas' section in the daily brief."
    )


# ---------------------------------------------------------------------------
# Reading Digest tiers
# ---------------------------------------------------------------------------

def test_story_009_digest_has_must_read_tier():
    """STORY-009: Reading digest must have a 'Must-Read' tier."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "Must-Read" in content or "must-read" in content.lower() or "must read" in content.lower(), (
        "SKILL.md must instruct including a 'Must-Read' tier in the reading digest."
    )


def test_story_009_digest_has_worth_a_look_tier():
    """STORY-009: Reading digest must have a 'Worth-a-Look' tier."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "Worth-a-Look" in content or "worth-a-look" in content.lower() or "worth a look" in content.lower(), (
        "SKILL.md must instruct including a 'Worth-a-Look' tier in the reading digest."
    )


def test_story_009_digest_has_rabbit_holes_tier():
    """STORY-009: Reading digest must have a 'Rabbit-Holes' tier."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "Rabbit-Holes" in content or "rabbit-holes" in content.lower() or "rabbit holes" in content.lower(), (
        "SKILL.md must instruct including a 'Rabbit-Holes' tier in the reading digest."
    )


def test_story_009_digest_targets_8_to_12_items():
    """STORY-009: Reading digest must target 8-12 items."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "8-12" in content or ("8" in content and "12" in content), (
        "SKILL.md must specify targeting 8-12 items in the reading digest."
    )


# ---------------------------------------------------------------------------
# Item structure
# ---------------------------------------------------------------------------

def test_story_009_each_item_has_title_and_url():
    """STORY-009: Each digest item must include title and URL."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "title" in content and "url" in content, (
        "SKILL.md must instruct including title and URL for each digest item."
    )


def test_story_009_each_item_has_relevance_hook():
    """STORY-009: Each digest item must have a 1-2 sentence hook explaining relevance to the user."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "hook" in content or "relevance" in content, (
        "SKILL.md must instruct including a relevance hook for each digest item, "
        "explaining why it matters to the user specifically."
    )


# ---------------------------------------------------------------------------
# Output file and frontmatter
# ---------------------------------------------------------------------------

def test_story_009_brief_written_to_daily_directory():
    """STORY-009: Brief must be written to content/daily/YYYY-MM-DD.md."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "content/daily" in content or "daily_dir" in content, (
        "SKILL.md must instruct writing the daily brief to content/daily/ (or configured daily_dir)."
    )


def test_story_009_brief_has_yaml_frontmatter():
    """STORY-009: Brief file must include YAML frontmatter."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "frontmatter" in content or "yaml" in content, (
        "SKILL.md must instruct writing YAML frontmatter in the daily brief file."
    )


def test_story_009_frontmatter_includes_date():
    """STORY-009: YAML frontmatter must include 'date' field."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "date" in content and ("frontmatter" in content.lower() or "---" in content), (
        "SKILL.md must instruct including 'date' in the brief's YAML frontmatter."
    )


def test_story_009_frontmatter_includes_sources_count():
    """STORY-009: YAML frontmatter must include 'sources_count' field."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "sources_count" in content, (
        "SKILL.md must instruct including 'sources_count' in the brief's YAML frontmatter."
    )


def test_story_009_frontmatter_includes_signals_fetched():
    """STORY-009: YAML frontmatter must include 'signals_fetched' field."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "signals_fetched" in content, (
        "SKILL.md must instruct including 'signals_fetched' in the brief's YAML frontmatter."
    )


def test_story_009_frontmatter_includes_angles_count():
    """STORY-009: YAML frontmatter must include 'angles_count' field."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "angles_count" in content, (
        "SKILL.md must instruct including 'angles_count' in the brief's YAML frontmatter."
    )


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_story_009_handles_fewer_than_8_signals():
    """STORY-009: SKILL.md must handle fewer than 8 signals — smaller digest is acceptable."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "fewer than 8" in content
        or "smaller digest" in content
        or ("don't pad" in content or "no pad" in content)
        or ("low-quality" in content)
    ), (
        "SKILL.md must handle the case of fewer than 8 signals — "
        "a smaller digest is acceptable, don't pad with low-quality items."
    )


def test_story_009_handles_no_captures():
    """STORY-009: SKILL.md must handle missing captures — skip 'What's on Your Mind' section."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "no captures" in content or (
        "skip" in content and ("what's on your mind" in content or "capture" in content)
    ), (
        "SKILL.md must handle the edge case of no captures — "
        "skip the 'What's on Your Mind' section."
    )


def test_story_009_handles_unreadable_signal_content():
    """STORY-009: SKILL.md must handle signals with no readable content."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "couldn't fetch" in content
        or "could not fetch" in content
        or "no readable" in content
        or "title + url" in content
        or ("title" in content and "url only" in content)
    ), (
        "SKILL.md must handle signals with no readable content — "
        "use title + URL only and note 'couldn't fetch full content'."
    )
