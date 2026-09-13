---
title: "fix: refresh Neovim terminal appearance in the Writing trial"
type: plan
date: 2026-09-13
status: complete
confidence: high
---

# Neovim appearance refresh

## Problem and evidence

The live Writing trial uses Neovim 0.11.6 and Rosé Pine's `auto` variant. After switching the terminal to light, the editor retained `background=dark` and an old OSC 11 report (`#232136`). Its native `nvim.tty` TermResponse handler was still installed. Explicitly requesting OSC 11 returned `#faf4ed` and immediately switched to Dawn without changing the source buffer's changedtick or modified flag. The underlying missed/stale notification timing is not yet reproduced; the refresh gap is verified.

## End state and scope

Add an explicitly loaded, terminal-only fallback that queries the actual terminal background every second and on focus/resume. Neovim's existing handler remains responsible for interpreting the report and selecting the colourscheme. Activate only in the disposable Writing trial, including its next start; no normal Neovim config, OS appearance setting, Herdr process/layout, draft, undo history, or desk integration changes. No macOS-only detector or extra dependency.

## Solution and rationale

An opt-in helper in `workstation/integrations/nvim/workstation-appearance.lua` issues the same read-only OSC 11 query used by Neovim. A periodic query also handles a missing notification while focus stays in the editor. Guard native TUI and stdout TTY before writing (never write escape bytes into an embedded RPC pipe). Clean up the timer/autocommands on stop, re-setup and exit; pause during suspension. Keep native background detection and manual override semantics, without another RGB parser or colourscheme hook.

## Tasks

- [x] Verify a real background query switches the live editor without changing its text.
- [x] Implement and package the opt-in helper; document its limits and removal.
- [x] Test headless/RPC safety, lifecycle/reload, and a real TUI switching dark → light → dark without notifications, including stale initial replies and unchanged unsaved text/undo.
- [x] Load the helper in the trial config and live editor; verify buffer/view/undo and editor connection are preserved.
- [x] Run relevant checks, commit only this fix, push the existing feature branch, and report unrelated leftover changes.

## Acceptance

- Responsive terminals converge to their current background within one polling interval plus response/render time, even without theme notifications.
- An unresponsive terminal does not freeze editing or guess an OS appearance.
- Headless/GUI/RPC-only instances receive no raw output or polling timer.
- Repeat setup/reload leaves one poller; stop/exit/suspend and queued callbacks are safe.
- No buffer, view, undo, keybinding, or desk authority is changed by the helper.

## Boundaries and validation

This is a small compatibility fallback, not a proven upstream Herdr repair. A PTY fixture acts as a terminal and answers OSC 11, keeping the native Neovim parser and colour reload path real. It must fail without the helper. The current trial is the only activation target. User-visible macOS appearance toggling remains a final manual confirmation; tests do not change global system settings. Existing uncommitted Writing desk work is outside this commit.

## Completion evidence

- `npm --prefix workstation test`: 186/186 passed, no skips, including the real PTY negative control and light/dark transitions.
- Node/Python/Lua syntax, `git diff --check`, and package dry-run passed. A separate focused review reported no actionable correctness findings.
- In-place trial activation preserved the same editor PID, draft digest/changedtick/modified flag, complete undo state, window/view/mode and desk command. Native Rosé Pine is now Dawn. Trial startup loads the helper on `VimEnter`; normal Neovim config is unchanged.
- Local receipts are under the trial's private `proof/appearance-*` paths; no draft text, socket authority, or credentials are committed.
- Fix commit `a4eec8a` pushed to `origin/feat/workstation-guide`. Unrelated existing desk files, package formatting/dependency changes, README and workflow edits remain unstaged. No submodule pointer was committed in Bobo.
- Actual macOS appearance toggling is left to the user for visual confirmation; the automated test uses a separate synthetic terminal, not the live Herdr session.
