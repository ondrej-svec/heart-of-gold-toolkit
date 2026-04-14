#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RENDER_DIR="$SCRIPT_DIR/render-mindmap"
RENDER_SCRIPT="$SCRIPT_DIR/smart-render.js"
INPUT_PATH=""
SLUG=""
TITLE=""
ALIAS=""
MODE="auto"
KEEP_HTML=0
URL_ONLY=0
HTML_OUT=""
TEMP_DIR=""

usage() {
  cat <<'EOF'
Usage: render-and-share.sh <markdown-file> [--mode MODE] [--slug STEM] [--title TITLE] [--alias ALIAS] [--html-out PATH] [--keep-html] [--url-only]

Generate a polished HTML visualization from a markdown file, publish it via share-html, and print the publish JSON.
Use --mode to force a renderer (mindmap, outline, roadmap, architecture, mockup, explainer).
Use --url-only to print only the final browser URL.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) MODE="$2"; shift 2 ;;
    --slug) SLUG="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --alias) ALIAS="$2"; shift 2 ;;
    --html-out) HTML_OUT="$2"; shift 2 ;;
    --keep-html) KEEP_HTML=1; shift ;;
    --url-only) URL_ONLY=1; shift ;;
    --help) usage; exit 0 ;;
    --*) echo "Unknown argument: $1" >&2; exit 1 ;;
    *)
      if [[ -z "$INPUT_PATH" ]]; then
        INPUT_PATH="$1"
        shift
      else
        echo "Unexpected positional argument: $1" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$INPUT_PATH" ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "$INPUT_PATH" ]]; then
  echo "Input markdown file does not exist: $INPUT_PATH" >&2
  exit 1
fi

if [[ ! -f "$RENDER_SCRIPT" ]]; then
  echo "Renderer script not found: $RENDER_SCRIPT" >&2
  exit 1
fi

if [[ ! -d "$RENDER_DIR/node_modules" ]]; then
  (cd "$RENDER_DIR" && npm install --silent)
fi

if [[ -z "$HTML_OUT" ]]; then
  TEMP_DIR="$(mktemp -d)"
  HTML_OUT="$TEMP_DIR/$(basename "${INPUT_PATH%.*}").html"
fi

cleanup() {
  if [[ "$KEEP_HTML" -eq 0 && -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}
trap cleanup EXIT

node "$RENDER_SCRIPT" "$INPUT_PATH" --mode "$MODE" --out "$HTML_OUT" >/dev/null

find_share_publish_script() {
  local candidates=(
    "$SCRIPT_DIR/../../share-html/scripts/publish.sh"
    "$SCRIPT_DIR/../../../marvin/skills/share-html/scripts/publish.sh"
    "$SCRIPT_DIR/../../../../marvin/skills/share-html/scripts/publish.sh"
    "$HOME/.agents/skills/share-html/scripts/publish.sh"
    "$HOME/.pi/agent/skills/share-html/scripts/publish.sh"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  find "$(cd "$SCRIPT_DIR/../../../../.." && pwd)" -path '*/share-html/scripts/publish.sh' 2>/dev/null | head -1
}

PUBLISH_SCRIPT="$(find_share_publish_script)"
if [[ -z "$PUBLISH_SCRIPT" || ! -f "$PUBLISH_SCRIPT" ]]; then
  echo '{"ok":false,"error":{"code":"MISSING_SHARE_HTML","message":"Could not find share-html publish.sh. Install the share-html skill first."}}'
  exit 1
fi

CMD=(bash "$PUBLISH_SCRIPT" "$HTML_OUT")
if [[ -n "$SLUG" ]]; then CMD+=(--slug "$SLUG"); fi
if [[ -n "$TITLE" ]]; then CMD+=(--title "$TITLE"); fi
if [[ -n "$ALIAS" ]]; then CMD+=(--alias "$ALIAS"); fi

PUBLISH_JSON="$("${CMD[@]}")"

if [[ "$URL_ONLY" -eq 1 ]]; then
  python3 - <<'PY' "$PUBLISH_JSON"
import json, sys
payload = json.loads(sys.argv[1])
if not payload.get("ok", True):
    print(json.dumps(payload))
    raise SystemExit(1)
print(payload.get("url") or payload.get("viewerUrl") or "")
PY
else
  printf '%s\n' "$PUBLISH_JSON"
fi
