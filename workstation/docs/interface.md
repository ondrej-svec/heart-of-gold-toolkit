# Offline interface and authoring contract

## CLI and JSON v1

`workstation-guide [task query]` searches locally across titles, authored synonyms, explanations and effects. Reserved commands are `list`, `show`, `learn`, `doctor`, `cmd` and the currently unimplemented `ai`. `-l` and `--list` are shorthand for `list` and take no positional query/subcommand. Options are parsed before literal text; `--` ends option parsing. A query beginning with a reserved command is not execution and cannot start an AI job; reserved argument errors explain usage.

`list --json` and a query with `--json` return `{schemaVersion:1, ok:true, chapters, cards, indexMarkdown, documents}`. `cards` retains the matching/ranked subset; `documents` maps **all** stable IDs to complete rendered Markdown and `indexMarkdown` lists all chapters, keeping related navigation available even for narrow queries. `show <id> --json` returns `{schemaVersion:1, ok:true, card}`. A card includes its stable metadata, interpolated `content`, dependency `tools` statuses and complete `markdown` (metadata, explanation, effects, recovery, sources and sibling links). These are additive JSON v1 fields; consumers should ignore unknown fields. Reference cards have no executable step or AI model/prompt fields. Future action support will require an explicit validated extension, not inferred execution from prose.

`doctor --json` returns `{schemaVersion:1, ok:true, profile, tools, bindings, notice}`. `present` means an executable was found, not that a hook, account or running integration works. `node` describes the running interpreter. No executable/version command, shell startup, auth read or model call occurs during doctor. Missing optional tools are informative, not exit failure.

Errors with `--json` return `{schemaVersion:1, ok:false, error:{code:"GUIDE_ERROR",message}}` on stdout and exit 1. No matches returns an empty card list with exit 0. Ordinary success exits 0. Interrupted owned subprocesses return 130/143 for SIGINT/SIGTERM; Esc in the picker is a normal cancellation. `--help`/`--version` are plain text. `cmd` exposes the external client's output/exit status, not this JSON contract.

Reference JSON can contain private **binding labels**, never source file bodies, credentials or profile contents. Treat an exported resolved card accordingly. No prompts, events or usage history are logged. Interactive Neovim reading creates private temporary Markdown copies as described below; plain and JSON output do not.

## Private profile v1

Default: `${XDG_CONFIG_HOME:-$HOME/.config}/workstation/profile.json`. No profile is required. `--profile /absolute/file.json` selects an explicit trusted local file. Missing explicit or invalid profiles fail rather than silently pretending the generic configuration is yours. Parse errors omit private JSON snippets.

The profile has exactly `schemaVersion:1`, optional `bindings`, and optional `tldr`. Unknown fields fail. It is bounded to 64 KiB. Do not put credentials, machine state or a copied Pi profile here.

Each binding contains `value` (one line of display text, no templates/markup), `source` (one of its allowlisted relative config files), `sha256` (the inspected file's lowercase SHA-256) and `verifiedAt` (`YYYY-MM-DD`). For example, a synthetic configuration could record:

```json
{
  "schemaVersion": 1,
  "bindings": {
    "tmux.prefix": {
      "value": "Ctrl-a",
      "source": "tmux/main.conf",
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "verifiedAt": "2026-09-06"
    }
  }
}
```

The all-zero hash is deliberately invalid as evidence; do not copy it as verification. Inspect your actual binding before calculating its source hash. No command is executed to discover keys. A matching file is `recorded`, not live-verified; a changed file is `stale`; missing/unreadable/outside-root sources are `unknown`. Only `recorded` values appear, followed by a reminder to confirm the configuration was loaded.

Allowed bindings and source files:

| Token after `binding.` | Source under the config root |
| --- | --- |
| `shell.file-picker`, `shell.history` | `zsh/.zshrc` |
| `tmux.prefix`, `tmux.menu`, `tmux.cockpit`, `tmux.split-below`, `tmux.split-right`, `tmux.navigate-panes`, `tmux.new-window`, `tmux.copy-mode-keys`, `tmux.clipboard-paste`, `tmux.session-picker` | `tmux/main.conf` |
| `nvim.leader` | `nvim/lua/vim-options.lua` |
| `nvim.discovery` | `nvim/lua/plugins/which-key.lua` |
| `nvim.find-files`, `nvim.buffers`, `nvim.grep`, `nvim.explorer`, `nvim.recent` | `nvim/lua/plugins/snacks.lua` |
| `nvim.hover`, `nvim.definition`, `nvim.references`, `nvim.code-action`, `nvim.format`, `nvim.rename` | `nvim/lua/plugins/lsp-config.lua` |
| `nvim.directory` | `nvim/lua/plugins/oil.lua` |
| `nvim.navigate-panes` | `nvim/lua/plugins/nvim-tmux-navigation.lua` |
| `nvim.test-nearest`, `nvim.test-file`, `nvim.test-suite`, `nvim.test-last`, `nvim.test-visit` | `nvim/lua/plugins/vim-test.lua` |

Record leader-dependent keys symbolically (`Leader f f`, repeated `Leader Leader`), not as baked-in Space sequences verified only by a plugin file. The separately fingerprinted `nvim.leader` explains that opener. tmux action values are suffixes; `tmux.prefix` is separate. `tmux.copy-mode-keys` describes the option, not a shortcut. See [coverage and inspection caveats](reference-coverage.md).

Profiles are trusted local configuration. Fingerprints detect drift, not authenticity or runtime behavior. Reading the allowlisted source never sources/evaluates it. Symlink resolution must remain inside the config root.

### Cache-only tldr adapter

No generic client is auto-detected or invoked. After reviewing an installed **tldr C client 1.6.1**, a user can opt into `tldr: {client:"tldr-c-1.6.1", sha256:"<actual reviewed executable hash>"}` in the profile. The guide resolves `tldr` on absolute PATH directories, checks that hash before each call, and runs one hyphenated command name with `TLDR_AUTO_UPDATE_DISABLED=1`. A binary upgrade requires re-review and re-pinning; a profile hash attests to a locally reviewed binary, not an upstream publisher signature.

The client documents that variable in its 1.6.1 README. Missing/stale-cache behavior must be verified for this adapter; other clients and versions remain unsupported. You can run `tldr` yourself outside the guide, but its own network/cache policy then applies. Neither the guide nor doctor installs or updates it.

## Authoring a card

Add metadata in `catalog/index.json` and a UTF-8 `catalog/cards/<name>.md` body. Required metadata: unique kebab/dotted `id`, one of six `chapter` IDs, `title`, `synonyms`, `kind`, `layer`, `requirements`, `body`, `effect`, `recovery`, `related` and `source` with label/URL/revision. Optional `exercise` contains goal, progressive hints and success criteria. Current kinds are `reference`, `keys` and `command-example`; executable AI metadata is rejected until its adapter contract exists.

Every body needs **When**, **Try**, **Why** sections. Effect and recovery render from metadata. Teach the layer and mode before a key. Label upstream defaults. Use only `{{binding.<known-name>}}` interpolation; it is a single literal replacement, never an expression or shell template. Markdown examples are always text. Related IDs and all tokens are validated. Control characters and escaping body paths are rejected. Source URLs are references, never fetched during reading.

To add an ordinary concept, add metadata and prose, then run tests. No backend function, prompt, model setting or UI code is necessary.

## Search → Markdown files in Neovim

Interactive `show`, a unique task-query result or a picker selection opens Neovim by default. The reader assembles **complete regular `.md` files** from the same body/metadata/profile renderer: operating layer, tool presence, explanation, expected effect, recovery, sources and related-file links are preserved. The raw authored body is not opened alone, because it lacks some of that context and can contain unresolved binding tokens. No duplicate authored cheatsheet or second catalog is introduced.

All lessons plus a six-chapter `index.md` are created under an owned `workstation-reader-*` temporary directory (0700; files 0600). Resolved private labels remain local. They are reading copies, not the source of truth; editing/saving them does not update the catalog. They and isolated editor state are removed only after the reader closes, including forwarded cancellation and ordinary error exits. SIGKILL or an OS crash can leave a private directory; there is no broad automatic cleanup of other invocations.

Use ordinary `j/k`, `/word` and `n`. Put the cursor on the filename part of a Markdown link and press `gf`; `Ctrl-O` returns. `:q` returns to the picker immediately, without an extra confirmation prompt. For a direct lookup it returns to the shell. `:q!` discards accidental edits to a copy. No custom key mappings, executable Markdown actions or URL opener are installed.

Neovim starts with `-u NONE -i NONE -n -R --noplugin`, plus pre-file `nomodeline nomodelineexpr noexrc noundofile noswapfile`. Only bundled filetype detection/syntax is enabled, with line numbers/wrapped text and owned semantic ANSI highlights. `notermguicolors` keeps headings/code/links/status/search on terminal slots 0–15: the client terminal's Rosé Pine Moon/Dawn palette, when configured, owns actual RGB and appearance changes. No host-OS appearance detection or private theme file is needed. HOME, XDG config/data/state/cache/runtime and temporary paths are private to the reader; `NVIM_LOG_FILE=/dev/null`. Inherited editor init/server variables are dropped. This deliberately does **not** load the user's live plugins/theme, perform installs or reuse a remote Neovim server. The opt-in [`:WorkstationHelp` adapter](neovim-help.md) instead uses shared JSON Markdown in memory buffers within an existing editor. It is separately loaded, not installed by running the CLI; its trusted live-editor boundary differs from this isolated reader. Neovim 0.11.6 is locally tested.

`-R` guards accidental writes; it is not a sandbox and does not prohibit intentional `:w!`/shell commands. File examples are never executed by opening help. `--plain`, `--glow`, non-TTY and JSON bypass Neovim. Missing/failed Neovim gets a clear notice and full terminal Markdown fallback, so ordinary help remains available without the editor. The no-history guarantee does not claim the absence of these explicitly scoped temporary reading files.

## Process and presentation boundary

The Node core performs no network requests and reads no Pi/Fabric/auth configuration. Optional executables are trusted local tools, **not an OS sandbox**. PATH entries must be absolute; commands spawn without a shell. Child environments retain only HOME/PATH/terminal/locale plus each adapter's deliberate variables. This removes inherited FZF hooks, pagers, shell startup files, Node injection, credentials and agent/session metadata.

fzf receives catalog records on stdin with no shell preview/execute/reload bindings; explicit `--color=16` and semantic slot assignments replace, rather than inherit, shell theme settings. Its result must match an offered record. Glow is explicit, receives stdin, uses an owned private `style.json` (0600) generated from shared semantic colors, and runs with an owned temporary HOME/cwd/config/cache scope because Glow 2.1.1 can create configuration on startup. That style is deleted with its directory. Chroma token colors use standard ANSI hex values that Glow 2.1.1 quantizes to terminal slots, not fixed Rosé Pine RGB; actual PTY output is checked for this. No external pager is enabled. Rendering failure falls back to Markdown. Captured stdout is capped at 1 MiB, noninteractive tools time out after 10 seconds, signals are forwarded, termination escalates after 500 ms (the outer host wrapper allows 1500 ms for the inner CLI to reap its child), and child closure is awaited. Trusted external stderr goes directly to the terminal; it is not persisted or interpreted as a guide result.

Interactive fzf, Neovim and the host delegation wait for the user rather than time out. These processes do not deliberately start descendants; this is not the future AI process-group isolation boundary. Plain reference and non-TTY output avoid presentation subprocesses entirely. The root/list/terminal fallback uses semantic ANSI accents only on TTY; `--plain`, JSON and non-TTY output are uncolored. Nonempty `NO_COLOR` or `TERM=dumb` selects plain presentation (no optional picker/editor/Glow). The existing-editor adapter is not recolored by the CLI: it retains the user's active editor theme. Bun may read `.env` before the host wrapper starts; `bun --no-env-file …` or the direct Node executable is necessary if dotenv access is unwanted.
