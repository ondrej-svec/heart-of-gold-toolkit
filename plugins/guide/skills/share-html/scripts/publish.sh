#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${CONFIG_PATH:-$HOME/.agent-share/config.json}"
ARTIFACT_PATH=""
SLUG=""
TITLE=""
ALIAS=""

usage() {
  cat <<'EOF'
Usage: publish.sh <path> [--config PATH] [--slug STEM] [--title TITLE] [--alias ALIAS]

Publish a single HTML file or a static site directory containing index.html.
Prints JSON to stdout.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG_PATH="$2"; shift 2 ;;
    --slug) SLUG="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --alias) ALIAS="$2"; shift 2 ;;
    --help) usage; exit 0 ;;
    --*) echo "Unknown argument: $1" >&2; exit 1 ;;
    *)
      if [[ -z "$ARTIFACT_PATH" ]]; then
        ARTIFACT_PATH="$1"
        shift
      else
        echo "Unexpected positional argument: $1" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$ARTIFACT_PATH" ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo '{"ok":false,"error":{"code":"MISSING_CONFIG","message":"Share server config not found. Run share-server-setup first."}}'
  exit 1
fi

API_URL="$(python3 - <<'PY' "$CONFIG_PATH"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    cfg = json.load(f)
print(cfg['server']['apiUrl'])
PY
)"

ARTIFACT_TYPE=""
UPLOAD_PATH=""
TEMP_DIR=""
cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}
trap cleanup EXIT

if [[ -f "$ARTIFACT_PATH" ]]; then
  if [[ "${ARTIFACT_PATH##*.}" != "html" ]]; then
    echo '{"ok":false,"error":{"code":"UNSUPPORTED_ARTIFACT","message":"Only .html files are supported for single-file publishing."}}'
    exit 1
  fi
  ARTIFACT_TYPE="html-file"
  UPLOAD_PATH="$ARTIFACT_PATH"
elif [[ -d "$ARTIFACT_PATH" ]]; then
  if [[ ! -f "$ARTIFACT_PATH/index.html" ]]; then
    echo '{"ok":false,"error":{"code":"INDEX_HTML_MISSING","message":"Static site directory must contain index.html at its root."}}'
    exit 1
  fi
  ARTIFACT_TYPE="static-site-zip"
  TEMP_DIR="$(mktemp -d)"
  UPLOAD_PATH="$TEMP_DIR/site.zip"
  (
    cd "$ARTIFACT_PATH"
    zip -rq "$UPLOAD_PATH" .
  )
else
  echo '{"ok":false,"error":{"code":"MISSING_PATH","message":"Input path does not exist."}}'
  exit 1
fi

CURL_ARGS=(
  -fsS
  -X POST
  -F "artifact=@$UPLOAD_PATH"
  -F "artifactType=$ARTIFACT_TYPE"
)
if [[ -n "$SLUG" ]]; then CURL_ARGS+=(-F "slug=$SLUG"); fi
if [[ -n "$TITLE" ]]; then CURL_ARGS+=(-F "title=$TITLE"); fi
if [[ -n "$ALIAS" ]]; then CURL_ARGS+=(-F "alias=$ALIAS"); fi

curl "${CURL_ARGS[@]}" "${API_URL%/}/publish"
