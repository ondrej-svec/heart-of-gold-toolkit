#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${CONFIG_PATH:-$HOME/.agent-share/config.json}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      CONFIG_PATH="$2"
      shift 2
      ;;
    --help)
      cat <<'EOF'
Usage: healthcheck.sh [--config PATH]

Check the local share-server config and GET /health from the configured admin API.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "{\"ok\":false,\"error\":{\"code\":\"MISSING_CONFIG\",\"message\":\"Config not found at $CONFIG_PATH\"}}"
  exit 1
fi

python3 - <<'PY' "$CONFIG_PATH"
import json, sys, urllib.request
path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    cfg = json.load(f)
url = cfg['server']['apiUrl'].rstrip('/') + '/health'
try:
    with urllib.request.urlopen(url, timeout=5) as resp:
        print(resp.read().decode('utf-8'))
except Exception as exc:
    print(json.dumps({"ok": False, "error": {"code": "HEALTHCHECK_FAILED", "message": str(exc)}}))
    raise SystemExit(1)
PY
