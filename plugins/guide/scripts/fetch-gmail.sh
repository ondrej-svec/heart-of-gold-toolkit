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

# Read config values using python3 + yaml (available in the pipeline environment)
# Default to "true" on parse failure so the gws availability check still runs (fail-open)
GMAIL_ENABLED=$(python3 -c "
import yaml, sys
with open('$CONFIG_PATH') as f:
    c = yaml.safe_load(f)
gmail = c.get('sources', {}).get('gmail', {})
print(str(gmail.get('enabled', False)).lower())
" 2>/dev/null || echo "true")

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

# Read label and max_items from config
GMAIL_LABEL=$(python3 -c "
import yaml
with open('$CONFIG_PATH') as f:
    c = yaml.safe_load(f)
print(c.get('sources', {}).get('gmail', {}).get('label', 'Content-Feed'))
" 2>/dev/null || echo "Content-Feed")

MAX_ITEMS=$(python3 -c "
import yaml
with open('$CONFIG_PATH') as f:
    c = yaml.safe_load(f)
print(c.get('sources', {}).get('gmail', {}).get('max_items', 20))
" 2>/dev/null || echo "20")

# Fetch emails using gws
# gws mail list fetches emails from a label
EMAILS_JSON=$(gws mail list --label "$GMAIL_LABEL" --max "$MAX_ITEMS" --format json 2>/tmp/gws_error) || {
  ERROR=$(cat /tmp/gws_error 2>/dev/null || echo "unknown error")
  if echo "$ERROR" | grep -qi "auth"; then
    echo "Error: Gmail auth expired. Run 'gws auth' to re-authenticate." >&2
    exit 1
  elif echo "$ERROR" | grep -qi "label"; then
    echo "Error: Gmail label '$GMAIL_LABEL' not found. Create it in Gmail first." >&2
    exit 1
  else
    echo "Error: gws failed: $ERROR" >&2
    exit 1
  fi
}

# Transform gws output to signal format
# Skip emails with no text content (image-only) by checking body/text is not null or empty
echo "$EMAILS_JSON" | python3 -c "
import json, sys, re
from datetime import datetime

data = json.load(sys.stdin)
if not isinstance(data, list):
    data = [data] if data else []

signals = []
for email in data:
    # Extract text content, strip HTML
    body = email.get('body', '') or email.get('text', '') or email.get('snippet', '') or ''
    # Strip HTML tags
    content = re.sub(r'<[^>]+>', ' ', str(body))
    content = re.sub(r'\s+', ' ', content).strip()

    # Skip image-only emails with no text content
    if not content or len(content) < 10:
        continue

    subject = email.get('subject', '') or ''
    sender = email.get('from', '') or email.get('sender', '') or ''
    date_str = email.get('date', '') or email.get('internalDate', '') or ''

    # Parse date or use current time
    try:
        published = datetime.fromisoformat(date_str).isoformat()
    except (ValueError, TypeError):
        published = datetime.utcnow().isoformat()

    url = email.get('link', '') or email.get('url', '') or ''
    msg_id = email.get('id', '') or email.get('messageId', '') or ''

    signals.append({
        'source': 'gmail',
        'title': subject,
        'url': url if url else f'gmail://message/{msg_id}',
        'content': content,
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
