#!/usr/bin/env bash
# Stop hook runner (plan 2026-05-13, task 1.D.2).
#
# Reads Claude Code's Stop JSON from stdin, delegates claim-scanning to
# hooks/lib/stop_match.py. On a claim-without-evidence match, blocks the
# Stop transition with a "show evidence" message.
#
# V1.0 ships claim detection only. Phase 1.E adds the evidence-search
# helper that verifies whether the claim is actually unsupported before
# the block fires.

set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
matcher="${here}/lib/stop_match.py"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[quellis] python3 not on PATH — Stop evidence gate skipped" >&2
  cat >/dev/null 2>&1 || true
  exit 0
fi

python3 "${matcher}"
exit_code=$?
exit "${exit_code}"
