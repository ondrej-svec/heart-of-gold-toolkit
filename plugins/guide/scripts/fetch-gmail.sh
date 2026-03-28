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

# Read label and max_items from config (pass path as argument, SEC-004)
GMAIL_LABEL=$(python3 -c "
import yaml, sys
with open(sys.argv[1]) as f:
    c = yaml.safe_load(f)
print(c.get('sources', {}).get('gmail', {}).get('label', 'Content-Feed'))
" "$CONFIG_PATH" 2>/dev/null || echo "Content-Feed")

MAX_ITEMS=$(python3 -c "
import yaml, sys
with open(sys.argv[1]) as f:
    c = yaml.safe_load(f)
print(c.get('sources', {}).get('gmail', {}).get('max_items', 20))
" "$CONFIG_PATH" 2>/dev/null || echo "20")

# Read label_id from config (for filtering by label ID rather than display name)
GMAIL_LABEL_ID=$(python3 -c "
import yaml, sys
with open(sys.argv[1]) as f:
    c = yaml.safe_load(f)
print(c.get('sources', {}).get('gmail', {}).get('label_id', ''))
" "$CONFIG_PATH" 2>/dev/null || echo "")

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
echo "$EMAILS_JSON" | python3 -c "
import json, sys, os
from datetime import datetime

label_id = '$GMAIL_LABEL_ID'
max_items = int('$MAX_ITEMS')

data = json.load(sys.stdin)
messages = data.get('messages', []) if isinstance(data, dict) else data

# Filter by label ID if configured
if label_id:
    messages = [m for m in messages if label_id in m.get('labels', [])]

# Limit to max_items
messages = messages[:max_items]

signals = []
for email in messages:
    subject = email.get('subject', '') or ''
    sender = email.get('from', '') or ''
    date_str = email.get('date', '') or ''
    msg_id = email.get('id', '') or ''

    # Skip emails with no subject (likely image-only or empty)
    if not subject or len(subject.strip()) < 5:
        continue

    # Parse date or use current time
    published = datetime.utcnow().isoformat()
    if date_str:
        # Try common date formats from Gmail headers
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
        'content': subject,  # +triage doesn't return body; subject used as signal
        'published_at': published,
        'metadata': {
            'sender': sender,
            'subject': subject,
            'message_id': msg_id,
        }
    })

json.dump(signals, sys.stdout, indent=2)
" 2>/dev/null || {
  echo "Error: Failed to parse gws output" >&2
  exit 1
}
