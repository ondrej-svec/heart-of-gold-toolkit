---
last_grounded: 2026-09-06T02:16:41Z
fingerprint: heart-of-gold-toolkit__terminal-cli
repo: heart-of-gold-toolkit
sources_consulted:
  - local:package.json
  - local:bun.lock
  - local:src/index.ts
  - local:node_modules/citty/dist/index.mjs
  - https://man.archlinux.org/man/fzf.1.en
  - https://raw.githubusercontent.com/charmbracelet/glow/v2.1.1/main.go
  - https://raw.githubusercontent.com/charmbracelet/glow/v2.1.1/README.md
  - https://raw.githubusercontent.com/tldr-pages/tldr/main/CLIENT-SPECIFICATION.md
  - https://bun.sh/docs/runtime/environment-variables
confidence: medium
---

## Repo State
- As of 2026-09-06: toolkit 0.2.0, ESM; host entry uses a Bun shebang and citty. Lock resolves citty 0.1.6; other direct dependency is js-yaml ^4.1.0.
- Survey started on clean `main`, HEAD `5f7c197`; recent work emphasizes package discovery, portability, and release safety. Branch creation belongs to the implementing agent.
- Existing share-server commands delegate using Bun and `process.execPath`; do not copy that runtime choice into the independent Node guide.
- No matching cached terminal-CLI briefing. Existing broader research was not repeated. No installs, live configuration changes, executable version probes, auth inspection, or model calls performed; authenticated PR lookup skipped.
- Recommendations below need offline fixture tests; installed optional-tool versions were not inspected.

## Recent Ecosystem Changes
- Fetched fzf manual identifies 0.74.3 (August 2026); it is not evidence that older workstation versions support every current flag. Keep basic picker flags conservative. [Manual](https://man.archlinux.org/man/fzf.1.en)
- tldr specification reports legacy `tldr-pages.github.io/assets` downloads removed on 2026-01-20; old clients may fail updates. Do not repair/update caches implicitly. [Specification](https://raw.githubusercontent.com/tldr-pages/tldr/main/CLIENT-SPECIFICATION.md)

## Known Footguns
- **fzf: shell-free spawn alone is insufficient.** Clear inherited `FZF_DEFAULT_OPTS`, `FZF_DEFAULT_OPTS_FILE`, and `FZF_DEFAULT_COMMAND` in the child environment (prefer dropping all `FZF_*`). Defaults can inject executable bindings/previews; the default command invokes a shell when input is a TTY. Pipe only validated catalog records, never use preview/execute/reload hooks, pass query as a separate argv value, and validate the returned ID against the catalog. Do not source shell integration. [Manual](https://man.archlinux.org/man/fzf.1.en)
- **Glow v2.1.1 reads/writes config during initialization**, before ordinary command execution: `GLOW_CONFIG_HOME` and `XDG_CONFIG_HOME` add search locations; Viper automatically reads `GLOW_*`. Missing config triggers default creation. Therefore even version/help probing is not guaranteed read-only; `--config` alone is not isolation. Use a disposable child HOME/config scope, strip inherited Glow/Glamour settings, or use plain rendering. [Source](https://raw.githubusercontent.com/charmbracelet/glow/v2.1.1/main.go)
- **Glow offline input:** pipe Markdown to `glow -`; never forward arbitrary source arguments, which support HTTP and repository fetching. Pin a built-in style. `-p` launches `$PAGER` (default `less -r`): avoid arbitrary inherited pager commands. In v2.1.1, explicitly passing `--pager=false` or `--tui=false` still enters the corresponding branch because code also tests whether the flag changed! Disable through sanitized environment/config, or deliberately select tested paging with controlled executables. [Source](https://raw.githubusercontent.com/charmbracelet/glow/v2.1.1/main.go)
- **tldr is not universally offline:** the client specification permits automatic cache refresh and mandates no universal offline flag. Under the approved offline-only scope, do not blindly spawn `tldr <command>`; fail closed with an explanation unless a particular client/version's cache-only mode is verified. Test missing/stale caches without network. [Specification](https://raw.githubusercontent.com/tldr-pages/tldr/main/CLIENT-SPECIFICATION.md)
- **Bun loads `.env` before application code.** Sanitizing child env cannot undo parent reads. Document a verified `bun --no-env-file ...` entry for the host wrapper; the existing bare Bun shebang cannot promise no dotenv access. Prefer direct Node for the strict offline/no-secret path. Current documentation supports this flag, but no minimum Bun version was established. [Docs](https://bun.sh/docs/runtime/environment-variables)
- **citty 0.1.6 intercepts `--help`/`-h` anywhere** in `runMain`, even after `--` (locally verified locked distribution). Route `workstation` before that interception; preserve its raw argv tail rather than reconstructing parsed options. Spawn actual Node, not Bun's `process.execPath`, with shell disabled and inherited stdio. Test help/version, literal `--`, spaces/metacharacters, non-TTY behavior, exit codes and signals; ensure imported modules do not execute before dispatch unnecessarily.

## Recommended Further Reading
- [Glow v2.1.1 CLI documentation](https://raw.githubusercontent.com/charmbracelet/glow/v2.1.1/README.md): distinguish stdin rendering, external paging, and discovery TUI.
- [fzf manual](https://man.archlinux.org/man/fzf.1.en): defaults, executable actions and cancellation statuses.
