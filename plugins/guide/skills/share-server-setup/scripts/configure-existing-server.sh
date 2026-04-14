#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${CONFIG_PATH:-$HOME/.agent-share/config.json}"
API_URL=""
VIEWER_URL=""
PUBLIC_BASE_URL=""
PROVIDER="existing"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG_PATH="$2"; shift 2 ;;
    --api-url) API_URL="$2"; shift 2 ;;
    --viewer-url) VIEWER_URL="$2"; shift 2 ;;
    --public-base-url) PUBLIC_BASE_URL="$2"; shift 2 ;;
    --provider) PROVIDER="$2"; shift 2 ;;
    --help)
      cat <<'EOF'
Usage: configure-existing-server.sh --api-url URL --viewer-url URL [--public-base-url URL] [--provider NAME] [--config PATH]

Write config for an already-running compatible share server.
EOF
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$API_URL" || -z "$VIEWER_URL" ]]; then
  echo "--api-url and --viewer-url are required" >&2
  exit 1
fi

CMD=(bunx @heart-of-gold/toolkit share-server init --config "$CONFIG_PATH" --api-url "$API_URL" --viewer-url "$VIEWER_URL" --provider "$PROVIDER")
if [[ -n "$PUBLIC_BASE_URL" ]]; then
  CMD+=(--public-base-url "$PUBLIC_BASE_URL")
fi
"${CMD[@]}"
