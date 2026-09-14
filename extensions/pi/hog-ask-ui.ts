import {
	CURSOR_MARKER,
	Editor,
	decodeKittyPrintable,
	isKeyRelease,
	isKeyRepeat,
	Key,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
	type EditorTheme,
	type TUI,
	type TuiMouseEvent,
	type TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import type { Theme, KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { boundedText, createController, LIMITS, normalizeQuestion, outcome } from "./hog-ask-core.mjs";
import { answerLabel, optionDescription, optionLabel, sendLabel } from "./hog-ask-presentation.mjs";

type Question = ReturnType<typeof normalizeQuestion>;
type Result = ReturnType<typeof outcome>;
type EditorKind = "custom" | "note";
type ActionId = "back" | "send" | "dismiss" | "clear" | "note";
type Target =
	| { kind: "option"; index: number }
	| { kind: "custom" }
	| { kind: "editor"; editor: EditorKind; y: number; height: number }
	| { kind: "action"; id: ActionId };
type Region = { start: number; end: number; target: Target };
type RenderRow = { text: string; target?: Target; regions?: Region[] };
type PointerGesture = { target: string; revision: number; x: number; y: number; dragged: boolean };
type FooterSegment = { text: string; target?: Target };

// Pi 0.85.1 recognizes legacy function-key press spellings for bindings,
// while release/repeat classification accepts their extended event forms.
function bindingInput(data: string): string {
	return data.replace(/^(\x1b\[\d+);1:[123]~$/, "$1~");
}
function targetKey(target: Target | undefined): string {
	if (!target) return "";
	if (target.kind === "option") return `option:${target.index}`;
	if (target.kind === "custom") return "custom";
	if (target.kind === "editor") return `editor:${target.editor}:${target.y}`;
	return `action:${target.id}`;
}
function stripUnfocusedCursor(line: string): string {
	return line.replace(/\x1b\[7m([\s\S]*?)\x1b\[0m/g, "$1");
}
function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** A native Editor whose public border hooks make it read as one inline field. */
class InlineEditor extends Editor {
	caption: string;
	hovered = false;
	private color: (name: Parameters<Theme["fg"]>[0], text: string) => string;

	constructor(tui: TUI, theme: EditorTheme, caption: string, color: InlineEditor["color"]) {
		super(tui, theme, { paddingX: 2, autocompleteMaxVisible: 3 });
		this.caption = caption;
		this.color = color;
		this.disableSubmit = true;
	}

	protected renderTopBorder(width: number, hiddenLineCount: number): string {
		const suffix = hiddenLineCount ? ` · ↑ ${hiddenLineCount} more` : "";
		return this.color("muted", truncateToWidth(`${this.caption}${suffix}`, width, ""));
	}

	protected renderBottomBorder(width: number, hiddenLineCount: number): string {
		return hiddenLineCount ? this.color("dim", truncateToWidth(`↓ ${hiddenLineCount} more`, width, "")) : "";
	}

	render(width: number): string[] {
		const lines = super.render(width);
		if (lines.length > 1) {
			const prefix = this.color(this.focused || this.hovered ? "accent" : "dim", "› ");
			// Editor padding is public and fixed at two cells. Replacing those cells
			// keeps native cursor and mouse coordinates unchanged.
			lines[1] = lines[1]!.startsWith("  ") ? prefix + lines[1]!.slice(2) : lines[1]!;
		}
		return lines.map((line) => truncateToWidth(this.focused ? line : stripUnfocusedCursor(line), width, ""));
	}
}

/** Native, compact decision/approval card. Focus is never an answer. */
export class AskCard {
	readonly controller: ReturnType<typeof createController>;
	readonly editor: InlineEditor;
	readonly noteEditor: InlineEditor;
	readonly wantsKeyRelease = true;

	private chooseIndex = 0;
	private scroll = 0;
	private pageSize = 10;
	private followFocus = true;
	private disposed = false;
	private _focused = false;
	private error = "";
	private returnFocus = 0;
	private noteReturnsToCustom = false;
	private hover = "";
	private renderedRows: RenderRow[] = [];
	private layoutSignature = "";
	private layoutRevision = 0;
	private pointer?: PointerGesture;
	private pointerTransitionGuard?: { x: number; y: number };
	private ignorePointerPress = false;

	private question: Question;
	private tui: TUI;
	private theme: Theme;
	private keybindings: KeybindingsManager;
	private done: (result: Result) => void;

	constructor(question: Question, tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (result: Result) => void) {
		this.question = question;
		this.tui = tui;
		this.theme = theme;
		this.keybindings = keybindings;
		this.done = done;
		this.controller = createController(question);
		const editorTheme: EditorTheme = {
			borderColor: (text) => this.theme.fg("border", text),
			selectList: {
				selectedPrefix: (text) => this.theme.fg("accent", text),
				selectedText: (text) => this.theme.fg("accent", text),
				description: (text) => this.theme.fg("muted", text),
				scrollInfo: (text) => this.theme.fg("dim", text),
				noMatch: (text) => this.theme.fg("warning", text),
			},
		};
		const color = (name: Parameters<Theme["fg"]>[0], text: string) => this.theme.fg(name, text);
		this.editor = new InlineEditor(tui, editorTheme, question.purpose === "approval" ? "Changes or questions" : "Your answer", color);
		this.noteEditor = new InlineEditor(tui, editorTheme, "Note · optional", color);
		this.editor.onChange = () => {
			if (this.controller.state.step === "custom") this.controller.draft(this.editor.getExpandedText());
			this.error = "";
		};
		this.noteEditor.onChange = () => {
			if (this.controller.state.step === "note") this.controller.draft(this.noteEditor.getExpandedText());
			this.error = "";
		};
	}

	get focused() { return this._focused; }
	set focused(value: boolean) {
		const lost = this._focused && !value;
		this._focused = !this.disposed && value;
		if (lost) this.invalidateInputOrigin();
		else this.syncFocus();
	}

	/** Focus changes invalidate provenance; the activating click is not Send. */
	invalidateInputOrigin() {
		if (this.disposed) return;
		// Restart the visible review journey after focus changes, rather than
		// hiding a keyboard unlock behind Tab or an unobservable key release.
		this.backFromApprovalReview();
		this.pointer = undefined;
		this.ignorePointerPress = true;
		this.refresh(false);
	}

	invalidate() {
		this.editor.invalidate();
		this.noteEditor.invalidate();
	}

	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this._focused = false;
		this.editor.focused = false;
		this.noteEditor.focused = false;
		this.editor.onChange = undefined;
		this.editor.onSubmit = undefined;
		this.noteEditor.onChange = undefined;
		this.noteEditor.onSubmit = undefined;
		this.pointer = undefined;
	}

	private get approval() { return this.question.purpose === "approval"; }
	private get step() { return this.controller.state.step; }
	private get entry() { return this.step === "choose" || this.step === "custom"; }
	private get editingCustom() { return this.step === "custom"; }
	private get editingNote() { return !this.approval && this.step === "note"; }
	private get approvalReview() { return this.approval && this.step === "review"; }
	private get feedbackPending() { return this.approval && this.editor.getExpandedText().length > 0; }
	private get notePending() { return !this.approval && this.noteEditor.getExpandedText().length > 0; }

	private syncFocus() {
		this.editor.focused = this._focused && this.editingCustom;
		this.noteEditor.focused = this._focused && this.editingNote;
	}

	private refresh(followFocus = true) {
		this.followFocus = followFocus;
		this.syncFocus();
		this.invalidate();
		if (!this.disposed) this.tui.requestRender();
	}

	private matches(data: string, action: Parameters<KeybindingsManager["matches"]>[1]) {
		return this.keybindings.matches(bindingInput(data), action);
	}
	private keys(action: Parameters<KeybindingsManager["getKeys"]>[0]) {
		const key = this.keybindings.getKeys(action)[0] || "unbound";
		return key === "up" ? "↑" : key === "down" ? "↓" : key === "escape" ? "esc" : key;
	}
	private finish(result: Result) {
		if (this.disposed) return;
		this.dispose();
		this.done(result);
	}

	private focusEntry(index: number) {
		const next = Math.max(0, Math.min(this.question.options.length, index));
		if (next === this.question.options.length) {
			if (this.step !== "custom") this.controller.custom();
		} else if (this.step === "custom") {
			this.controller.back();
		}
		this.chooseIndex = next;
		this.error = "";
		this.refresh();
	}

	private leaveCustom() {
		if (!this.editingCustom) return;
		this.controller.back();
		this.chooseIndex = this.approval ? this.question.options.findIndex((option) => option.id === "revise") : this.question.options.length;
		this.error = "";
		this.refresh();
	}

	private currentAnswerName(): string {
		if (this.chooseIndex < this.question.options.length) {
			const option = this.question.options[this.chooseIndex]!;
			return optionLabel(this.question, option);
		}
		return this.editor.getExpandedText().trim() || "custom answer";
	}

	private answerName(): string {
		const answer = this.controller.state.answer;
		if (!answer) return this.currentAnswerName();
		return answer.kind === "custom" ? answer.text : answer.label;
	}

	private setNoteCaption() {
		this.noteEditor.caption = `Note for: ${this.answerName()} · optional`;
	}

	private noteValidationError(): string {
		try {
			boundedText(this.noteEditor.getExpandedText(), "note", LIMITS.note, true);
			return "";
		} catch (error) {
			return errorText(error);
		}
	}

	private enterNote(returnToCustom: boolean) {
		if (this.controller.state.step !== "review" || !this.controller.state.answer) return;
		this.returnFocus = returnToCustom ? this.question.options.length : this.chooseIndex;
		this.noteReturnsToCustom = returnToCustom;
		this.setNoteCaption();
		this.controller.editNote();
		this.controller.draft(this.noteEditor.getExpandedText());
		this.error = "";
		this.scroll = 0;
		this.refresh();
	}

	private returnFromNote() {
		if (!this.editingNote) return;
		// Leaving note entry is deliberately non-validating: even an invalid draft
		// remains in the native Editor and is called out beside the next answer.
		this.controller.back();
		this.controller.back();
		this.chooseIndex = this.returnFocus;
		if (this.noteReturnsToCustom) this.controller.custom();
		this.error = "";
		this.scroll = 0;
		this.refresh();
	}

	private savePendingNote(): boolean {
		if (!this.notePending) return true;
		if (this.controller.state.step !== "review") return false;
		this.setNoteCaption();
		this.controller.editNote();
		if (!this.controller.saveText(this.noteEditor.getExpandedText())) {
			this.error = this.controller.state.error;
			this.refresh();
			return false;
		}
		return true;
	}

	private submitStagedOrdinary() {
		if (this.approval || this.controller.state.step !== "review") return;
		if (!this.savePendingNote()) return;
		this.error = "";
		this.finish(this.controller.submit());
	}

	private submitOption(index: number) {
		const option = this.question.options[index];
		if (!option || this.approval) return;
		this.controller.choose(option.id);
		this.returnFocus = index;
		this.noteReturnsToCustom = false;
		this.setNoteCaption();
		this.submitStagedOrdinary();
	}

	private openNoteForCurrent() {
		if (this.approval || !this.entry) return;
		if (this.editingCustom) {
			if (!this.controller.saveText(this.editor.getExpandedText())) {
				this.error = this.controller.state.error;
				this.refresh();
				return;
			}
			this.enterNote(true);
			return;
		}
		const option = this.question.options[this.chooseIndex];
		if (!option) {
			this.focusEntry(this.question.options.length);
			return;
		}
		this.controller.choose(option.id);
		this.returnFocus = this.chooseIndex;
		this.enterNote(false);
	}

	private submitCustomOrdinary() {
		if (this.approval || !this.editingCustom) return;
		if (!this.controller.saveText(this.editor.getExpandedText())) {
			this.error = this.controller.state.error;
			this.refresh();
			return;
		}
		this.returnFocus = this.question.options.length;
		this.noteReturnsToCustom = true;
		this.setNoteCaption();
		this.submitStagedOrdinary();
	}

	private submitNote() {
		if (!this.editingNote) return;
		if (!this.controller.saveText(this.noteEditor.getExpandedText())) {
			this.error = this.controller.state.error;
			this.refresh();
			return;
		}
		this.error = "";
		this.finish(this.controller.submit());
	}

	private reviewCustom() {
		if (!this.approval) return;
		if (this.controller.state.step !== "custom") this.controller.custom();
		if (!this.controller.saveText(this.editor.getExpandedText())) {
			this.error = this.controller.state.error;
			this.chooseIndex = this.question.options.length;
			this.refresh();
			return;
		}
		this.error = "";
		this.returnFocus = this.question.options.length;
		this.scroll = 0;
		this.refresh();
	}

	private chooseApprovalOption(index: number) {
		const option = this.question.options[index];
		if (!option || !this.approval) return;
		if (option.id === "revise") {
			this.focusEntry(this.question.options.length);
			return;
		}
		if (option.id === "approve" && this.feedbackPending) {
			this.error = "Clear your feedback before approving as written.";
			this.focusEntry(this.question.options.length);
			return;
		}
		this.controller.choose(option.id);
		this.error = "";
		this.returnFocus = index;
		this.scroll = 0;
		this.refresh();
	}

	private chooseOption(index: number) {
		if (this.approval) this.chooseApprovalOption(index);
		else this.submitOption(index);
	}

	private clearFeedback() {
		if (!this.approval) return;
		if (this.controller.state.step !== "custom") this.controller.custom();
		this.editor.setText("");
		this.error = "";
		this.chooseIndex = this.question.options.length;
		this.refresh();
	}

	private backFromApprovalReview() {
		if (!this.approvalReview) return;
		this.controller.back();
		this.chooseIndex = this.returnFocus;
		if (this.chooseIndex === this.question.options.length) this.controller.custom();
		this.error = "";
		this.scroll = 0;
		this.refresh();
	}

	private submitApproval() {
		if (!this.approvalReview || this.error) return;
		this.finish(this.controller.submit());
	}

	private typeToEditor(data: string) {
		this.focusEntry(this.question.options.length);
		this.editor.handleInput(data);
		this.refresh();
	}
	private isTyping(data: string) {
		return data.includes("\x1b[200~") || /^[^\x00-\x1f\x7f-\x9f]+$/u.test(data) || decodeKittyPrintable(data) !== undefined;
	}

	private activatePrimary() {
		if (this.editingNote) {
			this.submitNote();
			return;
		}
		if (this.entry) {
			if (this.editingCustom) {
				if (this.approval) this.reviewCustom();
				else this.submitCustomOrdinary();
				return;
			}
			if (this.chooseIndex === this.question.options.length) {
				this.focusEntry(this.chooseIndex);
				return;
			}
			this.chooseOption(this.chooseIndex);
			return;
		}
		if (this.approvalReview) this.submitApproval();
	}

	handleInput(data: string) {
		if (this.disposed) return;
		if (data === "\x1b[I" || data === "\x1b[O") { this.invalidateInputOrigin(); return; }
		if (!this._focused) return;

		if (isKeyRelease(data)) return;
		// Filter repeats when the transport reports them. Legacy CR does not
		// distinguish a held key from another press; no physical-release claim.
		const repeated = isKeyRepeat(data);
		if (repeated && (this.matches(data, "tui.select.confirm") || this.matches(data, "tui.input.submit") || matchesKey(data, Key.ctrl("enter")) || this.matches(data, "tui.input.tab") || matchesKey(data, Key.tab) || matchesKey(data, Key.shift("tab")))) return;
		if (!repeated) this.pointerTransitionGuard = undefined;

		if (this.matches(data, "tui.select.pageUp") || this.matches(data, "tui.select.pageDown")) {
			this.scroll = Math.max(0, this.scroll + (this.matches(data, "tui.select.pageUp") ? -this.pageSize : this.pageSize));
			this.refresh(false);
			return;
		}

		// Ctrl+C cancels even when a custom answer or note currently fails validation.
		if (this.matches(data, "app.clear")) {
			this.finish(outcome(this.question, "dismissed"));
			return;
		}
		if (this.matches(data, "tui.select.cancel") || this.matches(data, "app.interrupt")) {
			if (this.editingNote) this.returnFromNote();
			else if (this.editingCustom) this.leaveCustom();
			else if (this.approvalReview) this.backFromApprovalReview();
			else this.finish(outcome(this.question, "dismissed"));
			return;
		}

		const tab = this.matches(data, "tui.input.tab") || matchesKey(data, Key.tab);
		const shiftTab = matchesKey(data, Key.shift("tab"));
		if (tab || shiftTab) {
			if (this.editingNote) {
				this.returnFromNote();
			} else if (!this.approval && this.entry) {
				this.openNoteForCurrent();
			} else if (this.approval && this.entry && !this.editingCustom) {
				const count = this.question.options.length;
				this.focusEntry((this.chooseIndex + (shiftTab ? -1 : 1) + count) % count);
			}
			return;
		}

		if (this.entry) {
			if (this.approval && this.feedbackPending && !this.editingCustom && this.matches(data, "tui.editor.deleteToLineStart")) {
				this.clearFeedback();
				return;
			}
			if (this.editingCustom) {
				if (this.matches(data, "tui.select.up")) {
					const cursor = this.editor.getCursor();
					if (cursor.line === 0 && cursor.col === 0) {
						this.leaveCustom();
						if (!this.approval) this.focusEntry(this.question.options.length - 1);
					} else { this.editor.handleInput(data); this.refresh(); }
					return;
				}
				if (this.matches(data, "tui.select.down")) {
					this.editor.handleInput(data);
					this.refresh();
					return;
				}
				if (this.matches(data, "tui.input.newLine")) {
					this.editor.insertTextAtCursor("\n");
					this.refresh();
					return;
				}
				if (this.matches(data, "tui.input.submit") || matchesKey(data, Key.ctrl("enter"))) {
					this.activatePrimary();
					return;
				}
				this.editor.handleInput(data);
				this.refresh();
				return;
			}

			if (this.matches(data, "tui.select.up") || this.matches(data, "tui.select.down")) {
				const delta = this.matches(data, "tui.select.up") ? -1 : 1;
				const last = this.question.options.length - (this.approval ? 1 : 0);
				const next = Math.max(0, Math.min(last, this.chooseIndex + delta));
				if (next === this.chooseIndex) {
					this.scroll = Math.max(0, this.scroll + delta * this.pageSize);
					this.refresh(false);
				} else this.focusEntry(next);
				return;
			}
			if (this.matches(data, "tui.select.confirm")) {
				this.activatePrimary();
				return;
			}
			if (this.isTyping(data)) {
				this.typeToEditor(data);
				return;
			}
			return;
		}

		if (this.editingNote) {
			if (this.matches(data, "tui.input.newLine")) this.noteEditor.insertTextAtCursor("\n");
			else if (this.matches(data, "tui.input.submit") || matchesKey(data, Key.ctrl("enter"))) {
				this.submitNote();
				return;
			} else this.noteEditor.handleInput(data);
			this.refresh();
			return;
		}

		if (!this.approvalReview) return;
		if (this.matches(data, "tui.select.up") || this.matches(data, "tui.select.down")) {
			const delta = this.matches(data, "tui.select.up") ? -this.pageSize : this.pageSize;
			this.scroll = Math.max(0, this.scroll + delta);
			this.refresh(false);
			return;
		}
		if (this.matches(data, "tui.select.confirm")) this.submitApproval();
	}

	private wrap(text: string, width: number): string[] {
		return wrapTextWithAnsi(text, Math.max(1, width)).map((line) => truncateToWidth(line, width, ""));
	}

	private addWrapped(rows: RenderRow[], text: string, width: number, color: Parameters<Theme["fg"]>[0] = "text", target?: Target, bold = false) {
		for (const line of this.wrap(text, width)) {
			const styled = this.theme.fg(color, bold ? this.theme.bold(line) : line);
			rows.push({ text: truncateToWidth(styled, width, ""), target });
		}
	}

	private addPrefixed(rows: RenderRow[], prefix: string, text: string, width: number, color: Parameters<Theme["fg"]>[0], target?: Target, bold = false) {
		const prefixWidth = visibleWidth(prefix);
		if (prefixWidth >= width) {
			this.addWrapped(rows, prefix + text, width, color, target, bold);
			return;
		}
		const wrapped = this.wrap(text, width - prefixWidth);
		for (let index = 0; index < wrapped.length; index++) {
			const plain = `${index === 0 ? prefix : " ".repeat(prefixWidth)}${wrapped[index]}`;
			rows.push({ text: truncateToWidth(this.theme.fg(color, bold ? this.theme.bold(plain) : plain), width, ""), target });
		}
	}

	private renderHeader(rows: RenderRow[], width: number) {
		rows.push({ text: this.theme.fg("accent", "─".repeat(width)) });
		this.addPrefixed(rows, " ", this.question.question, width, "text", undefined, true);
		if (this.question.context) this.addPrefixed(rows, " ", this.question.context, width, "muted");
		if (this.question.scope) {
			rows.push({ text: "" });
			this.addPrefixed(rows, " ", "Scope", width, "muted");
			this.addPrefixed(rows, " ", this.question.scope.action, width, "text");
			const meta = [this.question.scope.artifactPath, this.question.scope.revision].filter(Boolean).join(" · ");
			if (meta) this.addPrefixed(rows, " ", meta, width, "muted");
		}
	}

	private renderEditor(rows: RenderRow[], editor: InlineEditor, kind: EditorKind, width: number) {
		const rendered = editor.render(width);
		for (let y = 0; y < rendered.length; y++) rows.push({ text: rendered[y]!, target: { kind: "editor", editor: kind, y, height: rendered.length } });
	}

	private renderCustomEditor(rows: RenderRow[], width: number): number {
		const start = rows.length;
		this.editor.hovered = this.hover.startsWith("editor:custom");
		this.renderEditor(rows, this.editor, "custom", width);
		if (!this.editingCustom) return start;
		const cursor = rows.findIndex((row, index) => index >= start && row.text.includes(CURSOR_MARKER));
		return cursor >= 0 ? cursor : start;
	}

	private renderEntry(width: number): { rows: RenderRow[]; focusLine: number } {
		const rows: RenderRow[] = [];
		this.renderHeader(rows, width);
		rows.push({ text: "" });
		let focusLine = 0;
		for (let index = 0; index < this.question.options.length; index++) {
			const option = this.question.options[index]!;
			const focused = !this.editingCustom && this.chooseIndex === index;
			const hovered = this.hover === `option:${index}`;
			if (focused) focusLine = rows.length;
			const recommendation = this.question.recommendation?.optionId === option.id ? " · recommended" : "";
			this.addPrefixed(rows, focused ? "> " : hovered ? "· " : "  ", `${index + 1}. ${optionLabel(this.question, option)}${recommendation}`, width, focused ? "accent" : "text", { kind: "option", index }, focused);
			const description = this.approval && option.id === "approve" && this.feedbackPending ? "Clear your feedback first." : optionDescription(this.question, option);
			this.addPrefixed(rows, "     ", description, width, "muted", { kind: "option", index });
			if (this.question.recommendation?.optionId === option.id && this.question.recommendation.reason !== option.description) {
				this.addPrefixed(rows, "     ", `Why: ${this.question.recommendation.reason}`, width, "muted", { kind: "option", index });
			}
			if (this.approval && option.id === "revise" && (this.editingCustom || this.editor.getExpandedText().length > 0)) {
				rows.push({ text: "" });
				const editorFocus = this.renderCustomEditor(rows, width);
				if (this.editingCustom) focusLine = editorFocus;
			}
		}

		if (!this.approval) {
			const focused = !this.editingCustom && this.chooseIndex === this.question.options.length;
			const hovered = this.hover === "custom";
			if (focused) focusLine = rows.length;
			const marker = focused ? "> " : hovered ? "· " : "  ";
			const suffix = this.editingCustom ? " ✎" : "";
			this.addPrefixed(rows, marker, `${this.question.options.length + 1}. Type something…${suffix}`, width, focused || this.editingCustom ? "accent" : "text", { kind: "custom" }, focused);
			if (this.editingCustom || this.editor.getExpandedText().length > 0) {
				rows.push({ text: "" });
				const editorFocus = this.renderCustomEditor(rows, width);
				if (this.editingCustom) focusLine = editorFocus;
			}
		}

		if (this.error) {
			this.addPrefixed(rows, " ", this.error, width, "error");
			focusLine = rows.length - 1;
		}
		return { rows, focusLine };
	}

	private renderNote(width: number): { rows: RenderRow[]; focusLine: number } {
		const rows: RenderRow[] = [];
		this.renderHeader(rows, width);
		rows.push({ text: "" });
		this.addPrefixed(rows, "> ", `Answer: ${this.answerName()}`, width, "accent", undefined, true);
		rows.push({ text: "" });
		this.noteEditor.hovered = this.hover.startsWith("editor:note");
		const start = rows.length;
		this.renderEditor(rows, this.noteEditor, "note", width);
		let focusLine = rows.findIndex((row, index) => index >= start && row.text.includes(CURSOR_MARKER));
		if (focusLine < 0) focusLine = start;
		if (this.error) {
			this.addPrefixed(rows, " ", this.error, width, "error");
			focusLine = rows.length - 1;
		}
		return { rows, focusLine };
	}

	private renderApprovalReview(width: number): { rows: RenderRow[]; focusLine: number } {
		const rows: RenderRow[] = [];
		this.renderHeader(rows, width);
		rows.push({ text: "" });
		const answer = this.controller.state.answer!;
		this.addPrefixed(rows, "> ", answerLabel(this.question, answer), width, "accent", undefined, true);
		if (answer.kind === "custom") this.addPrefixed(rows, "  ", answer.text, width, "text");
		if (this.error) this.addPrefixed(rows, " ", this.error, width, "error");
		return { rows, focusLine: rows.length - 1 };
	}

	private footerSegments(): FooterSegment[] {
		const action = (text: string, id: ActionId): FooterSegment => ({ text, target: { kind: "action", id } });
		if (this.editingNote) {
			return [
				action(`${this.keys("tui.input.submit")} send`, "send"),
				{ text: `${this.keys("tui.input.newLine")} new line` },
				action(`${this.keys("tui.input.tab")}/${this.keys("tui.select.cancel")} back`, "back"),
			];
		}
		if (this.entry) {
			if (this.editingCustom) {
				const segments: FooterSegment[] = [action(`${this.keys("tui.input.submit")} ${this.approval ? "review" : "send"}`, "send")];
				if (!this.approval) segments.push(action(`${this.keys("tui.input.tab")} add note`, "note"));
				segments.push({ text: `${this.keys("tui.input.newLine")} new line` }, action(`${this.keys("tui.select.cancel")} back`, "back"));
				return segments;
			}
			const atCustom = !this.approval && this.chooseIndex === this.question.options.length;
			const editsFeedback = this.approval && this.question.options[this.chooseIndex]?.id === "revise";
			const segments: FooterSegment[] = [
				{ text: `${this.keys("tui.select.up")}/${this.keys("tui.select.down")} choose` },
				action(`${this.keys("tui.select.confirm")} ${atCustom || editsFeedback ? "edit" : this.approval ? "review" : "send"}`, "send"),
			];
			if (!this.approval && !atCustom) segments.push(action(`${this.keys("tui.input.tab")} add note`, "note"));
			if (this.approval && this.feedbackPending) segments.push(action(`${this.keys("tui.editor.deleteToLineStart")} clear feedback`, "clear"));
			segments.push(action(`${this.keys("tui.select.cancel")} cancel`, "dismiss"));
			return segments;
		}
		const answer = this.controller.state.answer!;
		return [
			action(`${this.keys("tui.select.confirm")} ${sendLabel(this.question, answer)}`, "send"),
			action(`${this.keys("tui.select.cancel")} back`, "back"),
		];
	}

	private renderActionRows(width: number): RenderRow[] {
		const rows: RenderRow[] = [];
		if (this.entry && this.notePending) {
			const invalid = this.noteValidationError();
			const status = `Note draft · ${invalid ? "needs editing" : "ready"} · for: ${this.currentAnswerName()}`;
			rows.push({ text: this.theme.fg(invalid ? "warning" : "muted", truncateToWidth(status, width, "")) });
		}
		let plain = "";
		let regions: Region[] = [];
		const flush = () => {
			if (!plain) return;
			rows.push({ text: this.theme.fg("dim", truncateToWidth(plain, width, "")), regions });
			plain = "";
			regions = [];
		};
		for (const segment of this.footerSegments()) {
			const separator = plain ? " · " : "";
			if (plain && visibleWidth(plain + separator + segment.text) > width) flush();
			const actualSeparator = plain ? " · " : "";
			const start = visibleWidth(plain) + visibleWidth(actualSeparator);
			plain += actualSeparator + segment.text;
			const end = Math.min(width, start + visibleWidth(segment.text));
			if (segment.target && end > start) regions.push({ start, end, target: segment.target });
		}
		flush();
		return rows.slice(0, 4);
	}

	render(width: number): string[] {
		if (width < 1 || this.disposed) return [];
		this.syncFocus();
		const content = this.editingNote ? this.renderNote(width) : this.approvalReview ? this.renderApprovalReview(width) : this.renderEntry(width);
		const maxHeight = Math.max(6, this.tui.terminal.rows - 6);
		const actionRows = this.renderActionRows(width);
		let footerRows: RenderRow[] = [...(content.rows.at(-1)?.text ? [{ text: "" }] : []), ...actionRows, { text: this.theme.fg("accent", "─".repeat(width)) }];
		let bodyHeight = Math.max(1, maxHeight - footerRows.length);
		const overflow = content.rows.length > bodyHeight;
		if (overflow) {
			footerRows = [{ text: "" }, ...actionRows, { text: this.theme.fg("accent", "─".repeat(width)) }];
			bodyHeight = Math.max(1, maxHeight - footerRows.length);
		}
		this.pageSize = bodyHeight;
		if (this.followFocus) {
			if (content.focusLine < this.scroll) this.scroll = content.focusLine;
			else if (content.focusLine >= this.scroll + bodyHeight) this.scroll = content.focusLine - bodyHeight + 1;
		}
		this.followFocus = false;
		this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, content.rows.length - bodyHeight)));
		const visible = content.rows.slice(this.scroll, this.scroll + bodyHeight);
		if (overflow) {
			const scrollKeys = this.tui.mode === "fullscreen" ? `${this.keys("tui.select.up")}/${this.keys("tui.select.down")} at edges` : `${this.keys("tui.select.pageUp")}/${this.keys("tui.select.pageDown")}`;
			footerRows[0] = { text: this.theme.fg("dim", truncateToWidth(`↑${this.scroll} ↓${Math.max(0, content.rows.length - this.scroll - bodyHeight)} · ${scrollKeys} scroll`, width, "")) };
		}
		this.renderedRows = [...visible, ...footerRows];
		const signature = `${width}|${this.step}|${this.scroll}|${this.renderedRows.map((row) => targetKey(row.target) || row.regions?.map((region) => `${region.start}-${region.end}:${targetKey(region.target)}`).join(",") || "").join("|")}`;
		if (signature !== this.layoutSignature) {
			this.layoutSignature = signature;
			this.layoutRevision++;
		}
		return this.renderedRows.map((row) => truncateToWidth(row.text, width, ""));
	}

	private targetAt(event: TuiMouseEvent): Target | undefined {
		const row = this.renderedRows[event.y];
		if (!row) return undefined;
		for (const region of row.regions ?? []) if (event.x >= region.start && event.x < region.end) return region.target;
		return row.target;
	}
	private mouseEditor(target: Target & { kind: "editor" }) {
		return target.editor === "custom" ? this.editor : this.noteEditor;
	}
	private forwardEditorMouse(editor: InlineEditor, target: Target & { kind: "editor" }, event: TuiMouseEvent) {
		return editor.handleMouse({ ...event, y: target.y, height: target.height });
	}

	private activateBack() {
		if (this.editingNote) this.returnFromNote();
		else if (this.editingCustom) this.leaveCustom();
		else if (this.approvalReview) this.backFromApprovalReview();
	}

	private activateMouseTarget(target: Target, event: TuiMouseEvent) {
		if (target.kind === "option") {
			this.chooseIndex = target.index;
			this.chooseOption(target.index);
			this.pointerTransitionGuard = { x: event.screenX, y: event.screenY };
			return;
		}
		if (target.kind === "custom") {
			this.focusEntry(this.question.options.length);
			return;
		}
		if (target.kind === "editor") {
			if (target.editor === "custom") this.focusEntry(this.question.options.length);
			return;
		}
		if (target.id === "note") this.openNoteForCurrent();
		else if (target.id === "back") this.activateBack();
		else if (target.id === "dismiss") this.finish(outcome(this.question, "dismissed"));
		else if (target.id === "clear") this.clearFeedback();
		else if (target.id === "send") this.activatePrimary();
	}

	handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		if (this.disposed) return undefined;
		const target = this.targetAt(event);
		const key = targetKey(target);

		if (event.type === "move") {
			if (this.pointerTransitionGuard && (event.screenX !== this.pointerTransitionGuard.x || event.screenY !== this.pointerTransitionGuard.y)) this.pointerTransitionGuard = undefined;
			if (this.pointer && (event.screenX !== this.pointer.x || event.screenY !== this.pointer.y)) this.pointer.dragged = true;
			const nextHover = event.button === "none" ? key : this.hover;
			const changed = nextHover !== this.hover;
			this.hover = nextHover;
			if (changed) this.refresh(false);
			return changed ? { handled: true, render: true } : undefined;
		}
		if (event.type === "wheel") {
			const before = this.scroll;
			this.scroll = Math.max(0, this.scroll + (event.wheelDelta ?? 0));
			this.refresh(false);
			return { handled: true, render: before !== this.scroll };
		}
		if (event.type === "press" && event.button === "left") {
			if (this.ignorePointerPress) {
				this.ignorePointerPress = false;
				this.pointer = undefined;
				return { handled: true, capture: true };
			}
			if (this.pointerTransitionGuard && event.screenX === this.pointerTransitionGuard.x && event.screenY === this.pointerTransitionGuard.y) {
				this.pointer = undefined;
				return { handled: true, capture: true };
			}
			if (!target) return undefined;
			this.pointer = { target: key, revision: this.layoutRevision, x: event.screenX, y: event.screenY, dragged: false };
			if (target.kind === "editor") {
				// Native Editor intentionally leaves press/drag/release to fullscreen
				// selection. Its synthesized click below performs caret placement.
				return this.forwardEditorMouse(this.mouseEditor(target), target, event);
			}
			return { handled: true, capture: true, focus: !this._focused };
		}
		if (event.type === "drag") {
			if (this.pointer) this.pointer.dragged = true;
			if (target?.kind === "editor") return this.forwardEditorMouse(this.mouseEditor(target), target, event);
			return this.pointer ? { handled: true, capture: true } : undefined;
		}
		if (event.type === "release") {
			if (target?.kind === "editor") return this.forwardEditorMouse(this.mouseEditor(target), target, event);
			return this.pointer ? { handled: true } : undefined;
		}
		if (event.type !== "click" || event.button !== "left" || !target) return undefined;
		const pointer = this.pointer;
		this.pointer = undefined;
		if (!pointer || pointer.dragged || pointer.revision !== this.layoutRevision || pointer.target !== key || pointer.x !== event.screenX || pointer.y !== event.screenY || (event.clickCount ?? 1) > 1) {
			return { handled: true };
		}
		if (target.kind === "editor") {
			const result = this.forwardEditorMouse(this.mouseEditor(target), target, event);
			this.activateMouseTarget(target, event);
			return { ...result, handled: true, focus: !this._focused, render: true };
		}
		this.activateMouseTarget(target, event);
		// Submission has already restored the host editor. Never refocus a
		// disposed card after done() returns to the fullscreen dispatcher.
		return { handled: true, focus: !this.disposed && !this._focused, render: true };
	}
}
