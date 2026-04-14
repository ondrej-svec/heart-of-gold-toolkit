#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HTML_PATH=""
SLUG=""
TITLE=""
ALIAS=""
URL_ONLY=0

usage() {
  cat <<'EOF'
Usage: publish-authored-html.sh <html-file> [--slug STEM] [--title TITLE] [--alias ALIAS] [--url-only]

Publish an already-authored HTML artifact via share-html.
Use this when the coding agent wrote the HTML directly and only needs the share pipeline.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug) SLUG="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --alias) ALIAS="$2"; shift 2 ;;
    --url-only) URL_ONLY=1; shift ;;
    --help) usage; exit 0 ;;
    --*) echo "Unknown argument: $1" >&2; exit 1 ;;
    *)
      if [[ -z "$HTML_PATH" ]]; then
        HTML_PATH="$1"
        shift
      else
        echo "Unexpected positional argument: $1" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$HTML_PATH" ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "$HTML_PATH" ]]; then
  echo "HTML file does not exist: $HTML_PATH" >&2
  exit 1
fi

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

CMD=(bash "$PUBLISH_SCRIPT" "$HTML_PATH")
if [[ -n "$SLUG" ]]; then CMD+=(--slug "$SLUG"); fi
if [[ -n "$TITLE" ]]; then CMD+=(--title "$TITLE"); fi
if [[ -n "$ALIAS" ]]; then CMD+=(--alias "$ALIAS"); fi

PUBLISH_JSON="$(${CMD[@]})"

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
