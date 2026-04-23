#!/usr/bin/env bash
# Generate an image via Codex CLI's built-in image_gen tool (gpt-image-2).
# Uses ChatGPT OAuth — no OPENAI_API_KEY required.
# Requires: codex-cli >= 0.124.0-alpha.2

set -euo pipefail

PROMPT=""
OUTPUT="./generated_image.png"
SIZE=""
QUALITY=""

usage() {
  cat <<'EOF'
Usage: generate_image_codex.sh [options] "prompt"

Options:
  -o, --output PATH    Output file (default: ./generated_image.png)
  --size SIZE          e.g. 1024x1024, 1536x1024, 3840x2160, or auto
  --quality LEVEL      low | medium | high | auto
  -h, --help           Show this help

Examples:
  generate_image_codex.sh "a red apple on a white table"
  generate_image_codex.sh --output logo.png --quality high "a minimalist fox logo"
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output)   OUTPUT="$2"; shift 2 ;;
    --size)        SIZE="$2"; shift 2 ;;
    --quality)     QUALITY="$2"; shift 2 ;;
    -h|--help)     usage; exit 0 ;;
    --)            shift; PROMPT="${1:-}"; shift || true ;;
    -*)            echo "Unknown flag: $1" >&2; usage >&2; exit 2 ;;
    *)             PROMPT="$1"; shift ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  echo "Error: prompt is required" >&2
  usage >&2
  exit 2
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Error: codex CLI not found on PATH." >&2
  echo "Install: npm install -g @openai/codex@0.124.0-alpha.2" >&2
  exit 1
fi

OUT_DIR="$(cd "$(dirname "$OUTPUT")" 2>/dev/null && pwd || echo "$(pwd)")"
OUT_ABS="$OUT_DIR/$(basename "$OUTPUT")"
mkdir -p "$OUT_DIR"

INSTR="Use your built-in image_gen tool to generate a single image: $PROMPT"
[[ -n "$SIZE" ]]    && INSTR+=$'\nSize: '"$SIZE"
[[ -n "$QUALITY" ]] && INSTR+=$'\nQuality: '"$QUALITY"
INSTR+=$'\nAfter image_gen returns, copy the generated file to '"$OUT_ABS"$' and print that absolute path as the final line. Do not use the fallback CLI scripts/image_gen.py.'

echo "Generating via codex built-in image_gen (gpt-image-2)..." >&2
echo "Prompt: $PROMPT" >&2

codex exec \
  --skip-git-repo-check \
  --sandbox workspace-write \
  --full-auto \
  -C "$OUT_DIR" \
  "$INSTR" 2>/dev/null | tail -3

if [[ -f "$OUT_ABS" ]]; then
  echo "Image saved to: $OUT_ABS"
else
  echo "Error: expected image at $OUT_ABS but none was written." >&2
  exit 1
fi
