# Review writing beside the source — opt-in Neovim proof

This additive adapter provides **preview → Send → review → Apply → undo**, not automatic editing. It is separate from the installed help-only adapter. Loading help does not enable AI commands. Existing `:Llm`, mappings, native `:help` and your theme stay unchanged.

Requires Neovim 0.11+, Node 22.19+, and the [reviewed Pi writing setup](writing-runner.md). No dependency or login is installed. Ordinary help still works without Pi.

## Load only after deliberate opt-in

Try in a disposable editor first. With your actual module path:

```lua
local root = "/absolute/path/to/workstation"
local ai = dofile(root .. "/integrations/nvim/workstation-ai.lua")
assert(ai.setup({
  node = vim.fn.exepath("node"),
  entry = root .. "/bin/workstation-guide.mjs",
  -- profile = "/absolute/path/to/private/profile.json", -- optional
}))
```

This documentation does not install a persistent hook or reload your editor. Persistent private activation and any legacy-key migration require a separate reviewed change/backup. Cache the module table when repeatedly sourcing a hook; repeated `setup` on the same table is safe. Conflicting global or buffer-local command names are refused, not overwritten. No new keybindings are created.

## Scope and workflow

1. Put the cursor in a paragraph of a normal text buffer.
2. Run `:WorkstationAI` and choose an action, or specify its ID:
   - `:WorkstationAI improve-writing`
   - `:WorkstationAI analyze-prose`
   - `:WorkstationAI summarize-micro`
3. The right split shows the **exact source**, line range/count, UTF-8 byte count, provider/model/thinking, Pi version, pinned prompt hash/revision and privacy notice. **Nothing has been sent.** Read with native movement/search. `G` reaches the instructions at the bottom.
4. In that preview only, `:WorkstationAISend` explicitly sends the snapshot to the provider. The editor remains usable; no source is replaced.
5. Compare the original and the result in the review view. For a rewrite only, `:WorkstationAIApply` makes **one unsaved change** and returns focus to the source. Use `u` there to undo once. Earlier unsaved undo entries are preserved.

No-range commands target the paragraph, never silently default to the whole file. A single-paragraph file can still be the entire buffer; that fact is disclosed. Blank paragraphs, unsupported buffers, control bytes and input over 128 KiB are refused.

For whole lines, use **Visual Line mode (`V`)**, then `:WorkstationAI …`, or an explicit numeric range such as `:12,16WorkstationAI improve-writing`. Native characterwise (`v`) and blockwise Visual selections are rejected rather than silently widened. Scripts should supply explicit numeric ranges, not recycled Visual marks: programmatic Ex ranges have already resolved to lines and do not carry an originating Visual mode. `:%WorkstationAI …` is an explicit whole-buffer request and is labeled accordingly before Send.

**Feedback and summaries are scratch output. They have no Apply command.** A summary intentionally omits material and is not a drop-in replacement. None of these commands changes the old `:Llm` route; that older helper can still have a whole-buffer default and different replacement behavior.

## Cancel, stale results and errors

- `:q`, `:WorkstationAICancel` in the owned view, or global `:WorkstationAI!` closes/cancels it. Closing a source buffer/window also cancels its job. Cancelling the preview sends nothing.
- Starting a new request from the source cancels the old one. Late process or chooser callbacks cannot apply results or reopen cancelled views.
- Edits made after preview block Send. **Any source changedtick change** blocks Apply, including unrelated edits or edits subsequently undone. The stale result remains readable for manual comparison; prepare again if you want a new proposal.
- Apply also requires a writable normal buffer with undo enabled. Identical results cause no edit. A successful Apply cannot be repeated, even after undo.
- Results update the existing owned view without stealing focus. If you repurpose that window for another buffer, the adapter does not delete/close the foreign buffer.
- Missing configuration, unsupported Pi/model, provider failure, malformed/oversized output, timeout or cancellation produce generic diagnostics. Raw stderr, model events and private paths are not displayed. Source text is never replaced on failure.

## Safety boundary

The views are unlisted read-only/nonmodifiable `nofile` memory buffers, with swap, persistent undo and modelines disabled. Creation/population/cleanup suppress initial autocommands; no files are written by this adapter. Existing editor styling is retained, not replaced. Apply uses one buffer-edit operation, an explicit undo boundary, and no `:write`.

**Your existing editor is trusted, not sandboxed.** Existing plugins, later autocommands (including autosave), session/ShaDa tools, manual commands and deliberate copy/save may retain or act on viewed text. The adapter itself does not save. Its guarantees do not disable the rest of your configured editor.

Only the direct Node CLI is invoked, with literal argv, a controlled environment and closed stdin. Before Send, stdin is empty. At Send it contains only the selected source; Node wraps it for Pi. Intentional canonical agent-directory/proxy/CA settings are retained; API keys, Node hooks and inherited session/model/control metadata are not. Routing override variables remain visible to Node so it can reject them rather than silently hide a changed route.

Lookup/prepare have a 10-second watchdog; generation has Node's 180-second limit and an outer 185-second watchdog. Output is capped at 2 MiB and stderr is discarded. Cancellation first sends SIGTERM to Node so it can reap Pi's separate owned group, allowing two seconds before escalating an unresponsive Node. Normal editor exit waits for pending cleanup. Crashes/SIGKILL, an unresponsive or malicious runtime, or deliberately escaped descendants can defeat cleanup; this is not OS process/filesystem confinement. See the runner's canonical-auth and provider-retention caveats.

## Verification and acceptance

`node --test workstation/tests/writing-nvim.test.mjs` uses disposable Neovim, fake Pi and synthetic text. The opt-in `tests/terminal-smoke.py` additionally exercises actual terminal help/chooser/disclosure/Send/review/Apply/undo/feedback/cancel with fake Pi and network denied. Neither loads live init/plugins or sends writing to a provider.

Automated proof is not user acceptance of feel, latency or output quality, and not live activation or second-Mac verification. Try the representative flow before migrating more presets or adding mappings.
