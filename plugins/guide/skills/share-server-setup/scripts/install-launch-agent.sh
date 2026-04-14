#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${CONFIG_PATH:-$HOME/.agent-share/config.json}"
SERVER_DIR="${SERVER_DIR:-$HOME/.agent-share/server}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG_PATH="$2"; shift 2 ;;
    --server-dir) SERVER_DIR="$2"; shift 2 ;;
    --help)
      cat <<'EOF'
Usage: install-launch-agent.sh [--config PATH] [--server-dir PATH]

Write a macOS LaunchAgent for the installed Heart of Gold reference share server.
EOF
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

bunx @heart-of-gold/toolkit share-server install-launch-agent --config "$CONFIG_PATH" --server-dir "$SERVER_DIR"
