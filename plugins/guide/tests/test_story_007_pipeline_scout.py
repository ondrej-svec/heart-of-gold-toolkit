"""
STORY-007: /guide:pipeline — Scout phase

Tests verify:
- skills/pipeline/SKILL.md exists
- SKILL.md instructs running all three fetch scripts (rss, gmail, hn)
- SKILL.md instructs reading captures from content/captures/ (last 7 days)
- SKILL.md instructs reading the voice profile from config
- SKILL.md instructs reading recent daily briefs (last 3) for deduplication context
- SKILL.md instructs writing combined signals to content/pipeline/YYYY-MM-DD/signals.json
- SKILL.md instructs logging which sources succeeded/failed
- SKILL.md handles the all-scripts-fail edge case (brief from captures only)
- SKILL.md handles the no-captures edge case (proceed with external signals)
- SKILL.md handles pipeline dir already existing (appends run number)
- agents/scout.md exists
"""
import os
import pytest
from conftest import GUIDE_ROOT

SKILL_MD = os.path.join(GUIDE_ROOT, "skills", "pipeline", "SKILL.md")
SCOUT_AGENT_MD = os.path.join(GUIDE_ROOT, "agents", "scout.md")


# ---------------------------------------------------------------------------
# File existence
# ---------------------------------------------------------------------------

def test_story_007_pipeline_skill_md_exists():
    """STORY-007: skills/pipeline/SKILL.md must exist."""
    assert os.path.exists(SKILL_MD), (
        f"Pipeline SKILL.md not found at {SKILL_MD}. "
        "Create plugins/guide/skills/pipeline/SKILL.md to implement the pipeline skill."
    )


def test_story_007_scout_agent_exists():
    """STORY-007: agents/scout.md must exist (source analysis subagent)."""
    assert os.path.exists(SCOUT_AGENT_MD), (
        f"scout.md not found at {SCOUT_AGENT_MD}. "
        "Create plugins/guide/agents/scout.md as the source analysis subagent."
    )


# ---------------------------------------------------------------------------
# Fetch scripts are invoked
# ---------------------------------------------------------------------------

def test_story_007_skill_invokes_rss_fetcher():
    """STORY-007: SKILL.md must instruct running the fetch-rss.py script."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "fetch-rss.py" in content, (
        "SKILL.md must mention 'fetch-rss.py' to run the RSS fetcher in the scout phase."
    )


def test_story_007_skill_invokes_gmail_fetcher():
    """STORY-007: SKILL.md must instruct running the fetch-gmail.sh script."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "fetch-gmail.sh" in content, (
        "SKILL.md must mention 'fetch-gmail.sh' to run the Gmail fetcher in the scout phase."
    )


def test_story_007_skill_invokes_hn_fetcher():
    """STORY-007: SKILL.md must instruct running the fetch-hn.sh script."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "fetch-hn.sh" in content, (
        "SKILL.md must mention 'fetch-hn.sh' to run the HN fetcher in the scout phase."
    )


# ---------------------------------------------------------------------------
# Reading context sources
# ---------------------------------------------------------------------------

def test_story_007_skill_reads_captures_directory():
    """STORY-007: SKILL.md must instruct reading recent captures from content/captures/."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "content/captures" in content or "captures_dir" in content, (
        "SKILL.md must instruct reading user captures from content/captures/ "
        "(or configured captures_dir) in the scout phase."
    )


def test_story_007_skill_reads_last_7_days_captures():
    """STORY-007: SKILL.md must specify reading last 7 days of captures."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "7" in content and ("day" in content.lower() or "days" in content.lower()), (
        "SKILL.md must specify reading captures from the last 7 days."
    )


def test_story_007_skill_reads_voice_profile():
    """STORY-007: SKILL.md must instruct reading the voice profile from config."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "voice" in content.lower() and (
        "profile" in content.lower() or "reference" in content.lower()
    ), (
        "SKILL.md must instruct reading the voice profile path from config."
    )


def test_story_007_skill_reads_recent_briefs_for_dedup():
    """STORY-007: SKILL.md must instruct reading last 3 daily briefs for deduplication context."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "dedup" in content.lower() or "deduplication" in content.lower(), (
        "SKILL.md must mention deduplication context (reading recent briefs) in scout phase."
    )
    assert "3" in content, (
        "SKILL.md must specify reading last 3 briefs for deduplication context."
    )


# ---------------------------------------------------------------------------
# Writing output
# ---------------------------------------------------------------------------

def test_story_007_skill_writes_signals_json():
    """STORY-007: SKILL.md must instruct writing combined signals to signals.json."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "signals.json" in content, (
        "SKILL.md must mention writing signals.json in the scout phase output."
    )


def test_story_007_skill_writes_to_pipeline_directory():
    """STORY-007: SKILL.md must instruct writing to content/pipeline/YYYY-MM-DD/ directory."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "pipeline" in content.lower() and (
        "YYYY-MM-DD" in content or "pipeline_dir" in content
    ), (
        "SKILL.md must instruct writing output to a dated pipeline directory "
        "(e.g. content/pipeline/YYYY-MM-DD/)."
    )


def test_story_007_skill_logs_source_success_and_failure():
    """STORY-007: SKILL.md must instruct logging which sources succeeded and which failed."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert ("log" in content.lower() or "report" in content.lower()) and (
        "fail" in content.lower() or "success" in content.lower() or "error" in content.lower()
    ), (
        "SKILL.md must instruct logging which sources succeeded and which failed."
    )


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_story_007_skill_handles_all_scripts_fail():
    """STORY-007: SKILL.md must handle the case where all fetch scripts fail."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    # Must mention the fallback: produce brief from captures only
    assert (
        "captures only" in content.lower()
        or "no external" in content.lower()
        or ("all" in content.lower() and "fail" in content.lower())
    ), (
        "SKILL.md must handle the edge case where all fetch scripts fail — "
        "it should notify the user and produce a brief from captures only."
    )


def test_story_007_skill_handles_no_captures():
    """STORY-007: SKILL.md must handle the case where no captures exist."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "no captures" in content.lower() or (
        "captures" in content.lower() and "external" in content.lower()
    ), (
        "SKILL.md must handle the edge case where no captures exist — "
        "it should proceed with external signals only."
    )


def test_story_007_skill_handles_pipeline_dir_already_exists():
    """STORY-007: SKILL.md must handle the case where pipeline dir already exists today."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert (
        "signals-2" in content
        or "run number" in content.lower()
        or ("already exists" in content.lower() and "append" in content.lower())
        or "-2" in content
    ), (
        "SKILL.md must handle pipeline directory already existing today — "
        "it should append a run number (e.g. signals-2.json)."
    )


# ---------------------------------------------------------------------------
# Scout agent content
# ---------------------------------------------------------------------------

def test_story_007_scout_agent_has_meaningful_content():
    """STORY-007: agents/scout.md must not be an empty stub."""
    assert os.path.exists(SCOUT_AGENT_MD)
    content = open(SCOUT_AGENT_MD).read().strip()
    assert len(content) >= 100, (
        f"agents/scout.md is too short ({len(content)} chars) — "
        "it must contain real subagent instructions, not just a placeholder."
    )


def test_story_007_scout_agent_references_signal_analysis():
    """STORY-007: agents/scout.md must instruct the agent to analyze source signals."""
    assert os.path.exists(SCOUT_AGENT_MD)
    content = open(SCOUT_AGENT_MD).read().lower()
    assert "signal" in content or "source" in content, (
        "agents/scout.md must reference signals or sources — "
        "it is the source analysis subagent."
    )
