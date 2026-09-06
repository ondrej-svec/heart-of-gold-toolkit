## When

You want to split terminal space like an IDE's terminal panel, move between panes, or open a new terminal tab without closing a running process.

## Try

Reference only: this guide opens no panes or windows. First confirm you are inside tmux and identify the active pane.

**Prefix:** {{binding.tmux.prefix}}. Press and release the prefix chord, then press the **suffix** below. Each local record is the suffix only, never a hardcoded prefix-plus-key. Records describe inspected source, **not live verification**.

| Task | Recorded local suffix | Authored tmux action |
| --- | --- | --- |
| Horizontal divider, new pane below | {{binding.tmux.split-below}} | `split-window -v -c "#{pane_current_path}"` |
| Vertical divider, new pane right | {{binding.tmux.split-right}} | `split-window -h -c "#{pane_current_path}"` |
| Focus left/down/up/right | {{binding.tmux.navigate-panes}} | `select-pane -L` / `-D` / `-U` / `-R` |
| New window (terminal tab) | {{binding.tmux.new-window}} | `new-window -c "#{pane_current_path}"` |

The orientation words describe the visible divider. tmux calls `-v` a vertical split (stacked top/bottom) and `-h` a horizontal split (side by side); remembering **below** and **right** avoids that naming trap. The local splits and new window inherit the active pane's working directory, not a universal project root.

**Stock defaults**, separately from these local records: prefix then `"` creates top/bottom panes; prefix then `%` creates left/right panes; prefix then arrow selects a pane; prefix then `z` toggles zoom of the active pane. Prefix then `n` / `p` selects next / previous window. These suffixes can be overridden; the upstream prefix is not assumed to be yours.

Native shell examples, shown but never executed: `tmux split-window -v`, `tmux split-window -h`, `tmux select-pane -L`, `tmux new-window`, `tmux resize-pane -Z`. These address the current tmux context and launch shells or change focus/layout. They avoid memorizing a custom key, not the need to check the target.

## Why

A session groups windows; each window contains panes. A pane is a terminal/process environment, not a Neovim buffer or editor split. Focus changes preserve processes. Splitting starts another process; killing a pane ends the process in it. Ctrl-h/j/k/l handoff from Neovim belongs to a separate navigator plugin, not these prefix-table suffixes.

## Recovery

Toggle stock zoom with prefix then z again to restore the layout, or use `tmux resize-pane -Z` intentionally. Move focus back without closing anything. In a genuinely disposable shell, `exit` ends that shell/pane; do not type it into an unfamiliar running application. Stock prefix then x asks to kill the active pane—destructive, not an undo for splitting. To leave work running, detach instead (`tmux detach-client`); see tmux.workspaces.

## Sources

Inspected authored file: `tmux/main.conf` (split-window, select-pane, new-window). [tmux manual](https://man.openbsd.org/tmux), also installed `man1/tmux.1`, for native commands and stock defaults. No running server was queried or reconfigured.
