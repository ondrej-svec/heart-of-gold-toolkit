#!/usr/bin/env bash
set -euo pipefail

PLIST_PATH="${PLIST_PATH:-$HOME/Library/LaunchAgents/com.heart-of-gold.share-server.plist}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      cat <<'EOF'
Usage: stop.sh

Unload the macOS LaunchAgent for the local share server.
EOF
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

launchctl unload "$PLIST_PATH" 2>/dev/null || true
echo "{\"ok\":true,\"action\":\"stop\",\"plistPath\":\"$PLIST_PATH\"}"
