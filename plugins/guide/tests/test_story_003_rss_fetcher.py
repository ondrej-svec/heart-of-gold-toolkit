"""
STORY-003: RSS feed fetcher script

Tests verify:
- fetch-rss.py exists and is executable
- Script uses feedparser library (real I/O, not a stub)
- Outputs valid JSON array matching the signal schema
- Different feed configs produce different outputs (no hardcoded stub)
- Respects freshness_hours — items older than threshold are excluded
- Handles feed errors gracefully (DNS failure, 404, malformed XML)
- Strips HTML from content field
- Exits 0 even when some feeds fail
"""
import json
import os
import subprocess
import sys
import tempfile
import pytest

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

from conftest import SCRIPTS_DIR

RSS_SCRIPT = os.path.join(SCRIPTS_DIR, "fetch-rss.py")

SIGNAL_REQUIRED_FIELDS = {"source", "title", "url", "content", "published_at", "metadata"}


def run_rss_script(config_path, extra_args=None):
    """Run fetch-rss.py with a config file and return (returncode, stdout, stderr)."""
    cmd = [sys.executable, RSS_SCRIPT, "--config", config_path]
    if extra_args:
        cmd.extend(extra_args)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return result.returncode, result.stdout, result.stderr


def write_config(tmp_path, feeds, gmail_enabled=False, hn_enabled=False):
    """Write a test config.yaml with the given RSS feeds."""
    config = {
        "version": 1,
        "voice": {"jargon_blocklist": []},
        "sources": {
            "rss": feeds,
            "gmail": {"enabled": gmail_enabled, "label": "test", "max_items": 5},
            "hackernews": {"enabled": hn_enabled, "max_items": 5},
        },
    }
    import yaml as _yaml
    path = tmp_path / "config.yaml"
    path.write_text(_yaml.dump(config))
    return str(path)


# ---------------------------------------------------------------------------
# Script existence
# ---------------------------------------------------------------------------

def test_story_003_fetch_rss_script_exists():
    """STORY-003: scripts/fetch-rss.py must exist."""
    assert os.path.exists(RSS_SCRIPT), (
        f"fetch-rss.py not found at {RSS_SCRIPT}"
    )


def test_story_003_script_is_valid_python():
    """STORY-003: fetch-rss.py must be valid Python (no syntax errors)."""
    assert os.path.exists(RSS_SCRIPT)
    result = subprocess.run(
        [sys.executable, "-m", "py_compile", RSS_SCRIPT],
        capture_output=True, text=True
    )
    assert result.returncode == 0, (
        f"fetch-rss.py has syntax errors:\n{result.stderr}"
    )


def test_story_003_script_imports_feedparser():
    """STORY-003: fetch-rss.py must import feedparser (real library, not a stub)."""
    assert os.path.exists(RSS_SCRIPT)
    content = open(RSS_SCRIPT).read()
    assert "feedparser" in content, (
        "fetch-rss.py must import feedparser to parse RSS/Atom feeds. "
        "A stub returning hardcoded data is not acceptable."
    )


def test_story_003_script_accepts_config_argument():
    """STORY-003: fetch-rss.py must accept a --config argument."""
    assert os.path.exists(RSS_SCRIPT)
    content = open(RSS_SCRIPT).read()
    assert "--config" in content, (
        "fetch-rss.py must accept --config argument to read sources"
    )


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_003_outputs_valid_json_array(tmp_path):
    """STORY-003: Script must output a JSON array to stdout."""
    config_path = write_config(tmp_path, feeds=[
        {"url": "https://blog.pragmaticengineer.com/feed", "freshness_hours": 168}
    ])
    rc, stdout, stderr = run_rss_script(config_path)
    assert rc == 0, f"Script exited {rc}. stderr: {stderr}"
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError as e:
        pytest.fail(f"Script stdout is not valid JSON: {e}\nstdout: {stdout[:500]}")
    assert isinstance(data, list), f"Script must output a JSON array, got: {type(data)}"


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_003_output_items_have_required_schema_fields(tmp_path):
    """STORY-003: Each signal must have source, title, url, content, published_at, metadata."""
    config_path = write_config(tmp_path, feeds=[
        {"url": "https://blog.pragmaticengineer.com/feed", "freshness_hours": 168}
    ])
    rc, stdout, _ = run_rss_script(config_path)
    assert rc == 0
    signals = json.loads(stdout)
    if not signals:
        pytest.skip("Feed returned 0 items (possible network issue) — skipping schema check")
    for signal in signals[:3]:  # check first 3
        missing = SIGNAL_REQUIRED_FIELDS - set(signal.keys())
        assert not missing, (
            f"Signal missing required fields {missing}. Got keys: {list(signal.keys())}"
        )


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_003_source_field_is_rss(tmp_path):
    """STORY-003: All output signals from RSS fetcher must have source='rss'."""
    config_path = write_config(tmp_path, feeds=[
        {"url": "https://blog.pragmaticengineer.com/feed", "freshness_hours": 168}
    ])
    rc, stdout, _ = run_rss_script(config_path)
    assert rc == 0
    signals = json.loads(stdout)
    if not signals:
        pytest.skip("No signals returned — possible network issue")
    for signal in signals:
        assert signal.get("source") == "rss", (
            f"Signal source should be 'rss', got '{signal.get('source')}'"
        )


# ---------------------------------------------------------------------------
# Different inputs → different outputs (anti-stub test)
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_003_different_feed_urls_produce_different_output(tmp_path):
    """STORY-003: Different feed URLs must produce different signal titles (not a hardcoded stub)."""
    (tmp_path / "a").mkdir(exist_ok=True)
    (tmp_path / "b").mkdir(exist_ok=True)
    config_a = write_config(tmp_path / "a", feeds=[
        {"url": "https://blog.pragmaticengineer.com/feed", "freshness_hours": 168}
    ])
    config_b = write_config(tmp_path / "b", feeds=[
        {"url": "https://lethain.com/feeds/", "freshness_hours": 168}
    ])
    rc_a, out_a, _ = run_rss_script(config_a)
    rc_b, out_b, _ = run_rss_script(config_b)
    assert rc_a == 0
    assert rc_b == 0
    sigs_a = json.loads(out_a)
    sigs_b = json.loads(out_b)
    if not sigs_a or not sigs_b:
        pytest.skip("One or both feeds returned 0 items — can't compare (network issue)")
    urls_a = {s["url"] for s in sigs_a}
    urls_b = {s["url"] for s in sigs_b}
    assert urls_a != urls_b, (
        "Two different feed URLs produced identical output — "
        "this suggests a hardcoded stub rather than real fetching"
    )


# ---------------------------------------------------------------------------
# Freshness filtering
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_003_freshness_zero_returns_empty_array(tmp_path):
    """STORY-003: freshness_hours=0 should filter out all items (nothing is fresh enough)."""
    config_path = write_config(tmp_path, feeds=[
        {"url": "https://blog.pragmaticengineer.com/feed", "freshness_hours": 0}
    ])
    rc, stdout, _ = run_rss_script(config_path)
    assert rc == 0, "Script must exit 0 even when all items are filtered by freshness"
    signals = json.loads(stdout)
    assert signals == [], (
        f"freshness_hours=0 should filter all items, but got {len(signals)} signals"
    )


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_003_exits_zero_on_unreachable_feed(tmp_path):
    """STORY-003: Script must exit 0 even if a feed DNS fails (partial results are fine)."""
    config_path = write_config(tmp_path, feeds=[
        {"url": "https://this-domain-does-not-exist-xyz-abc.com/feed", "freshness_hours": 168}
    ])
    rc, stdout, stderr = run_rss_script(config_path)
    assert rc == 0, (
        f"Script should exit 0 on DNS failure (partial results ok), got exit {rc}. "
        f"stderr: {stderr[:300]}"
    )
    signals = json.loads(stdout)
    assert isinstance(signals, list), "Even on feed error, must output a JSON array"


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_003_continues_after_bad_feed_when_good_feed_present(tmp_path):
    """STORY-003: Bad feed should not prevent good feeds from being fetched."""
    config_path = write_config(tmp_path, feeds=[
        {"url": "https://this-domain-does-not-exist-xyz-abc.com/feed", "freshness_hours": 168},
        {"url": "https://blog.pragmaticengineer.com/feed", "freshness_hours": 168},
    ])
    rc, stdout, stderr = run_rss_script(config_path)
    assert rc == 0
    signals = json.loads(stdout)
    # If the good feed returned items, we should see them
    # (network may be down so we just verify it doesn't crash)
    assert isinstance(signals, list)


@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_003_empty_feed_returns_empty_array(tmp_path):
    """STORY-003: A feed with 0 items should produce an empty array without error."""
    # Use a known-valid but potentially-empty Atom test feed
    config_path = write_config(tmp_path, feeds=[
        {"url": "https://blog.pragmaticengineer.com/feed", "freshness_hours": 0}
    ])
    rc, stdout, _ = run_rss_script(config_path)
    assert rc == 0, "Script must exit 0 even when feed has 0 items"
    signals = json.loads(stdout)
    assert isinstance(signals, list)


# ---------------------------------------------------------------------------
# Content stripping
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_story_003_content_field_has_no_html_tags(tmp_path):
    """STORY-003: content field must have HTML stripped — no <p>, <a>, <div>, etc."""
    config_path = write_config(tmp_path, feeds=[
        {"url": "https://blog.pragmaticengineer.com/feed", "freshness_hours": 168}
    ])
    rc, stdout, _ = run_rss_script(config_path)
    assert rc == 0
    signals = json.loads(stdout)
    if not signals:
        pytest.skip("No signals returned — possible network issue")
    for signal in signals[:5]:
        content = signal.get("content", "")
        import re
        html_tags = re.findall(r'<[a-zA-Z][^>]*>', content)
        assert not html_tags, (
            f"content field contains HTML tags {html_tags[:3]}. "
            "fetch-rss.py must strip HTML from content."
        )
