#!/bin/bash
#
# destructive-command-guard.sh — PreToolUse(Bash) guard for the marvin plugin.
#
# Was an inline shell blob in hooks.json. Moved to a file because an inline
# blob cannot be tested, and this one had a false-positive class that made it
# block legitimate work: it matched the command *text*, so writing a commit
# message that mentioned a force push, or authoring a deny rule for one, was
# blocked as though the command were being executed.
#
# Blocks: sudo, force push, destructive rm -rf, pipe-to-interpreter.
#
# Exit: 0 allow, 2 block.

set -uo pipefail

CMD=$(cat | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
[[ -z "$CMD" ]] && exit 0

#######################################
# Remove heredoc bodies that are DATA, keep bodies that are CODE.
#
# `git commit -F - <<EOF ... EOF` carries prose; matching it produces false
# positives. `bash <<EOF ... EOF` carries commands that will actually run;
# stripping it would be a false negative — the guard would wave through
# `bash <<EOF` / `rm -rf /` / `EOF`.
#######################################
strip_data_heredocs() {
  printf '%s' "$1" | awk '
    BEGIN { in_doc = 0 }
    {
      if (in_doc) {
        if ($0 == delim || $0 == delim "\t") { in_doc = 0 }
        else if (keep_body) { print }
        next
      }
      line = $0
      if (match(line, /<<-?[ \t]*['"'"'"]?[A-Za-z_][A-Za-z0-9_]*['"'"'"]?/)) {
        d = substr(line, RSTART, RLENGTH)
        gsub(/^<<-?[ \t]*/, "", d)
        gsub(/['"'"'"]/, "", d)
        delim = d
        in_doc = 1
        keep_body = (line ~ /(^|[;&|[:space:]])(sudo[[:space:]]+)?((ba|z|k|da|fi)?sh|python[0-9.]*|perl|ruby|node)([[:space:]]|$)/)
      }
      print line
    }
  '
}

SCAN=$(strip_data_heredocs "$CMD")

block() { printf 'Blocked: %s\n' "$1" >&2; exit 2; }

echo "$SCAN" | grep -Eq '(^|[;&|]+[[:space:]]*)sudo([[:space:]]|$)' \
  && block "sudo"

echo "$SCAN" | grep -Eq 'git[[:space:]]+push[[:space:]].*(-f([[:space:]]|$)|--force)' \
  && block "force push"

echo "$SCAN" | grep -Eq 'rm[[:space:]]+(-rf|-fr|-r[[:space:]]+-f|-f[[:space:]]+-r)[[:space:]]+(/|~)([[:space:]]|$)' \
  && block "destructive rm -rf"

# The trailing (space|end) matters: without it, (ba)?sh matches the "sh" in
# shasum, blocking `curl ... | shasum -a 256` — the safe alternative to
# piping into a shell — while letting `| zsh` through.
echo "$SCAN" | grep -Eq '(curl|wget)[^|]*\|[[:space:]]*(sudo[[:space:]]+)?((ba|z|k|da|fi)?sh|python[0-9.]*|perl|ruby|node)([[:space:]]|$)' \
  && block "piping a download into an interpreter — download, inspect, then run"

exit 0
