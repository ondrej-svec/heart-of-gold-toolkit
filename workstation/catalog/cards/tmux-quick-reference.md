## When

You want a tmux cheatsheet: panes versus windows versus sessions, the menu, and the few moves that preserve your work.

## Try

Reference only; no tmux command below is executed by the guide.

**Prefix:** {{binding.tmux.prefix}}. Press and release this chord, then the **suffix**. Local records are inspected configuration, **not live verification**. Stock defaults below can be overridden; do not replace an unknown prefix with an upstream guess.

| Local task | Recorded suffix after prefix | Effect |
| --- | --- | --- |
| Discover local actions | {{binding.tmux.menu}} | Opens the authored menu |
| Session switcher | {{binding.tmux.session-picker}} | Opens an external picker; availability not verified |
| New window | {{binding.tmux.new-window}} | Starts a shell in the active pane's directory |
| Split below | {{binding.tmux.split-below}} | New pane below, same directory |
| Split right | {{binding.tmux.split-right}} | New pane right, same directory |
| Focus left/down/up/right | {{binding.tmux.navigate-panes}} | Selects a pane |

**Stock default suffixes** (not local profile verification):

| Task | After prefix | Native shell command alternative |
| --- | --- | --- |
| Detach, leave work running | `d` | `tmux detach-client` |
| Next / previous window | `n` / `p` | `tmux next-window` / `tmux previous-window` |
| Zoom pane / restore layout | `z` | `tmux resize-pane -Z` |
| Enter scrollback / copy mode | `[` | `tmux copy-mode` |
| Paste tmux buffer, not guaranteed OS clipboard | `]` | `tmux paste-buffer` |
| Command prompt | `:` | Type a tmux command here without a leading `tmux` |
| Key help | `?` | See distinction below |

**Direct ? versus menu ?:** stock prefix then `?` uses `list-keys -N` to show keys with help notes, not necessarily every binding. After opening the authored menu, `?` selects its “Every binding” entry, which runs `list-keys` instead. `tmux list-keys` shows binding commands; `tmux list-keys -T prefix` narrows to prefix keys; `tmux list-keys -T copy-mode-vi` inspects vi copy-mode keys. These are reference examples, not queries this guide performs. Plugins/version changes may alter direct key help.

Outside tmux, `tmux list-sessions` lists sessions; `tmux attach-session -t '=NAME'` attaches to an exact name you deliberately substitute. Do not type the placeholder literally. Session persistence across detach/disconnection is native; reboot restoration relies on separately functioning plugins and is not guaranteed.

## Why

**Session = workspace; window = terminal tab; pane = terminal rectangle.** A Neovim window lives inside a pane. Copy mode temporarily handles keys instead of the application. Native help remains available through `man tmux` and tmux's own key listing; this guide does not intercept them.

The local clipboard-paste label is not evidence of working OS paste: `tmux/main.conf` uses `pbcopy` where clipboard reading is expected, a known defect left untouched. See tmux.copy-mode before pasting; paste can submit executable text.

## Recovery

Esc closes the authored menu or cancels the command prompt; q exits stock vi copy mode or the key-list view. Detach to preserve work instead of closing a shell, pane or session. `kill-pane`, `kill-window` and `kill-session` terminate work and have no general undo. Reattach on the same host; a disconnected client is not a backup.

## Sources

Inspected authored file: `tmux/main.conf` (menu, local suffixes and plugin declarations). [tmux manual](https://man.openbsd.org/tmux) and installed `man1/tmux.1` for commands, copy mode and stock defaults. The private `CHEATSHEET.md` was reconciled in a separate sanitized note; its “every binding” and clipboard claims are not adopted as runtime facts.
