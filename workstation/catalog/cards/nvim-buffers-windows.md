## When

You want to switch buffers like IDE editor tabs, see two files side by side, or move focus without accidentally closing work.

## Try

Reference only; the guide does not open, close or save anything. Start in **Normal mode** (Esc).

Leader is separately recorded: {{binding.nvim.leader}}. `Leader f b` means separate presses; Ctrl-h means hold Ctrl while pressing h. Never substitute Space unless the leader record agrees.

| Task | Recorded local mapping | Meaning |
| --- | --- | --- |
| Switch buffers | {{binding.nvim.buffers}} | Snacks picker for loaded buffers |
| Move between editor windows and tmux panes | {{binding.nvim.navigate-panes}} | vim-tmux-navigator left/down/up/right; previous returns to last pane |

The navigation plugin can hand off at Neovim's edge only when its tmux counterpart is loaded. Without that integration, use native window navigation inside Neovim and tmux's own pane navigation outside it. These local Ctrl chords are not stock Neovim window keys.

**Native commands and stock Normal-mode defaults** (custom mappings may override):

| IDE equivalent | Neovim route | Effect |
| --- | --- | --- |
| List open documents | `:ls` | Shows buffer numbers and modified flags |
| Activate document | `:buffer 3` | Shows buffer 3; use a number actually listed |
| Next / previous document | `:bnext` / `:bprevious` | Switches the buffer in this window |
| Last document | Ctrl-^ (`:buffer #`) | Alternate buffer, not the jump list |
| Split editor top/bottom | `:split` or Ctrl-W then s | Another view of the same buffer |
| Split editor side by side | `:vsplit` or Ctrl-W then v | Another view of the same buffer |
| Focus left/down/up/right | Ctrl-W then h/j/k/l | Changes editor window, not terminal pane |
| Close this editor view | `:close` | Closes a window; refuses the last window |

Neovim split placement depends on `splitbelow` / `splitright`; do not assume a new view appears below/right. A split may show the same buffer twice; changing either view edits that one buffer. `:tabnew` creates a tab page containing windows, not an IDE-style file tab.

## Why

A **buffer** is the in-memory document, a **window** is a view of a buffer, and a **tab page** arranges windows. A tmux pane is an independent terminal that may contain a whole Neovim instance. `:bdelete` removes a buffer from the list; it does not delete the disk file, but should not be used as a casual “close split” command.

## Recovery

Cancel the buffer picker with Ctrl-C in its Insert mode or Esc into Normal then Esc. Switch back with `:buffer #`, or focus the previous window with stock Ctrl-W then p. If a switch/close refuses modified text, inspect it and `:write` only when ready; do not add `!` reflexively. `:quit` can leave Neovim when closing its last window; `:quit!` deliberately loses unsaved changes. Reopen a closed view with a split; no file restoration is needed just because a view closed.

## Sources

Inspected authored files: `nvim/lua/vim-options.lua`, `nvim/lua/plugins/snacks.lua`, `nvim/lua/plugins/nvim-tmux-navigation.lua`; counterpart declared in `tmux/main.conf`. Installed `runtime/doc/windows.txt`; [Neovim windows and buffers](https://neovim.io/doc/user/windows.html). Reading these sources is not live verification.
