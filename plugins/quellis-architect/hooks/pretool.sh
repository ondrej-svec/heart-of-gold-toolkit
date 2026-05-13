#!/usr/bin/env bash
# PreToolUse hook — V1.0 wiring skeleton (plan 2026-05-13, task 1.C.3).
#
# Real trigger logic lands in Phase 1.D:
#   - Read tool name + args from stdin (Claude Code hook contract: JSON).
#   - Load .quellis/packs/core/pretool-triggers.toml (or baselines/core).
#   - Match against the tool call.
#   - On match: print a structured block message to stderr; exit non-zero.
#   - On no match: exit 0 silently.
#
# Until 1.D ships, this stub is a no-op so the plugin installs and runs
# without breaking sessions. Stdin is drained but ignored.

set -u

# Drain stdin so Claude Code's hook protocol does not block.
cat >/dev/null 2>&1 || true

# No triggers loaded yet — pass everything.
exit 0
