"""
STORY-014: Port /capture skill to guide plugin as /guide:capture

Tests verify:
- plugins/guide/skills/capture/SKILL.md exists
- Skill describes AM and PM modes
- Skill reads output directory from content/config.yaml (config-driven)
- Skill falls back to content/captures/ when config is missing
- Skill preserves raw transcript (not just summary)
- Skill saves to YYYY-MM-DD-{am|pm}.md naming convention
- Skill uses append (not overwrite) when a capture for that period already exists
- Skill detects time of day automatically when am/pm not specified
- Skill works standalone (no dependency on pipeline having run)
"""
import os
import re
import pytest
from conftest import REPO_ROOT, GUIDE_ROOT

CAPTURE_SKILL = os.path.join(GUIDE_ROOT, "skills", "capture", "SKILL.md")


# ---------------------------------------------------------------------------
# Skill file existence
# ---------------------------------------------------------------------------

def test_story_014_capture_skill_exists():
    """STORY-014: plugins/guide/skills/capture/SKILL.md must exist."""
    assert os.path.exists(CAPTURE_SKILL), (
        f"Capture skill not found at {CAPTURE_SKILL}. "
        "Create plugins/guide/skills/capture/SKILL.md"
    )


# ---------------------------------------------------------------------------
# Skill content checks
# ---------------------------------------------------------------------------

def _read_skill():
    assert os.path.exists(CAPTURE_SKILL), f"SKILL.md not found at {CAPTURE_SKILL}"
    return open(CAPTURE_SKILL).read()


def test_story_014_skill_has_am_mode():
    """STORY-014: /guide:capture SKILL.md must describe AM (morning) mode."""
    content = _read_skill()
    assert re.search(r'\bam\b', content, re.IGNORECASE) or "morning" in content.lower(), (
        "SKILL.md must describe AM (morning) capture mode. "
        "The skill should behave differently in the morning vs evening."
    )


def test_story_014_skill_has_pm_mode():
    """STORY-014: /guide:capture SKILL.md must describe PM (evening) mode."""
    content = _read_skill()
    assert re.search(r'\bpm\b', content, re.IGNORECASE) or "evening" in content.lower(), (
        "SKILL.md must describe PM (evening) capture mode. "
        "Evening captures are different in tone and focus from morning ones."
    )


def test_story_014_skill_reads_config_for_output_dir():
    """STORY-014: SKILL.md must read output directory from content/config.yaml."""
    content = _read_skill()
    has_config = (
        "config.yaml" in content
        or "captures_dir" in content
        or re.search(r'output.*dir', content, re.IGNORECASE)
        or re.search(r'config.*captures', content, re.IGNORECASE)
    )
    assert has_config, (
        "SKILL.md must read the captures output directory from content/config.yaml "
        "(output.captures_dir), not hardcode it. This allows users to customize the path."
    )


def test_story_014_skill_falls_back_to_default_captures_dir():
    """STORY-014: SKILL.md must fall back to content/captures/ when config is missing."""
    content = _read_skill()
    has_fallback = (
        "content/captures" in content
        or re.search(r'fall.?back', content, re.IGNORECASE)
        or re.search(r'default.*captures', content, re.IGNORECASE)
        or re.search(r'captures.*default', content, re.IGNORECASE)
    )
    assert has_fallback, (
        "SKILL.md must document a fallback to content/captures/ when config.yaml "
        "is missing or captures_dir is not set."
    )


def test_story_014_skill_preserves_raw_transcript():
    """STORY-014: SKILL.md must preserve the raw transcript, not just a summary."""
    content = _read_skill()
    has_raw = (
        "raw" in content.lower()
        or "transcript" in content.lower()
        or re.search(r'preserv', content, re.IGNORECASE)
        or re.search(r'verbatim', content, re.IGNORECASE)
    )
    assert has_raw, (
        "SKILL.md must preserve the raw transcript. "
        "The original voice capture should be kept, not discarded after summarization."
    )


def test_story_014_skill_uses_date_am_pm_filename_convention():
    """STORY-014: SKILL.md must specify YYYY-MM-DD-{am|pm}.md filename convention."""
    content = _read_skill()
    has_date_convention = (
        re.search(r'YYYY-MM-DD', content)
        or re.search(r'\{am.pm\}', content)
        or re.search(r'am\.md', content)
        or re.search(r'pm\.md', content)
        or re.search(r'date.*am.*pm', content, re.IGNORECASE)
    )
    assert has_date_convention, (
        "SKILL.md must specify the filename convention: YYYY-MM-DD-{am|pm}.md "
        "(e.g. 2026-03-28-am.md). This ensures captures are uniquely named by day and period."
    )


def test_story_014_skill_appends_to_existing_capture():
    """STORY-014: SKILL.md must append to an existing capture rather than overwrite it."""
    content = _read_skill()
    has_append = (
        re.search(r'append', content, re.IGNORECASE)
        or re.search(r'don.t overwrite', content, re.IGNORECASE)
        or re.search(r'already exists', content, re.IGNORECASE)
        or re.search(r'add to', content, re.IGNORECASE)
    )
    assert has_append, (
        "SKILL.md must document appending to an existing capture file if one already exists "
        "for the same day/period. Do NOT overwrite previous captures."
    )


def test_story_014_skill_auto_detects_time_of_day():
    """STORY-014: SKILL.md must auto-detect am/pm from the current time if not specified."""
    content = _read_skill()
    has_autodetect = (
        re.search(r'auto.?detect', content, re.IGNORECASE)
        or re.search(r'time of day', content, re.IGNORECASE)
        or re.search(r'current.time', content, re.IGNORECASE)
        or re.search(r'detect.*am.*pm', content, re.IGNORECASE)
        or re.search(r'if.*not.*specified', content, re.IGNORECASE)
        or re.search(r'noon', content, re.IGNORECASE)
    )
    assert has_autodetect, (
        "SKILL.md must specify that when the user doesn't say 'am' or 'pm', "
        "the skill should auto-detect based on current time of day."
    )


def test_story_014_skill_works_without_pipeline():
    """STORY-014: SKILL.md must work standalone (no pipeline dependency)."""
    content = _read_skill()
    # Negative test: the skill should NOT require pipeline state files
    # Positive: no mandatory reference to signals.json or analysis.md
    requires_pipeline_output = (
        re.search(r'requires.*pipeline', content, re.IGNORECASE)
        or re.search(r'must.*run.*pipeline.*first', content, re.IGNORECASE)
        or re.search(r'depends.*on.*pipeline', content, re.IGNORECASE)
    )
    assert not requires_pipeline_output, (
        "SKILL.md must NOT require the pipeline to have run. "
        "/guide:capture is a standalone skill — users capture thoughts at any time."
    )


def test_story_014_skill_has_gentle_followup_prompts():
    """STORY-014: SKILL.md must include gentle follow-up prompts to draw out more from the user."""
    content = _read_skill()
    has_followup = (
        re.search(r'follow.?up', content, re.IGNORECASE)
        or re.search(r'gentle', content, re.IGNORECASE)
        or re.search(r'prompt', content, re.IGNORECASE)
        or re.search(r'ask.*more', content, re.IGNORECASE)
        or re.search(r'explore', content, re.IGNORECASE)
    )
    assert has_followup, (
        "SKILL.md must include gentle follow-up prompts to help the user explore their thoughts. "
        "This is a key UX requirement of the original /capture skill."
    )
