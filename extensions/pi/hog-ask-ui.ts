import { Editor, CURSOR_MARKER, truncateToWidth, wrapTextWithAnsi, type TUI } from "@earendil-works/pi-tui";
import type { Theme, KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { answerText, createController, normalizeQuestion, outcome, questionText } from "./hog-ask-core.mjs";

type Question = ReturnType<typeof normalizeQuestion>;
type Result = ReturnType<typeof outcome>;

/** One temporary editor-area card. Focus, draft selection and submission differ. */
export class AskCard {
	readonly controller: ReturnType<typeof createController>;
	readonly editor: Editor;
	private chooseIndex = 0;
	private reviewIndex = 0;
	private scroll = 0;
	private followFocus = false;
	private pageSize = 10;
	private disposed = false;
	private _focused = false;

	private question: Question;
	private tui: TUI;
	private theme: Theme;
	private keybindings: KeybindingsManager;
	private done: (result: Result) => void;

	constructor(question: Question, tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (result: Result) => void) {
		this.question = question; this.tui = tui; this.theme = theme; this.keybindings = keybindings; this.done = done;
		this.controller = createController(question);
		this.editor = new Editor(tui, {
			borderColor: (s) => this.theme.fg("border", s),
			selectList: {
				selectedPrefix: (s) => this.theme.fg("accent", s), selectedText: (s) => this.theme.fg("accent", s),
				description: (s) => this.theme.fg("muted", s), scrollInfo: (s) => this.theme.fg("dim", s), noMatch: (s) => this.theme.fg("warning", s),
			},
		});
		// Native editing, paste expansion and IME; injected bindings own submission.
		this.editor.disableSubmit = true;
		this.editor.onChange = () => this.controller.draft(this.editor.getExpandedText());
	}
	get focused() { return this._focused; }
	set focused(value: boolean) { this._focused = !this.disposed && value; this.syncFocus(); }
	private syncFocus() { this.editor.focused = this._focused && ["custom", "note"].includes(this.controller.state.step); }
	invalidate() { this.editor.invalidate(); }
	dispose() {
		this.disposed = true; this._focused = false; this.editor.focused = false;
		this.editor.onChange = undefined; this.editor.onSubmit = undefined;
	}
	private refresh() { this.syncFocus(); this.invalidate(); if (!this.disposed) this.tui.requestRender(); }
	private matches(data: string, action: Parameters<KeybindingsManager["matches"]>[1]) { return this.keybindings.matches(data, action); }
	private keys(action: Parameters<KeybindingsManager["getKeys"]>[0]) { return this.keybindings.getKeys(action).join("/") || "unbound"; }
	private finish(result: Result) { if (!this.disposed) { this.dispose(); this.done(result); } }
	private openEditor(kind: "custom" | "note") {
		if (kind === "custom") this.controller.custom(); else this.controller.editNote();
		this.editor.setText(this.controller.state.textDraft);
		this.followFocus = true;
	}

	handleInput(data: string) {
		if (this.disposed) return;
		const state = this.controller.state;
		// Paging is available at every stage, including long approval scopes/notes.
		if (this.matches(data, "tui.select.pageUp") || this.matches(data, "tui.select.pageDown")) {
			this.scroll = Math.max(0, this.scroll + (this.matches(data, "tui.select.pageUp") ? -this.pageSize : this.pageSize));
			this.followFocus = false; this.refresh(); return;
		}
		if (this.matches(data, "tui.select.cancel") || this.matches(data, "app.interrupt")) {
			if (state.step === "custom" || state.step === "note") {
				this.controller.draft(this.editor.getExpandedText()); this.controller.back();
				this.reviewIndex = 0; this.scroll = 0; this.followFocus = false; this.refresh();
			} else this.finish(outcome(this.question, "dismissed"));
			return;
		}
		if (state.step === "custom" || state.step === "note") {
			if (this.matches(data, "tui.input.newLine")) this.editor.insertTextAtCursor("\n");
			else if (this.matches(data, "tui.input.submit")) {
				if (this.controller.saveText(this.editor.getExpandedText())) {
					this.reviewIndex = 0; this.scroll = 0; this.followFocus = false; this.refresh(); return;
				}
			} else this.editor.handleInput(data);
			this.followFocus = true; this.refresh(); return;
		}
		const count = state.step === "choose" ? this.question.options.length + 2 : 4;
		let index = state.step === "choose" ? this.chooseIndex : this.reviewIndex;
		if (this.matches(data, "tui.select.up") || this.matches(data, "tui.select.down")) {
			const delta = this.matches(data, "tui.select.up") ? -1 : 1;
			const next = Math.max(0, Math.min(count - 1, index + delta));
			// Pi fullscreen consumes PageUp/Down for its transcript. Arrow keys at
			// menu edges keep the entire scope/review reachable in that mode too.
			if (next === index) { this.scroll = Math.max(0, this.scroll + delta * this.pageSize); this.followFocus = false; }
			else this.followFocus = true;
			index = next;
			if (state.step === "choose") this.chooseIndex = index; else this.reviewIndex = index;
		} else if (this.matches(data, "tui.select.confirm")) {
			this.scroll = 0; this.followFocus = false;
			if (state.step === "choose") {
				if (index < this.question.options.length) { this.controller.choose(this.question.options[index].id); this.reviewIndex = 0; }
				else if (index === this.question.options.length) this.openEditor("custom");
				else this.finish(outcome(this.question, "dismissed"));
			} else {
				if (index === 0) this.controller.back();
				else if (index === 1) this.openEditor("note");
				else if (index === 2) this.finish(this.controller.submit());
				else this.finish(outcome(this.question, "dismissed"));
			}
		}
		this.refresh();
	}

	render(width: number): string[] {
		if (width < 1) return [];
		const lines: string[] = [];
		const wrap = (text: string) => wrapTextWithAnsi(text, width).map((line) => truncateToWidth(line, width, ""));
		const add = (text: string, color: Parameters<Theme["fg"]>[0] = "text") => lines.push(...wrap(this.theme.fg(color, text)));
		const state = this.controller.state;
		let focusLine = 0;
		add(questionText(this.question));
		add("");
		if (state.step === "choose") {
			add(state.answer ? "Draft selection retained; nothing submitted." : "No option selected. Review before sending.", "muted");
			this.question.options.forEach((option, index) => {
				if (index === this.chooseIndex) focusLine = lines.length;
				const marker = state.answer?.optionId === option.id ? "x" : " ";
				add(`${index === this.chooseIndex ? ">" : " "} (${marker}) ${option.label}${this.question.recommendation?.optionId === option.id ? " [recommended]" : ""}`, index === this.chooseIndex ? "accent" : "text");
				add(`    ${option.description}`, "muted");
			});
			["Write a different answer", "Dismiss"].forEach((label, offset) => {
				const focused = this.chooseIndex === this.question.options.length + offset;
				if (focused) focusLine = lines.length;
				add(`${focused ? ">" : " "} ${label}`, focused ? "accent" : "text");
			});
		} else if (state.step === "review") {
			add("Review answer — not yet submitted", "accent");
			add(answerText(state.answer));
			if (state.answer.kind === "option") add(this.question.options.find((o) => o.id === state.answer.optionId).description, "muted");
			if (!state.answer.note) add("Note: (none)", "muted");
			if (this.question.purpose === "approval") add(state.answer.kind === "custom" || state.answer.note ? "No approval granted: this answer needs discussion." : "Only Send records the selected response for this scope.", "warning");
			add("");
			["Back / change answer", "Add / edit note", "Send answer", "Dismiss"].forEach((label, index) => {
				if (index === this.reviewIndex) focusLine = lines.length;
				add(`${index === this.reviewIndex ? ">" : " "} ${label}`, index === this.reviewIndex ? "accent" : "text");
			});
		} else {
			add(state.step === "custom" ? "Write a different answer" : "Optional note (blank clears it)", "accent");
			focusLine = lines.length;
			for (const line of this.editor.render(width)) {
				if (line.includes(CURSOR_MARKER)) focusLine = lines.length;
				lines.push(truncateToWidth(line, width, ""));
			}
			if (state.error) { focusLine = lines.length; add(state.error, "error"); }
		}
		const editing = state.step === "custom" || state.step === "note";
		add("");
		add(editing
			? `${this.keys("tui.input.submit")} review · ${this.keys("tui.input.newLine")} new line · ${this.keys("tui.select.cancel")} back`
			: `${this.keys("tui.select.up")}/${this.keys("tui.select.down")} navigate · ${this.keys("tui.select.confirm")} choose · ${this.keys("tui.select.cancel")} dismiss`, "dim");
		const height = Math.max(4, this.tui.terminal.rows - 6);
		if (lines.length <= height) { this.scroll = 0; return lines; }
		const hint = wrap(this.theme.fg("dim", `${this.keys("tui.select.pageUp")}/${this.keys("tui.select.pageDown")} scroll${editing ? "" : ` · ${this.keys("tui.select.up")}/${this.keys("tui.select.down")} at menu ends also scroll`}`));
		this.pageSize = Math.max(1, height - Math.min(hint.length, height - 2) - 1);
		if (this.followFocus) {
			if (focusLine < this.scroll) this.scroll = focusLine;
			else if (focusLine >= this.scroll + this.pageSize) this.scroll = focusLine - this.pageSize + 1;
		}
		this.followFocus = false;
		this.scroll = Math.max(0, Math.min(this.scroll, lines.length - this.pageSize));
		return [
			...lines.slice(this.scroll, this.scroll + this.pageSize),
			truncateToWidth(this.theme.fg("dim", `↑ ${this.scroll} above · ↓ ${Math.max(0, lines.length - this.scroll - this.pageSize)} below`), width, ""),
			...hint.slice(0, height - this.pageSize - 1),
		];
	}
}
