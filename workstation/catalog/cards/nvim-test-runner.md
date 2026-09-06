## When

You miss the IDE's run-test gutter button: run nearest test, test this file, rerun the last failure, or return to the test you were working on.

## Try

Reference only: no test runner is launched by reading this card. Start in **Normal mode** in a trusted project/test file. Leader is separately recorded: {{binding.nvim.leader}}. `Leader t n` means separate presses; a matching plugin hash does not establish the leader key.

| IDE task | Recorded local mapping | Plugin command (not a stock Neovim command) |
| --- | --- | --- |
| Run nearest test to cursor | {{binding.nvim.test-nearest}} | `:TestNearest` |
| Run tests in this file | {{binding.nvim.test-file}} | `:TestFile` |
| Run the suite | {{binding.nvim.test-suite}} | `:TestSuite` |
| Rerun last test command | {{binding.nvim.test-last}} | `:TestLast` |
| Visit last test file | {{binding.nvim.test-visit}} | `:TestVisit` |

The authored `vim-test.lua` selects the **vimux** strategy, with `preservim/vimux` as a dependency. It sends the test command to a tmux runner pane; Neovim must be inside a working tmux session and the project's supported test runner/dependencies must exist. TestVisit navigates rather than running tests.

Check the selected scope, working directory (`:pwd`) and whether your intended changes are saved before an intentional run. Read the command/output in the runner pane: a green result for old on-disk code is not proof of unsaved edits. Nearest support varies by runner. Outside a test file, vim-test can reuse a previous test/file/suite; do not assume the current non-test file defines the target.

**Native fallback:** Neovim has no universal built-in “nearest test” command. A shell in a tmux pane can run the project's documented test command, but choose it from that project rather than guessing a language/tool here. `:help test-generic_commands` explains vim-test when installed.

## Why

Tests are executable project code with possible **side effects**: writes, subprocesses, databases or network calls. The suite can be expensive; start with the narrowest appropriate scope. This guide only teaches the distinction—it neither installs runners nor executes these examples.

## Recovery

If you intentionally launched the wrong run, focus the identified runner pane and use Ctrl-C, or use vimux's `:VimuxInterruptRunner` after confirming that is the runner you mean. Interruption is not rollback of side effects. Esc in Neovim does not stop a test already running in another pane. Visit the test again with TestVisit; closing a runner pane can terminate its process and is not the same as returning focus.

## Sources

Inspected authored files: `nvim/lua/vim-options.lua`, `nvim/lua/plugins/vim-test.lua`. Installed `vim-test/doc/test.txt` (`test-generic_commands`, vimux strategy) and `vimux/doc/vimux.txt` (`VimuxInterruptRunner`); [Neovim native terminal reference](https://neovim.io/doc/user/terminal.html) for the editor/terminal distinction. Source records do not verify a live runner.
