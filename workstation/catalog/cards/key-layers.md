## When

A shortcut works at the shell but not in Neovim, or the terminal seems to swallow it.

## Try

Read the layers from the outside in:

1. **Terminal app:** receives physical keys and may handle its own shortcuts first.
2. **tmux:** handles configured prefix sequences and can forward other keys.
3. **Current application:** the shell, Neovim or another program interprets what remains.
4. **Application mode:** Neovim Normal, Insert and Visual modes have different meanings for the same key.

Your tmux prefix: {{binding.tmux.prefix}}.
Your complete tmux help-menu sequence: {{binding.tmux.menu}}.

At a shell inside tmux, `tmux show-options -gv prefix` displays the running server's prefix. `tmux list-keys -T prefix` lists its prefix bindings. These inspect the running server; a matching config-file fingerprint alone does not prove it was reloaded.

## Why

A shortcut belongs to a layer, not to the keyboard universally. Check the receiver before trying another binding. The guide does not source shell config or attach to a tmux server during `doctor`.
