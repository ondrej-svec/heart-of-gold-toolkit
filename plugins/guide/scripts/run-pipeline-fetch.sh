#!/bin/bash
# run-pipeline-fetch.sh — Deterministic pipeline fetcher.
#
# Calls ALL configured sources, combines signals, normalizes scores,
# writes signals.json + fetch-log.json. Events cannot be skipped.
#
# Usage:
#   bash run-pipeline-fetch.sh --config <path-to-config.yaml>
#
# Output:
#   content/pipeline/YYYY-MM-DD/signals.json  — combined, scored signals
#   content/pipeline/YYYY-MM-DD/fetch-log.json — per-source status
#
# Exit codes:
#   0 — at least one source succeeded
#   1 — ALL sources failed (or config error)

set -uo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      CONFIG_PATH="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "$CONFIG_PATH" ]]; then
  echo "Error: --config argument is required" >&2
  exit 1
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Error: Config file not found: $CONFIG_PATH" >&2
  exit 1
fi

# Determine output directory
TODAY=$(date -u +%Y-%m-%d)
PIPELINE_DIR=$(python3 -c "
import yaml, sys
with open(sys.argv[1]) as f:
    c = yaml.safe_load(f)
print(c.get('output', {}).get('pipeline_dir', 'content/pipeline'))
" "$CONFIG_PATH" 2>/dev/null || echo "content/pipeline")
OUTPUT_DIR="${PIPELINE_DIR}/${TODAY}"
mkdir -p "$OUTPUT_DIR"

# Read source configs
read_config() {
  python3 -c "
import yaml, sys, json
with open(sys.argv[1]) as f:
    c = yaml.safe_load(f)
# Output source configs as JSON
sources = c.get('sources', {})
weights = {
    'rss': 1.5,
    'hn': 1.0,
    'gmail': 1.2,
    'event': 1.3,
    'capture': 2.0
}
# Override from config if present
print(json.dumps({'sources': sources, 'weights': weights}))
" "$CONFIG_PATH" 2>/dev/null
}

CONFIG_JSON=$(read_config)

# Temp directory for intermediate outputs
WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

SOURCES_SUCCEEDED=0
SOURCES_FAILED=0

# Run a fetch source and record results
# Usage: run_source <name> <command...>
run_source() {
  local name="$1"
  shift
  local start_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  local outfile="$WORK_DIR/${name}.json"
  local errfile="$WORK_DIR/${name}.err"

  echo "  · Fetching $name..." >&2

  if eval "$@" > "$outfile" 2> "$errfile"; then
    local exit_code=0
  else
    local exit_code=$?
  fi

  local end_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  local duration=$((end_ms - start_ms))

  # Count signals
  local signal_count=0
  if [[ -s "$outfile" ]]; then
    signal_count=$(python3 -c "
import json, sys
try:
    data = json.load(open(sys.argv[1]))
    print(len(data) if isinstance(data, list) else 0)
except:
    print(0)
" "$outfile" 2>/dev/null || echo "0")
  fi

  local errors=""
  if [[ -s "$errfile" ]]; then
    errors=$(cat "$errfile" | head -5 | tr '\n' ' ')
  fi

  if [[ $exit_code -eq 0 && $signal_count -gt 0 ]]; then
    SOURCES_SUCCEEDED=$((SOURCES_SUCCEEDED + 1))
    echo "  ✓ $name: $signal_count signals (${duration}ms)" >&2
  elif [[ $exit_code -eq 0 && $signal_count -eq 0 ]]; then
    SOURCES_SUCCEEDED=$((SOURCES_SUCCEEDED + 1))
    echo "  · $name: 0 signals (${duration}ms)" >&2
  else
    SOURCES_FAILED=$((SOURCES_FAILED + 1))
    echo "  ✗ $name: failed (exit $exit_code, ${duration}ms)" >&2
  fi

  # Write log entry as JSON file
  python3 -c "
import json
with open('$WORK_DIR/${name}.log.json', 'w') as f:
    json.dump({
        'source': '${name}',
        'exit_code': ${exit_code},
        'signal_count': ${signal_count},
        'duration_ms': ${duration},
    }, f)
"
}

# ── Run all configured sources ────────────────────────────────────────────────

# 1. RSS
RSS_ENABLED=$(echo "$CONFIG_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); rss=d['sources'].get('rss',[]); print('true' if rss else 'false')")
if [[ "$RSS_ENABLED" == "true" ]]; then
  run_source "rss" "python3 '$SCRIPTS_DIR/fetch-rss.py' --config '$CONFIG_PATH'"
fi

# 2. Hacker News
HN_ENABLED=$(echo "$CONFIG_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if d['sources'].get('hackernews',{}).get('enabled',False) else 'false')")
HN_LIMIT=$(echo "$CONFIG_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['sources'].get('hackernews',{}).get('max_items',30))")
if [[ "$HN_ENABLED" == "true" ]]; then
  run_source "hn" "bash '$SCRIPTS_DIR/fetch-hn.sh' --limit $HN_LIMIT"
fi

# 3. Gmail
GMAIL_ENABLED=$(echo "$CONFIG_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if d['sources'].get('gmail',{}).get('enabled',False) else 'false')")
if [[ "$GMAIL_ENABLED" == "true" ]]; then
  run_source "gmail" "bash '$SCRIPTS_DIR/fetch-gmail.sh' --config '$CONFIG_PATH'"
fi

# 4. Events (iCal feeds)
EVENTS_ENABLED=$(echo "$CONFIG_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if d['sources'].get('events',{}).get('enabled',False) else 'false')")
if [[ "$EVENTS_ENABLED" == "true" ]]; then
  run_source "events" "python3 '$SCRIPTS_DIR/fetch-events.py' --config '$CONFIG_PATH'"
fi

# 5. Anthropic news (sitemap-driven)
ANTHROPIC_NEWS_ENABLED=$(echo "$CONFIG_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if d['sources'].get('anthropic_news',{}).get('enabled',False) else 'false')")
if [[ "$ANTHROPIC_NEWS_ENABLED" == "true" ]]; then
  run_source "anthropic_news" "python3 '$SCRIPTS_DIR/fetch-anthropic-news.py' --config '$CONFIG_PATH'"
fi

# ── Combine and normalize ─────────────────────────────────────────────────────

echo "  · Combining signals..." >&2

# Use pipeline_utils to combine and normalize
python3 -c "
import json, sys, os
sys.path.insert(0, '$SCRIPTS_DIR')
from pipeline_utils import combine_signals, validate_signal, next_pipeline_path, normalize_score

# Read all source outputs
source_files = ['rss', 'hn', 'gmail', 'events', 'anthropic_news']
all_signals = []
for name in source_files:
    path = '$WORK_DIR/' + name + '.json'
    if os.path.exists(path):
        try:
            with open(path) as f:
                data = json.load(f)
            if isinstance(data, list):
                # Validate each signal
                valid = []
                for s in data:
                    ok, errors = validate_signal(s)
                    if ok:
                        valid.append(s)
                    else:
                        print(f'  Warning: invalid {name} signal: {errors}', file=sys.stderr)
                all_signals.append(valid)
        except json.JSONDecodeError as e:
            print(f'  Warning: invalid JSON from {name}: {e}', file=sys.stderr)
            all_signals.append([])
    else:
        all_signals.append([])

# Combine
combined = combine_signals(*all_signals)

# Normalize scores
weights = json.loads('$CONFIG_JSON').get('weights', {})
for signal in combined:
    normalize_score(signal, weights)

# Sort by relevance_score descending
combined.sort(key=lambda s: s.get('relevance_score', 0), reverse=True)

# Write signals.json
output_path = next_pipeline_path('$OUTPUT_DIR', 'signals.json')
with open(output_path, 'w') as f:
    json.dump(combined, f, indent=2)
print(f'  ✓ Wrote {len(combined)} signals to {output_path}', file=sys.stderr)
print(output_path)
" 2>&2 || {
  echo "Error: Failed to combine/normalize signals" >&2
}

# ── Write fetch log ───────────────────────────────────────────────────────────

python3 -c "
import json, glob, os
log_entries = []
for f in sorted(glob.glob('$WORK_DIR/*.log.json')):
    with open(f) as fh:
        log_entries.append(json.load(fh))
with open('$OUTPUT_DIR/fetch-log.json', 'w') as f:
    json.dump({
        'date': '$TODAY',
        'sources_succeeded': $SOURCES_SUCCEEDED,
        'sources_failed': $SOURCES_FAILED,
        'sources': log_entries
    }, f, indent=2)
" 2>/dev/null

echo "  · Fetch log: $OUTPUT_DIR/fetch-log.json" >&2

# ── Exit code ─────────────────────────────────────────────────────────────────

if [[ $SOURCES_SUCCEEDED -eq 0 ]]; then
  echo "Error: ALL sources failed" >&2
  exit 1
fi

echo "  ✓ Pipeline fetch complete: $SOURCES_SUCCEEDED sources, $SOURCES_FAILED failures" >&2
exit 0
