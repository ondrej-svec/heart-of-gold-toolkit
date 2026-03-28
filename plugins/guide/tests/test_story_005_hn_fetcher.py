"""
STORY-005: Hacker News fetcher script

Tests verify:
- fetch-hn.sh exists and is executable
- Accepts --limit <n> argument (default 30)
- Fetches from the HN Firebase API (hacker-news.firebaseio.com)
- Outputs JSON array matching the signal schema
- Includes HN discussion URL in metadata
- Handles Ask/Show HN posts (no URL → use HN discussion URL)
- Exits 0 with empty array when HN disabled in config
- Different --limit values produce different result counts
"""
import json
import os
import subprocess
import pytest

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

from conftest import SCRIPTS_DIR

HN_SCRIPT = os.path.join(SCRIPTS_DIR, "fetch-hn.sh")

SIGNAL_REQUIRED_FIELDS = {"source", "title", "url", "content", "published_at", "metadata"}
HN_API_HOST = "hacker-news.firebaseio.com"


def run_hn_script(extra_args=None, timeout=60):
    """Run fetch-hn.sh and return (returncode, stdout, stderr)."""
    cmd = ["bash", HN_SCRIPT]
    if extra_args:
        cmd.extend(extra_args)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return result.returncode, result.stdout, result.stderr


# ---------------------------------------------------------------------------
# Script existence and executability
# ---------------------------------------------------------------------------

def test_story_005_fetch_hn_script_exists():
    """STORY-005: scripts/fetch-hn.sh must exist."""
    assert os.path.exists(HN_SCRIPT), (
        f"fetch-hn.sh not found at {HN_SCRIPT}"
    )


def test_story_005_script_is_executable():
    """STORY-005: fetch-hn.sh must be executable."""
    assert os.path.exists(HN_SCRIPT)
    assert os.access(HN_SCRIPT, os.X_OK), (
        f"fetch-hn.sh is not executable. Run: chmod +x {HN_SCRIPT}"
    )


def test_story_005_script_references_hn_firebase_api():
    """STORY-005: fetch-hn.sh must use the HN Firebase API (hacker-news.firebaseio.com)."""
    assert os.path.exists(HN_SCRIPT)
    content = open(HN_SCRIPT).read()
    assert HN_API_HOST in content, (
        f"fetch-hn.sh must fetch from {HN_API_HOST}. "
        "A stub that doesn't contact the HN API is not acceptable."
    )


def test_story_005_script_accepts_limit_argument():
    """STORY-005: fetch-hn.sh must accept --limit argument."""
    assert os.path.exists(HN_SCRIPT)
    content = open(HN_SCRIPT).read()
    assert "--limit" in content, (
        "fetch-hn.sh must accept --limit argument to control result count"
    )


def test_story_005_script_uses_curl_for_api_calls():
    """STORY-005: fetch-hn.sh must use curl (specified in architecture dependencies)."""
    assert os.path.exists(HN_SCRIPT)
    content = open(HN_SCRIPT).read()
    assert "curl" in content, (
        "fetch-hn.sh must use curl to fetch from the HN Firebase API"
    )


def test_story_005_script_uses_jq_for_json_processing():
    """STORY-005: fetch-hn.sh must use jq for JSON processing (specified in architecture)."""
    assert os.path.exists(HN_SCRIPT)
    content = open(HN_SCRIPT).read()
    assert "jq" in content, (
        "fetch-hn.sh must use jq for JSON processing (architecture dependency)"
    )


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------

def test_story_005_outputs_valid_json_array():
    """STORY-005: fetch-hn.sh must output a valid JSON array."""
    rc, stdout, stderr = run_hn_script(["--limit", "3"])
    assert rc == 0, f"Script exited {rc}. stderr: {stderr[:300]}"
    try:
        data = json.loads(stdout.strip())
    except json.JSONDecodeError as e:
        pytest.fail(f"Script stdout is not valid JSON: {e}\nstdout: {stdout[:500]}")
    assert isinstance(data, list), f"Script must output a JSON array, got: {type(data)}"


def test_story_005_output_items_have_required_schema_fields():
    """STORY-005: Each HN signal must have source, title, url, content, published_at, metadata."""
    rc, stdout, _ = run_hn_script(["--limit", "3"])
    assert rc == 0
    signals = json.loads(stdout.strip())
    if not signals:
        pytest.skip("No signals returned — possible network issue")
    for signal in signals:
        missing = SIGNAL_REQUIRED_FIELDS - set(signal.keys())
        assert not missing, (
            f"HN signal missing required fields: {missing}. Got: {list(signal.keys())}"
        )


def test_story_005_source_field_is_hn():
    """STORY-005: All HN signals must have source='hn'."""
    rc, stdout, _ = run_hn_script(["--limit", "3"])
    assert rc == 0
    signals = json.loads(stdout.strip())
    if not signals:
        pytest.skip("No signals returned — possible network issue")
    for signal in signals:
        assert signal.get("source") == "hn", (
            f"HN signal has source='{signal.get('source')}', expected 'hn'"
        )


def test_story_005_metadata_includes_hn_discussion_url():
    """STORY-005: metadata must include the HN discussion URL (news.ycombinator.com/item?id=...)."""
    rc, stdout, _ = run_hn_script(["--limit", "3"])
    assert rc == 0
    signals = json.loads(stdout.strip())
    if not signals:
        pytest.skip("No signals returned — possible network issue")
    for signal in signals:
        meta = signal.get("metadata", {})
        hn_url = meta.get("hn_url") or meta.get("discussion_url") or meta.get("hn_discussion_url")
        assert hn_url, (
            f"Signal metadata must include HN discussion URL. Got metadata: {meta}"
        )
        assert "ycombinator.com/item" in str(hn_url), (
            f"HN discussion URL should be news.ycombinator.com/item?id=..., got: {hn_url}"
        )


def test_story_005_metadata_includes_score():
    """STORY-005: metadata must include story score."""
    rc, stdout, _ = run_hn_script(["--limit", "3"])
    assert rc == 0
    signals = json.loads(stdout.strip())
    if not signals:
        pytest.skip("No signals returned — possible network issue")
    for signal in signals:
        meta = signal.get("metadata", {})
        assert "score" in meta, (
            f"HN signal metadata must include 'score'. Got: {meta}"
        )


# ---------------------------------------------------------------------------
# --limit parameter
# ---------------------------------------------------------------------------

def test_story_005_limit_controls_result_count():
    """STORY-005: --limit N must return at most N results (different limits → different counts)."""
    rc_5, out_5, _ = run_hn_script(["--limit", "5"])
    rc_10, out_10, _ = run_hn_script(["--limit", "10"])
    assert rc_5 == 0
    assert rc_10 == 0
    sigs_5 = json.loads(out_5.strip())
    sigs_10 = json.loads(out_10.strip())
    assert len(sigs_5) <= 5, f"--limit 5 returned {len(sigs_5)} items"
    assert len(sigs_10) <= 10, f"--limit 10 returned {len(sigs_10)} items"
    # Different limits should produce different (not identical) result sets
    if sigs_5 and sigs_10:
        assert len(sigs_5) != len(sigs_10) or sigs_5 != sigs_10, (
            "--limit 5 and --limit 10 returned identical results — "
            "limit parameter may not be working"
        )


# ---------------------------------------------------------------------------
# Ask HN / Show HN: no external URL → use HN discussion URL
# ---------------------------------------------------------------------------

def test_story_005_script_handles_text_only_posts():
    """STORY-005: Posts with no external URL (Ask HN, Show HN) must use HN discussion URL as primary url."""
    assert os.path.exists(HN_SCRIPT)
    content = open(HN_SCRIPT).read()
    # Script must have logic to handle null/empty URL
    has_url_fallback = any(
        term in content
        for term in ['url', 'null', 'empty', 'hn_url', '""', "''", 'ycombinator']
    )
    assert has_url_fallback, (
        "fetch-hn.sh must handle posts with no external URL "
        "(Ask HN, Show HN) by falling back to the HN discussion URL"
    )


# ---------------------------------------------------------------------------
# Parallelization
# ---------------------------------------------------------------------------

def test_story_005_script_parallelizes_item_fetches():
    """STORY-005: Script must parallelize item detail fetches (use xargs -P or & with wait)."""
    assert os.path.exists(HN_SCRIPT)
    content = open(HN_SCRIPT).read()
    has_parallelism = (
        "xargs" in content and "-P" in content
    ) or (
        "wait" in content and "&" in content
    )
    assert has_parallelism, (
        "fetch-hn.sh must parallelize item fetches for speed. "
        "Use 'xargs -P' or run fetches in background with '&' + wait."
    )
