## When

You remember a filename, a phrase somewhere in the project, or an IDE's Quick Open / Find in Files / Explorer, but not the Neovim route.

## Try

Reference only: reading this card executes nothing. Start in **Normal mode** (Esc), not at a shell prompt.

**Leader legend:** Leader means the separately recorded opener: {{binding.nvim.leader}}. A sequence such as `Leader f f` means press and release Leader, then f, then f; Ctrl-p means a chord. A plugin fingerprint alone cannot tell you the leader. Unknown or stale means inspect your setup, not guess Space.

| IDE task | Recorded local mapping (Normal mode) | Effect |
| --- | --- | --- |
| Quick Open by filename | {{binding.nvim.find-files}} | Snacks files picker; choose a file to open |
| Find text in project | {{binding.nvim.grep}} | Snacks grep picker; choose a matching location |
| Explorer / project tree | {{binding.nvim.explorer}} | Snacks explorer, not the shell file picker |
| Recently opened files | {{binding.nvim.recent}} | Snacks recent picker, not just currently loaded buffers |
| Edit a directory listing | {{binding.nvim.directory}} | Oil floating directory buffer; filesystem editing, not plain search |

Snacks grep needs ripgrep (`rg`) and the expected working directory. `:pwd` shows Neovim's current directory; “project” is not a guarantee that every picker chose the repository root. Ignore/hidden-file settings can exclude results. Picker Enter opens the highlighted result. In the inspected Snacks defaults, Esc from Insert first enters Normal mode; Esc again cancels, or Ctrl-C cancels from picker Insert mode.

**Native alternatives:** `:edit relative/path.txt` opens a known file; `/word` then Enter searches only the current buffer, with `n` / `N` for next / previous. `:vimgrep /needle/gj **/*.lua` collects matches in Lua files below the working directory into quickfix; `:copen`, `:cnext`, `:cprev` inspect and visit them. This can read many files and is not the same search engine as ripgrep. These are examples to read, not commands the guide runs.

## Why

A filename picker searches names; grep searches contents; buffers lists already loaded working copies. Oil is different again: editing a name or deleting a listing line stages a filesystem operation. `:write` in Oil applies operations after its confirmation flow; it is not merely saving a text list. Do not experiment on real files.

## Recovery

Cancel a picker before confirming to stay where you were. After jumping, stock Normal-mode Ctrl-O goes back through the jump list. In Oil, undo unsaved listing edits with `u` and close the float with its default Normal-mode Ctrl-C; do not confirm or write unwanted changes. Undoing a buffer edit is not a reliable rollback of an applied filesystem deletion or rename; use backups/version control for recovery.

## Sources

Inspected authored files: `nvim/lua/vim-options.lua`, `nvim/lua/plugins/snacks.lua`, `nvim/lua/plugins/oil.lua`. Installed docs: `snacks.nvim/doc/snacks.nvim-picker.txt` (input keys), `oil.nvim/doc/oil.txt` (save/confirmation). Native reference: [Neovim quickfix](https://neovim.io/doc/user/quickfix.html). Source inspection is not proof the running editor loaded these mappings.
