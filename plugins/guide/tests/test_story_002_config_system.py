"""
STORY-002: Guide plugin skeleton with config system

Tests verify:
- defaults/config.yaml exists with full schema
- Config covers all required sections (voice, themes, sources, cadence, notifications, output)
- voice.reference and at least one source are present
- Jargon blocklist has all 17 terms
- Config is valid YAML (not just a placeholder)
- The jargon blocklist contains distinct, non-empty terms
"""
import os
import pytest

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

from conftest import DEFAULTS_DIR, REPO_ROOT

REQUIRED_JARGON_COUNT = 17
DEFAULT_CONFIG_PATH = os.path.join(DEFAULTS_DIR, "config.yaml")


# ---------------------------------------------------------------------------
# File existence
# ---------------------------------------------------------------------------

def test_story_002_default_config_exists():
    """STORY-002: defaults/config.yaml must exist in the guide plugin."""
    assert os.path.exists(DEFAULT_CONFIG_PATH), (
        f"defaults/config.yaml not found at {DEFAULT_CONFIG_PATH}"
    )


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_002_default_config_is_valid_yaml():
    """STORY-002: defaults/config.yaml must be parseable YAML."""
    assert os.path.exists(DEFAULT_CONFIG_PATH)
    with open(DEFAULT_CONFIG_PATH) as f:
        data = yaml.safe_load(f)
    assert data is not None, "defaults/config.yaml parsed to None — file is empty or comment-only"
    assert isinstance(data, dict), "defaults/config.yaml must be a YAML mapping (dict)"


# ---------------------------------------------------------------------------
# Top-level sections
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
@pytest.mark.parametrize("section", ["voice", "themes", "sources", "cadence", "notifications", "output"])
def test_story_002_config_has_required_section(section):
    """STORY-002: defaults/config.yaml must include all required top-level sections."""
    assert os.path.exists(DEFAULT_CONFIG_PATH)
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    assert section in data, (
        f"defaults/config.yaml missing required section: '{section}'"
    )


# ---------------------------------------------------------------------------
# Voice section
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_002_voice_has_reference_field():
    """STORY-002: voice section must include a 'reference' field for the voice profile path."""
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    voice = data.get("voice", {})
    assert "reference" in voice, (
        "voice section must have a 'reference' field pointing to the user's voice profile"
    )


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_002_voice_has_jargon_blocklist():
    """STORY-002: voice section must include a jargon_blocklist."""
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    voice = data.get("voice", {})
    assert "jargon_blocklist" in voice, "voice section missing 'jargon_blocklist'"
    assert isinstance(voice["jargon_blocklist"], list), "jargon_blocklist must be a list"


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_002_jargon_blocklist_has_17_terms():
    """STORY-002: jargon_blocklist must contain exactly 17 terms (per the PRD)."""
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    blocklist = data.get("voice", {}).get("jargon_blocklist", [])
    assert len(blocklist) == REQUIRED_JARGON_COUNT, (
        f"jargon_blocklist has {len(blocklist)} terms, expected {REQUIRED_JARGON_COUNT}"
    )


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_002_jargon_blocklist_terms_are_non_empty_strings():
    """STORY-002: Each jargon term must be a non-empty string (not a placeholder)."""
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    blocklist = data.get("voice", {}).get("jargon_blocklist", [])
    for term in blocklist:
        assert isinstance(term, str), f"jargon term must be a string, got: {type(term)}"
        assert term.strip(), f"jargon term must not be empty or whitespace-only"


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_002_jargon_blocklist_terms_are_unique():
    """STORY-002: Jargon blocklist must not have duplicate terms."""
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    blocklist = data.get("voice", {}).get("jargon_blocklist", [])
    assert len(blocklist) == len(set(blocklist)), (
        f"jargon_blocklist contains duplicate terms"
    )


# ---------------------------------------------------------------------------
# Sources section
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_002_sources_has_rss_section():
    """STORY-002: sources must have an 'rss' section."""
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    sources = data.get("sources", {})
    assert "rss" in sources, "sources section missing 'rss'"


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_002_sources_rss_has_at_least_one_feed():
    """STORY-002: RSS sources must include at least one feed with a URL."""
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    rss_feeds = data.get("sources", {}).get("rss", [])
    assert isinstance(rss_feeds, list), "sources.rss must be a list"
    assert len(rss_feeds) >= 1, "sources.rss must have at least one feed"
    for feed in rss_feeds:
        assert "url" in feed, f"RSS feed entry missing 'url': {feed}"
        assert "freshness_hours" in feed, f"RSS feed entry missing 'freshness_hours': {feed}"


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_002_sources_has_gmail_section():
    """STORY-002: sources must have a 'gmail' section with enabled flag."""
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    gmail = data.get("sources", {}).get("gmail", {})
    assert "enabled" in gmail, "sources.gmail missing 'enabled' field"
    assert "label" in gmail, "sources.gmail missing 'label' field"
    assert "max_items" in gmail, "sources.gmail missing 'max_items' field"


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_002_sources_has_hackernews_section():
    """STORY-002: sources must have a 'hackernews' section with enabled flag."""
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    hn = data.get("sources", {}).get("hackernews", {})
    assert "enabled" in hn, "sources.hackernews missing 'enabled' field"
    assert "max_items" in hn, "sources.hackernews missing 'max_items' field"


# ---------------------------------------------------------------------------
# Output section
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
@pytest.mark.parametrize("field", ["daily_dir", "drafts_dir", "pipeline_dir", "captures_dir"])
def test_story_002_output_section_has_required_dirs(field):
    """STORY-002: output section must specify all four directory paths."""
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    output = data.get("output", {})
    assert field in output, f"output section missing '{field}'"


# ---------------------------------------------------------------------------
# Notifications section
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_002_notifications_has_imessage_and_slack():
    """STORY-002: notifications must have imessage and slack subsections."""
    data = yaml.safe_load(open(DEFAULT_CONFIG_PATH))
    notifications = data.get("notifications", {})
    assert "imessage" in notifications, "notifications missing 'imessage'"
    assert "slack" in notifications, "notifications missing 'slack'"


# ---------------------------------------------------------------------------
# Config is not a minimal stub — it has actual content with comments
# ---------------------------------------------------------------------------

def test_story_002_default_config_has_documentation_comments():
    """STORY-002: defaults/config.yaml must contain comments documenting fields."""
    assert os.path.exists(DEFAULT_CONFIG_PATH)
    raw = open(DEFAULT_CONFIG_PATH).read()
    # Count comment lines — a real documented config should have several
    comment_lines = [line for line in raw.splitlines() if line.strip().startswith("#")]
    assert len(comment_lines) >= 5, (
        f"defaults/config.yaml has only {len(comment_lines)} comment lines. "
        "The spec requires a fully documented config with comments explaining each field."
    )
