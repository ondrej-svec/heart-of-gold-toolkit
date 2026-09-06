## When

You want a familiar overview of personal tasks or tools, rather than constructing a one-off shell command.

## Try

1. Check availability without launching it: `command -v cockpit` at your shell prompt.
2. If present, inspect that tool's own `cockpit --help` before opening or submitting tasks. The guide cannot establish its account access or deployment from an executable alone.
3. Your recorded tmux prefix: {{binding.tmux.prefix}}. Release it, then press the cockpit key: {{binding.tmux.cockpit}}. Use it only after verifying the matching config is loaded.
4. If it lives in a persistent tmux window, switching windows leaves it running. Learn its own documented back/quit action before starting real work.

No cockpit? The shell, finding, tmux and editor chapters still work. A personal tool's existence on another machine is not a portable installation recipe; ask its owner for access rather than installing a guessed package.

## Why

A cockpit is a curated set of workflows with its own effects and permissions. It complements the shell and this learning guide; selecting a reference here never launches it.
