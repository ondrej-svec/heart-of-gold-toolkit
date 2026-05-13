#!/usr/bin/env bash
# Stop hook — V1.0 wiring skeleton (plan 2026-05-13, task 1.C.3).
#
# Real evidence-gate logic lands in Phase 1.E:
#   - Read assistant's last message from stdin (JSON, transcript path inside).
#   - Run claim-scan against .quellis/packs/core/stop-triggers.toml.
#   - On match: emit "show evidence" message to stderr; exit non-zero to
#     block the Stop transition.
#   - Write a line to .quellis/acceptance-log.jsonl recording the fire.
#
# Until 1.E ships, this stub is a no-op so Stop transitions go through cleanly.

set -u

# Drain stdin (Claude Code passes JSON; we discard for now).
cat >/dev/null 2>&1 || true

exit 0
