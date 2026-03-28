"""
RED TEAM: Security, injection, and edge-case tests

These tests are ADVERSARIAL — they are expected to FAIL against the current
implementation. Each test targets a real vulnerability, unsafe pattern, or
missing guard in the scripts.

Coverage:
  SEC-001  notify.sh: Slack JSON payload not escaped — double quotes in message
           produce malformed JSON sent to webhook
  SEC-002  notify.sh: osascript string injection — double quotes in --message
           break the AppleScript string literal and can inject commands
  SEC-003  notify.sh: osascript recipient injection — double quotes in --recipient
           break the AppleScript string literal
  SEC-004  fetch-gmail.sh: Python -c config-path injection — a single quote in the
           config file path breaks the inline Python, triggering fail-open behavior
           (GMAIL_ENABLED defaults to "true" even when config says disabled)
  SEC-005  fetch-gmail.sh: uses fixed /tmp/gws_error temp file — concurrent runs
           overwrite each other's error output, causing incorrect error routing
  SEC-006  fetch-hn.sh: overwrites and exports $TMPDIR — clobbers the system-wide
           TMPDIR env var for all child processes in the pipeline
  SEC-007  fetch-rss.py: undated entries bypass freshness filter — entries with no
           published date get `published = now`, and `now < cutoff` is False when
           freshness_hours=0, so they are included even when nothing should be
  SEC-008  fetch-rss.py: no URL scheme validation — file:// URLs are accepted,
           allowing the RSS fetcher to read arbitrary local files as feeds
  SEC-009  fetch-hn.sh: no jq availability check — if jq is not installed, the
           script fails with a cryptic pipefail error instead of a clear message
  SEC-010  notify.sh: Slack message with embedded newlines breaks JSON — literal
           newlines in the message body create invalid JSON without escaping
"""
import json
import os
import subprocess
import sys
import tempfile
import textwrap
import pytest

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

from conftest import SCRIPTS_DIR

NOTIFY_SCRIPT = os.path.join(SCRIPTS_DIR, "notify.sh")
GMAIL_SCRIPT = os.path.join(SCRIPTS_DIR, "fetch-gmail.sh")
HN_SCRIPT = os.path.join(SCRIPTS_DIR, "fetch-hn.sh")
RSS_SCRIPT = os.path.join(SCRIPTS_DIR, "fetch-rss.py")


def run_notify(args, timeout=15):
    cmd = ["bash", NOTIFY_SCRIPT] + list(args)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return result.returncode, result.stdout, result.stderr


def run_gmail_script(config_path, env_override=None, timeout=30):
    import os as _os
    cmd = ["bash", GMAIL_SCRIPT, "--config", config_path]
    env = _os.environ.copy()
    if env_override:
        env.update(env_override)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)
    return result.returncode, result.stdout, result.stderr


def run_rss_script(config_path, timeout=30):
    cmd = [sys.executable, RSS_SCRIPT, "--config", config_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return result.returncode, result.stdout, result.stderr


# ---------------------------------------------------------------------------
# SEC-001: Slack JSON injection — double quotes in message
# ---------------------------------------------------------------------------

def test_redteam_sec001_slack_json_not_escaped_for_double_quotes():
    """
    SEC-001: notify.sh must properly escape message content before embedding in
    Slack JSON payload. Current implementation uses naive string interpolation:
        -d '{"text": "$MESSAGE"}'
    A message containing '"' produces malformed JSON. The fix requires jq or
    a proper JSON serialiser.

    This test FAILS against the current implementation because the script
    uses raw variable expansion with no JSON escaping.
    """
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()

    # Detect the unsafe interpolation pattern: the Slack payload is constructed
    # by wrapping $MESSAGE directly in a JSON string — no jq, no printf %q, no sed escaping.
    slack_section_start = content.find("slack)")
    if slack_section_start == -1:
        pytest.skip("No slack) case found in notify.sh")

    slack_section = content[slack_section_start:]
    # Trim to just the slack case block
    next_case = slack_section.find(";;")
    if next_case != -1:
        slack_section = slack_section[:next_case]

    # Check that the Slack JSON is built with a safe method, NOT raw interpolation
    uses_jq_serialisation = "jq" in slack_section
    uses_printf_json = "printf" in slack_section and ("\\\\\"" in slack_section or "json" in slack_section.lower())

    safe_json_construction = uses_jq_serialisation or uses_printf_json

    assert safe_json_construction, (
        "SEC-001 FAIL: notify.sh builds Slack JSON payload via raw $MESSAGE interpolation "
        "with no escaping. A message containing '\"' produces malformed JSON:\n"
        "  Input:    --message 'Hello \"world\"'\n"
        "  Payload:  {\"text\": \"Hello \"world\"\"}\n"
        "  Result:   curl sends invalid JSON; Slack webhook returns 400.\n"
        "Fix: use jq -n --arg text \"$MESSAGE\" '{text: $text}' to serialise safely."
    )


# ---------------------------------------------------------------------------
# SEC-002: osascript injection — double quotes in --message
# ---------------------------------------------------------------------------

def test_redteam_sec002_imessage_message_not_escaped_for_applescript():
    """
    SEC-002: notify.sh embeds --message directly into an AppleScript string literal:
        send \"$MESSAGE\" to theBuddy
    A message containing '"' breaks the AppleScript string boundary. Worse,
    a message like:
        foo" & (do shell script "touch /tmp/pwned") & "bar
    is valid AppleScript that executes an arbitrary shell command.

    This test FAILS because the script performs no escaping before interpolation.
    """
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()

    imessage_start = content.find("imessage)")
    if imessage_start == -1:
        pytest.skip("No imessage) case found in notify.sh")

    imessage_section = content[imessage_start:]
    next_case = imessage_section.find(";;")
    if next_case != -1:
        imessage_section = imessage_section[:next_case]

    # Proper mitigations: escape " as \" inside the AppleScript, or use
    # AppleScript's 'quoted form of' operator, or pre-process with sed
    has_double_quote_escape = (
        'sed' in imessage_section and '"' in imessage_section
    ) or (
        'quoted form' in imessage_section
    ) or (
        # replaces " with escaped version
        '\\\\\"' in imessage_section
    ) or (
        '${MESSAGE//\\"' in imessage_section
        or "${MESSAGE//\\\"" in imessage_section
    )

    assert has_double_quote_escape, (
        "SEC-002 FAIL: notify.sh interpolates $MESSAGE directly into the osascript "
        "-e string without escaping double quotes. This allows AppleScript injection:\n"
        "  --message 'x\" & (do shell script \"id > /tmp/poc\") & \"y'\n"
        "Fix: escape double quotes in MESSAGE before embedding, e.g.:\n"
        '  SAFE_MSG="${MESSAGE//\"/\\\\\"}"'
    )


# ---------------------------------------------------------------------------
# SEC-003: osascript injection — double quotes in --recipient
# ---------------------------------------------------------------------------

def test_redteam_sec003_imessage_recipient_not_escaped_for_applescript():
    """
    SEC-003: The --recipient value is also embedded verbatim into osascript:
        set targetBuddy to "$RECIPIENT"
    A recipient containing '"' breaks the AppleScript string. This test FAILS
    because the script has no escaping for RECIPIENT.
    """
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()

    imessage_start = content.find("imessage)")
    if imessage_start == -1:
        pytest.skip("No imessage) case found in notify.sh")

    imessage_section = content[imessage_start:]
    next_case = imessage_section.find(";;")
    if next_case != -1:
        imessage_section = imessage_section[:next_case]

    # Check for recipient escaping
    has_recipient_escape = (
        'SAFE_RECIPIENT' in imessage_section or
        'RECIPIENT//\"' in imessage_section or
        'RECIPIENT//"' in imessage_section or
        ("sed" in imessage_section and "RECIPIENT" in imessage_section)
    )

    assert has_recipient_escape, (
        "SEC-003 FAIL: notify.sh interpolates $RECIPIENT directly into osascript "
        "without escaping. A recipient like 'foo\"bar' breaks the AppleScript string.\n"
        "Fix: escape double quotes in RECIPIENT before embedding."
    )


# ---------------------------------------------------------------------------
# SEC-004: fetch-gmail.sh fail-open — single quote in config path
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_redteam_sec004_gmail_config_path_with_single_quote_fails_open(tmp_path):
    """
    SEC-004: fetch-gmail.sh reads the config by splicing $CONFIG_PATH directly into
    a Python -c inline string delimited by single quotes:
        python3 -c "
        with open('$CONFIG_PATH') as f: ...
        " 2>/dev/null || echo "true"

    A config path containing a single quote (e.g. /tmp/it's/config.yaml) causes a
    Python SyntaxError. The 2>/dev/null suppresses it, and '|| echo "true"' sets
    GMAIL_ENABLED="true" regardless of what the config says.

    Result: even with gmail.enabled=false in config, the script proceeds past the
    disabled check (GMAIL_ENABLED != "true" is False) and attempts to use gws,
    exiting 1 instead of the expected exit 0 + empty array.

    This test FAILS against the current implementation.
    """
    # Create a directory name containing a single quote
    awkward_dir = tmp_path / "it's_a_test_dir"
    awkward_dir.mkdir()
    config_path = awkward_dir / "config.yaml"
    config = {
        "version": 1,
        "voice": {"jargon_blocklist": []},
        "sources": {
            "rss": [],
            "gmail": {"enabled": False, "label": "Test", "max_items": 5},
            "hackernews": {"enabled": False, "max_items": 5},
        },
    }
    config_path.write_text(yaml.dump(config))

    # Override PATH to remove gws so we can detect if the script tried to use it
    rc, stdout, stderr = run_gmail_script(
        str(config_path),
        env_override={"PATH": "/usr/bin:/bin"}
    )

    # EXPECTED (correct): exit 0 with "[]" — Gmail is disabled
    # ACTUAL (buggy):     exit 1 — single quote broke config parse → fail-open →
    #                     GMAIL_ENABLED="true" → gws not found → exit 1
    assert rc == 0, (
        f"SEC-004 FAIL: Config path with single quote caused fail-open behavior.\n"
        f"Expected exit 0 (Gmail disabled), got exit {rc}.\n"
        f"Cause: single quote in path broke python3 -c inline code; "
        f"fallback set GMAIL_ENABLED='true' ignoring config.\n"
        f"stderr: {stderr[:400]}"
    )
    data = json.loads(stdout.strip())
    assert data == [], (
        f"SEC-004 FAIL: Expected empty array (Gmail disabled), got: {data}"
    )


# ---------------------------------------------------------------------------
# SEC-005: fetch-gmail.sh uses fixed /tmp/gws_error (not mktemp)
# ---------------------------------------------------------------------------

def test_redteam_sec005_gmail_uses_fixed_tmp_file_not_mktemp():
    """
    SEC-005: fetch-gmail.sh writes gws stderr to a hardcoded path /tmp/gws_error:
        gws mail list ... 2>/tmp/gws_error

    Concurrent pipeline runs overwrite each other's error file, so the error
    routing logic (grep for "auth" / "label") reads stale or wrong content.
    Additionally, an attacker with write access to /tmp can pre-populate
    /tmp/gws_error to influence which error branch the script takes.

    The fix is to use a per-run temp file: ERROR_FILE=$(mktemp)

    This test FAILS because the current script uses the hardcoded /tmp/gws_error path.
    """
    assert os.path.exists(GMAIL_SCRIPT)
    content = open(GMAIL_SCRIPT).read()

    uses_fixed_tmp = "/tmp/gws_error" in content
    uses_mktemp_for_errors = (
        "mktemp" in content and
        # mktemp result is assigned to a variable used for the gws redirect
        ("ERROR_FILE" in content or "GWS_ERR" in content or "TMPFILE" in content)
    )

    assert not uses_fixed_tmp or uses_mktemp_for_errors, (
        "SEC-005 FAIL: fetch-gmail.sh uses hardcoded /tmp/gws_error for capturing "
        "gws stderr. This path is shared across all processes on the machine.\n"
        "Concurrent pipeline runs overwrite each other's error files, causing "
        "incorrect error-type detection (auth vs label vs other).\n"
        "Fix: use ERROR_FILE=$(mktemp) and redirect gws stderr to $ERROR_FILE."
    )


# ---------------------------------------------------------------------------
# SEC-006: fetch-hn.sh clobbers system TMPDIR
# ---------------------------------------------------------------------------

def test_redteam_sec006_hn_script_shadows_system_tmpdir():
    """
    SEC-006: fetch-hn.sh assigns and exports the variable TMPDIR:
        TMPDIR=$(mktemp -d)
        ...
        export TMPDIR

    $TMPDIR is a POSIX-standard environment variable that all programs on the
    system use to locate the temporary file directory. Overwriting and exporting
    it means every child process spawned by this script (jq, curl, xargs, Python,
    bash subshells) will write their temp files to the pipeline's private tmpdir
    instead of the system temp dir — potentially mixing pipeline artefacts with
    system temp data, and causing cleanup issues.

    The fix: use a private variable name like HN_TMPDIR or PIPELINE_TMP.

    This test FAILS because the script uses TMPDIR as the variable name.
    """
    assert os.path.exists(HN_SCRIPT)
    content = open(HN_SCRIPT).read()

    # The script should NOT use TMPDIR as its working variable name
    assigns_system_tmpdir = "TMPDIR=$(mktemp" in content
    exports_system_tmpdir = "export TMPDIR" in content

    assert not assigns_system_tmpdir, (
        "SEC-006 FAIL: fetch-hn.sh uses TMPDIR=$(mktemp -d) which shadows the "
        "system-wide $TMPDIR environment variable.\n"
        "Use a private name: HN_TMPDIR=$(mktemp -d)"
    )

    assert not exports_system_tmpdir, (
        "SEC-006 FAIL: fetch-hn.sh exports $TMPDIR, overwriting the standard "
        "POSIX temp dir for all child processes.\n"
        "Remove 'export TMPDIR' and use a private variable."
    )


# ---------------------------------------------------------------------------
# SEC-007: fetch-rss.py — undated entries bypass freshness_hours=0
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_redteam_sec007_undated_rss_entries_bypass_freshness_zero(tmp_path):
    """
    SEC-007: fetch-rss.py handles entries with no published date by assigning
    `published = now`. The freshness check is:
        if published and published < cutoff: continue

    With freshness_hours=0, cutoff = now - timedelta(hours=0) = now.
    An undated entry gets published = now, and `now < now` is False — so the
    entry is NOT filtered out, even though freshness_hours=0 means "nothing passes".

    This is a logic error: the freshness filter should also exclude undated entries
    when freshness_hours=0, or at minimum treat no-date entries as maximally stale.

    This test creates a local RSS feed file with no <pubDate> and verifies the
    bug: undated items are returned even with freshness_hours=0.

    This test FAILS against the current implementation.
    """
    # Create a minimal RSS feed with no pubDate on any entry
    rss_content = textwrap.dedent("""\
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Test Feed</title>
            <link>http://example.com</link>
            <description>A test RSS feed with no dates</description>
            <item>
              <title>Undated Article One</title>
              <link>http://example.com/article-1</link>
              <description>Content of article one, no date at all.</description>
            </item>
            <item>
              <title>Undated Article Two</title>
              <link>http://example.com/article-2</link>
              <description>Content of article two, also no date.</description>
            </item>
          </channel>
        </rss>
    """)
    feed_file = tmp_path / "no_dates.rss"
    feed_file.write_text(rss_content)
    feed_url = feed_file.as_uri()  # file:///...

    config = {
        "version": 1,
        "voice": {"jargon_blocklist": []},
        "sources": {
            "rss": [{"url": feed_url, "freshness_hours": 0}],
            "gmail": {"enabled": False},
            "hackernews": {"enabled": False},
        },
    }
    config_path = tmp_path / "config.yaml"
    config_path.write_text(yaml.dump(config))

    rc, stdout, stderr = run_rss_script(str(config_path))
    assert rc == 0

    signals = json.loads(stdout)

    # With freshness_hours=0, the intent is "only accept items from the last 0 hours"
    # = nothing. Undated items should not bypass this filter.
    assert signals == [], (
        f"SEC-007 FAIL: {len(signals)} undated RSS entries bypassed freshness_hours=0 filter.\n"
        f"Undated entries receive published=now, and now < now is False, "
        f"so they skip the filter entirely.\n"
        f"Signals returned: {[s['title'] for s in signals]}\n"
        f"Fix: treat undated entries as maximally stale (published=epoch) or "
        f"skip them when freshness_hours=0."
    )


# ---------------------------------------------------------------------------
# SEC-008: fetch-rss.py — file:// URLs allow local file reads
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not HAS_YAML, reason="pyyaml not installed")
def test_redteam_sec008_rss_fetcher_accepts_file_url_without_restriction(tmp_path):
    """
    SEC-008: fetch-rss.py passes the 'url' value from config directly to
    feedparser.parse() with no URL scheme validation. feedparser supports
    file:// URIs and will read arbitrary local files.

    A malicious or misconfigured config.yaml pointing at a local sensitive file
    (e.g. file:///etc/passwd or a private key) would cause the pipeline to
    silently attempt to parse it as an RSS feed. Even though feedparser returns
    bozo=True for non-XML files, the absence of a scheme allowlist is a design
    deficiency that should fail explicitly.

    This test creates a local RSS-like file and confirms it is read — proving
    the absence of a URL scheme restriction.

    This test FAILS because the script does not validate URL schemes.
    """
    # Create a valid RSS file at a known local path
    rss_content = textwrap.dedent("""\
        <?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Local Sensitive Feed</title>
            <link>http://example.com</link>
            <description>This file should not be accessible via config URL.</description>
            <item>
              <title>Local File Article SENTINEL_12345</title>
              <link>http://example.com/local</link>
              <pubDate>Mon, 01 Jan 2099 00:00:00 +0000</pubDate>
              <description>Sentinel content from local file.</description>
            </item>
          </channel>
        </rss>
    """)
    local_feed = tmp_path / "local_sensitive.rss"
    local_feed.write_text(rss_content)
    file_url = local_feed.as_uri()  # file:///tmp/.../local_sensitive.rss

    config = {
        "version": 1,
        "voice": {"jargon_blocklist": []},
        "sources": {
            "rss": [{"url": file_url, "freshness_hours": 9999}],
            "gmail": {"enabled": False},
            "hackernews": {"enabled": False},
        },
    }
    config_path = tmp_path / "config.yaml"
    config_path.write_text(yaml.dump(config))

    rc, stdout, stderr = run_rss_script(str(config_path))
    assert rc == 0

    signals = json.loads(stdout)

    # The script should REJECT file:// URLs and return empty, not read the file.
    # If this assertion fails, it proves local file access is possible.
    local_titles = [s["title"] for s in signals if "SENTINEL_12345" in s.get("title", "")]
    assert not local_titles, (
        f"SEC-008 FAIL: fetch-rss.py read a local file via file:// URL.\n"
        f"The script accepted 'url: {file_url}' from config and returned "
        f"{len(local_titles)} signal(s) containing content from the local file.\n"
        f"Fix: validate that all RSS URLs use http:// or https:// scheme before "
        f"passing to feedparser. Reject file://, ftp://, and other schemes."
    )


# ---------------------------------------------------------------------------
# SEC-009: fetch-hn.sh — no jq dependency check
# ---------------------------------------------------------------------------

def test_redteam_sec009_hn_script_has_no_jq_dependency_check():
    """
    SEC-009: fetch-hn.sh depends on jq for JSON processing but does not check
    whether jq is installed. If jq is missing, the script fails with a generic
    pipefail error at 'STORY_IDS=$(echo "$TOP_STORIES" | jq -r ...)' with no
    actionable message for the user.

    The architecture specifies jq as a dependency; the script should verify its
    presence and emit a clear error like:
        "Error: jq is required but not installed. Install with: brew install jq"

    This test FAILS because the current script has no jq availability check.
    """
    assert os.path.exists(HN_SCRIPT)
    content = open(HN_SCRIPT).read()

    # Check for an explicit jq availability guard
    has_jq_check = (
        "command -v jq" in content or
        "which jq" in content or
        "type jq" in content
    )

    assert has_jq_check, (
        "SEC-009 FAIL: fetch-hn.sh uses jq but never checks if it is installed.\n"
        "When jq is missing, the script fails with a cryptic pipefail error instead "
        "of a clear dependency error.\n"
        "Fix: add near the top of the script:\n"
        "  if ! command -v jq &>/dev/null; then\n"
        '    echo "Error: jq is required. Install: brew install jq" >&2\n'
        "    exit 1\n"
        "  fi"
    )


# ---------------------------------------------------------------------------
# SEC-010: notify.sh — newlines in Slack message break JSON
# ---------------------------------------------------------------------------

def test_redteam_sec010_slack_message_with_newlines_produces_invalid_json():
    """
    SEC-010: The Slack notification payload is built by raw variable interpolation:
        -d '{"text": "$MESSAGE"}'
    JSON strings may not contain literal (unescaped) newline characters.
    A multi-line message (e.g. from a daily brief) produces:
        {"text": "line one
        line two"}
    which is invalid JSON. curl sends it, Slack rejects it with 400.

    This test verifies the script does NOT contain safe newline-handling logic.
    It FAILS because the current implementation has no newline escaping.
    """
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()

    slack_start = content.find("slack)")
    if slack_start == -1:
        pytest.skip("No slack) case found in notify.sh")

    slack_section = content[slack_start:]
    end = slack_section.find(";;")
    if end != -1:
        slack_section = slack_section[:end]

    # Proper handling requires either jq (handles it automatically) or
    # pre-processing to replace literal newlines: MESSAGE="${MESSAGE//$'\n'/\\n}"
    has_newline_handling = (
        "jq" in slack_section or  # jq serialises correctly
        r"$'\n'" in slack_section or  # explicit newline replacement
        r"\n" in slack_section and "MESSAGE" in slack_section or  # sed-based escape
        "tr -d" in slack_section
    )

    assert has_newline_handling, (
        "SEC-010 FAIL: notify.sh sends Slack webhook with raw $MESSAGE interpolation. "
        "A message containing a literal newline produces invalid JSON.\n"
        "Example:\n"
        '  Input:   --message $\'line1\\nline2\'\n'
        '  Payload: {"text": "line1\n  line2"}  ← invalid JSON\n'
        "  Result:  Slack returns HTTP 400 / invalid_payload.\n"
        "Fix: use jq -n --arg text \"$MESSAGE\" '{text: $text}' which handles "
        "newlines, quotes, and all other JSON special characters correctly."
    )
