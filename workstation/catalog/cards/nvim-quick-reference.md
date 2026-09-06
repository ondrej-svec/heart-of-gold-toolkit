## When

You want a compact nvim cheatsheet: the everyday editor moves, the local discovery menu, and where to look when a familiar IDE action is missing.

## Try

Reference only. **Esc → Normal mode first** for the keys below; Insert types text, Visual selects it. Native commands beginning `:` are typed on Neovim's command line then confirmed with Enter, not run in the shell.

**Leader legend:** separately recorded opener: {{binding.nvim.leader}}. `Leader f f` is three separate presses; Ctrl-p is one chord. Do not infer a physical Space from a plugin fingerprint. Local mapping discovery: {{binding.nvim.discovery}}. The authored which-key call requests global mappings (`global = true`); it is not proof that every buffer-local LSP mapping is displayed. Which-key's 300 ms display delay is not Neovim's mapping `timeoutlen`.

| Remembered IDE action | Recorded local route | Detailed card |
| --- | --- | --- |
| Quick Open | {{binding.nvim.find-files}} | nvim.find-project |
| Find in Files | {{binding.nvim.grep}} | nvim.find-project |
| Explorer | {{binding.nvim.explorer}} | nvim.find-project |
| Recent files | {{binding.nvim.recent}} | nvim.find-project |
| Open documents | {{binding.nvim.buffers}} | nvim.buffers-windows |
| Go to definition | {{binding.nvim.definition}} | nvim.code-navigation |
| Run test at cursor | {{binding.nvim.test-nearest}} | nvim.tests |

**Stock Normal-mode defaults / native commands**, not promises about overridden local keys:

| Task | Route |
| --- | --- |
| Type / select characters / select lines | `i` / `v` / `V`; Esc returns to Normal |
| Move by word / line start / line end | `w`, `b` / `0` / `$` |
| File start / end | `gg` / `G` |
| Search this buffer / next / previous | `/text` then Enter / `n` / `N` |
| Clear search highlighting | `:nohlsearch` |
| Copy / cut / paste a line | `yy` / `dd` / `p` (Neovim registers, not guaranteed system clipboard) |
| Undo / redo | `u` / Ctrl-R |
| Save / quit without forced loss | `:write` / `:quit` |
| List / switch buffers | `:ls` / `:buffer 3` (choose a listed number) |
| Split side by side / move right | `:vsplit` / Ctrl-W then l |
| Jump back / forward | Ctrl-O / Ctrl-I |
| Native help | `:help`, `:help usr_02.txt`, `:help windows`, `:help lsp-defaults` |

`dd` edits the buffer; `p` inserts register text. Neither is a safe way to experiment in a real file. In Visual mode y copies the selection; Esc cancels selection before an operator. Native help remains native; this guide does not replace `:help` or which-key.

## Why

Mode, receiver and scope explain most surprising shortcuts. A shell file picker is not the editor picker, an editor split is not a tmux pane, and LSP navigation needs an attached server. Use the detailed cards for prerequisites and effects rather than treating a cheatsheet as universal keybindings.

## Recovery

Esc stops typing/selecting; `u` reverses a buffer edit and Ctrl-R redoes it. `:quit` refuses unsaved loss; `:quit!` deliberately discards it. Undo cannot recall a test run, filesystem operation or transmitted request. If a key is unknown/stale, use native help or inspect `:verbose nmap` rather than blindly replaying a personal shortcut.

## Sources

Inspected authored files: `nvim/lua/vim-options.lua`, `nvim/lua/plugins/which-key.lua`, `nvim/lua/plugins/snacks.lua`, `nvim/lua/plugins/lsp-config.lua`, `nvim/lua/plugins/vim-test.lua`. [Neovim user manual](https://neovim.io/doc/user/usr_02.html) and installed `runtime/doc/windows.txt`, `runtime/doc/lsp.txt`. The private `CHEATSHEET.md` was reconciled separately, not copied as authority.
