#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$SCRIPT_DIR/agent-artifact-template.html"
OUT_PATH="${1:-}"

if [[ -z "$OUT_PATH" ]]; then
  TEMP_BASE="$(mktemp /tmp/hog-visualize-artifact-XXXXXX)"
  OUT_PATH="${TEMP_BASE}.html"
fi

cp "$TEMPLATE" "$OUT_PATH"
printf '%s\n' "$OUT_PATH"
