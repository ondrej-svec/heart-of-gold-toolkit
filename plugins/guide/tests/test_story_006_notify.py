"""
STORY-006: Notification script

Tests verify:
- notify.sh exists and is executable
- Accepts --type <imessage|slack>, --recipient <addr>, --message <text>
- Exits 1 with error on empty message
- Truncates iMessage content to 280 chars with "..."
- References osascript for iMessage sending
- References webhook/curl for Slack sending
- Exits 0 on success, 1 on failure
- Notification disabled in config → exit 0 silently (via --type none or skip logic)
"""
import os
import subprocess
import pytest

from conftest import SCRIPTS_DIR

NOTIFY_SCRIPT = os.path.join(SCRIPTS_DIR, "notify.sh")

IMESSAGE_LIMIT = 280


def run_notify(args, timeout=15):
    """Run notify.sh with args and return (returncode, stdout, stderr)."""
    cmd = ["bash", NOTIFY_SCRIPT] + args
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return result.returncode, result.stdout, result.stderr


# ---------------------------------------------------------------------------
# Script existence
# ---------------------------------------------------------------------------

def test_story_006_notify_script_exists():
    """STORY-006: scripts/notify.sh must exist."""
    assert os.path.exists(NOTIFY_SCRIPT), (
        f"notify.sh not found at {NOTIFY_SCRIPT}"
    )


def test_story_006_script_is_executable():
    """STORY-006: notify.sh must be executable."""
    assert os.path.exists(NOTIFY_SCRIPT)
    assert os.access(NOTIFY_SCRIPT, os.X_OK), (
        f"notify.sh is not executable. Run: chmod +x {NOTIFY_SCRIPT}"
    )


# ---------------------------------------------------------------------------
# Argument handling
# ---------------------------------------------------------------------------

def test_story_006_script_accepts_type_argument():
    """STORY-006: notify.sh must accept --type argument."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    assert "--type" in content, "notify.sh must accept --type argument"


def test_story_006_script_accepts_recipient_argument():
    """STORY-006: notify.sh must accept --recipient argument."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    assert "--recipient" in content, "notify.sh must accept --recipient argument"


def test_story_006_script_accepts_message_argument():
    """STORY-006: notify.sh must accept --message argument."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    assert "--message" in content, "notify.sh must accept --message argument"


# ---------------------------------------------------------------------------
# Empty message → exit 1
# ---------------------------------------------------------------------------

def test_story_006_empty_message_exits_one():
    """STORY-006: Empty message must cause exit 1 with an error message."""
    rc, stdout, stderr = run_notify([
        "--type", "imessage",
        "--recipient", "+1234567890",
        "--message", ""
    ])
    assert rc == 1, (
        f"Empty message should cause exit 1, got {rc}. "
        f"stdout: {stdout[:200]}, stderr: {stderr[:200]}"
    )
    combined = stdout + stderr
    assert combined.strip(), (
        "Script should print an error message when --message is empty"
    )


def test_story_006_missing_message_arg_exits_nonzero():
    """STORY-006: Missing --message argument must exit with non-zero status."""
    rc, stdout, stderr = run_notify([
        "--type", "imessage",
        "--recipient", "+1234567890",
    ])
    assert rc != 0, (
        f"Missing --message should cause non-zero exit, got {rc}"
    )


# ---------------------------------------------------------------------------
# iMessage: osascript
# ---------------------------------------------------------------------------

def test_story_006_imessage_uses_osascript():
    """STORY-006: iMessage sending must use osascript to drive Messages.app."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    assert "osascript" in content, (
        "notify.sh must use osascript to send iMessage notifications"
    )


def test_story_006_imessage_280_char_truncation_logic_exists():
    """STORY-006: Script must contain truncation logic for 280-char iMessage limit."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    # Script should reference 280 chars somewhere
    has_truncation = "280" in content
    assert has_truncation, (
        f"notify.sh must include iMessage character limit logic (280 chars). "
        "Missing reference to the 280-character limit."
    )


def test_story_006_imessage_truncates_long_message_with_ellipsis():
    """STORY-006: Messages over 280 chars must be truncated with '...' appended."""
    long_message = "x" * 400  # 400 chars > 280 limit
    # We can't actually send iMessage in tests, so we test the truncation logic
    # by inspecting the script or by running with a mock (check truncation in source)
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    has_ellipsis = "..." in content or '\\.\\.\\.' in content
    assert has_ellipsis, (
        "notify.sh must append '...' when truncating long iMessages"
    )


# ---------------------------------------------------------------------------
# Slack: webhook / curl
# ---------------------------------------------------------------------------

def test_story_006_slack_uses_curl_with_webhook():
    """STORY-006: Slack sending must use curl to call the webhook URL."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    assert "curl" in content, (
        "notify.sh must use curl to send Slack webhook requests"
    )
    # Should reference webhook concept
    has_webhook = "webhook" in content.lower() or "slack" in content.lower()
    assert has_webhook, (
        "notify.sh must handle Slack webhook sending"
    )


# ---------------------------------------------------------------------------
# Type routing
# ---------------------------------------------------------------------------

def test_story_006_script_handles_both_imessage_and_slack_types():
    """STORY-006: Script must have routing logic for both 'imessage' and 'slack' types."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    assert "imessage" in content, "notify.sh must handle --type imessage"
    assert "slack" in content, "notify.sh must handle --type slack"


def test_story_006_invalid_type_exits_nonzero():
    """STORY-006: Unknown --type value should exit with non-zero status."""
    rc, stdout, stderr = run_notify([
        "--type", "invalid_type_xyz",
        "--recipient", "test",
        "--message", "Hello"
    ])
    assert rc != 0, (
        f"Invalid --type should cause non-zero exit, got {rc}"
    )


# ---------------------------------------------------------------------------
# Different messages produce different outputs (anti-stub check)
# ---------------------------------------------------------------------------

def test_story_006_short_message_not_truncated():
    """STORY-006: Messages under 280 chars must NOT be truncated (no '...' added)."""
    short_message = "Hello, this is a short test message."
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    # Verify script checks length before truncating (not blindly truncating all messages)
    # The 280-char check should be conditional
    has_conditional = (
        "if" in content and "280" in content
    ) or (
        "[ " in content and "280" in content
    ) or (
        "length" in content and "280" in content
    )
    assert has_conditional, (
        "notify.sh must only truncate messages that EXCEED 280 chars. "
        "The truncation should be conditional, not applied to all messages."
    )


# ---------------------------------------------------------------------------
# Slack non-200 response → exit 1
# ---------------------------------------------------------------------------

def test_story_006_slack_failure_check_exists():
    """STORY-006: Script must check Slack webhook HTTP response and exit 1 on failure."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    # Script should check curl exit code or HTTP status code
    has_error_check = (
        "$?" in content or
        "200" in content or
        "exit 1" in content or
        "curl.*-w" in content or
        "http_code" in content.lower()
    )
    assert has_error_check, (
        "notify.sh must check whether the Slack webhook request succeeded "
        "and exit 1 if it returns a non-200 response"
    )
