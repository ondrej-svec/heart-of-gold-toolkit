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
  --output-format FORMAT        text, json, stream-json (default: text)
  --resume VALUE                Resume a session, for example: latest
  --continue                    Continue the most recent session in the current directory
  --add-dir PATH                Additional directory to allow tool access to; repeatable
  --cwd PATH                    Working directory to run Claude Code from
  --help                        Show this help text
EOF
}

check_only=0
prompt=""
model="sonnet"
permission_mode=""
effort=""
output_format="text"
resume_value=""
continue_mode=0
cwd=""
declare -a add_dirs=()

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
    --cwd)
      [[ $# -ge 2 ]] || { echo "Missing value for --cwd" >&2; exit 2; }
      cwd="$2"
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

if ((${#add_dirs[@]} > 0)); then
  for dir in "${add_dirs[@]}"; do
    cmd+=(--add-dir "$dir")
  done
fi

cmd+=("$prompt")

if [[ -n "$cwd" ]]; then
  cd "$cwd"
fi

exec "${cmd[@]}"
