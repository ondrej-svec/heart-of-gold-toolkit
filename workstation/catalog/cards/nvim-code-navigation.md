## When

You want an IDE's go to definition, find usages, hover documentation, rename symbol, quick fix or format document.

## Try

Reference only: nothing below is executed by this guide. Start in **Normal mode** on a symbol. Leader is separately recorded: {{binding.nvim.leader}}. `Leader g d` means separate presses, not a chord; do not infer Space from a plugin hash.

These authored mappings are **buffer-local**, installed by `LspAttach`. They need an attached language server that supports the requested method. Installing Neovim or a plugin alone is insufficient.

| IDE action | Recorded local key | Native API via Neovim command line |
| --- | --- | --- |
| Hover documentation | {{binding.nvim.hover}} | `:lua vim.lsp.buf.hover()` |
| Go to definition | {{binding.nvim.definition}} | `:lua vim.lsp.buf.definition()` |
| Find references / usages | {{binding.nvim.references}} | `:lua vim.lsp.buf.references()` |
| Quick fix / code action | {{binding.nvim.code-action}} | `:lua vim.lsp.buf.code_action()` |
| Format document | {{binding.nvim.format}} | `:lua vim.lsp.buf.format()` |
| Rename symbol | {{binding.nvim.rename}} | `:lua vim.lsp.buf.rename()` |

**Rename exception:** the inspected mapping is literal Space r n, not a Leader mapping. Its key remains literal Space even if mapleader changes; it still requires LspAttach for this buffer. The recorded key above is authoritative only to the stated source fingerprint, not runtime state.

Stock Normal-mode `gd` finds a local declaration using editor text rules; it is not this local LSP definition mapping. Neovim 0.11 also has native LSP defaults such as `grr` (references) and `grn` (rename), but custom mappings and version differences can override them. Use `:help lsp-defaults` for the installed version. `:checkhealth vim.lsp` helps inspect attachment/configuration; no diagnostic is run here.

## Why

Definition and hover request information. Rename can edit several files' buffers; formatting changes text, and a code action may apply edits or execute a server-provided command. Review the action and resulting diff before saving. No result can mean the cursor is not on a resolvable symbol, the server lacks that capability, or no server is attached—not necessarily a broken key.

## Recovery

Stock Ctrl-O goes back after a jump; Ctrl-I moves forward (a terminal may encode it as Tab). Esc dismisses many prompts; focus a hover window and `:close` if needed. `u` undoes text edits in the current buffer, not an entire multi-file rename atomically and not external command effects. Review every affected buffer/version-control diff; `:quit` refuses unsaved loss, while `:quit!` deliberately discards the current buffer's unsaved changes.

## Sources

Inspected authored files: `nvim/lua/vim-options.lua`, `nvim/lua/plugins/lsp-config.lua`. Installed `runtime/doc/lsp.txt`, including `lsp-defaults`; [official Neovim LSP reference](https://neovim.io/doc/user/lsp.html). Local records are not confirmation of a live attached server.
