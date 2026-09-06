## When

You ran something useful before and want to adapt it, not blindly repeat it.

## Try

1. Return to an interactive shell prompt.
2. Your recorded history binding: {{binding.shell.history}}.
3. Standard fzf shell integration uses **Ctrl-R** to search history. Without that integration, your shell may provide its own different reverse search.
4. Search for a distinctive word. Select a candidate, then read the entire recalled command before pressing Enter.
5. Check its directory, host, filenames and destructive flags. Edit or discard it if any assumption has changed.

Avoid pasting history into public chats: it may contain credentials or private paths. This guide neither reads nor records history.

## Why

History returns the old command text, not the old context. The same text can act on different files or machines today.
