# Cross-platform paths (plan task 1.C.2)

The plugin assumes a POSIX runtime (macOS or Linux). Windows is explicitly out of scope for V1.0.

## Plugin install location

Claude Code resolves plugin paths through `$CLAUDE_PLUGIN_ROOT`, which is set by the host before each hook fires. Hooks **must not** hardcode absolute paths — always go through that variable. Our `hooks.json` already does this:

```json
"command": "${CLAUDE_PLUGIN_ROOT}/hooks/sessionstart.sh"
```

Verified resolved paths:

| Platform | Install root | Hook script resolved path |
|---|---|---|
| macOS | `~/.claude/plugins/quellis-architect/` | `~/.claude/plugins/quellis-architect/hooks/sessionstart.sh` |
| Linux | `~/.claude/plugins/quellis-architect/` | `~/.claude/plugins/quellis-architect/hooks/sessionstart.sh` |
| Windows | *(out of scope for V1.0)* | — |

`~/.claude/plugins/` is the documented Claude Code plugin root on both supported platforms. The marketplace installer copies our plugin directory there verbatim; no path translation needed.

## Working-directory context

When a hook fires, the user's project directory is available as `$CLAUDE_PROJECT_DIR`. Hook scripts should prefer this over `pwd` for two reasons:

1. `pwd` may be the user's home or a temp dir depending on how Claude Code spawned the hook subprocess.
2. `$CLAUDE_PROJECT_DIR` is stable across SessionStart / PreToolUse / Stop, which lets hooks read the same `.quellis/` directory consistently.

Our `sessionstart.sh` already falls back to `pwd` when `CLAUDE_PROJECT_DIR` is unset, but the env var is the canonical source.

## Shell + permission quirks

- **Shebang.** All hook scripts use `#!/usr/bin/env bash`. macOS ships bash 3.2 by default; Linux distros vary. We avoid bash-4-only features (`[[ -v var ]]`, associative arrays at scale, `${var^^}`, etc.) so the same script runs on every supported host.
- **Executable bit.** Scripts must be `chmod +x` before they reach the user's `~/.claude/plugins/`. The toolkit packager preserves the bit. If you edit a hook script locally, double-check with `ls -l hooks/*.sh` — a hook that isn't executable will fail silently at session start (Claude Code logs the spawn error but does not break the session).
- **Line endings.** LF only. CRLF will be misread by the bash interpreter and crash hook execution. The repo enforces this via `.gitattributes` (toolkit-wide).

## Path constants the plugin reads

| Path | Source | Used by |
|---|---|---|
| `${CLAUDE_PROJECT_DIR}/.quellis/config.toml` | env + CLI | All three hook scripts |
| `${CLAUDE_PROJECT_DIR}/.quellis/packs/core/pretool-triggers.toml` | CLI | `pretool.sh` (1.D) |
| `${CLAUDE_PROJECT_DIR}/.quellis/packs/core/stop-triggers.toml` | CLI | `stop.sh` (1.E) |
| `${CLAUDE_PROJECT_DIR}/.quellis/acceptance-log.jsonl` | Plugin (append) | `stop.sh`, `pretool.sh` (1.D) |
| `${CLAUDE_PLUGIN_ROOT}/hooks/lib/` | Plugin install | Shared helpers (1.E) |

All paths use `/` as the separator. No platform-specific path joining required for the V1.0 surface.

## What changes for V1.3 (Windows / Cursor / cross-agent)

Out of scope until V1.3, but the open questions to revisit then:

- **Windows.** Either WSL-only support (cheapest, narrowest), or Git Bash compatibility (forces avoiding `realpath`, GNU `sed`, etc.), or PowerShell ports of every hook script (most work, broadest reach).
- **Cursor.** `.cursor/hooks.json` uses a different schema. The 1.D triggers are pack-driven, so the bulk of logic is portable; only the hook-runner shape differs.
- **Codex CLI.** Codex's hook surface is the V1.3 first port. Mostly the same Bash, different invocation contract.

None of this affects V1.0 — but anyone touching this plugin should keep the surface narrow so the V1.3 port is a translation, not a rewrite.
