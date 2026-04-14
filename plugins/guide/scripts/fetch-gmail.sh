#!/bin/bash
# fetch-gmail.sh — Fetch Gmail newsletters via gws CLI and output JSON signals.
#
# Usage:
#   bash fetch-gmail.sh --config <path-to-config.yaml>
#
# Reads Gmail settings from config: enabled, label, max_items.
# Uses gws CLI to fetch emails from the configured label.
# Outputs a JSON array of signal objects to stdout.
#
# Exit codes:
#   0 — success (or Gmail disabled in config)
#   1 — error (gws not installed, auth expired, label not found)

set -euo pipefail

CONFIG_PATH=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      CONFIG_PATH="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "$CONFIG_PATH" ]]; then
  echo "Error: --config argument is required" >&2
  exit 1
fi

# Check if Gmail is disabled in config (SEC-004: safe path handling, no inline interpolation)
# Use sed+grep to parse just the gmail section's enabled field
# Works without python3+yaml on restricted PATHs
GMAIL_ENABLED="true"
if [[ -f "$CONFIG_PATH" ]]; then
  # Extract gmail section: from 'gmail:' to next section at same or lower indent level
  GMAIL_SECTION=$(sed -n '/gmail:/,/^[^ ]/p' "$CONFIG_PATH" 2>/dev/null | head -5)
  if echo "$GMAIL_SECTION" | grep -qiE 'enabled:\s*(false|no)'; then
    GMAIL_ENABLED="false"
  fi
fi

# If Gmail is disabled, output empty array and exit 0
if [[ "$GMAIL_ENABLED" != "true" ]]; then
  echo "[]"
  exit 0
fi

# Check if gws CLI is installed
if ! command -v gws &>/dev/null; then
  echo "Error: gws CLI is not installed. Install it from https://github.com/nicholasgasior/gws" >&2
  echo "gws is required to fetch Gmail newsletters." >&2
  exit 1
fi

# Read Gmail settings from config in one pass without interpolating shell values
read_gmail_settings() {
  python3 - "$1" <<'PY'
import sys
import yaml

config_path = sys.argv[1]
with open(config_path) as f:
    c = yaml.safe_load(f) or {}

gmail = c.get('sources', {}).get('gmail', {}) or {}
label = str(gmail.get('label', 'Content-Feed'))
max_items = gmail.get('max_items', 20)
label_id = str(gmail.get('label_id', ''))
fetch_body = 'true' if gmail.get('fetch_body', False) else 'false'

print(label)
print(max_items)
print(label_id)
print(fetch_body)
PY
}

if mapfile -t GMAIL_SETTINGS < <(read_gmail_settings "$CONFIG_PATH" 2>/dev/null); then
  GMAIL_LABEL="${GMAIL_SETTINGS[0]:-Content-Feed}"
  MAX_ITEMS="${GMAIL_SETTINGS[1]:-20}"
  GMAIL_LABEL_ID="${GMAIL_SETTINGS[2]:-}"
  FETCH_BODY="${GMAIL_SETTINGS[3]:-false}"
else
  GMAIL_LABEL="Content-Feed"
  MAX_ITEMS="20"
  GMAIL_LABEL_ID=""
  FETCH_BODY="false"
fi

# Fetch emails using gws +triage helper (more reliable than raw API calls —
# the helper handles auth scopes internally, avoiding insufficientPermissions errors)
# Fetch recent emails with labels, then filter by label ID in Python
GWS_ERR=$(mktemp)
trap "rm -f $GWS_ERR" EXIT
EMAILS_JSON=$(gws gmail +triage \
  --query "newer_than:3d" \
  --max 50 \
  --format json \
  --labels \
  2>"$GWS_ERR") || {
  ERROR=$(cat "$GWS_ERR" 2>/dev/null || echo "unknown error")
  if echo "$ERROR" | grep -qi "auth"; then
    echo "Error: Gmail auth expired. Run 'gws auth login -s gmail' to re-authenticate." >&2
    exit 1
  else
    echo "Error: gws failed: $ERROR" >&2
    exit 1
  fi
}

# Transform +triage output to signal format
# +triage returns {messages: [{id, subject, from, date, labels}]}
# Filter by label_id if configured, then limit to max_items

# Determine the scripts directory (where this script lives)
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$FETCH_BODY" == "true" ]]; then
  # Deep mode: filter messages first, then pass to fetch-gmail-deep.py for
  # full body fetching, link extraction, and article following
  echo "$EMAILS_JSON" | python3 - "$GMAIL_LABEL_ID" "$MAX_ITEMS" "$CONFIG_PATH" <<'PY' 2>/dev/null | python3 "$SCRIPTS_DIR/fetch-gmail-deep.py" || {
import json
import sys
import yaml

label_id = sys.argv[1]
max_items = int(sys.argv[2])
config_path = sys.argv[3]

data = json.load(sys.stdin)
messages = data.get('messages', []) if isinstance(data, dict) else data

if label_id:
    messages = [m for m in messages if label_id in m.get('labels', [])]

messages = messages[:max_items]

with open(config_path) as f:
    config = yaml.safe_load(f) or {}
gmail_config = config.get('sources', {}).get('gmail', {}) or {}

json.dump({'messages': messages, 'config': gmail_config}, sys.stdout)
PY
    echo "Error: Deep Gmail processing failed" >&2
    exit 1
  }
else
  # Shallow mode: subject-only signals (original behavior)
  echo "$EMAILS_JSON" | python3 - "$GMAIL_LABEL_ID" "$MAX_ITEMS" <<'PY' 2>/dev/null || {
import json
import sys
from datetime import datetime, timezone

label_id = sys.argv[1]
max_items = int(sys.argv[2])

data = json.load(sys.stdin)
messages = data.get('messages', []) if isinstance(data, dict) else data

if label_id:
    messages = [m for m in messages if label_id in m.get('labels', [])]

messages = messages[:max_items]

signals = []
for email in messages:
    subject = email.get('subject', '') or ''
    sender = email.get('from', '') or ''
    date_str = email.get('date', '') or ''
    msg_id = email.get('id', '') or ''

    if not subject or len(subject.strip()) < 5:
        continue

    published = datetime.now(timezone.utc).isoformat()
    if date_str:
        for fmt in ('%a, %d %b %Y %H:%M:%S %z', '%a, %d %b %Y %H:%M:%S %z (%Z)',
                    '%a, %d %b %Y %H:%M:%S %Z'):
            try:
                published = datetime.strptime(date_str.strip(), fmt).isoformat()
                break
            except (ValueError, TypeError):
                continue

    signals.append({
        'source': 'gmail',
        'title': subject,
        'url': f'gmail://message/{msg_id}',
        'content': subject,
        'published_at': published,
        'metadata': {
            'sender': sender,
            'subject': subject,
            'message_id': msg_id,
        }
    })

json.dump(signals, sys.stdout, indent=2)
PY
    echo "Error: Failed to parse gws output" >&2
    exit 1
  }
fi
