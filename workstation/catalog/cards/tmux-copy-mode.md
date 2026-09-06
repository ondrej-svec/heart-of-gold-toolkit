## When

You want to copy terminal output or search scrollback without sending navigation keys to the program currently running in the pane.

## Try

Reference only: no scrollback, clipboard or tmux buffer is read by this guide.

**Prefix:** {{binding.tmux.prefix}}. Release it before pressing a suffix. The authored copy-mode key style is {{binding.tmux.copy-mode-keys}}. This is a source record, **not live verification** of the running server's key table.

The following are **stock defaults**, not fingerprinted local shortcuts. The copy-mode steps assume **vi** mode-keys; custom copy-mode-vi bindings can override them.

1. Prefix then `[` (suffix) enters copy mode. Native shell alternative: `tmux copy-mode`.
2. Inside copy mode, use h/j/k/l to move; `g` goes to the top of history, `G` to the bottom. `?text` then Enter searches backward; `/text` searches forward, `n` repeats, `N` reverses.
3. **Space** starts a selection (not Neovim's leader). Move to its other end.
4. **Enter** copies the selection to a **tmux buffer** and exits copy mode. Stock vi `y` is not assumed to copy.
5. **q** cancels/exits copy mode. **Esc** clears the current selection in vi copy mode; it is not the universal exit key here.
6. Prefix then `]` (suffix) pastes the tmux buffer into the active pane. Native equivalent: `tmux paste-buffer`. Inspect the target first: newlines in pasted text can execute shell commands or submit application input.

Copy mode uses tmux history, not a file or an editor's undo history. Older output outside the scrollback limit may be gone. Prefix then `=` is the stock buffer chooser; `tmux list-buffers` lists stored buffers if you deliberately inspect them yourself. Output and buffer previews can contain secrets—do not share them casually.

## Why

The **tmux buffer** and **system clipboard** are different stores. OS/terminal integration, tmux options and plugins decide whether copying also reaches the clipboard. This card does not claim that vi mode, mouse support or Enter guarantees macOS clipboard synchronization, especially over SSH.

**Known defect, not fixed here:** the authored clipboard-paste suffix is {{binding.tmux.clipboard-paste}}. Both that binding and its menu entry invoke `pbcopy` where clipboard reading/paste is expected, before loading/pasting a tmux buffer. `pbcopy` writes the macOS clipboard; it does not read its contents. Do not rely on this action to paste the clipboard, and do not infer working clipboard support from its label. The private sheet's “paste the macOS clipboard” claim is outdated. This guide neither runs the pipeline nor changes it.

## Recovery

Use q to leave copy mode without a new copy. Copying replaces/adds tmux buffer data; it does not alter the application text. Pasting is consequential: Ctrl-C at a shell can discard pending input or interrupt a foreground command, but cannot undo a command already executed. If the clipboard action behaved unexpectedly, stop and inspect the target rather than retrying it; clipboard repair is separately scoped.

## Sources

Inspected authored file: `tmux/main.conf` (`mode-keys vi`, clipboard binding and menu entry). [tmux manual](https://man.openbsd.org/tmux), copy mode and buffers; installed `man1/tmux.1`. No live key table, clipboard provider or remote clipboard behavior was verified.
