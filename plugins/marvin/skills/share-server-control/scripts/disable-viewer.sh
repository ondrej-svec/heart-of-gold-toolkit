#!/usr/bin/env bash
set -euo pipefail

TAILSCALE_BIN="${TAILSCALE_BIN:-tailscale}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      cat <<'EOF'
Usage: disable-viewer.sh

Disable private Tailscale Serve exposure for the viewer listener.
EOF
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

"$TAILSCALE_BIN" serve --https=443 off
echo '{"ok":true,"action":"disable-viewer"}'
