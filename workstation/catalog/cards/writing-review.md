## When

You want help with prose but need to choose what kind of help before sending it.

## Try

- **Rewrite:** ask for proposed replacement wording. Preserve the original; compare meaning, voice and facts before applying anything.
- **Feedback:** ask what is unclear and why. A critique belongs beside the text, not pasted over it.
- **Summary:** ask for a shorter account. Omissions are expected; it is not automatically an improved version of the original.

Choose a paragraph or explicit whole-line range first. Read the scope and provider/model before sending. Selected text leaves your machine when you invoke a provider-backed AI tool; disabling local session files does not establish provider retention or training policy.

The separate opt-in writing adapter uses pinned Fabric `improve_writing`, `analyze_prose` and `summarize_micro` prompts through Pi. **Reading this card never runs them or enables editor commands.** After separately loading the writing adapter, `:WorkstationAI` chooses an action and previews its scope/settings. No-range means the current paragraph; use `V` or a numeric line range for whole lines, not character/block Visual mode.

In its preview, `:WorkstationAISend` explicitly sends the selected text. Rewrites offer `:WorkstationAIApply` only after the result arrives for review; `u` in the source undoes the one unsaved change. Feedback/summary have no Apply. `:q` or `:WorkstationAI!` cancels/closes the view. Source changes block Apply, even if those edits were undone. See the module's `docs/neovim-ai.md` for opt-in setup and editor/plugin privacy limits.

Existing AI bindings have not been migrated. If you use an existing `:Llm` helper, inspect its scope: some configurations default a no-range command to the whole buffer. Do not assume a current selection or this guide's review safety applies to that legacy route.

## Why

Scope and result type are decisions, not implementation details. The review flow refuses Apply after the source changes. An explicit Apply is undoable and the adapter never saves the file. Existing editor plugins, including any autosave configuration, remain trusted and are not disabled.
