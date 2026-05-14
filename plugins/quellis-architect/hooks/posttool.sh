#!/usr/bin/env bash
# PostToolUse hook (plan 2026-05-13, task 2.C.3).
#
# Reads Claude Code's PostToolUse JSON from stdin, delegates to
# hooks/lib/posttool_inject.py which picks doctrine cards whose
# inject_on_* selectors match the tool call and emits their bodies as
# session context for the agent's next turn.
#
# Contract:
#   - stdin: PostToolUse JSON
#   - stdout: doctrine context to inject (empty when no card matches)
#   - exit 0 always — never block a session.

set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  # No Python — no doctrine. Drain stdin and exit 0 so the session
  # proceeds untouched.
  cat >/dev/null 2>&1 || true
  exit 0
fi

python3 "${here}/lib/posttool_inject.py"
exit 0
