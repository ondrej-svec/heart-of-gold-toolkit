import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TuiMouseEvent } from "@earendil-works/pi-tui";
import { AskSchema } from "./hog-ask-schema.ts";
import { normalizeQuestion, outcome } from "./hog-ask-core.mjs";
import { createInteractions } from "./hog-ask-runtime.mjs";
import { AskCard } from "./hog-ask-ui.ts";
import { observeTerminalFocus } from "./hog-ask-focus.mjs";

export async function presentTui(question: ReturnType<typeof normalizeQuestion>, ctx: ExtensionContext, signal: AbortSignal, focusInput = process.stdin) {
	let cleanup = () => {};
	try {
		return await ctx.ui.custom((tui, theme, keybindings, done) => {
			let settled = false;
			let card: AskCard;
			let stopFocusObserver = () => {};
			const finish = (result: ReturnType<typeof outcome>) => {
				if (settled) return;
				disposeView();
				done(signal.aborted ? outcome(question, "aborted") : result);
			};
			const abort = () => finish(outcome(question, "aborted"));
			const disposeView = () => {
				settled = true;
				stopFocusObserver();
				signal.removeEventListener("abort", abort);
				card?.dispose();
			};
			cleanup = disposeView;
			card = new AskCard(question, tui, theme, keybindings, finish);
			if (tui.mode === "fullscreen") stopFocusObserver = observeTerminalFocus(focusInput, () => card.invalidateInputOrigin());
			signal.addEventListener("abort", abort, { once: true });
			if (signal.aborted) abort();
			return {
				wantsKeyRelease: true,
				get focused() { return card.focused; },
				set focused(value: boolean) { card.focused = value; },
				render: (width: number) => settled ? [] : card.render(width),
				handleInput: (data: string) => { if (!settled) card.handleInput(data); },
				handleMouse: (event: TuiMouseEvent) => settled ? undefined : card.handleMouse(event),
				invalidate: () => card.invalidate(),
				dispose: () => { card.dispose(); finish(outcome(question, "unavailable", null, "ui_disposed")); },
			};
		});
	} finally {
		// Also cover host setup throws, rejected custom UI, or a lost result.
		// Those paths may never call the component's disposer or our done().
		cleanup();
	}
}

export default function hogAskExtension(pi: ExtensionAPI) {
	const interactions = createInteractions(presentTui);
	// Close before navigation UI takes ownership, and also on actual replacement /
	// reload / shutdown. Duplicate cleanup is harmless. No prose-triggered hooks.
	for (const event of ["session_before_switch", "session_before_fork", "session_before_tree", "session_tree", "session_shutdown", "session_start"] as const) {
		pi.on(event, () => { interactions.invalidate(event); });
	}
	pi.registerTool({
		name: "hog_ask",
		label: "Decision / approval",
		description: "Ask one deliberate decision or named approval, with custom text, optional notes, review and explicit submission. Not a task selector. Decisions require 2–4 alternatives; approvals require scope and omit options/recommendation. Text fields are bounded; answers max 2000 characters, notes max 1000, at most 32 lines. Returns answered, needs_discussion, dismissed, unavailable or aborted, with question and response details. Only approved:true records approval of the exact named scope. No action is executed by this tool.",
		promptSnippet: "Ask one meaningful decision or named approval; ordinary conversation stays in prose",
		promptGuidelines: [
			"Use hog_ask deliberately for a genuine unresolved choice or named approval, after inspecting available evidence. Never turn required work, progress, acceptance criteria, or a fixed handoff menu into options. Plain conversation is the default and always valid.",
			"For hog_ask decisions offer non-overlapping alternatives and evidence-based tradeoffs. For approvals name the whole action/scope and relevant artifact revision; recommendations, focus, path mentions and unanswered questions are not approval.",
			"Wait for hog_ask's result before dependent actions. Never place tools that depend on its answer in the same assistant message. Dismissed, aborted or unavailable means no answer/approval: stop dependent work, do not automatically retry or assume consent. Unrelated already-running tools are not transactional.",
			"In hog_ask approvals, custom text or any nonempty note yields needs_discussion, not approval. Resolve the qualification before asking again for a revised scope. Only an explicit submitted approve with approved:true records approval; revise/pause do not. Do not auto-execute commands from an answer.",
		],
		parameters: AskSchema,
		executionMode: "sequential",
		async execute(_id, params, signal, _onUpdate, ctx) {
			// Revalidate cross-field invariants even after another tool_call hook mutates args.
			return interactions.run(normalizeQuestion(params), ctx, signal);
		},
	});
}
