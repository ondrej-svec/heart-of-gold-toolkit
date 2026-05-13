#!/usr/bin/env bash
# SessionStart hook — V1.0 wiring skeleton (plan 2026-05-13, task 1.C.3).
#
# At this stage the hook only proves the plugin is wired correctly. It reads
# .quellis/config.toml if present and emits a single context line so the agent
# session shows "Quellis active." No doctrine injection, no acceptance log
# writes — those land in Phase 1.D and later.
#
# Real wiring contract:
#   - Hook receives no stdin input (per Claude Code's SessionStart contract).
#   - cwd is the user's repo root at session start.
#   - Anything written to stdout becomes session context (precious tokens —
#     keep it terse).
#   - Exit 0 always; this hook must never break a session.

set -u

repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
config="${repo_root}/.quellis/config.toml"

if [[ ! -f "${config}" ]]; then
  # No Quellis config — emit nothing. The session proceeds untouched.
  exit 0
fi

# Cheap intensity extraction without taking a TOML dep: grep the line we wrote
# in `quellis init`. Format is `intensity = "standard"` (or chill/strict).
intensity=$(grep -E '^[[:space:]]*intensity[[:space:]]*=' "${config}" 2>/dev/null \
  | head -n 1 \
  | sed -E 's/.*"([^"]*)".*/\1/')
intensity="${intensity:-standard}"

# Single-line context emission. ≤ 200 chars per the Subjective Contract.
printf 'Quellis active · intensity: %s · acceptance log: .quellis/acceptance-log.jsonl\n' \
  "${intensity}"

exit 0
