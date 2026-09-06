## When

You want a safe starting point for editing and recovery.

## Try

Try this in a disposable buffer. These are standard Neovim defaults; custom mappings can override them.

1. Press **Esc** for Normal mode. Movement and editing commands now operate on text.
2. Press **i** for Insert mode, type a short sentence, then Esc.
3. Press **u** in Normal mode to undo; **Ctrl-R** redoes that change.
4. Press **V** (uppercase) for a linewise selection; **v** selects characters; Ctrl-V is blockwise. Esc leaves selection mode.
5. Search existing text with `/word` and Enter; `n` advances to the next match.
6. `:write` saves the buffer to its file. `:quit` refuses to discard unsaved edits; `:quit!` deliberately discards them.

Your recorded leader: {{binding.nvim.leader}}.
Your recorded discovery sequence: {{binding.nvim.discovery}}.

Native `:help` still opens Neovim's documentation. Use `:help usr_02.txt` for its introduction. No guide command replaces it in this proof.

## Why

The buffer is the in-memory working copy; the file is what you last saved. Undo changes the buffer, not a previously transmitted AI request or an unrelated command's effects.
