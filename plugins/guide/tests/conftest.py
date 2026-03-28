"""
Shared pytest configuration for Heart of Gold toolkit tests.
REPO_ROOT points to the marketplace repo root (heart-of-gold-toolkit/).
"""
import os
import pytest

# Three levels up from plugins/guide/tests/ → repo root
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
GUIDE_ROOT = os.path.join(REPO_ROOT, "plugins", "guide")
SCRIPTS_DIR = os.path.join(GUIDE_ROOT, "scripts")
DEFAULTS_DIR = os.path.join(GUIDE_ROOT, "defaults")


@pytest.fixture
def repo_root():
    return REPO_ROOT


@pytest.fixture
def guide_root():
    return GUIDE_ROOT


@pytest.fixture
def scripts_dir():
    return SCRIPTS_DIR


@pytest.fixture
def defaults_dir():
    return DEFAULTS_DIR


@pytest.fixture
def tmp_config(tmp_path):
    """Write a minimal config.yaml to a temp dir and return the path."""
    config_content = """
version: 1
voice:
  name: test
  reference: thoughts/writing-voice.md
  tone: [plain]
  jargon_blocklist: []
themes:
  professional:
    - engineering leadership
sources:
  rss:
    - url: https://example.com/feed
      freshness_hours: 72
  gmail:
    enabled: false
    label: Content-Feed
    max_items: 5
  hackernews:
    enabled: false
    max_items: 5
cadence:
  linkedin:
    per_week: 3
notifications:
  imessage:
    enabled: false
  slack:
    enabled: false
output:
  daily_dir: content/daily
  drafts_dir: content/drafts
  pipeline_dir: content/pipeline
  captures_dir: content/captures
"""
    config_path = tmp_path / "config.yaml"
    config_path.write_text(config_content)
    return str(config_path)
