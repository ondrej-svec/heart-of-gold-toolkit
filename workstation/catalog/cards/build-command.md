## When

A command looks like punctuation soup, or a filename contains spaces.

## Try

Start with harmless text, not your real files:

```sh
printf '%s\n' 'notes for Friday'
printf '%s\n' 'one' 'two' | wc -l
```

- A program receives separate **arguments**. Quoting `"notes for Friday.md"` makes one argument, not three. Single quotes keep `$variables` and `$(commands)` literal; double quotes still expand them.
- `|` feeds the first program's standard output into the next program's standard input. Standard error is separate unless explicitly redirected.
- `>` writes to a file and can overwrite it; `>>` appends. There is no general shell undo. The examples above use neither.
- `ssh host 'command'` runs the quoted command on the remote host. In `ssh host 'command' | wc -l`, the counting runs locally. The pipe belongs to the shell that parses it.

## Why

The shell parses quotes, expansions, pipes and redirects before the program works on its arguments. Reading the command in those layers is safer than memorizing a long incantation.
