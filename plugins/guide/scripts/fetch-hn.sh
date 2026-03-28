#!/bin/bash
# fetch-hn.sh — Fetch Hacker News top stories via Firebase API and output JSON signals.
#
# Usage:
#   bash fetch-hn.sh --limit <n>   (default: 30)
#
# Fetches top story IDs from hacker-news.firebaseio.com/v0/topstories.json,
# then fetches each item's detail in parallel using xargs -P.
# Outputs a JSON array of signal objects to stdout.
#
# For Ask HN / Show HN posts with no external URL, the HN discussion URL
# (news.ycombinator.com/item?id=...) is used as the primary url.
#
# Exit codes:
#   0 — success
#   1 — HN API unreachable

set -euo pipefail

LIMIT=30

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Create temp directory for item results
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Fetch top story IDs
TOP_STORIES=$(curl -sf "https://hacker-news.firebaseio.com/v0/topstories.json" 2>/dev/null) || {
  echo "Error: Failed to fetch HN top stories. API may be down." >&2
  exit 1
}

# Extract first N story IDs
STORY_IDS=$(echo "$TOP_STORIES" | jq -r ".[:$LIMIT][]")

# Function to fetch a single story item
fetch_item() {
  local id=$1
  local outfile="$TMPDIR/$id.json"
  # Small delay to avoid rate limiting
  sleep 0.05
  local item
  item=$(curl -sf "https://hacker-news.firebaseio.com/v0/item/$id.json" 2>/dev/null) || return 0
  echo "$item" > "$outfile"
}
export -f fetch_item
export TMPDIR

# Fetch items in parallel using xargs -P
echo "$STORY_IDS" | xargs -P 10 -I {} bash -c 'fetch_item "$@"' _ {}

# Combine all item JSON files into a signal array
jq -n --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
[inputs |
  select(.title != null) |
  {
    source: "hn",
    title: .title,
    url: (if .url and .url != "" and .url != null then .url else "https://news.ycombinator.com/item?id=\(.id)" end),
    content: (if .text then .text else (.title // "") end),
    published_at: (if .time then (.time | todate) else $now end),
    metadata: {
      hn_url: "https://news.ycombinator.com/item?id=\(.id)",
      score: (.score // 0),
      comment_count: (.descendants // 0),
      author: (.by // ""),
      hn_id: .id
    }
  }
]' "$TMPDIR"/*.json 2>/dev/null || echo "[]"
