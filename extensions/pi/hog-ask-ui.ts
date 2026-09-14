import {
	CURSOR_MARKER,
	Editor,
	decodeKittyPrintable,
	isKeyRelease,
	isKeyRepeat,
	Key,
	matchesKey,
	parseKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
	type EditorTheme,
	type TUI,
	type TuiMouseEvent,
	type TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import type { Theme, KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { createController, normalizeQuestion, outcome } from "./hog-ask-core.mjs";
import { answerLabel, optionDescription, optionLabel, sendLabel } from "./hog-ask-presentation.mjs";

type Question = ReturnType<typeof normalizeQuestion>;
type Result = ReturnType<typeof outcome>;
type EditorKind = "custom" | "note";
type ReviewActivation = "confirm" | "submit" | "ctrlEnter" | undefined;
type Target =
	| { kind: "option"; index: number }
	| { kind: "editor"; editor: EditorKind; y: number; height: number }
	| { kind: "action"; id: "back" | "send" | "dismiss" | "clear" | "review-note" };
type Region = { start: number; end: number; target: Target };
type RenderRow = { text: string; target?: Target; regions?: Region[] };
type PointerGesture = { target: string; revision: number; x: number; y: number; dragged: boolean };

// Pi 0.85.1 recognizes legacy function-key press spellings for bindings,
// while release/repeat classification accepts their extended event forms.
function bindingInput(data: string): string {
	return data.replace(/^(\x1b\[\d+);1:[123]~$/, "$1~");
}
function physicalKey(data: string): string | undefined {
	return parseKey(bindingInput(data))?.replace(/^(?:(?:ctrl|shift|alt|super|meta|hyper)\+)+/, "");
}

function targetKey(target: Target | undefined): string {
	if (!target) return "";
	if (target.kind === "option") return `option:${target.index}`;
	if (target.kind === "editor") return `editor:${target.editor}:${target.y}`;
	return `action:${target.id}`;
}

function stripUnfocusedCursor(line: string): string {
	return line.replace(/\x1b\[7m([\s\S]*?)\x1b\[0m/g, "$1");
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

/** Native, inline decision/approval card. Focus is never an answer. */
export class AskCard {
	readonly controller: ReturnType<typeof createController>;
	readonly editor: InlineEditor;
	readonly noteEditor: InlineEditor;
	readonly wantsKeyRelease = true;

	private chooseIndex = 0;
	private reviewIndex = 0;
	private scroll = 0;
	private pageSize = 10;
	private followFocus = true;
	private disposed = false;
	private _focused = false;
	private error = "";
	private returnFocus = 0;
	private hover = "";
	private renderedRows: RenderRow[] = [];
	private layoutSignature = "";
	private layoutRevision = 0;
	private pointer?: PointerGesture;
	private pointerTransitionGuard?: { x: number; y: number };
	private approvalReleasePending: ReviewActivation;
	private approvalOpeningKey?: string;
	private ignorePointerPress = false;
	private approvalEnterArmed = false;
	private legacyApprovalTabArmed = false;

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
		this.resetApprovalGuard();
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
	private get entry() { return this.controller.state.step === "choose" || this.controller.state.step === "custom"; }
	private get feedbackPending() { return this.approval && this.editor.getExpandedText().trim().length > 0; }
	private get reviewTargets() { return this.approval ? 2 : 3; }

	private syncFocus() {
		this.editor.focused = this._focused && this.entry && this.chooseIndex === this.question.options.length;
		this.noteEditor.focused = this._focused && !this.approval && !this.entry && this.reviewIndex === 1;
	}

	private refresh(followFocus = true) {
		this.followFocus = followFocus;
		this.syncFocus();
		this.invalidate();
		if (!this.disposed) this.tui.requestRender();
	}

	private matches(data: string, action: Parameters<KeybindingsManager["matches"]>[1]) {
		// Event type is always classified from original bytes before matching.
		return this.keybindings.matches(bindingInput(data), action);
	}

	private keys(action: Parameters<KeybindingsManager["getKeys"]>[0]) {
		return this.keybindings.getKeys(action)[0] || "unbound";
	}

	private finish(result: Result) {
		if (this.disposed) return;
		this.dispose();
		this.done(result);
	}

	private resetApprovalGuard() {
		this.approvalReleasePending = undefined;
		this.approvalOpeningKey = undefined;
		this.approvalEnterArmed = false;
		this.legacyApprovalTabArmed = false;
	}

	private beginApprovalReview(opening: ReviewActivation, data?: string) {
		this.approvalEnterArmed = false;
		this.approvalReleasePending = opening;
		this.approvalOpeningKey = data ? physicalKey(data) : undefined;
		this.legacyApprovalTabArmed = false;
	}

	private focusEntry(index: number) {
		const next = Math.max(0, Math.min(this.question.options.length, index));
		if (next === this.question.options.length) {
			if (this.controller.state.step !== "custom") this.controller.custom();
		} else if (this.controller.state.step === "custom") {
			this.controller.back();
		}
		this.chooseIndex = next;
		this.error = "";
		this.refresh();
	}

	private focusReview(index: number) {
		const next = Math.max(0, Math.min(this.reviewTargets - 1, index));
		if (!this.approval && next === 1) {
			if (this.controller.state.step !== "note") {
				this.controller.editNote();
				const note = this.controller.state.textDraft;
				if (this.noteEditor.getExpandedText() !== note) this.noteEditor.setText(note);
			}
		} else if (this.controller.state.step === "note") {
			if (!this.saveNote()) return;
		}
		this.reviewIndex = next;
		this.error = "";
		this.refresh();
	}

	private saveNote() {
		if (this.controller.state.step !== "note") return true;
		if (!this.controller.saveText(this.noteEditor.getExpandedText())) {
			this.error = this.controller.state.error;
			this.refresh();
			return false;
		}
		return true;
	}

	private reviewCustom(opening: ReviewActivation, data: string) {
		if (this.controller.state.step !== "custom") this.controller.custom();
		if (!this.controller.saveText(this.editor.getExpandedText())) {
			this.error = this.controller.state.error;
			this.chooseIndex = this.question.options.length;
			this.refresh();
			return;
		}
		this.error = "";
		this.returnFocus = this.question.options.length;
		this.reviewIndex = 0;
		// Saving a custom answer creates a new committed answer with no note.
		// The rendered note must match what Send would actually submit.
		if (!this.approval && this.noteEditor.getExpandedText() !== this.controller.state.answer!.note) {
			this.noteEditor.setText(this.controller.state.answer!.note);
		}
		if (this.approval) this.beginApprovalReview(opening, data);
		this.scroll = 0;
		this.refresh();
	}

	private chooseOption(index: number, openingData?: string) {
		const option = this.question.options[index];
		if (!option) return;
		if (this.approval && option.id === "revise") {
			this.focusEntry(this.question.options.length);
			return;
		}
		if (this.approval && option.id === "approve" && this.feedbackPending) {
			this.error = "Clear your feedback before approving as written.";
			this.focusEntry(this.question.options.length);
			return;
		}
		const previous = this.controller.state.answer;
		this.controller.choose(option.id);
		if (!this.approval) {
			const note = this.controller.state.answer?.note ?? "";
			if (previous?.kind !== "option" || previous.optionId !== option.id || this.noteEditor.getExpandedText() !== note) {
				this.noteEditor.setText(note);
			}
		}
		this.error = "";
		this.returnFocus = index;
		this.reviewIndex = 0;
		if (this.approval) this.beginApprovalReview(openingData ? "confirm" : undefined, openingData);
		this.scroll = 0;
		this.refresh();
	}

	private clearFeedback() {
		if (!this.approval) return;
		if (this.controller.state.step !== "custom") this.controller.custom();
		this.editor.setText("");
		this.error = "";
		this.chooseIndex = this.question.options.length;
		this.refresh();
	}

	private backToEntry() {
		if (this.controller.state.step === "note") {
			if (!this.saveNote()) return;
		}
		if (this.controller.state.step === "review") this.controller.back();
		this.resetApprovalGuard();
		this.chooseIndex = this.returnFocus;
		if (this.chooseIndex === this.question.options.length && this.controller.state.step !== "custom") this.controller.custom();
		this.reviewIndex = 0;
		this.error = "";
		this.scroll = 0;
		this.refresh();
	}

	private submit() {
		if (this.controller.state.step !== "review" || this.error) return;
		this.finish(this.controller.submit());
	}

	private activateReviewFocus() {
		if (this.reviewIndex === 0) this.backToEntry();
		else if (this.reviewIndex === 1) this.focusReview(1);
		else this.submit();
	}

	private typeToEditor(data: string) {
		this.focusEntry(this.question.options.length);
		this.editor.handleInput(data);
		this.refresh();
	}

	private isTyping(data: string) {
		return data.includes("\x1b[200~") || /^[^\x00-\x1f\x7f-\x9f]+$/u.test(data) || decodeKittyPrintable(data) !== undefined;
	}

	handleInput(data: string) {
		if (this.disposed) return;
		if (data === "\x1b[I" || data === "\x1b[O") { this.invalidateInputOrigin(); return; }
		if (!this._focused) return;

		const released = isKeyRelease(data);
		const repeated = isKeyRepeat(data);
		if (released) {
			// Modifiers can be released first: Ctrl+Enter may produce an ordinary
			// Enter release. Match the opening key itself, not the modifier state.
			const openingReleased = this.approvalOpeningKey ? physicalKey(data) === this.approvalOpeningKey
				: this.approvalReleasePending === "confirm" ? this.matches(data, "tui.select.confirm")
				: this.approvalReleasePending === "submit" ? this.matches(data, "tui.input.submit")
				: this.approvalReleasePending === "ctrlEnter" && matchesKey(data, Key.ctrl("enter"));
			if (this.approval && !this.entry && openingReleased) {
				this.approvalReleasePending = undefined;
				this.approvalOpeningKey = undefined;
				this.approvalEnterArmed = true;
				this.legacyApprovalTabArmed = false;
				this.refresh(false);
			}
			return;
		}
		// Repeated activation must not cross a stage boundary. Native editing and
		// navigation repeats are still useful (held arrows/backspace/characters).
		if (repeated && (this.matches(data, "tui.select.confirm") || this.matches(data, "tui.input.submit") || matchesKey(data, Key.ctrl("enter")) || this.matches(data, "tui.input.tab") || matchesKey(data, Key.tab) || matchesKey(data, Key.shift("tab")))) return;
		if (!repeated) this.pointerTransitionGuard = undefined;

		if (this.matches(data, "tui.select.pageUp") || this.matches(data, "tui.select.pageDown")) {
			this.scroll = Math.max(0, this.scroll + (this.matches(data, "tui.select.pageUp") ? -this.pageSize : this.pageSize));
			this.refresh(false);
			return;
		}

		// The host clear-editor action (Ctrl+C by default) dismisses this dialog,
		// including an invalid draft. Escape/app.interrupt still means Back.
		if (this.matches(data, "app.clear")) {
			this.finish(outcome(this.question, "dismissed"));
			return;
		}
		if (this.matches(data, "tui.select.cancel") || this.matches(data, "app.interrupt")) {
			if (this.entry && this.chooseIndex === this.question.options.length) {
				if (this.controller.state.step === "custom") this.controller.back();
				this.chooseIndex = this.question.options.length - 1;
				this.error = "";
				this.refresh();
			} else if (!this.entry && !this.approval && this.reviewIndex === 1) {
				if (this.saveNote()) this.focusReview(0);
			} else if (!this.entry) this.backToEntry();
			else this.finish(outcome(this.question, "dismissed"));
			return;
		}

		const tab = this.matches(data, "tui.input.tab") || matchesKey(data, Key.tab);
		const shiftTab = matchesKey(data, Key.shift("tab"));
		if (tab || shiftTab) {
			if (this.entry) {
				const count = this.question.options.length + 1;
				this.focusEntry((this.chooseIndex + (shiftTab ? -1 : 1) + count) % count);
			} else if (!this.approval) {
				this.focusReview((this.reviewIndex + (shiftTab ? -1 : 1) + this.reviewTargets) % this.reviewTargets);
			} else {
				this.legacyApprovalTabArmed = true;
				this.refresh(false);
			}
			return;
		}

		if (this.entry) {
			const inEditor = this.chooseIndex === this.question.options.length;
			if (this.approval && this.feedbackPending && !inEditor && this.matches(data, "tui.editor.deleteToLineStart")) {
				this.clearFeedback();
				return;
			}
			if (inEditor) {
				if (this.matches(data, "tui.select.up")) {
					const cursor = this.editor.getCursor();
					if (cursor.line === 0 && cursor.col === 0) this.focusEntry(this.question.options.length - 1);
					else { this.editor.handleInput(data); this.refresh(); }
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
					this.reviewCustom(this.matches(data, "tui.select.confirm") ? "confirm" : this.matches(data, "tui.input.submit") ? "submit" : "ctrlEnter", data);
					return;
				}
				this.editor.handleInput(data);
				this.refresh();
				return;
			}

			if (this.matches(data, "tui.select.up") || this.matches(data, "tui.select.down")) {
				const delta = this.matches(data, "tui.select.up") ? -1 : 1;
				const next = Math.max(0, Math.min(this.question.options.length, this.chooseIndex + delta));
				if (next === this.chooseIndex) {
					this.scroll = Math.max(0, this.scroll + delta * this.pageSize);
					this.refresh(false);
				} else this.focusEntry(next);
				return;
			}
			if (this.matches(data, "tui.select.confirm")) {
				this.chooseOption(this.chooseIndex, data);
				return;
			}
			if (this.isTyping(data)) {
				this.typeToEditor(data);
				return;
			}
			return;
		}

		if (!this.approval && this.reviewIndex === 1) {
			if (this.matches(data, "tui.input.newLine")) this.noteEditor.insertTextAtCursor("\n");
			else if (this.matches(data, "tui.input.submit") || matchesKey(data, Key.ctrl("enter"))) {
				if (this.saveNote()) this.focusReview(0);
				return;
			} else this.noteEditor.handleInput(data);
			this.refresh();
			return;
		}

		if (!this.approval && matchesKey(data, Key.ctrl("enter"))) {
			this.submit();
			return;
		}
		if (this.matches(data, "tui.select.up") || this.matches(data, "tui.select.down")) {
			const delta = this.matches(data, "tui.select.up") ? -1 : 1;
			const next = Math.max(0, Math.min(this.reviewTargets - 1, this.reviewIndex + delta));
			// Fullscreen owns PageUp/Down for transcript scrolling. Approval arrows
			// scroll directly; decision arrows scroll at the review-focus edges.
			if (this.approval || next === this.reviewIndex) {
				this.scroll = Math.max(0, this.scroll + delta * this.pageSize);
				this.refresh(false);
			} else this.focusReview(next);
			return;
		}
		if (this.matches(data, "tui.select.confirm")) {
			if (!this.approval) {
				this.activateReviewFocus();
				return;
			}
			if (this.approvalEnterArmed || this.legacyApprovalTabArmed) {
				this.submit();
			} else {
				// A press without a proven relevant release cannot authorize. Its
				// eventual release may arm the next fresh press.
				this.approvalReleasePending = "confirm";
				this.approvalOpeningKey = physicalKey(data);
				this.legacyApprovalTabArmed = false;
				this.refresh(false);
			}
		}
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

	private styleTargetRows(rows: RenderRow[], start: number, width: number, focused: boolean, hovered: boolean) {
		for (let i = start; i < rows.length; i++) {
			if (focused) {
				const padding = " ".repeat(Math.max(0, width - visibleWidth(rows[i]!.text)));
				rows[i]!.text = this.theme.bg("selectedBg", rows[i]!.text + padding);
			} else if (hovered) {
				rows[i]!.text = this.theme.fg("muted", rows[i]!.text);
			}
		}
	}

	private renderHeader(rows: RenderRow[], width: number, review: boolean) {
		this.addWrapped(rows, `${this.question.title} · ${review ? "Review" : this.approval ? "Approval" : "Choose one"}`, width, "muted");
		this.addWrapped(rows, this.question.question, width, "text", undefined, true);
		if (this.question.context) this.addWrapped(rows, this.question.context, width, "muted");
		if (this.question.scope) {
			rows.push({ text: "" });
			this.addWrapped(rows, "Scope", width, "muted");
			this.addWrapped(rows, this.question.scope.action, width, "text");
			const meta = [this.question.scope.artifactPath, this.question.scope.revision].filter(Boolean).join(" · ");
			if (meta) this.addWrapped(rows, meta, width, "muted");
		}
	}

	private renderEditor(rows: RenderRow[], editor: InlineEditor, kind: EditorKind, width: number) {
		const rendered = editor.render(width);
		for (let y = 0; y < rendered.length; y++) rows.push({ text: rendered[y]!, target: { kind: "editor", editor: kind, y, height: rendered.length } });
	}

	private renderEntry(width: number): { rows: RenderRow[]; focusLine: number } {
		const rows: RenderRow[] = [];
		this.renderHeader(rows, width, false);
		rows.push({ text: "" });
		let focusLine = 0;
		for (let index = 0; index < this.question.options.length; index++) {
			const option = this.question.options[index]!;
			const focused = this.chooseIndex === index;
			const hovered = this.hover === `option:${index}`;
			const start = rows.length;
			if (focused) focusLine = start;
			const recommendation = this.question.recommendation?.optionId === option.id ? " · recommended" : "";
			this.addWrapped(rows, `${focused ? "›" : hovered ? "·" : " "} ${optionLabel(this.question, option)}${recommendation}`, width, focused ? "accent" : "text", { kind: "option", index }, true);
			this.addWrapped(rows, `  ${this.approval && option.id === "approve" && this.feedbackPending ? "Clear your feedback first." : optionDescription(this.question, option)}`, width, focused ? "text" : "muted", { kind: "option", index });
			if (this.question.recommendation?.optionId === option.id && this.question.recommendation.reason !== option.description) {
				this.addWrapped(rows, `  Why: ${this.question.recommendation.reason}`, width, focused ? "text" : "muted", { kind: "option", index });
			}
			this.styleTargetRows(rows, start, width, focused, hovered);
		}
		rows.push({ text: "" });
		const editorStart = rows.length;
		this.editor.hovered = this.hover.startsWith("editor:custom");
		this.renderEditor(rows, this.editor, "custom", width);
		if (this.chooseIndex === this.question.options.length) {
			const cursor = rows.findIndex((row, index) => index >= editorStart && row.text.includes(CURSOR_MARKER));
			focusLine = cursor >= 0 ? cursor : editorStart;
		}
		if (this.error) {
			this.addWrapped(rows, this.error, width, "error");
			focusLine = rows.length - 1;
		}
		return { rows, focusLine };
	}

	private renderReview(width: number): { rows: RenderRow[]; focusLine: number } {
		const rows: RenderRow[] = [];
		this.renderHeader(rows, width, true);
		rows.push({ text: "" });
		const answer = this.controller.state.answer!;
		this.addWrapped(rows, answerLabel(this.question, answer), width, "muted");
		if (answer.kind === "custom" || !this.approval) this.addWrapped(rows, answer.kind === "custom" ? answer.text : answer.label, width, "text", undefined, true);
		let focusLine = rows.length - 1;
		if (!this.approval) {
			rows.push({ text: "" });
			const start = rows.length;
			this.noteEditor.hovered = this.hover.startsWith("editor:note");
			this.renderEditor(rows, this.noteEditor, "note", width);
			if (this.reviewIndex === 1) {
				const cursor = rows.findIndex((row, index) => index >= start && row.text.includes(CURSOR_MARKER));
				focusLine = cursor >= 0 ? cursor : start;
			}
		}
		if (this.error) {
			this.addWrapped(rows, this.error, width, "error");
			focusLine = rows.length - 1;
		}
		return { rows, focusLine };
	}

	private footerActions(): Array<{ key: string; label: string; id: "back" | "send" | "dismiss" | "clear" | "review-note" }> {
		if (this.entry) {
			const actions: Array<{ key: string; label: string; id: "dismiss" | "clear" }> = [{ key: this.keys("tui.select.cancel"), label: this.chooseIndex === this.question.options.length ? "back to options" : "dismiss", id: "dismiss" }];
			if (this.feedbackPending) actions.push({ key: `${this.chooseIndex === this.question.options.length ? this.keys("tui.select.cancel") + " then " : ""}${this.keys("tui.editor.deleteToLineStart")}`, label: "clear feedback", id: "clear" });
			return actions;
		}
		if (this.approval) {
			const answer = this.controller.state.answer!;
			const armed = this.approvalEnterArmed || this.legacyApprovalTabArmed;
			const key = `${armed ? "" : this.keys("tui.input.tab") + " then "}${this.keys("tui.select.confirm")}`;
			return [{ key, label: sendLabel(this.question, answer), id: "send" }, { key: this.keys("tui.select.cancel"), label: "back", id: "back" }];
		}
		return [
			{ key: this.keys(this.reviewIndex === 1 ? "tui.input.submit" : "tui.select.confirm"), label: this.reviewIndex === 0 ? "back" : this.reviewIndex === 1 ? "review note" : sendLabel(this.question, this.controller.state.answer!), id: this.reviewIndex === 2 ? "send" : this.reviewIndex === 1 ? "review-note" : "back" },
			{ key: "Ctrl+Enter", label: sendLabel(this.question, this.controller.state.answer!), id: "send" },
			{ key: this.keys("tui.select.cancel"), label: "back", id: "back" },
		];
	}

	private renderActionRows(width: number): RenderRow[] {
		const rows: RenderRow[] = [];
		const hints = this.entry
			? [`${this.keys("tui.select.up")}/${this.keys("tui.select.down")}/${this.keys("tui.input.tab")} move`, `${this.keys(this.chooseIndex === this.question.options.length ? "tui.input.submit" : "tui.select.confirm")} review`, `${this.keys("tui.input.newLine")} new line`]
			: this.approval
				? []
				: [`${this.keys("tui.select.up")}/${this.keys("tui.select.down")}/${this.keys("tui.input.tab")} move`];
		let hintLine = "";
		for (const hint of hints) {
			const next = hintLine ? `${hintLine} · ${hint}` : hint;
			if (hintLine && visibleWidth(next) > width) {
				rows.push({ text: this.theme.fg("dim", truncateToWidth(hintLine, width, "")) });
				hintLine = hint;
			} else hintLine = next;
		}
		if (hintLine) rows.push({ text: this.theme.fg("dim", truncateToWidth(hintLine, width, "")) });

		let plain = "";
		let regions: Region[] = [];
		const flush = () => {
			if (!plain) return;
			rows.push({ text: this.theme.fg("dim", truncateToWidth(plain, width, "")), regions });
			plain = "";
			regions = [];
		};
		for (const action of this.footerActions()) {
			const chunk = `${action.key} ${action.label}`;
			const separator = plain ? " · " : "";
			if (plain && visibleWidth(plain + separator + chunk) > width) flush();
			const start = visibleWidth(plain);
			plain += (plain ? " · " : "") + chunk;
			const actualStart = start + (start ? 3 : 0);
			const end = Math.min(width, actualStart + visibleWidth(chunk));
			if (end > actualStart) regions.push({ start: actualStart, end, target: { kind: "action", id: action.id } });
		}
		flush();
		return rows.slice(0, 4);
	}

	render(width: number): string[] {
		if (width < 1 || this.disposed) return [];
		this.syncFocus();
		const content = this.entry ? this.renderEntry(width) : this.renderReview(width);
		const maxHeight = Math.max(6, this.tui.terminal.rows - 6);
		const actionRows = this.renderActionRows(width);
		let footerRows: RenderRow[] = [{ text: this.theme.fg("border", "─".repeat(width)) }, ...actionRows];
		let bodyHeight = Math.max(1, maxHeight - footerRows.length);
		let overflow = content.rows.length > bodyHeight;
		if (overflow) {
			footerRows = [{ text: this.theme.fg("border", "─".repeat(width)) }, { text: "" }, ...actionRows];
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
			footerRows[1] = { text: this.theme.fg("dim", truncateToWidth(`↑${this.scroll} ↓${Math.max(0, content.rows.length - this.scroll - bodyHeight)} · ${scrollKeys} scroll`, width, "")) };
		}
		this.renderedRows = [...visible, ...footerRows];
		const signature = `${width}|${this.entry ? "entry" : "review"}|${this.scroll}|${this.renderedRows.map((row) => targetKey(row.target) || row.regions?.map((region) => `${region.start}-${region.end}:${targetKey(region.target)}`).join(",") || "").join("|")}`;
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

	private activateMouseTarget(target: Target, event: TuiMouseEvent) {
		if (target.kind === "option") {
			this.chooseIndex = target.index;
			this.chooseOption(target.index);
			this.pointerTransitionGuard = { x: event.screenX, y: event.screenY };
			return;
		}
		if (target.kind === "editor") {
			if (target.editor === "custom") this.focusEntry(this.question.options.length);
			else this.focusReview(1);
			return;
		}
		if (target.id === "review-note") { if (this.saveNote()) this.focusReview(0); }
		else if (target.id === "back") this.backToEntry();
		else if (target.id === "dismiss") {
			if (this.entry && this.chooseIndex === this.question.options.length) this.focusEntry(this.question.options.length - 1);
			else this.finish(outcome(this.question, "dismissed"));
		} else if (target.id === "clear") this.clearFeedback();
		else if (target.id === "send") this.submit();
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
			// Pi setFocus toggles focused false/true even for the same owner.
			// Do not manufacture a blur during a gesture already owned by this card.
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
