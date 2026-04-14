#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${CONFIG_PATH:-$HOME/.agent-share/config.json}"
VIEWER_PORT="${VIEWER_PORT:-4816}"
PUBLIC_BASE_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG_PATH="$2"; shift 2 ;;
    --viewer-port) VIEWER_PORT="$2"; shift 2 ;;
    --public-base-url) PUBLIC_BASE_URL="$2"; shift 2 ;;
    --help)
      cat <<'EOF'
Usage: configure-tailscale-viewer.sh --public-base-url URL [--viewer-port PORT] [--config PATH]

Expose the viewer listener over tailscale serve and update config.publicBaseUrl.
EOF
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PUBLIC_BASE_URL" ]]; then
  echo "--public-base-url is required" >&2
  exit 1
fi

if ! command -v tailscale >/dev/null 2>&1; then
  echo "tailscale CLI not found" >&2
  exit 1
fi

tailscale serve --bg --yes "$VIEWER_PORT"

python3 - <<'PY' "$CONFIG_PATH" "$PUBLIC_BASE_URL"
import json, os, sys
path, public_url = sys.argv[1], sys.argv[2]
os.makedirs(os.path.dirname(path), exist_ok=True)
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
else:
    cfg = {
        "server": {
            "apiUrl": "http://127.0.0.1:4815",
            "viewerUrl": "http://127.0.0.1:4816",
            "publicBaseUrl": None,
            "apiToken": None,
            "provider": "reference",
            "version": 1,
        },
        "defaults": {
            "publishMode": "immutable",
            "aliasStrategy": "none",
            "openAfterPublish": False,
        },
    }
cfg["server"]["publicBaseUrl"] = public_url
with open(path, 'w', encoding='utf-8') as f:
    json.dump(cfg, f, indent=2)
    f.write('\n')
print(json.dumps({"ok": True, "configPath": path, "publicBaseUrl": public_url}))
PY
