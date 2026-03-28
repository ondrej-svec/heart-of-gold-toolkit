"""
STORY-013: /guide:pipeline — Deliver phase

Tests verify:
- pipeline/SKILL.md exists and covers the Deliver phase
- Skill references all four output dirs (daily_dir, drafts_dir, pipeline_dir)
- Skill specifies file collision avoidance (-2, -3 suffixes)
- Skill documents creating output directories if they don't exist
- Skill specifies notification on completion with the required summary format
- Skill documents that notification failure must NOT fail the pipeline
- Skill handles "all notifications disabled" case silently
- notify.sh exists (notification delivery mechanism)
- notify.sh supports the required notification summary format
"""
import os
import re
import pytest
from conftest import REPO_ROOT, GUIDE_ROOT, SCRIPTS_DIR

PIPELINE_SKILL = os.path.join(GUIDE_ROOT, "skills", "pipeline", "SKILL.md")
NOTIFY_SCRIPT = os.path.join(SCRIPTS_DIR, "notify.sh")


# ---------------------------------------------------------------------------
# Skill file existence
# ---------------------------------------------------------------------------

def test_story_013_pipeline_skill_exists():
    """STORY-013: plugins/guide/skills/pipeline/SKILL.md must exist."""
    assert os.path.exists(PIPELINE_SKILL), (
        f"Pipeline skill not found at {PIPELINE_SKILL}. "
        "Create plugins/guide/skills/pipeline/SKILL.md"
    )


# ---------------------------------------------------------------------------
# Deliver phase content in SKILL.md
# ---------------------------------------------------------------------------

def _read_skill():
    assert os.path.exists(PIPELINE_SKILL), f"SKILL.md not found at {PIPELINE_SKILL}"
    return open(PIPELINE_SKILL).read()


def test_story_013_skill_mentions_deliver_phase():
    """STORY-013: SKILL.md must describe a Deliver phase (or Step 5/Deliver)."""
    content = _read_skill()
    assert re.search(r'deliver', content, re.IGNORECASE), (
        "SKILL.md must mention the Deliver phase. "
        "Pipeline has 5 phases: fetch, analyze, create, edit, deliver."
    )


def test_story_013_skill_references_daily_dir():
    """STORY-013: SKILL.md must reference the daily_dir output location."""
    content = _read_skill()
    assert "daily_dir" in content or "daily" in content, (
        "SKILL.md must reference output.daily_dir for writing the daily brief"
    )


def test_story_013_skill_references_drafts_dir():
    """STORY-013: SKILL.md must reference the drafts_dir output location."""
    content = _read_skill()
    assert "drafts_dir" in content or "drafts" in content, (
        "SKILL.md must reference output.drafts_dir for writing LinkedIn drafts"
    )


def test_story_013_skill_references_pipeline_dir():
    """STORY-013: SKILL.md must reference the pipeline_dir for state preservation."""
    content = _read_skill()
    assert "pipeline_dir" in content or "pipeline" in content, (
        "SKILL.md must reference output.pipeline_dir for preserving pipeline state"
    )


def test_story_013_skill_documents_file_collision_avoidance():
    """STORY-013: SKILL.md must document collision avoidance (append -2, -3 suffixes)."""
    content = _read_skill()
    has_collision = (
        "-2" in content
        or "collision" in content.lower()
        or "already exists" in content.lower()
        or re.search(r'suffix', content, re.IGNORECASE)
        or re.search(r'append.*\d', content, re.IGNORECASE)
    )
    assert has_collision, (
        "SKILL.md must document file collision avoidance: "
        "if a file already exists, append -2, -3 etc. to the filename. "
        "This prevents second pipeline runs from overwriting first-run output."
    )


def test_story_013_skill_creates_output_dirs_if_missing():
    """STORY-013: SKILL.md must document creating output directories if they don't exist."""
    content = _read_skill()
    has_mkdir = (
        "mkdir" in content
        or re.search(r"creat.*director", content, re.IGNORECASE)
        or re.search(r"director.*not exist", content, re.IGNORECASE)
        or re.search(r"ensur.*director", content, re.IGNORECASE)
    )
    assert has_mkdir, (
        "SKILL.md must document that the Deliver phase creates output directories "
        "if they don't exist. Users may not have content/daily/ pre-created."
    )


def test_story_013_skill_documents_notification_on_completion():
    """STORY-013: SKILL.md must document sending a notification after delivery."""
    content = _read_skill()
    assert re.search(r'notif', content, re.IGNORECASE), (
        "SKILL.md must describe sending a notification on pipeline completion. "
        "The notification should summarize: signal count, top angle, file path, draft status."
    )


def test_story_013_skill_notification_summary_format():
    """STORY-013: SKILL.md must specify the notification summary format with N signals + top angle."""
    content = _read_skill()
    # The spec says: "{N} signals today. Top angle: {angle_title}. Brief: {path}. Draft: {ready|needs review}"
    has_signal_count = re.search(r'signal', content, re.IGNORECASE)
    has_angle = re.search(r'angle', content, re.IGNORECASE)
    assert has_signal_count, (
        "SKILL.md notification summary must include signal count (e.g. '5 signals today')"
    )
    assert has_angle, (
        "SKILL.md notification summary must include top angle title"
    )


def test_story_013_skill_notification_failure_does_not_fail_pipeline():
    """STORY-013: SKILL.md must specify that notification failure must NOT fail the pipeline."""
    content = _read_skill()
    has_resilience = (
        re.search(r'notif.*fail.*log', content, re.IGNORECASE)
        or re.search(r'log.*error.*notif', content, re.IGNORECASE)
        or re.search(r"notif.*fail.*don.t fail", content, re.IGNORECASE)
        or re.search(r"notif.*error.*continu", content, re.IGNORECASE)
        or re.search(r"notif.*fail.*pipeline", content, re.IGNORECASE)
        or re.search(r"even if.*notif", content, re.IGNORECASE)
    )
    assert has_resilience, (
        "SKILL.md must specify that notification failure should log the error "
        "but NOT fail the overall pipeline. The brief has already been written."
    )


def test_story_013_skill_handles_notifications_disabled():
    """STORY-013: SKILL.md must handle the case where all notifications are disabled."""
    content = _read_skill()
    has_disabled = (
        re.search(r'disabled', content, re.IGNORECASE)
        or re.search(r'notif.*skip', content, re.IGNORECASE)
        or re.search(r'enabled.*false', content, re.IGNORECASE)
        or re.search(r'no.*notif', content, re.IGNORECASE)
    )
    assert has_disabled, (
        "SKILL.md must handle the case where notifications are disabled in config. "
        "When disabled, skip silently without logging an error."
    )


# ---------------------------------------------------------------------------
# notify.sh integration
# ---------------------------------------------------------------------------

def test_story_013_notify_script_exists():
    """STORY-013: scripts/notify.sh must exist (used by deliver phase for notifications)."""
    assert os.path.exists(NOTIFY_SCRIPT), (
        f"notify.sh not found at {NOTIFY_SCRIPT}. "
        "The deliver phase depends on scripts/notify.sh for sending notifications."
    )


def test_story_013_notify_script_is_shell():
    """STORY-013: notify.sh must be a shell script (has shebang line)."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    assert content.startswith("#!/"), (
        "notify.sh must start with a shebang line (e.g. #!/bin/bash or #!/bin/sh)"
    )


def test_story_013_notify_script_accepts_message_flag():
    """STORY-013: notify.sh must accept --message flag (used to pass the notification summary)."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    assert "--message" in content, (
        "notify.sh must accept --message flag to receive the notification text. "
        "The deliver phase calls: notify.sh --type imessage --recipient ... --message '...'"
    )
