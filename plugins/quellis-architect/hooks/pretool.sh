#!/usr/bin/env bash
# PreToolUse hook runner (plan 2026-05-13, task 1.D.1).
#
# Reads Claude Code's PreToolUse JSON from stdin, delegates matching to
# hooks/lib/pretool_match.py against the user's .quellis/packs/core pack.
#
# Failure modes (per docs/coordination.md):
#   - No Python 3: log to stderr, exit 0 (never break a session).
#   - No trigger pack: matcher returns 0 silently.
#   - Malformed pack: matcher returns 0 silently.
#   - First trigger match: matcher writes message to stderr, exits 2.

set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
matcher="${here}/lib/pretool_match.py"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[quellis] python3 not on PATH — PreToolUse triggers skipped" >&2
  cat >/dev/null 2>&1 || true
  exit 0
fi

# Pass stdin through; matcher exits 2 on block, 0 otherwise.
python3 "${matcher}"
exit_code=$?
exit "${exit_code}"
