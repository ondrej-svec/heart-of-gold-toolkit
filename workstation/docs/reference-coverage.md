# Neovim / tmux reference coverage

## Scope and evidence

This is a sanitized reconciliation of the authored `CHEATSHEET.md` against the narrow editor/terminal sources below, inspected 2026-09-06. It is **not** a copy of that private sheet, a live keymap export, or an approved personal profile. No private account paths, mailbox details, credentials or unrelated workflows are included. The private sheet and all live configuration are **untouched**. Examples in cards are reference text, never executable card metadata.

Every new card has When/Try/Why/Recovery/Sources sections and related-card links. Existing shell, writing and personal-tool cards remain unchanged.

| Card ID | Forgotten task / coverage |
| --- | --- |
| `nvim.find-project` | Quick Open, find text in project, explorer, recent files, native buffer search/quickfix, Oil filesystem-editing caution |
| `nvim.code-navigation` | Go to definition, usages, hover, rename, format, code action; attached-server and multi-file edit boundaries |
| `nvim.buffers-windows` | Switch buffers, IDE tabs versus Neovim buffers/windows/tab pages, native splits, navigator handoff |
| `nvim.tests` | Run nearest test/file/suite/last; visit last test; vimux runner, trusted code, scope and interruption |
| `nvim.quick-reference` | Compact nvim cheatsheet; modes, native movements/editing, local discovery and IDE equivalents |
| `tmux.panes` | Split terminal below/right, pane focus, new window, stock zoom, process lifetime |
| `tmux.copy-mode` | Copy terminal output, vi scrollback search/selection, tmux buffers versus system clipboard, paste danger |
| `tmux.quick-reference` | Compact tmux cheatsheet; sessions/windows/panes, detach/attach, menu versus direct key help |

## Binding provenance and representation

Allowlist entries authorize only the stated relative source label. They do not parse or execute Lua/tmux configuration and contain no binding values. Values come only from a separately approved private profile; absent values render **unknown**, changed source hashes render **stale**, and matching hashes render **recorded; confirm loaded**, never “live verified.” Optional plugins, ripgrep, language servers, test runners and picker scripts are explained as prerequisites, not installed or probed by content.

**Legend:** Ctrl-x is a chord. `Leader f f` is a sequence of separate presses. `nvim.leader` is fingerprinted against `nvim/lua/vim-options.lua`, independently of plugin mappings. The inspected leader happens to be Space, but a plugin hash alone cannot establish that. A future profile must preserve symbolic Leader notation rather than bake the leader into every sequence. No private profile is created by this slice.

For tmux, `tmux.prefix` is rendered separately; each action's record contains only the suffix. The stock-default suffix tables explicitly are not live verification and never substitute an upstream prefix for an unknown local one. `tmux.copy-mode-keys` records an option (`vi`), not a shortcut.

The following values describe only this **inspected authored snapshot**, not universal keys or approved live records:

| Source label | Binding tokens | Inspected mapping / behavior |
| --- | --- | --- |
| `nvim/lua/vim-options.lua` | Existing `nvim.leader` | mapleader; native `:nohlsearch` is taught without extending the allowlist for its optional local shortcut |
| `nvim/lua/plugins/which-key.lua` | Existing `nvim.discovery` | `Leader ?`; calls `show({ global = true })` |
| `nvim/lua/plugins/snacks.lua` | `nvim.find-files`, `nvim.buffers`, `nvim.grep`, `nvim.explorer`, `nvim.recent` | Ctrl-p / `Leader f f`; `Leader f b`; `Leader f g`; Ctrl-n / `Leader e`; recent is authored `<leader><leader>` |
| `nvim/lua/plugins/lsp-config.lua` | `nvim.hover`, `nvim.definition`, `nvim.references`, `nvim.code-action`, `nvim.format`, `nvim.rename` | K; `Leader g d`; `Leader g r`; `Leader c a`; `Leader g f`; **literal Space r n**. All installed buffer-locally by LspAttach |
| `nvim/lua/plugins/oil.lua` | `nvim.directory` | `-` toggles an Oil float; `oil.setup()` defaults; saving applies filesystem operations |
| `nvim/lua/plugins/nvim-tmux-navigation.lua` | `nvim.navigate-panes` | Ctrl-h/j/k/l left/down/up/right, Ctrl-Backslash previous; actually declares vim-tmux-navigator |
| `nvim/lua/plugins/vim-test.lua` | `nvim.test-nearest`, `nvim.test-file`, `nvim.test-suite`, `nvim.test-last`, `nvim.test-visit` | `Leader t n`, `Leader t f`, `Leader t s`, `Leader t l`, `Leader t v`; TestNearest/File/Suite/Last/Visit; vimux strategy |
| `tmux/main.conf` | Existing `tmux.prefix`, `tmux.menu`; new `tmux.split-below`, `tmux.split-right`, `tmux.navigate-panes`, `tmux.new-window`, `tmux.copy-mode-keys`, `tmux.clipboard-paste`, `tmux.session-picker` | Prefix separate; menu suffix Space; split suffixes `,` below (`-v`), `.` right (`-h`); h/j/k/l panes; c new window; mode-keys vi; Ctrl-v clipboard action **defective**; T external session picker |

**Recent-files nuance:** with the inspected Space leader, the authored repeated-leader mapping is described as `Leader Space`. It is not a permanently literal trailing Space: `<leader><leader>` repeats mapleader. A future profile can record `Leader Leader` to preserve both dependencies, or use `Leader Space` only alongside a current separately confirmed Space leader and explicit re-review after a leader change. The cards deliberately render a token rather than claim “Space twice” from a snacks.lua hash alone. This differs from rename's truly literal `<space>rn`.

## Reconciliation: corrections, qualifications and intentional exclusions

| Private-sheet claim / area | Evidence and treatment |
| --- | --- |
| “Leader keys only work in Normal mode” versus selection-required writing keys | Overbroad and internally contradictory. Mode belongs to each mapping. New local editor tables describe inspected Normal-mode mappings; Visual/native operations are separately labelled. Legacy AI writing behavior is not revalidated or altered |
| Space opens all editor keybindings | Leader is a separate source. which-key's explicit discovery call uses `global = true`; it does not establish exhaustive display of buffer-local LSP keys |
| Fixed 1000 ms leader timeout | which-key.lua sets a 300 ms **display delay**, not `timeoutlen`. The inspected vim-options.lua does not set timeoutlen. Do not export a guessed runtime timeout as a local fact |
| Recent files is always “Space twice” | Actual source is repeated Leader, currently describable as `Leader Space`; use the separately confirmed leader, not a plugin-only physical-key assertion |
| Bare `gd` means IDE go-to-definition | New card separates stock text declaration motion from local `Leader g d` and native LSP APIs. LSP mappings are buffer-local after LspAttach; rename uses literal Space r n |
| File tree / directory buffer are interchangeable | Snacks explorer browses; Oil toggles a floating editable directory. Oil write applies filesystem operations, not a harmless text save |
| Grep was fixed by installing ripgrep | Historic fix is not proof of present availability. Card states rg prerequisite and directory/ignore scope; nothing is installed |
| Test keys / old flat prefixes | Current vim-test.lua uses only the scoped Leader t n/f/s/l/v routes listed here, with vimux. Old flat aliases in comments are not promoted |
| Split “down / across” | Explicitly below/right with horizontal/vertical **divider** descriptions. tmux's `-v` stacks top/bottom; `-h` places side by side. Local split/new-window commands inherit pane_current_path |
| Direct prefix `?` dumps every binding | Stock direct help is `list-keys -N` (noted keys); the authored menu's `?` item explicitly runs `list-keys` (binding commands). The source comment conflates them; no live table has been queried |
| Ctrl-v action “pastes the macOS clipboard” | **Known defect:** both binding and menu use `pbcopy` where reading clipboard contents is expected. pbcopy writes, not reads. Cards flag the mismatch; no pipeline is executed and no fix is made |
| vi mode guarantees copy/paste integration | False inference. Stock copy-mode-vi uses Space to begin selection, Enter to copy to a tmux buffer and exit, q to cancel, Esc to clear selection. System clipboard behavior requires separate integration verification |
| Sessions automatically save/restore | tmux/main.conf declares resurrect/continuum and a 15-minute interval. Declarations do not prove plugins loaded, saves succeeded or arbitrary processes survive reboot. Detach/attach is distinguished from backup/restore |
| Popups, hint grabbing, theme, remote terminal and shell/mail/news workflows | Not expanded here. Only the menu/session-picker entry points needed for terminal navigation are covered; external scripts and plugin functionality remain unverified |
| Legacy AI routes, prose replacement, chat adapters and provider/model commands | **Untouched**, neither endorsed as current nor executed. No legacy AI mapping tokens or operational examples are added. Existing writing/AI routes are outside this slice |

## Reference trail and checks

Generic sources are the [Neovim user manual](https://neovim.io/doc/user/usr_02.html), [windows/buffers](https://neovim.io/doc/user/windows.html), [LSP](https://neovim.io/doc/user/lsp.html), [quickfix](https://neovim.io/doc/user/quickfix.html), [terminal](https://neovim.io/doc/user/terminal.html), and [tmux manual](https://man.openbsd.org/tmux). Local source labels above contain no private account paths.

Installed documentation inspected as evidence: `runtime/doc/windows.txt`, `runtime/doc/lsp.txt`, `snacks.nvim/doc/snacks.nvim-picker.txt`, `oil.nvim/doc/oil.txt`, `vim-test/doc/test.txt`, `vimux/doc/vimux.txt`, and `man1/tmux.1`. Plugin command facts come from these inspected docs and authored declarations, not stock Neovim defaults. The inspected Snacks input defaults require Esc to leave Insert first, then Esc to cancel; Ctrl-C cancels directly in picker Insert mode.

Regression coverage in `tests/catalog.test.mjs` ranks all eight forgotten-task queries deterministically. `tests/content.test.mjs` checks card structure, token/source allowlists, cross-source rejection, unknown labels, independent leader fingerprints (including staleness), LSP/test scope, tmux orientation/clipboard caveats, and sanitized coverage. The tests use synthetic files and never load live Neovim/tmux configuration.
