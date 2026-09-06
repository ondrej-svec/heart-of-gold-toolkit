# Help beside your work — optional Neovim adapter

This is the **help-only** slice. It adds `:WorkstationHelp`, not an AI filter, Apply action or keybinding. Native `:help`, which-key and existing mappings remain unchanged. Nothing is installed just by browsing the guide. Requires Neovim **0.11+** and Node **22+** already installed.

## Opt in after reviewing the module

For a disposable session, start `nvim -u NONE -i NONE -n --noplugin`, then run this Lua with your actual module path. A persistent private Neovim declaration is a separate configuration change, not performed by the guide:

```lua
local root = "/absolute/path/to/workstation"
local guide = dofile(root .. "/integrations/nvim/workstation-help.lua")
assert(guide.setup({
  node = vim.fn.exepath("node"),
  entry = root .. "/bin/workstation-guide.mjs",
  -- profile = "/absolute/path/to/private/profile.json", -- optional
}))
```

For persistent help-only activation, use a reviewed private `nvim/after/plugin/workstation-help.lua` hook rather than changing existing mappings or adding a plugin-manager dependency. Cache the module table in `package.loaded` if that hook may be sourced repeatedly. After backup/approval, new sessions load it; an already-open editor needs `:luafile ~/.config/nvim/after/plugin/workstation-help.lua` (adjust for a relocated config root). Do not reload the whole init just to activate help. Keep the trusted local checkout path in that private hook, not in the shared catalog.

The module refuses missing/nonabsolute executable/entry paths and existing global or buffer-local `WorkstationHelp` commands. Repeating `setup` on the same module object is safe; loading another copy does not replace the first command. No plugin manager, downloads, shell reload or native-help override is needed.

```vim
:WorkstationHelp
:WorkstationHelp go to definition
:WorkstationHelp nvim.quick-reference
:WorkstationHelp tmux.quick-reference
:WorkstationHelp!
```

No query offers all cards. A task uses the **same Node search and ranking** as shell `help`; multiple results use your existing `vim.ui.select` (Neovim's numbered chooser if no override). A unique result or exact stable ID opens directly. Esc cancels the chooser. Bang cancels a pending request or closes the owned help view. Cancellation is silent; missing tools, invalid responses and no matches give short diagnostics.

## Read and return

A complete reference opens in a right-hand split with the existing editor's appearance. Use native movement/search, **`gf` on the filename/URI in a related link**, **Ctrl-O** to return, and **`:q`** to close the help window. `index.md` lists all chapters. Run `:WorkstationHelp` again to search. There are no custom buffer mappings.

The editor receives complete Markdown from the shared renderer, not just card bodies. Its unlisted `nofile` buffers have private-to-the-editor `workstation-guide://…/*.md` names. These are **in-memory reading copies**, not real files. Known sibling links point to other already-created buffers; native `gf` can follow them. No temporary directory, profile export, source-file edits, swap or persistent undo are created by this adapter.

All owned reading buffers are wiped when the help window closes, on replacement, explicit cancellation or normal editor exit. Navigating a help window to an unrelated buffer does not give the helper permission to close/delete that unrelated buffer. Source text, changedtick, modified state and undo entries are preserved. Ordinary window switching may finish an in-progress undo block; it does not add an edit. Source cursor/view restoration is tested with stock options; existing user window/autocommand behavior remains trusted.

## Async and safety boundary

- The adapter calls **only the direct Node reference CLI**, with argv, sanitized environment, closed empty stdin and its trusted module directory as cwd. No source-buffer text is included. Query strings are literal search text after `--`, including leading dashes/metacharacters.
- HOME/PATH, XDG_CONFIG_HOME and locale/terminal values support existing profile resolution. Node startup hooks, credentials, Pi metadata and shell/editor startup injection variables are not inherited by Node. Profiles remain optional and source-fingerprinted; actual private records require explicit source inspection/installation and are never inferred or written by this adapter.
- No shell, external picker, nested Neovim, tldr, Pi or model is launched. Node's reference mode does not execute optional tools. The adapter caps stdout at **2 MiB**, imposes a **10-second timeout**, discards child stderr, validates JSON version/card IDs/document targets and uses generic errors. It kills only its owned Node process; this is not a future AI process-group sandbox.
- Requests are invalidated before cancellation. Delayed process/chooser callbacks cannot reopen an old view after replacement/cancellation. If the originating window/buffer disappears or focus moves elsewhere, the result is discarded rather than editing/focusing an unrelated buffer. Typing in the source during lookup remains allowed.
- Initial buffer creation/naming/filetype setup and cleanup suppress autocommands with scoped restoration of `eventignore`. No `BufRead` path/modelines or Markdown FileType plugins are invoked to display the response. Syntax/Markdown plugins are deliberately not loaded just for the guide.
- **An existing editor is not a sandbox.** Its existing UI picker/plugins are trusted; subsequent user commands, navigation/autocommands, registers, jumps, search history, ShaDa/session plugins or an explicit save/copy may retain viewed text/URIs. Read-only/nonmodifiable flags prevent accidental editing, not deliberate commands. No claim of isolated editor state applies to this opt-in adapter. Use the shell's isolated reader if that boundary is wanted.

## Local checks

`node --test workstation/tests/nvim.test.mjs` uses isolated Neovim with disposable HOME/XDG, synthetic failures and OS-denied network access on macOS. It checks source preservation, native links/help/mappings, setup collision refusal, chooser cancellation/late callbacks, focus changes, hostile env/literal argv/empty stdin, malformed/oversized output, timeout, owned-child cancellation and editor exit. It never loads your live init or plugins.

Automated success is not user acceptance of the live editor feel, nor second-Mac validation. Enabling this command in the real editor and recording personal keys remain separately reviewed steps.
