#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${CONFIG_PATH:-$HOME/.agent-share/config.json}"
SERVER_DIR="${SERVER_DIR:-$HOME/.agent-share/server}"
API_URL="${API_URL:-http://127.0.0.1:4815}"
VIEWER_URL="${VIEWER_URL:-http://127.0.0.1:4816}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG_PATH="$2"; shift 2 ;;
    --server-dir) SERVER_DIR="$2"; shift 2 ;;
    --api-url) API_URL="$2"; shift 2 ;;
    --viewer-url) VIEWER_URL="$2"; shift 2 ;;
    --help)
      cat <<'EOF'
Usage: install-reference-server.sh [--config PATH] [--server-dir PATH] [--api-url URL] [--viewer-url URL]

Install the Heart of Gold reference share server into a stable local directory and initialize config.
EOF
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

bunx @heart-of-gold/toolkit share-server install --server-dir "$SERVER_DIR"
bunx @heart-of-gold/toolkit share-server init --config "$CONFIG_PATH" --api-url "$API_URL" --viewer-url "$VIEWER_URL" --provider reference
