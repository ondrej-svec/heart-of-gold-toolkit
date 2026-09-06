## When

You remember part of a filename, not its full path.

## Try

1. At a shell prompt, type `nvim `, including the trailing space. Do not press Enter yet.
2. Your recorded file-picker binding: {{binding.shell.file-picker}}.
3. With standard fzf shell integration, **Ctrl-T** opens file insertion. This is an upstream convention, not proof that your current shell has the hook loaded.
4. Type a distinctive piece of the filename. Enter selects; inspect the inserted path and its quoting.
5. Press Enter again only if you actually want to run the completed command. Otherwise Ctrl-C discards the line.

If the binding is unknown or does nothing, use `find . -type f -name '*part-of-name*'` in a small directory instead. This lists names without opening them. Replace the quoted pattern deliberately.

## Why

fzf selects text. The shell still decides when to execute the command line. An installed `fzf` executable alone does not install Ctrl-T in your active shell.
