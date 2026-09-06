# Your workstation — How do I…?

A learning-first, offline guide and growing quick reference inside Heart of Gold. **Read explanations, not run actions.** Shell, finding, tmux, Neovim, writing decisions and personal tools share one small catalog. Search by intention or a command/key concept; sixteen cards now include compact Neovim/tmux cheatsheets and practical editor workflows, not yet comprehensive workstation coverage.

## Try the proof without installing anything

From the toolkit checkout:

```sh
node workstation/bin/workstation-guide.mjs
node workstation/bin/workstation-guide.mjs "find a file"
node workstation/bin/workstation-guide.mjs "return to my workspace"
node workstation/bin/workstation-guide.mjs show nvim.modes
node workstation/bin/workstation-guide.mjs learn shell.find-file --hint 1
node workstation/bin/workstation-guide.mjs doctor
```

Ordinary reference needs **Node 22+**, no dependencies, Bun, Pi, credentials or network. In a terminal, optional fzf selects a lesson; otherwise a numbered prompt works. **Enter opens a complete Markdown file in Neovim.** `:q` returns directly to the picker (or shell for a direct lookup), without an extra viewer prompt. Missing/failed Neovim falls back to terminal text. Piped/JSON output never launches an editor or waits. `--plain` avoids all presentation tools; `--glow` explicitly chooses terminal Markdown formatting instead of Neovim.

- In Neovim: `j/k` move, `/word` then `n` searches, `gf` on a `.md` filename follows a related guide, `Ctrl-O` goes back. Each lesson links to `index.md` with all six chapters. These are ordinary files and native keys, not custom mappings. `:q!` discards accidental edits to a reading copy.
- The reader uses isolated startup, not your live plugins or editor state. Its owned styling follows your terminal's Rosé Pine color roles; no live Neovim colorscheme is loaded. Complete `.md` copies include metadata, resolved bindings, recovery and links. They have private permissions and are removed after the reader exits; the authored source stays untouched. There is no persistent copy/export command in this slice.
- Esc quits fzf. In the terminal-text fallback, Enter or `q` returns and Ctrl-C quits.
- Unknown/stale private bindings stay visibly unresolved. Upstream default shortcuts are labeled as defaults, never claimed as your configuration.
- Two optional manual exercises offer progressive hints; there is no tracking, shell-history inspection or scoreboard.
- `cmd` delegates only to an explicitly reviewed, fingerprinted **tldr C client 1.6.1**, with automatic updates disabled. Unknown clients fail closed. A missing/stale cache is not silently downloaded.
- The host exports `workstation-guide` as a Node binary and `heart-of-gold workstation …` as a convenience wrapper. From source, use `bun --no-env-file src/index.ts workstation …` to avoid Bun's automatic `.env` loading. The host's normal Bun shebang does not promise dotenv isolation; use direct Node for that boundary.

**Proof status:** sixteen authored cards in six populated chapters, catalog/profile/search, read-only doctor, search → Neovim Markdown reading, an opt-in in-editor help split, safe terminal fallbacks, two manual exercises and host/package integration. A separate explicit [writing runner](docs/writing-runner.md) provides three pinned Fabric actions through Pi; reading cards still never sends text. An opt-in zsh `help` wrapper is available below. An opt-in [Neovim review/Apply adapter](docs/neovim-ai.md) is tested separately without live installation. General installation/restore, portable skill/Pi command and release remain later gated slices. No existing `help`, `cheat`, tmux or editor mapping changes just by running this code.

## Rosé Pine consistency

The root/list, fzf picker, standalone Neovim reader and explicit Glow view use the terminal's **semantic ANSI palette**, matching the shared workstation roles: iris headings, foam code/links, rose accents, muted labels, overlay selections. With the client terminal configured for Rosé Pine Moon/Dawn, the guide follows that active palette—including over SSH—without consulting the host OS or loading private appearance scripts. It does not install or change the terminal palette; another terminal theme supplies its own colors.

The reader uses `notermguicolors` and owned syntax/status/search highlights, so changing the terminal palette recolors the same slots. No themes/plugins are downloaded. fzf receives explicit color-only argv, **not** inherited `FZF_DEFAULT_OPTS` executable hooks. Glow gets an owned private temporary style, removed after rendering. The opt-in in-editor helper keeps that editor's existing theme unchanged.

`--plain`, non-TTY and JSON stay uncolored. Nonempty `NO_COLOR` or `TERM=dumb` selects plain terminal output without the optional picker/reader/Glow. Reopening `help` is enough to use a source-checkout update; no shell or editor reload is needed for these guide-owned colors.

## Make `help` your front door (zsh, opt-in)

After reviewing the wrapper, source it from your shell configuration or a small private snippet:

```sh
source /absolute/path/to/workstation/integrations/zsh/help.zsh
help
help -l                     # list this guide's cards, not tldr's pages
help "tmux prefix"
```

The wrapper replaces only the `help` alias/function, safely forwards arguments and resolves its Node entry relative to its own location. It can be sourced repeatedly. It does not install anything, start an agent or execute tldr. Missing Node or a moved/deleted entry produces a short diagnostic rather than falling back to a different tool. New shells load your chosen declaration; already-running shells need to source just that wrapper/snippet once.

Keep `tldr` directly available if useful: `tldr tar` or `tldr git` gives a handful of generic examples, whereas this guide teaches workstation workflows and setup. A tldr client may download/update its cache; running it directly follows that client's policy. There is no requirement to use it. `cheat` and other aliases are not changed by this wrapper.

## Remember Neovim and tmux

```sh
help "nvim cheatsheet"
help "tmux cheatsheet"
help "go to definition"
help "find text in project"
help "switch buffers"
help "run nearest test"
help "split terminal"
help "copy terminal output"
```

Without the zsh wrapper, use `node workstation/bin/workstation-guide.mjs` instead of `help`. Keys distinguish stock defaults from source-fingerprinted local mappings; no private profile means local keys remain **unknown**, not guessed. The [coverage note](docs/reference-coverage.md) reconciles the old sheet without removing access to unmigrated material. It also flags an existing clipboard-paste configuration defect; browsing does not fix or execute that action.

For help beside an open source buffer, the optional [Neovim adapter](docs/neovim-help.md) adds only `:WorkstationHelp [task or ID]`. Shared Markdown opens in a read-only memory-buffer split with native `gf`, Ctrl-O and `:q`; `:WorkstationHelp!` cancels/closes it. No keybindings, source edits, AI calls or live installation. Review the opt-in instructions before loading it in your real editor.

## Development

```sh
node --test workstation/tests/*.test.mjs
# or, from the toolkit root:
npm run test:workstation
```

Tests use synthetic profiles and temporary homes. Optional host tests require an already-installed Bun; packaging tests require already-installed npm. Neither installs anything. For the opt-in real-terminal smoke on macOS, inspect `tests/terminal-smoke.py --help`; it uses Python's standard library, already-installed fzf/Glow/Neovim and an explicitly reviewed tldr C 1.6.1 binary, with disposable homes and OS-denied network access. Node 24/25 macOS are locally exercised; Node 22 and Linux are CI targets, not claimed local results.

The module is private package metadata, **not a separate npm product**. Its parent is `@heart-of-gold/toolkit`; a nested payload allowlist excludes tests, private profiles and state. There are no imports from the host installer, private personal packages or agent runtimes. Root MIT terms apply. Three unmodified Fabric prompts are distributed with their upstream MIT license and exact revision/hash provenance; no Fabric runtime is required.

## Boundaries and references

- [Interface, profile, safety and authoring](docs/interface.md)
- [Dependencies, scoped backup and proposed private integration paths](docs/dependencies-and-backup.md)
- [Neovim/tmux reference coverage and source caveats](docs/reference-coverage.md)
- [Optional in-editor help and its safety boundary](docs/neovim-help.md)
- [Explicit Pi writing runner, consent and limits](docs/writing-runner.md)
- [Opt-in Neovim writing preview, Send, Apply and undo](docs/neovim-ai.md)

Toolkit implementation started from host commit `5f7c19708658f3afe3f69c57422601ec15fc0b80`. Existing publish-safety, security, compatibility and Pi test gates remain intact; workstation tests are additive. Source work, live installation, off-machine backup, publication and second-device verification are separate milestones.
