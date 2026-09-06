## When

You want to leave a terminal workspace and come back without closing its running programs.

## Try

A **session** contains **windows**; a window contains one or more **panes**. Each pane runs a program such as a shell or Neovim.

From a shell inside a disposable tmux session:

```sh
tmux display-message -p '#S'
tmux detach-client
```

Then, from the shell outside tmux on the **same host**:

```sh
tmux list-sessions
tmux attach-session -t '=YOUR_EXACT_SESSION_NAME'
```

Replace the placeholder with a listed name; keep it quoted. The leading `=` requests an exact match. If already inside tmux, use `tmux switch-client -t '=YOUR_EXACT_SESSION_NAME'` instead of nesting sessions.

Your recorded tmux prefix: {{binding.tmux.prefix}}. A prefix shortcut means press/release the prefix, **then** the next key. The commands above avoid guessing your configured shortcut.

## Why

Detaching disconnects a client, not the session. Closing a pane's shell with `exit`, or killing a session, is different. A remote session stays on its remote host; a local tmux server does not preserve work across reboot by itself.
