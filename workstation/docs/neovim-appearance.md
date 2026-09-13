# Optional Neovim appearance refresh

For a terminal editor that remains dark/light after the rendering terminal switches appearance, `integrations/nvim/workstation-appearance.lua` provides an explicit fallback. Tested with Neovim 0.11.6 and Rosé Pine `variant = "auto"` (`dark_variant = "moon"`). This is separate from the help/AI/desk adapters and is not installed automatically.

## Load

After reviewing the local helper, load it from your init on `VimEnter` (replace the placeholder with its absolute path):

```lua
vim.api.nvim_create_autocmd('VimEnter', {
  once = true,
  callback = function()
    dofile('/absolute/path/to/workstation/integrations/nvim/workstation-appearance.lua').setup()
  end,
})
```

For an already-running TUI, call that `dofile(...).setup()` directly via `:lua`; no restart or buffer reload is needed. Re-sourcing the file stops the previous instance, and repeated `setup()` replaces its timer instead of accumulating pollers.

The helper requests the terminal's background using **OSC 11 once per second**, immediately on setup, and on focus/resume. Neovim's existing `nvim.tty` handler interprets responses, updates `background`, and reloads the current adaptive colourscheme. A missed appearance notification or a stale first reply therefore recovers on a later poll. Polling pauses while Neovim is suspended and stops on exit. It does not set terminal colours, read the host OS appearance, run commands, download plugins, or touch buffers, views, undo, mappings or desk state.

Only the native TUI with an actual stdout TTY is supported. Headless, GUI and RPC-only instances are no-ops; escape bytes must not enter a MessagePack pipe. Unsupported/unresponsive terminals receive queries but cannot supply automatic switching; no timeout blocks editing and no appearance is guessed. A failed stdout write stops the helper.

Keep a colourscheme that adapts to `background`. Setting a fixed variant, explicitly setting `background` before startup, or removing native automatic detection can prevent switching; this helper does not override those choices. It repairs the refresh gap, not a confirmed underlying multiplexer notification bug.

## Stop / remove

```lua
local appearance = package.loaded['workstation-terminal-appearance']
if appearance then appearance.stop() end
```

Remove the `VimEnter` activation to keep it off next time. Normal Neovim configuration is not changed by the package. The initial local rollout was restricted to the disposable Writing trial.

## Checks

```sh
node --test workstation/tests/appearance.test.mjs
uv run --offline --no-project --no-config workstation/tests/appearance-pty.py /absolute/path/to/nvim
```

The Node tests cover lifecycle and output safety, then run the PTY fixture if Neovim and `uv` are already available (no installation). The fixture's terminal deliberately sends **no appearance notifications**: without the helper the editor stays dark, then with it the real TUI handles a stale reply, light/dark transitions and stop/restart while preserving unsaved text, undo, view, windows and mode. It uses a synthetic adaptive colourscheme; the local live verification additionally checks Rosé Pine. These checks do not toggle macOS appearance or touch a user's running editor.
