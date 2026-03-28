"""
STORY-016: Pipeline scheduling via launchd [INTEGRATION]

Tests verify:
- A launchd plist file OR schedule config exists in the guide plugin
- The plist/config references headless Claude invocation
- The plist/config specifies a default scheduled time (6:00 AM)
- The log output path (content/logs/YYYY-MM-DD.log) is referenced
- A lock file mechanism is documented (prevents duplicate concurrent runs)
- Documentation on setup / modification is present in guide README or a dedicated doc
- The plist is valid XML (if a .plist file is provided)
"""
import os
import re
import xml.etree.ElementTree as ET
import pytest
from conftest import REPO_ROOT, GUIDE_ROOT

GUIDE_README = os.path.join(GUIDE_ROOT, "README.md")

# Possible locations for the launchd plist or schedule config
PLIST_CANDIDATES = [
    os.path.join(GUIDE_ROOT, "scripts", "com.heart-of-gold.pipeline.plist"),
    os.path.join(GUIDE_ROOT, "scripts", "heart-of-gold-pipeline.plist"),
    os.path.join(GUIDE_ROOT, "schedule", "com.heart-of-gold.pipeline.plist"),
    os.path.join(GUIDE_ROOT, "launchd", "com.heart-of-gold.pipeline.plist"),
    os.path.join(REPO_ROOT, "com.heart-of-gold.pipeline.plist"),
    os.path.join(GUIDE_ROOT, "scripts", "schedule.json"),
    os.path.join(GUIDE_ROOT, "schedule", "schedule.json"),
]

SCHEDULE_DOCS_CANDIDATES = [
    os.path.join(GUIDE_ROOT, "README.md"),
    os.path.join(GUIDE_ROOT, "docs", "scheduling.md"),
    os.path.join(GUIDE_ROOT, "SCHEDULING.md"),
]


def _find_schedule_artifact():
    """Return the first schedule config/plist that exists, or None."""
    for path in PLIST_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


def _find_schedule_docs():
    """Return the first docs file that mentions scheduling, or None."""
    for path in SCHEDULE_DOCS_CANDIDATES:
        if os.path.exists(path):
            content = open(path).read()
            if re.search(r'launchd|schedule|cron|6.00|6:00', content, re.IGNORECASE):
                return path, content
    return None, None


# ---------------------------------------------------------------------------
# Schedule artifact existence
# ---------------------------------------------------------------------------

def test_story_016_schedule_artifact_exists():
    """STORY-016: A launchd plist or schedule config must exist for the pipeline."""
    artifact = _find_schedule_artifact()
    assert artifact is not None, (
        "No schedule artifact found. Expected one of:\n"
        + "\n".join(f"  - {p}" for p in PLIST_CANDIDATES)
        + "\n\nCreate a launchd .plist file or a schedule.json config to automate pipeline runs."
    )


def test_story_016_schedule_artifact_references_claude():
    """STORY-016: The schedule artifact must reference the claude CLI (headless invocation)."""
    artifact = _find_schedule_artifact()
    assert artifact is not None, "No schedule artifact found (see test_story_016_schedule_artifact_exists)"
    content = open(artifact).read()
    assert re.search(r'\bclaude\b', content, re.IGNORECASE), (
        f"Schedule artifact at {artifact} must reference the claude CLI. "
        "Pipeline runs headlessly via: claude -p '...' --allowedTools '...' --model sonnet"
    )


def test_story_016_schedule_artifact_specifies_time():
    """STORY-016: The schedule artifact must specify a scheduled time (default 6:00 AM)."""
    artifact = _find_schedule_artifact()
    assert artifact is not None, "No schedule artifact found"
    content = open(artifact).read()
    has_time = (
        re.search(r'6.?:?0+', content)          # 6:00 or 6am or Hour=6
        or re.search(r'Hour.*6\b', content)
        or re.search(r'StartCalendarInterval', content)
        or re.search(r'cron.*\b6\b', content, re.IGNORECASE)
        or re.search(r'"hour".*:.*6', content, re.IGNORECASE)
        or re.search(r'hour.*6', content, re.IGNORECASE)
    )
    assert has_time, (
        f"Schedule artifact at {artifact} must specify the scheduled time. "
        "Default is 6:00 AM. For launchd: use StartCalendarInterval with Hour=6."
    )


def test_story_016_plist_is_valid_xml_if_plist():
    """STORY-016: If the schedule artifact is a .plist file, it must be valid XML."""
    artifact = _find_schedule_artifact()
    if artifact is None:
        pytest.skip("No schedule artifact found")
    if not artifact.endswith(".plist"):
        pytest.skip(f"Schedule artifact is not a .plist file: {artifact}")
    try:
        tree = ET.parse(artifact)
        root = tree.getroot()
        assert root is not None, "plist XML root element is None"
    except ET.ParseError as e:
        pytest.fail(
            f"launchd plist at {artifact} is not valid XML: {e}. "
            "macOS launchd will reject a malformed plist."
        )


def test_story_016_plist_is_launchd_plist_type():
    """STORY-016: If the schedule artifact is a .plist, it must be a launchd plist (DOCTYPE or dict keys)."""
    artifact = _find_schedule_artifact()
    if artifact is None:
        pytest.skip("No schedule artifact found")
    if not artifact.endswith(".plist"):
        pytest.skip(f"Schedule artifact is not a .plist file: {artifact}")
    content = open(artifact).read()
    has_launchd_keys = (
        "StartCalendarInterval" in content
        or "ProgramArguments" in content
        or "Label" in content
    )
    assert has_launchd_keys, (
        f"Plist at {artifact} must contain launchd-specific keys: "
        "Label, ProgramArguments, StartCalendarInterval. "
        "See: https://www.launchd.info/"
    )


# ---------------------------------------------------------------------------
# Log path
# ---------------------------------------------------------------------------

def test_story_016_log_path_referenced():
    """STORY-016: content/logs/ must be referenced in the schedule artifact or docs."""
    artifact = _find_schedule_artifact()
    docs_path, docs_content = _find_schedule_docs()

    found_log = False
    if artifact and os.path.exists(artifact):
        artifact_content = open(artifact).read()
        if re.search(r'content/logs|logs/.*\.log', artifact_content):
            found_log = True
    if docs_content and re.search(r'content/logs|logs/.*\.log', docs_content):
        found_log = True

    assert found_log, (
        "content/logs/ path must be referenced in the schedule artifact or its documentation. "
        "Pipeline logs should go to content/logs/YYYY-MM-DD.log for debugging."
    )


# ---------------------------------------------------------------------------
# Lock file (prevent duplicate runs)
# ---------------------------------------------------------------------------

def test_story_016_lock_file_mechanism_documented():
    """STORY-016: A lock file mechanism must be documented to prevent concurrent pipeline runs."""
    artifact = _find_schedule_artifact()
    docs_path, docs_content = _find_schedule_docs()

    found_lock = False
    if artifact and os.path.exists(artifact):
        artifact_content = open(artifact).read()
        if re.search(r'lock', artifact_content, re.IGNORECASE):
            found_lock = True
    if docs_content and re.search(r'lock', docs_content, re.IGNORECASE):
        found_lock = True

    assert found_lock, (
        "A lock file mechanism must be documented. "
        "If the previous pipeline run is still in progress when the scheduler fires, "
        "the new run should skip (use a .lock file to detect this)."
    )


# ---------------------------------------------------------------------------
# Setup documentation
# ---------------------------------------------------------------------------

def test_story_016_setup_documentation_exists():
    """STORY-016: Documentation on how to set up or modify the schedule must exist."""
    docs_path, docs_content = _find_schedule_docs()
    assert docs_path is not None, (
        "No scheduling documentation found. "
        "Expected the guide README or a dedicated doc to explain how to set up the schedule. "
        f"Checked: {SCHEDULE_DOCS_CANDIDATES}"
    )


def test_story_016_documentation_mentions_headless_claude():
    """STORY-016: Scheduling docs must show the headless Claude invocation command."""
    docs_path, docs_content = _find_schedule_docs()
    assert docs_path is not None, "No scheduling documentation found"
    has_headless = (
        re.search(r'claude\s+-p', docs_content)
        or re.search(r'headless', docs_content, re.IGNORECASE)
        or re.search(r'--allowedTools', docs_content)
        or re.search(r'--model.*sonnet', docs_content)
    )
    assert has_headless, (
        f"Docs at {docs_path} must show the headless Claude invocation. "
        "Example: claude -p '<prompt>' --allowedTools '...' --model sonnet"
    )


def test_story_016_documentation_mentions_modification():
    """STORY-016: Documentation must explain how to modify the schedule (not just set it up)."""
    docs_path, docs_content = _find_schedule_docs()
    assert docs_path is not None, "No scheduling documentation found"
    has_modify = (
        re.search(r'modif', docs_content, re.IGNORECASE)
        or re.search(r'chang.*time', docs_content, re.IGNORECASE)
        or re.search(r'adjust', docs_content, re.IGNORECASE)
        or re.search(r'customi', docs_content, re.IGNORECASE)
        or re.search(r'edit.*plist', docs_content, re.IGNORECASE)
    )
    assert has_modify, (
        f"Docs at {docs_path} must explain how to modify the schedule "
        "(e.g. how to change the 6 AM default to a different time)."
    )
