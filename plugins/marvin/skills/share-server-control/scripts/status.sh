#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${CONFIG_PATH:-$HOME/.agent-share/config.json}"
PLIST_PATH="${PLIST_PATH:-$HOME/Library/LaunchAgents/com.heart-of-gold.share-server.plist}"
TAILSCALE_BIN="${TAILSCALE_BIN:-tailscale}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG_PATH="$2"; shift 2 ;;
    --help)
      cat <<'EOF'
Usage: status.sh [--config PATH]

Show LaunchAgent state, server health, and Tailscale Serve status for the local share server.
EOF
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

python3 - <<'PY' "$CONFIG_PATH" "$PLIST_PATH" "$TAILSCALE_BIN"
import json, os, subprocess, sys, urllib.request
config_path, plist_path, tailscale = sys.argv[1], sys.argv[2], sys.argv[3]
result = {
    'ok': True,
    'configPath': config_path,
    'launchAgent': {
        'plistPath': plist_path,
        'exists': os.path.exists(plist_path),
        'loaded': False,
    },
    'health': None,
    'tailscaleServe': {
        'available': False,
        'status': None,
    },
}
if result['launchAgent']['exists']:
    try:
        proc = subprocess.run(['launchctl', 'list', 'com.heart-of-gold.share-server'], capture_output=True, text=True)
        result['launchAgent']['loaded'] = proc.returncode == 0
    except Exception:
        pass
if os.path.exists(config_path):
    with open(config_path, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    url = cfg['server']['apiUrl'].rstrip('/') + '/health'
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            result['health'] = json.loads(resp.read().decode('utf-8'))
    except Exception as exc:
        result['health'] = {'ok': False, 'error': str(exc)}
try:
    proc = subprocess.run([tailscale, 'serve', 'status'], capture_output=True, text=True)
    result['tailscaleServe']['available'] = proc.returncode == 0
    result['tailscaleServe']['status'] = (proc.stdout or proc.stderr).strip()
except FileNotFoundError:
    result['tailscaleServe']['available'] = False
print(json.dumps(result, indent=2))
PY
