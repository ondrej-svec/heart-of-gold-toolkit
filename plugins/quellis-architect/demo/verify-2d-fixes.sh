#!/usr/bin/env bash
# Mechanical verification of plan §2.D fixes (2026-05-13).
#
# Walks through the schema-migration footgun by replaying crafted PreToolUse
# JSON through the actual hook scripts. Useful as a pre-flight check before
# the human-driven V1.0 demo retry — confirms the pipeline produces the
# acceptance log shape the §2.D.6 gate criteria require.
#
# Usage:  bash demo/verify-2d-fixes.sh
#
# Expected outcome:
#   1. Naive Write blocks (fire, exit 2)
#   2. Compliant Write passes (suppressed_compliant, exit 0)
#   3. Bash heredoc bypass blocks (fire on Bash trigger)
#   4. Compliant Bash heredoc passes (suppressed_compliant)
#   5. acceptance-log.jsonl ends with 4 entries:
#      [fire (Write), suppressed_compliant (Write), fire (Bash), suppressed_compliant (Bash)]

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PRETOOL="${PLUGIN_ROOT}/hooks/pretool.sh"

WORK="$(mktemp -d -t quellis-2d-verify-XXXXXX)"
trap 'rm -rf "${WORK}"' EXIT

# Seed the fake repo with the core pack so the hooks have triggers to read.
mkdir -p "${WORK}/.quellis/packs/core"
cp "${PLUGIN_ROOT}"/packs/core/*.toml "${WORK}/.quellis/packs/core/"

export CLAUDE_PROJECT_DIR="${WORK}"
LOG="${WORK}/.quellis/acceptance-log.jsonl"

pass=0
fail=0
check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "${expected}" == "${actual}" ]]; then
    echo "  ✓ ${name}"
    pass=$((pass + 1))
  else
    echo "  ✗ ${name} (expected ${expected}, got ${actual})"
    fail=$((fail + 1))
  fi
}

echo "─── §2.D mechanical verification ──────────────────────"
echo

# 1. Naive Write — should block.
naive_payload=$(cat <<'EOF'
{"tool_name":"Write","tool_input":{"file_path":"migrations/0002_add_intensity.sql","content":"ALTER TABLE users ADD COLUMN intensity TEXT;\n"},"session_id":"verify-2d"}
EOF
)
echo "[1] Write migration without backfill note:"
echo "${naive_payload}" | bash "${PRETOOL}" 2>&1 >/dev/null
check "naive Write blocks (exit 2)" "2" "$?"

# 2. Compliant Write — should pass.
compliant_payload=$(cat <<'EOF'
{"tool_name":"Write","tool_input":{"file_path":"migrations/0002_add_intensity.sql","content":"-- backfill: existing rows default to 'standard'\nALTER TABLE users ADD COLUMN intensity TEXT NOT NULL DEFAULT 'standard';\n"},"session_id":"verify-2d"}
EOF
)
echo "[2] Write migration WITH backfill note:"
echo "${compliant_payload}" | bash "${PRETOOL}" 2>&1 >/dev/null
check "compliant Write passes (exit 0)" "0" "$?"

# 3. Bash heredoc bypass attempt — should block.
bash_naive=$(cat <<'EOF'
{"tool_name":"Bash","tool_input":{"command":"cat > migrations/0002_add_intensity.sql <<EOF\nALTER TABLE users ADD COLUMN intensity TEXT;\nEOF"},"session_id":"verify-2d"}
EOF
)
echo "[3] Bash heredoc redirection into migrations/:"
echo "${bash_naive}" | bash "${PRETOOL}" 2>&1 >/dev/null
check "Bash bypass blocks (exit 2)" "2" "$?"

# 4. Compliant Bash heredoc — should pass.
bash_compliant=$(cat <<'EOF'
{"tool_name":"Bash","tool_input":{"command":"cat > migrations/0002_add_intensity.sql <<EOF\n-- backfill: existing rows default to 'standard'\nALTER TABLE users ADD COLUMN intensity TEXT NOT NULL DEFAULT 'standard';\nEOF"},"session_id":"verify-2d"}
EOF
)
echo "[4] Bash heredoc WITH backfill note:"
echo "${bash_compliant}" | bash "${PRETOOL}" 2>&1 >/dev/null
check "compliant Bash heredoc passes (exit 0)" "0" "$?"

# 5. Acceptance log inspection.
echo
echo "[5] Acceptance log shape:"
if [[ ! -f "${LOG}" ]]; then
  echo "  ✗ acceptance-log.jsonl was not written"
  fail=$((fail + 1))
else
  count=$(wc -l <"${LOG}" | tr -d ' ')
  check "log has 4 entries" "4" "${count}"

  fires=$(grep -c '"event_type": "fire"' "${LOG}" || true)
  suppressed=$(grep -c '"event_type": "suppressed_compliant"' "${LOG}" || true)
  check "2 fires" "2" "${fires}"
  check "2 suppressed_compliant" "2" "${suppressed}"

  trigger_hits=$(grep -c '"trigger_id": "convention.migration' "${LOG}" || true)
  check "all 4 from migration family" "4" "${trigger_hits}"

  echo
  echo "  Log preview:"
  while IFS= read -r line; do
    echo "    ${line}"
  done <"${LOG}"
fi

echo
echo "─── Summary ──"
echo "  passed: ${pass}"
echo "  failed: ${fail}"
echo

if [[ "${fail}" -gt 0 ]]; then
  exit 1
fi
echo "§2.D mechanical contract holds. Ready for the live demo retry."
