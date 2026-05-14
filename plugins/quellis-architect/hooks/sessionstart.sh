#!/usr/bin/env bash
# SessionStart hook (plan 2026-05-13, V1.0 task 1.C.3 + V1.1 task 2.C.2).
#
# At session start:
#   1. If .quellis/config.toml is absent, emit nothing and exit 0.
#   2. Otherwise, delegate to hooks/lib/sessionstart_inject.py which
#      reads intensity + scans recent git activity + injects matched
#      doctrine cards (max 5 cards, ~1500 tokens budget enforced in
#      hooks/lib/doctrine_loader.py).
#
# Real wiring contract:
#   - Hook receives no stdin input (per Claude Code's SessionStart contract).
#   - cwd is the user's repo root at session start.
#   - Anything written to stdout becomes session context.
#   - Exit 0 always; this hook must never break a session.

set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
config="${repo_root}/.quellis/config.toml"

if [[ ! -f "${config}" ]]; then
  # No Quellis config — emit nothing. The session proceeds untouched.
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  # Fallback to the V1.0 shell-only status line so a Python-less host
  # still sees that Quellis is wired.
  intensity=$(grep -E '^[[:space:]]*intensity[[:space:]]*=' "${config}" 2>/dev/null \
    | head -n 1 \
    | sed -E 's/.*"([^"]*)".*/\1/')
  intensity="${intensity:-standard}"
  printf 'Quellis active · intensity: %s · acceptance log: .quellis/acceptance-log.jsonl\n' \
    "${intensity}"
  exit 0
fi

python3 "${here}/lib/sessionstart_inject.py"
exit 0
