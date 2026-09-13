---
title: "Harness question and approval UX: focus paths before styling"
date: 2026-09-13
type: research
status: findings_recorded
---

# Harness question and approval UX

**Conclusion:** the next preview needs a unified focus route and separate approval/feedback intents, not another wording or styling pass. Research only: no preview or production code changed.

## Trigger and method

Ondrej liked revision 02's direction but could not naturally move to “Or just start typing” and still found approval awkward. Screenshot: `img_20260913-180652_BDU.png`.

Examined current public docs and primary source for Codex, OpenCode, Gemini CLI and Claude Code. Repository sources are pinned below; these are source snapshots, not claims about every installed release. Claude Code behavior is documented behavior, not an inspection of its closed implementation. Issue reports are clearly distinguished from confirmed facts. Only our own browser preview was exercised live.

## Local reproduction: revision 02

Source: `a1768d5`, `docs/previews/hog-ask-v2/preview.mjs`. Served [revision 02](https://ondrejs-mac-mini.tailbc79e3.ts.net/s/site--2026-09-13--36963640/) tested in an isolated Chrome target at 1280×1000 using CDP keyboard and real coordinate-based pointer events.

| Action | Observed result | Finding |
|---|---|---|
| Down twice from initial Internal focus | Remains on Public, no answer | **Confirmed:** arrows clamp to option buttons and exclude custom entry (lines 112–123). |
| Hover the custom textarea | I-beam pointer, keyboard focus stays Public | Hover does not focus the editor. This alone is not a bug; hover should not redirect typing unexpectedly. |
| Click actual custom text area, then type | Text is captured in the focused custom editor | Clicking the actual input works; “all mouse input is broken” would be inaccurate. |
| Click the `›` prompt marker | Focus becomes null; still on Choose | **Confirmed:** the visible entry row is not a coherent click target. Marker is an inert span (line 43). |
| Focus the custom textarea | Its top moves from y=531.27 to y=398.27 | **Confirmed:** a 133px jump in this viewport. `onfocus → openCustom → render` replaces the entire choose layout (lines 75–79, 123–125). |
| Click approval note, then type | Note is captured; core still withholds approval | Mechanically works, but the presented intent remains “Approve this scope” while the eventual action becomes feedback. |

The 34 prior checks verified keyboard and semantic paths, not these pointer targets or the last-option-to-custom arrow boundary. Passing them was not evidence that the interface was intuitive.

## Primary-source comparisons

### OpenCode: custom entry belongs in normal navigation

Repository: `anomalyco/opencode`, SHA `a453386e9dd3cd5089714f1f0d4576002a96d30d`.

- [Question navigation, lines 257–281](https://github.com/anomalyco/opencode/blob/a453386e9dd3cd5089714f1f0d4576002a96d30d/packages/tui/src/routes/session/question.tsx#L257-L281): Up/Down and j/k cycle the total item count, including custom; Enter activates the focused item. Number shortcuts also activate.
- [Custom row, lines 400–445](https://github.com/anomalyco/opencode/blob/a453386e9dd3cd5089714f1f0d4576002a96d30d/packages/tui/src/routes/session/question.tsx#L400-L445): `onMouseOver` and `onMouseDown` move selection to the custom row; `onMouseUp` calls `selectOption()`. The resulting textarea is focused. Drag/text selection suppresses activation.
- [Choice activation, lines 105–126](https://github.com/anomalyco/opencode/blob/a453386e9dd3cd5089714f1f0d4576002a96d30d/packages/tui/src/routes/session/question.tsx#L105-L126): selecting custom enters editing instead of returning a blank “Other” answer.
- [Single-answer submission, lines 64–82](https://github.com/anomalyco/opencode/blob/a453386e9dd3cd5089714f1f0d4576002a96d30d/packages/tui/src/routes/session/question.tsx#L64-L82): a single choice replies immediately; multi-question flow is different. Do not import that instant-submit behavior into our established explicit-review contract without a separate decision.
- [Permission navigation, lines 568–625](https://github.com/anomalyco/opencode/blob/a453386e9dd3cd5089714f1f0d4576002a96d30d/packages/tui/src/routes/session/permission.tsx#L568-L625): Left/Right and h/l, then Enter. Tab is not bound in this component. This is the current TypeScript/OpenTUI project—not the archived `opencode-ai/opencode` Go project that appeared in search results.

**Borrow:** one navigation model, whole-row pointer targets, focus the custom editor on activation, protect text-selection gestures. **Do not blindly borrow:** immediate one-click permission approval.

### Gemini CLI: inline custom input; approval and feedback are different intents

Repository: `google-gemini/gemini-cli`, SHA `9c1b0a610534d6f8120964cf2672c07807d8fc90`.

- [Custom item and focus, lines 757–789](https://github.com/google-gemini/gemini-cli/blob/9c1b0a610534d6f8120964cf2672c07807d8fc90/packages/cli/src/ui/components/AskUserDialog.tsx#L757-L789): the custom item is added to the same selection list. Highlighting it sets custom focus.
- [Inline editor, lines 938–978](https://github.com/google-gemini/gemini-cli/blob/9c1b0a610534d6f8120964cf2672c07807d8fc90/packages/cli/src/ui/components/AskUserDialog.tsx#L938-L978): `TextInput` renders within the custom row and receives `focus={context.isSelected}`. It does not require a separate replacement question form.
- [Type-to-jump, lines 671–730](https://github.com/google-gemini/gemini-cli/blob/9c1b0a610534d6f8120964cf2672c07807d8fc90/packages/cli/src/ui/components/AskUserDialog.tsx#L671-L730): printable input focuses custom and seeds the buffer; navigation and numeric quick-select keys are handled separately.
- [Mouse selection, lines 73–89](https://github.com/google-gemini/gemini-cli/blob/9c1b0a610534d6f8120964cf2672c07807d8fc90/packages/cli/src/ui/components/shared/BaseSelectionList.tsx#L73-L89): first click highlights an unselected row, another click on the active row selects. For custom, highlight itself connects to editor focus. This is not universal single-click submission.
- [Plan approval, lines 245–277](https://github.com/google-gemini/gemini-cli/blob/9c1b0a610534d6f8120964cf2672c07807d8fc90/packages/cli/src/ui/components/ExitPlanModeDialog.tsx#L245-L277): explicit approval choices call `onApprove`; a free-text answer calls `onFeedback` instead. Its broader auto/manual tool modes are not a proposal for Heart of Gold.
- [Payload separation, lines 651–670](https://github.com/google-gemini/gemini-cli/blob/9c1b0a610534d6f8120964cf2672c07807d8fc90/packages/cli/src/ui/components/messages/ToolConfirmationMessage.tsx#L651-L670): approval sends `{ approved: true, approvalMode }`; feedback sends `{ approved: false, feedback }`.

**Borrow:** stable inline input and distinct approve-versus-feedback routes. Do not present approval and then silently reinterpret an attached note as a different response.

### Claude Code: pointer-accessible Other; comments do not mean conditions

- [Official fullscreen documentation](https://code.claude.com/docs/en/fullscreen#use-the-mouse): “Clicking a free-text row, such as the Other row in a multiple-choice question, focuses its input field so you can type an answer.” This is documented for v2.1.208 onward. The same page documents hover indication on select-menu options; it does not promise hover-to-edit.
- [Official permission comments](https://code.claude.com/docs/en/permissions#add-a-comment-when-you-answer-a-permission-prompt): Tab on Yes or No opens a comment. Enter submits the answer and comment; Tab closes the field while retaining text.
- Crucial distinction: **Yes runs the action, then delivers the comment after the result. No sends the comment as the denial reason.** Therefore its Yes+comment behavior is not a safe template for “yes, but do X first.” We must not cite Claude as evidence that all notes with approval should be accepted, or that all harnesses reject them.
- [Reported focus-click hazard, issue 76528](https://github.com/anthropics/claude-code/issues/76528): a user reports terminal/pane refocus clicks submitting prompts inadvertently. This is an issue report, not a behavior we independently reproduced. It supports preserving our separation between pointer focus and final authorization.

**Borrow:** full-row direct entry and clear explicit intent. **Do not borrow:** treating a condition as a post-action comment.

### Codex: explicit text route, but not a mouse reference

Repository: `openai/codex`, SHA `16537b20a5ec0ea9aa079f4ad4b0e30e8a9efacf`.

- [Question keys, lines 1300–1359](https://github.com/openai/codex/blob/16537b20a5ec0ea9aa079f4ad4b0e30e8a9efacf/codex-rs/tui/src/bottom_pane/request_user_input/mod.rs#L1300-L1359): arrows move highlight; Space commits; Enter commits and advances/submits. Tab reaches notes; Enter on the optional “None of the above” route enters text.
- [Typing behavior test, lines 2332–2356](https://github.com/openai/codex/blob/16537b20a5ec0ea9aa079f4ad4b0e30e8a9efacf/codex-rs/tui/src/bottom_pane/request_user_input/mod.rs#L2332-L2356): explicitly asserts that typing `x` on options does **not** open notes. A module comment suggests otherwise; code/tests take precedence.
- [Approval choices, lines 897–911](https://github.com/openai/codex/blob/16537b20a5ec0ea9aa079f4ad4b0e30e8a9efacf/codex-rs/tui/src/bottom_pane/approval_overlay.rs#L897-L911): “No, continue without running it” maps to Decline; “No, and tell Codex what to do differently” maps to Cancel. That overlay does not collect a feedback text field.
- [TUI event stream, lines 266–305](https://github.com/openai/codex/blob/16537b20a5ec0ea9aa079f4ad4b0e30e8a9efacf/codex-rs/tui/src/tui/event_stream.rs#L266-L305): unhandled events, including mouse, are dropped in this snapshot. Not a reference for pointer parity.

**Borrow:** precise distinction between navigation, answer and cancellation; not a claim that Tab-only custom entry is desirable for us.

## Pi feasibility

Installed Pi/TUI **0.85.1** documents normalized fullscreen `handleMouse` events, `MouseRegion`, focus requests, and built-in mouse behavior in `Input`, `Editor`, `SelectList`, and `SettingsList` (`docs/tui.md`, lines 312–326). The installed `hog_ask` custom renderer handles keyboard input but does not implement `handleMouse` or expose those pointer targets.

So pointer support is not inherently impossible in Pi: it should be explicitly integrated and tested in fullscreen mode, which this workstation uses. Regular mode deliberately leaves mouse ownership to terminal scrollback. Do not promise identical pointer behavior there. Real custom-card hit regions, focus propagation, drag selection, resize and scroll coordinates remain implementation-stage proof obligations.

## Recommended revision — not implemented or approved yet

1. **One focus route:** options → custom input, with Down/Up and Tab/Shift-Tab. Do not treat custom input as an extra semantic answer before it contains text.
2. **One coherent entry target:** clicking anywhere on its visible row, including marker/padding, focuses the stable input. Hover highlights; it does not capture typing or approve anything. No replacement form or geometry jump on focus.
3. **Preserve typing/paste:** direct typing remains a shortcut, not the only usable alternative to Tab; opening, navigating and backing out must preserve drafts.
4. **Approval intents first:** “Approve as written,” “Request changes,” and “Not now,” mapped to existing approve/revise/pause semantics. Feedback/conditions live in the request-changes/custom route, not under an apparently approved answer with a generic optional note. No approval-with-conditions inference.
5. **Keep trust boundaries:** an explicit reviewed Send for approval; hover, refocus clicks, text selection and navigation never authorize an action. Do not copy blanket/session permission modes or instant-submit behavior from other harnesses.
6. **Verify behavior before another style pass:** click text/marker/padding, Down into the editor, Up out at a text boundary, caret placement, typing after pointer focus, drag-to-copy, retained text on Back, clear approval vs feedback intent, and full native fullscreen proof later.

Owner/gates: agent owns the navigation fixes, pointer integration and tests; Ondrej owns review of the proposed approval interaction. No need to ask him to debug browser focus or choose mandatory test tasks. Existing production semantics, release authorization boundaries and immutable 0.2.3 installation remain unchanged.
