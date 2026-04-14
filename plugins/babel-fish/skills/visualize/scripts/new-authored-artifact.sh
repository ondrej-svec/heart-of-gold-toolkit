#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$SCRIPT_DIR/agent-artifact-template.html"
OUT_PATH="${1:-}"

if [[ -z "$OUT_PATH" ]]; then
  OUT_PATH="$(mktemp /tmp/hog-visualize-artifact-XXXXXX.html)"
fi

cp "$TEMPLATE" "$OUT_PATH"
printf '%s\n' "$OUT_PATH"
