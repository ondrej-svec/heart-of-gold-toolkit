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

GMAIL_SETTINGS_RAW=$(read_gmail_settings "$CONFIG_PATH" 2>/dev/null) || GMAIL_SETTINGS_RAW=""
if [[ -n "$GMAIL_SETTINGS_RAW" ]]; then
  GMAIL_LABEL=$(echo "$GMAIL_SETTINGS_RAW" | sed -n '1p')
  MAX_ITEMS=$(echo "$GMAIL_SETTINGS_RAW" | sed -n '2p')
  GMAIL_LABEL_ID=$(echo "$GMAIL_SETTINGS_RAW" | sed -n '3p')
  FETCH_BODY=$(echo "$GMAIL_SETTINGS_RAW" | sed -n '4p')
  GMAIL_LABEL="${GMAIL_LABEL:-Content-Feed}"
  MAX_ITEMS="${MAX_ITEMS:-20}"
  FETCH_BODY="${FETCH_BODY:-false}"
else
  GMAIL_LABEL="Content-Feed"
  MAX_ITEMS="20"
  GMAIL_LABEL_ID=""
  FETCH_BODY="false"
fi

# Collect seen Gmail message IDs from previous days to avoid duplicates
PIPELINE_DIR=$(python3 -c "
import yaml, sys
with open(sys.argv[1]) as f:
    c = yaml.safe_load(f)
print(c.get('output', {}).get('pipeline_dir', 'content/pipeline'))
" "$CONFIG_PATH" 2>/dev/null || echo "content/pipeline")

SEEN_IDS=$(python3 -c "
import json, glob, os, sys

pipeline_dir = sys.argv[1]
config_path = sys.argv[2]

# Resolve relative pipeline_dir against project root (config's grandparent,
# since config lives in content/ which is one level below project root)
if not os.path.isabs(pipeline_dir):
    config_dir = os.path.dirname(os.path.abspath(config_path))
    # Walk up until we find .git or use config's parent's parent as fallback
    project_root = config_dir
    while project_root != '/':
        if os.path.isdir(os.path.join(project_root, '.git')):
            break
        project_root = os.path.dirname(project_root)
    pipeline_dir = os.path.join(project_root, pipeline_dir)

seen = set()
# Check last 7 days of signals files
for path in sorted(glob.glob(os.path.join(pipeline_dir, '*/signals.json')))[-7:]:
    try:
        signals = json.load(open(path))
        for s in signals:
            if s.get('source') == 'gmail':
                mid = s.get('metadata', {}).get('message_id', '')
                if mid:
                    seen.add(mid)
    except (json.JSONDecodeError, KeyError):
        pass
# Output as comma-separated IDs
print(','.join(seen))
" "$PIPELINE_DIR" "$CONFIG_PATH" 2>/dev/null || echo "")

if [[ -n "$SEEN_IDS" ]]; then
  SEEN_COUNT=$(echo "$SEEN_IDS" | tr ',' '\n' | wc -l | tr -d ' ')
  echo "  · $SEEN_COUNT previously seen Gmail message IDs loaded" >&2
fi

# Fetch emails using gws +triage helper (more reliable than raw API calls —
# the helper handles auth scopes internally, avoiding insufficientPermissions errors)
# Fetch recent emails with labels, then filter by label ID in Python
GWS_ERR=$(mktemp)
trap "rm -f $GWS_ERR" EXIT
EMAILS_JSON=$(gws gmail +triage \
  --query "newer_than:7d" \
  --max 200 \
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

export _GMAIL_LABEL_ID="$GMAIL_LABEL_ID"
export _GMAIL_MAX_ITEMS="$MAX_ITEMS"
export _GMAIL_CONFIG_PATH="$CONFIG_PATH"
export _GMAIL_SEEN_IDS="$SEEN_IDS"

if [[ "$FETCH_BODY" == "true" ]]; then
  # Deep mode: filter messages first, then pass to fetch-gmail-deep.py for
  # full body fetching, link extraction, and article following
  echo "$EMAILS_JSON" | python3 -c "
import json, sys, yaml, os

label_id = os.environ['_GMAIL_LABEL_ID']
max_items = int(os.environ['_GMAIL_MAX_ITEMS'])
config_path = os.environ['_GMAIL_CONFIG_PATH']
seen_ids = set(os.environ.get('_GMAIL_SEEN_IDS', '').split(',')) - {''}

data = json.load(sys.stdin)
messages = data.get('messages', []) if isinstance(data, dict) else data

if label_id:
    messages = [m for m in messages if label_id in m.get('labels', [])]

before = len(messages)
messages = [m for m in messages if m.get('id', '') not in seen_ids]
skipped = before - len(messages)
if skipped:
    print(f'  Dedup: skipped {skipped} already-seen messages', file=sys.stderr)

messages = messages[:max_items]

with open(config_path) as f:
    config = yaml.safe_load(f) or {}
gmail_config = config.get('sources', {}).get('gmail', {}) or {}

json.dump({'messages': messages, 'config': gmail_config}, sys.stdout)
" | python3 "$SCRIPTS_DIR/fetch-gmail-deep.py" || {
    echo "Error: Deep Gmail processing failed" >&2
    exit 1
  }
else
  # Shallow mode: subject-only signals (original behavior)
  echo "$EMAILS_JSON" | python3 -c "
import json, sys, os
from datetime import datetime, timezone

label_id = os.environ.get('_GMAIL_LABEL_ID', '')
max_items = int(os.environ.get('_GMAIL_MAX_ITEMS', '20'))
seen_ids = set(os.environ.get('_GMAIL_SEEN_IDS', '').split(',')) - {''}

data = json.load(sys.stdin)
messages = data.get('messages', []) if isinstance(data, dict) else data

if label_id:
    messages = [m for m in messages if label_id in m.get('labels', [])]

before = len(messages)
messages = [m for m in messages if m.get('id', '') not in seen_ids]
skipped = before - len(messages)
if skipped:
    print(f'  Dedup: skipped {skipped} already-seen messages', file=sys.stderr)

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
" 2>/dev/null || {
    echo "Error: Failed to parse gws output" >&2
    exit 1
  }
fi
