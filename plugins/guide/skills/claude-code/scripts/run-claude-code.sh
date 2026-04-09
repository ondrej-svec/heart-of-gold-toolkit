#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  run-claude-code.sh --check
  run-claude-code.sh --prompt "..." [options]

Options:
  --check                       Verify that Claude Code is installed
  --prompt TEXT                 Prompt to send to Claude Code
  --model MODEL                 Claude model or alias (default: sonnet)
  --permission-mode MODE        plan, acceptEdits, default, auto, dontAsk, bypassPermissions
  --effort LEVEL                low, medium, high, max
  --max-turns N                 Bound the number of Claude turns
  --output-format FORMAT        text, json, stream-json (default: text)
  --resume VALUE                Resume a session, for example: latest
  --continue                    Continue the most recent session in the current directory
  --add-dir PATH                Additional directory to allow tool access to; repeatable
  --allowed-tools SPEC          Allowed tools spec; repeatable
  --disallowed-tools SPEC       Disallowed tools spec; repeatable
  --cwd PATH                    Working directory to run Claude Code from
  --name NAME                   Human-readable session name
  --permission-prompt-tool CMD  External permission handler for headless runs
  --no-session-persistence      Do not persist the session on disk
  --verbose                     Enable verbose Claude Code output
  --timeout-seconds N           Kill Claude Code if it does not finish within N seconds
  --help                        Show this help text
EOF
}

check_only=0
prompt=""
model="sonnet"
permission_mode=""
effort=""
max_turns=""
output_format="text"
resume_value=""
continue_mode=0
cwd=""
name=""
verbose=0
no_session_persistence=0
permission_prompt_tool=""
timeout_seconds=""
declare -a add_dirs=()
declare -a allowed_tools=()
declare -a disallowed_tools=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)
      check_only=1
      shift
      ;;
    --prompt)
      [[ $# -ge 2 ]] || { echo "Missing value for --prompt" >&2; exit 2; }
      prompt="$2"
      shift 2
      ;;
    --model)
      [[ $# -ge 2 ]] || { echo "Missing value for --model" >&2; exit 2; }
      model="$2"
      shift 2
      ;;
    --permission-mode)
      [[ $# -ge 2 ]] || { echo "Missing value for --permission-mode" >&2; exit 2; }
      permission_mode="$2"
      shift 2
      ;;
    --effort)
      [[ $# -ge 2 ]] || { echo "Missing value for --effort" >&2; exit 2; }
      effort="$2"
      shift 2
      ;;
    --max-turns)
      [[ $# -ge 2 ]] || { echo "Missing value for --max-turns" >&2; exit 2; }
      max_turns="$2"
      shift 2
      ;;
    --output-format)
      [[ $# -ge 2 ]] || { echo "Missing value for --output-format" >&2; exit 2; }
      output_format="$2"
      shift 2
      ;;
    --resume)
      [[ $# -ge 2 ]] || { echo "Missing value for --resume" >&2; exit 2; }
      resume_value="$2"
      shift 2
      ;;
    --continue)
      continue_mode=1
      shift
      ;;
    --add-dir)
      [[ $# -ge 2 ]] || { echo "Missing value for --add-dir" >&2; exit 2; }
      add_dirs+=("$2")
      shift 2
      ;;
    --allowed-tools|--allowedTools)
      [[ $# -ge 2 ]] || { echo "Missing value for --allowed-tools" >&2; exit 2; }
      allowed_tools+=("$2")
      shift 2
      ;;
    --disallowed-tools|--disallowedTools)
      [[ $# -ge 2 ]] || { echo "Missing value for --disallowed-tools" >&2; exit 2; }
      disallowed_tools+=("$2")
      shift 2
      ;;
    --cwd)
      [[ $# -ge 2 ]] || { echo "Missing value for --cwd" >&2; exit 2; }
      cwd="$2"
      shift 2
      ;;
    --name)
      [[ $# -ge 2 ]] || { echo "Missing value for --name" >&2; exit 2; }
      name="$2"
      shift 2
      ;;
    --permission-prompt-tool)
      [[ $# -ge 2 ]] || { echo "Missing value for --permission-prompt-tool" >&2; exit 2; }
      permission_prompt_tool="$2"
      shift 2
      ;;
    --no-session-persistence)
      no_session_persistence=1
      shift
      ;;
    --verbose)
      verbose=1
      shift
      ;;
    --timeout-seconds)
      [[ $# -ge 2 ]] || { echo "Missing value for --timeout-seconds" >&2; exit 2; }
      timeout_seconds="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$check_only" -eq 1 ]]; then
  exec claude --version
fi

if [[ -z "$prompt" ]]; then
  echo "--prompt is required unless --check is used" >&2
  exit 2
fi

if [[ -n "$resume_value" && "$continue_mode" -eq 1 ]]; then
  echo "--resume and --continue cannot be used together" >&2
  exit 2
fi

cmd=(claude)

if [[ -n "$resume_value" ]]; then
  cmd+=(-r "$resume_value")
elif [[ "$continue_mode" -eq 1 ]]; then
  cmd+=(-c)
fi

cmd+=(--print --output-format "$output_format" --model "$model")

if [[ -n "$permission_mode" ]]; then
  cmd+=(--permission-mode "$permission_mode")
fi

if [[ -n "$effort" ]]; then
  cmd+=(--effort "$effort")
fi

if [[ -n "$max_turns" ]]; then
  cmd+=(--max-turns "$max_turns")
fi

if [[ -n "$name" ]]; then
  cmd+=(--name "$name")
fi

if [[ -n "$permission_prompt_tool" ]]; then
  cmd+=(--permission-prompt-tool "$permission_prompt_tool")
fi

if [[ "$no_session_persistence" -eq 1 ]]; then
  cmd+=(--no-session-persistence)
fi

if [[ "$verbose" -eq 1 ]]; then
  cmd+=(--verbose)
fi

if ((${#add_dirs[@]} > 0)); then
  for dir in "${add_dirs[@]}"; do
    cmd+=(--add-dir "$dir")
  done
fi

if ((${#allowed_tools[@]} > 0)); then
  for tool in "${allowed_tools[@]}"; do
    cmd+=(--allowedTools "$tool")
  done
fi

if ((${#disallowed_tools[@]} > 0)); then
  for tool in "${disallowed_tools[@]}"; do
    cmd+=(--disallowedTools "$tool")
  done
fi

cmd+=("$prompt")

if [[ -n "$cwd" ]]; then
  cd "$cwd"
fi

if [[ -n "$timeout_seconds" ]]; then
  python3 -c '
import os, signal, subprocess, sys
timeout = float(sys.argv[1])
cmd = sys.argv[2:]
proc = subprocess.Popen(cmd)
try:
    rc = proc.wait(timeout=timeout)
    sys.exit(rc)
except subprocess.TimeoutExpired:
    proc.kill()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    print(f"Claude Code timed out after {timeout:g} seconds", file=sys.stderr)
    sys.exit(124)
' "$timeout_seconds" "${cmd[@]}"
else
  exec "${cmd[@]}"
fi
