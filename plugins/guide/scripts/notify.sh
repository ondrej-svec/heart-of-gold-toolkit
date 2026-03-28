#!/bin/bash
# notify.sh — Unified notification script supporting iMessage and Slack.
#
# Usage:
#   bash notify.sh --type <imessage|slack> --recipient <addr> --message <text>
#
# iMessage: uses osascript to send via Messages.app
# Slack: uses curl to POST to a webhook URL
#
# iMessage messages are truncated to 280 chars with "..." appended if too long.
#
# Exit codes:
#   0 — success
#   1 — failure (empty message, unknown type, send error)

set -euo pipefail

TYPE=""
RECIPIENT=""
MESSAGE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      TYPE="$2"
      shift 2
      ;;
    --recipient)
      RECIPIENT="$2"
      shift 2
      ;;
    --message)
      MESSAGE="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Validate required arguments
if [[ -z "$TYPE" ]]; then
  echo "Error: --type argument is required. Supported types: imessage, slack" >&2
  exit 1
fi

if [[ -z "$MESSAGE" ]]; then
  echo "Error: --message argument is required and must not be empty" >&2
  exit 1
fi

if [[ -z "$RECIPIENT" ]]; then
  echo "Error: --recipient argument is required" >&2
  exit 1
fi

# Send notification based on type
case "$TYPE" in
  imessage)
    # Truncate to 280 chars if message exceeds limit
    if [[ ${#MESSAGE} -gt 280 ]]; then
      MESSAGE="${MESSAGE:0:277}..."
    fi

    # Escape double quotes for AppleScript string safety (SEC-002, SEC-003)
    SAFE_MSG="${MESSAGE//\"/\\\"}"
    SAFE_RECIPIENT="${RECIPIENT//\"/\\\"}"

    # Send via osascript (Messages.app)
    osascript -e "
      tell application \"Messages\"
        set targetBuddy to \"$SAFE_RECIPIENT\"
        set targetService to id of 1st account whose service type = iMessage
        set theBuddy to participant targetBuddy of account id targetService
        send \"$SAFE_MSG\" to theBuddy
      end tell
    " 2>/dev/null || {
      echo "Error: Failed to send iMessage to $RECIPIENT" >&2
      exit 1
    }
    echo "iMessage sent to $RECIPIENT"
    ;;

  slack)
    # Build JSON payload safely using jq (SEC-001, SEC-010)
    PAYLOAD=$(jq -n --arg text "$MESSAGE" '{text: $text}')

    # Send via webhook URL using curl
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      "$RECIPIENT" 2>/dev/null) || {
      echo "Error: Slack webhook request failed" >&2
      exit 1
    }

    if [[ "$HTTP_CODE" != "200" ]]; then
      echo "Error: Slack webhook returned HTTP $HTTP_CODE (expected 200)" >&2
      exit 1
    fi
    echo "Slack notification sent"
    ;;

  *)
    echo "Error: Unknown notification type '$TYPE'. Supported: imessage, slack" >&2
    exit 1
    ;;
esac

exit 0
