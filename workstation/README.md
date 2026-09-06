# Your workstation — How do I…?

A learning-first, offline guide and growing quick reference inside Heart of Gold. **Read explanations, not run actions.** Shell, finding, tmux, Neovim, writing decisions and personal tools share one small catalog. Search by intention or a command/key concept; these eight starter cards are not yet a comprehensive cheatsheet.

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

The direct runtime needs **Node 22+**, no dependencies, Bun, Pi, credentials or network. In a terminal, optional fzf selects a lesson; otherwise a numbered prompt works. **Enter opens a complete Markdown file in Neovim.** `:q` returns directly to the picker (or shell for a direct lookup), without an extra viewer prompt. Missing/failed Neovim falls back to terminal text. Piped/JSON output never launches an editor or waits. `--plain` avoids all presentation tools; `--glow` explicitly chooses terminal Markdown formatting instead of Neovim.

- In Neovim: `j/k` move, `/word` then `n` searches, `gf` on a `.md` filename follows a related guide, `Ctrl-O` goes back. Each lesson links to `index.md` with all six chapters. These are ordinary files and native keys, not custom mappings. `:q!` discards accidental edits to a reading copy.
- The reader uses isolated startup, not your live plugins/theme or editor state. Complete `.md` copies include metadata, resolved bindings, recovery and links. They have private permissions and are removed after the reader exits; the authored source stays untouched. There is no persistent copy/export command in this slice.
- Esc quits fzf. In the terminal-text fallback, Enter or `q` returns and Ctrl-C quits.
- Unknown/stale private bindings stay visibly unresolved. Upstream default shortcuts are labeled as defaults, never claimed as your configuration.
- Two optional manual exercises offer progressive hints; there is no tracking, shell-history inspection or scoreboard.
- `cmd` delegates only to an explicitly reviewed, fingerprinted **tldr C client 1.6.1**, with automatic updates disabled. Unknown clients fail closed. A missing/stale cache is not silently downloaded.
- The host exports `workstation-guide` as a Node binary and `heart-of-gold workstation …` as a convenience wrapper. From source, use `bun --no-env-file src/index.ts workstation …` to avoid Bun's automatic `.env` loading. The host's normal Bun shebang does not promise dotenv isolation; use direct Node for that boundary.

**Proof status:** eight authored cards in six populated chapters, catalog/profile/search, read-only doctor, search → Neovim Markdown reading, safe terminal fallbacks, two manual exercises and host/package integration. AI-writing content is reference-only. Pi execution, vendored Fabric prompts, Neovim review/Apply, the shell `help` wrapper, live migration/install, portable skill/Pi command and release are later gated slices. No existing `help`, `cheat`, tmux or editor mapping changes just by running this code.

## Development

```sh
node --test workstation/tests/*.test.mjs
# or, from the toolkit root:
npm run test:workstation
```

Tests use synthetic profiles and temporary homes. Optional host tests require an already-installed Bun; packaging tests require already-installed npm. Neither installs anything. For the opt-in real-terminal smoke on macOS, inspect `tests/terminal-smoke.py --help`; it uses Python's standard library, already-installed fzf/Glow/Neovim and an explicitly reviewed tldr C 1.6.1 binary, with disposable homes and OS-denied network access. Node 24/25 macOS are locally exercised; Node 22 and Linux are CI targets, not claimed local results.

The module is private package metadata, **not a separate npm product**. Its parent is `@heart-of-gold/toolkit`; a nested payload allowlist excludes tests, private profiles and state. There are no imports from the host installer, private personal packages or agent runtimes. Root MIT terms apply. No Fabric prompt bytes are distributed in this proof.

## Boundaries and references

- [Interface, profile, safety and authoring](docs/interface.md)
- [Dependencies, scoped backup and proposed private integration paths](docs/dependencies-and-backup.md)

Toolkit implementation started from host commit `5f7c19708658f3afe3f69c57422601ec15fc0b80`. Existing publish-safety, security, compatibility and Pi test gates remain intact; workstation tests are additive. Source work, live installation, off-machine backup, publication and second-device verification are separate milestones.
