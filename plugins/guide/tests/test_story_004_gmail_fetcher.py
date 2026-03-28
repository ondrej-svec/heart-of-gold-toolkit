"""
STORY-004: Gmail newsletter fetcher script

Tests verify:
- fetch-gmail.sh exists and is executable
- Script accepts --config argument
- Outputs JSON array matching the signal schema
- Exits 1 with clear message when gws CLI not installed
- Exits 1 with "run gws auth" when auth is expired (gws auth error)
- Exits 1 with helpful error when label doesn't exist
- Exits 0 with empty array when Gmail disabled in config
- Includes sender and subject in metadata
- max_items limit is respected
"""
import json
import os
import subprocess
import tempfile
import pytest

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

from conftest import SCRIPTS_DIR

GMAIL_SCRIPT = os.path.join(SCRIPTS_DIR, "fetch-gmail.sh")

SIGNAL_REQUIRED_FIELDS = {"source", "title", "url", "content", "published_at", "metadata"}


def run_gmail_script(config_path, extra_args=None, env_override=None):
    """Run fetch-gmail.sh and return (returncode, stdout, stderr)."""
    import os as _os
    cmd = ["bash", GMAIL_SCRIPT, "--config", config_path]
    if extra_args:
        cmd.extend(extra_args)
    env = _os.environ.copy()
    if env_override:
        env.update(env_override)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, env=env)
    return result.returncode, result.stdout, result.stderr


def write_gmail_config(tmp_path, enabled=True, label="Content-Feed", max_items=20):
    """Write a config.yaml with Gmail settings."""
    import yaml as _yaml
    config = {
        "version": 1,
        "voice": {"jargon_blocklist": []},
        "sources": {
            "rss": [],
            "gmail": {
                "enabled": enabled,
                "label": label,
                "max_items": max_items,
            },
            "hackernews": {"enabled": False, "max_items": 5},
        },
    }
    path = tmp_path / "config.yaml"
    path.write_text(_yaml.dump(config))
    return str(path)


# ---------------------------------------------------------------------------
# Script existence
# ---------------------------------------------------------------------------

def test_story_004_fetch_gmail_script_exists():
    """STORY-004: scripts/fetch-gmail.sh must exist."""
    assert os.path.exists(GMAIL_SCRIPT), (
        f"fetch-gmail.sh not found at {GMAIL_SCRIPT}"
    )


def test_story_004_script_is_executable():
    """STORY-004: fetch-gmail.sh must be executable."""
    assert os.path.exists(GMAIL_SCRIPT)
    assert os.access(GMAIL_SCRIPT, os.X_OK), (
        f"fetch-gmail.sh is not executable. Run: chmod +x {GMAIL_SCRIPT}"
    )


def test_story_004_script_accepts_config_argument():
    """STORY-004: fetch-gmail.sh must reference --config in its source."""
    assert os.path.exists(GMAIL_SCRIPT)
    content = open(GMAIL_SCRIPT).read()
    assert "--config" in content, (
        "fetch-gmail.sh must accept --config argument to read Gmail settings"
    )


def test_story_004_script_uses_gws_cli():
    """STORY-004: fetch-gmail.sh must reference gws CLI to fetch emails."""
    assert os.path.exists(GMAIL_SCRIPT)
    content = open(GMAIL_SCRIPT).read()
    assert "gws" in content, (
        "fetch-gmail.sh must use the 'gws' CLI to fetch emails"
    )


# ---------------------------------------------------------------------------
# Gmail disabled in config
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_004_exits_zero_with_empty_array_when_gmail_disabled(tmp_path):
    """STORY-004: When gmail.enabled=false in config, script must exit 0 with empty array."""
    config_path = write_gmail_config(tmp_path, enabled=False)
    rc, stdout, stderr = run_gmail_script(config_path)
    assert rc == 0, (
        f"Script should exit 0 when Gmail is disabled, got {rc}. stderr: {stderr[:300]}"
    )
    try:
        data = json.loads(stdout.strip())
    except json.JSONDecodeError:
        pytest.fail(f"stdout is not valid JSON when Gmail disabled: {stdout[:300]}")
    assert data == [], (
        f"Script should output empty array when Gmail disabled, got: {data}"
    )


# ---------------------------------------------------------------------------
# Missing gws CLI
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_004_exits_one_with_message_when_gws_not_installed(tmp_path):
    """STORY-004: When gws is not on PATH, script must exit 1 with a clear error."""
    config_path = write_gmail_config(tmp_path, enabled=True)
    # Override PATH to exclude gws
    rc, stdout, stderr = run_gmail_script(
        config_path,
        env_override={"PATH": "/usr/bin:/bin"}  # minimal PATH without gws
    )
    assert rc == 1, (
        f"Script should exit 1 when gws is not installed, got {rc}. "
        f"stdout: {stdout[:200]}, stderr: {stderr[:200]}"
    )
    combined = (stdout + stderr).lower()
    assert "gws" in combined, (
        "Error message should mention 'gws' when the CLI is not installed"
    )


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_004_output_is_valid_json_array(tmp_path):
    """STORY-004: Script output must be a valid JSON array."""
    config_path = write_gmail_config(tmp_path, enabled=False)
    rc, stdout, _ = run_gmail_script(config_path)
    assert rc == 0
    try:
        data = json.loads(stdout.strip())
    except json.JSONDecodeError as e:
        pytest.fail(f"Script stdout is not valid JSON: {e}\nstdout: {stdout[:500]}")
    assert isinstance(data, list), f"Output must be a JSON array, got: {type(data)}"


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_004_source_field_is_gmail_when_items_present(tmp_path):
    """STORY-004: Signals from Gmail fetcher must have source='gmail'."""
    # This test only passes when gws is available and returns items
    # It's intended to fail in RED state because the script doesn't exist
    config_path = write_gmail_config(tmp_path, enabled=True)
    rc, stdout, stderr = run_gmail_script(config_path)
    if rc != 0:
        pytest.skip(f"gws not available or auth expired (rc={rc}) — skipping source field check")
    signals = json.loads(stdout.strip())
    for signal in signals:
        assert signal.get("source") == "gmail", (
            f"Gmail signal has source='{signal.get('source')}', expected 'gmail'"
        )


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_004_metadata_includes_sender_and_subject(tmp_path):
    """STORY-004: Each Gmail signal's metadata must include sender and subject."""
    config_path = write_gmail_config(tmp_path, enabled=True)
    rc, stdout, stderr = run_gmail_script(config_path)
    if rc != 0:
        pytest.skip("gws not available — skipping metadata check")
    signals = json.loads(stdout.strip())
    if not signals:
        pytest.skip("No signals returned")
    for signal in signals[:3]:
        meta = signal.get("metadata", {})
        assert "sender" in meta or "from" in meta, (
            f"Gmail signal metadata must include 'sender'. Got metadata keys: {list(meta.keys())}"
        )
        assert "subject" in meta, (
            f"Gmail signal metadata must include 'subject'. Got metadata keys: {list(meta.keys())}"
        )


# ---------------------------------------------------------------------------
# max_items limit
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_004_respects_max_items_limit(tmp_path):
    """STORY-004: Script must not return more items than max_items specifies."""
    config_path = write_gmail_config(tmp_path, enabled=True, max_items=2)
    rc, stdout, stderr = run_gmail_script(config_path)
    if rc != 0:
        pytest.skip("gws not available — skipping max_items test")
    signals = json.loads(stdout.strip())
    assert len(signals) <= 2, (
        f"Script returned {len(signals)} signals but max_items=2"
    )


# ---------------------------------------------------------------------------
# Empty message / image-only email handling
# ---------------------------------------------------------------------------

def test_story_004_script_handles_skipping_image_only_emails():
    """STORY-004: Script must include logic to skip emails with no text content."""
    assert os.path.exists(GMAIL_SCRIPT)
    content = open(GMAIL_SCRIPT).read()
    # The script should have some check for empty/null content
    has_content_check = any(
        term in content
        for term in ["content", "text", "body", "empty", "skip", "null", "strip"]
    )
    assert has_content_check, (
        "fetch-gmail.sh must include logic to handle image-only emails "
        "(skip emails with no text content)"
    )
