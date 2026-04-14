import { complete, type Api, type Model, type UserMessage } from "@mariozechner/pi-ai";
import { BorderedLoader, type ExtensionAPI, type ExtensionContext, type ModelRegistry } from "@mariozechner/pi-coding-agent";
import {
	type Component,
	Editor,
	type EditorTheme,
	Key,
	matchesKey,
	truncateToWidth,
	type TUI,
	visibleWidth,
	wrapTextWithAnsi,
} from "@mariozechner/pi-tui";

type WorkflowName = "brainstorm" | "plan" | "architect";

type PromptKind = "none" | "single_choice" | "text";

type GuidedPrompt = {
	kind: Exclude<PromptKind, "none">;
	workflow: WorkflowName;
	question: string;
	context?: string;
	options?: { label: string; description?: string }[];
	answerInstruction?: string;
	confidence?: "high" | "medium" | "low";
};

type ExtractedPromptEnvelope =
	| { kind: "none"; reason?: string; confidence?: "high" | "medium" | "low" }
	| {
			kind: "single_choice" | "text";
			question: string;
			context?: string;
			options?: { label: string; description?: string }[];
			answerInstruction?: string;
			confidence?: "high" | "medium" | "low";
	  };

const WORKFLOW_PATTERNS: Array<{ workflow: WorkflowName; pattern: RegExp }> = [
	{ workflow: "brainstorm", pattern: /^\/(?:skill:brainstorm|brainstorm|deep-thought:brainstorm|deep-thought-brainstorm)\b/i },
	{ workflow: "plan", pattern: /^\/(?:skill:plan|plan|deep-thought:plan|deep-thought-plan)\b/i },
	{ workflow: "architect", pattern: /^\/(?:skill:architect|architect|deep-thought:architect|deep-thought-architect)\b/i },
];

const RESET_COMMAND_PATTERN =
	/^\/(?!(?:skill:brainstorm|brainstorm|deep-thought:brainstorm|deep-thought-brainstorm|skill:plan|plan|deep-thought:plan|deep-thought-plan|skill:architect|architect|deep-thought:architect|deep-thought-architect)\b)\S+/i;

const CODEX_MODEL_ID = "gpt-5.1-codex-mini";
const HAIKU_MODEL_ID = "claude-haiku-4-5";

const EXTRACTION_SYSTEM_PROMPT = `You convert assistant messages into a single interactive prompt for a terminal UI.

Return JSON only. Use this schema:
{
  "kind": "none" | "single_choice" | "text",
  "question": "string",
  "context": "optional string",
  "options": [
    { "label": "string", "description": "optional string" }
  ],
  "answerInstruction": "optional string",
  "confidence": "high" | "medium" | "low",
  "reason": "optional string"
}

Rules:
- Extract at most ONE prompt: the next thing the user should answer now.
- Use kind="none" when the assistant is not actually waiting for user input now.
- Prefer kind="single_choice" when the assistant offers 2-5 explicit options or next steps.
- Prefer kind="text" when the assistant asks one focused open-ended question.
- Do NOT invent options. Use only options explicitly present in the message.
- Ignore rhetorical questions, implementation notes, and long checklists.
- Confidence must be high only when the prompt is explicit and safe to show in UI.
- If kind="single_choice", include 2-5 options.
- If kind="text", omit options.
- Keep question wording faithful to the message.
`;

const normalizeInline = (text: string): string =>
	text
		.replace(/\*\*(.*?)\*\*/g, "$1")
		.replace(/__(.*?)__/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\s+/g, " ")
		.trim();

function detectWorkflow(text: string): WorkflowName | undefined {
	const trimmed = text.trim();
	for (const { workflow, pattern } of WORKFLOW_PATTERNS) {
		if (pattern.test(trimmed)) return workflow;
	}
	return undefined;
}

async function selectExtractionModel(currentModel: Model<Api>, modelRegistry: ModelRegistry): Promise<Model<Api>> {
	const codexModel = modelRegistry.find("openai-codex", CODEX_MODEL_ID);
	if (codexModel) {
		const auth = await modelRegistry.getApiKeyAndHeaders(codexModel);
		if (auth.ok) return codexModel;
	}

	const haikuModel = modelRegistry.find("anthropic", HAIKU_MODEL_ID);
	if (haikuModel) {
		const auth = await modelRegistry.getApiKeyAndHeaders(haikuModel);
		if (auth.ok) return haikuModel;
	}

	return currentModel;
}

function parseExtractionEnvelope(text: string): ExtractedPromptEnvelope | null {
	try {
		let json = text.trim();
		const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
		if (codeBlock) json = codeBlock[1].trim();
		const parsed = JSON.parse(json) as ExtractedPromptEnvelope;
		if (!parsed || typeof parsed !== "object" || typeof parsed.kind !== "string") return null;
		if (parsed.kind === "none") return parsed;
		if (parsed.kind !== "single_choice" && parsed.kind !== "text") return null;
		if (typeof parsed.question !== "string" || parsed.question.trim() === "") return null;
		if (parsed.kind === "single_choice") {
			if (!Array.isArray(parsed.options) || parsed.options.length < 2 || parsed.options.length > 5) return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function splitQuestionAndContext(lines: string[], optionStartIndex: number): { question: string; context?: string } {
	const prior = lines.slice(0, optionStartIndex).map((line) => normalizeInline(line)).filter(Boolean);
	if (prior.length === 0) return { question: "Choose an option" };

	let question = prior[prior.length - 1];
	let contextLines = prior.slice(0, -1);

	for (let i = prior.length - 1; i >= 0; i--) {
		const line = prior[i];
		if (line.endsWith("?") || line.endsWith(":")) {
			question = line.replace(/:$/, "");
			contextLines = prior.slice(Math.max(0, i - 2), i);
			break;
		}
	}

	return { question, context: contextLines.join(" ").trim() || undefined };
}

function heuristicExtractOptions(text: string): ExtractedPromptEnvelope | null {
	const lines = text.split(/\r?\n/);
	const options: { label: string; description?: string }[] = [];
	let optionStartIndex = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		const match = line.match(/^(\d+\.|[-*])\s+(.*)$/);
		if (!match) {
			if (options.length > 0) break;
			continue;
		}
		if (optionStartIndex === -1) optionStartIndex = i;
		const body = normalizeInline(match[2]);
		const parts = body.split(/\s+[—-]\s+/);
		const label = parts[0]?.trim();
		const description = parts.slice(1).join(" — ").trim() || undefined;
		if (!label) break;
		options.push({ label, description });
	}

	if (optionStartIndex === -1 || options.length < 2 || options.length > 5) return null;
	const { question, context } = splitQuestionAndContext(lines, optionStartIndex);
	return { kind: "single_choice", question, context, options, confidence: "medium" };
}

function heuristicExtractText(text: string): ExtractedPromptEnvelope | null {
	const lines = text
		.split(/\r?\n/)
		.map((line) => normalizeInline(line))
		.filter(Boolean);

	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (!line.endsWith("?")) continue;
		if (/^(if|when|otherwise|for example)\b/i.test(line)) continue;
		return {
			kind: "text",
			question: line,
			context: lines.slice(Math.max(0, i - 2), i).join(" ").trim() || undefined,
			confidence: "low",
		};
	}

	return null;
}

function heuristicExtractPrompt(text: string): ExtractedPromptEnvelope {
	return heuristicExtractOptions(text) ?? heuristicExtractText(text) ?? { kind: "none", reason: "no clear prompt", confidence: "low" };
}

function getLastAssistantText(
	messages: Array<{ role?: string; content?: Array<{ type: string; text?: string }>; stopReason?: string }>,
): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message.role !== "assistant") continue;
		if (message.stopReason && message.stopReason !== "stop") return null;
		const text = (message.content ?? [])
			.filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
			.map((part) => part.text)
			.join("\n")
			.trim();
		if (text) return text;
	}
	return null;
}

async function extractPromptWithModel(
	ctx: ExtensionContext,
	workflow: WorkflowName,
	assistantText: string,
): Promise<ExtractedPromptEnvelope | null> {
	if (!ctx.model) return null;
	const extractionModel = await selectExtractionModel(ctx.model, ctx.modelRegistry);
	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(extractionModel);
	if (!auth.ok) return null;

	const userMessage: UserMessage = {
		role: "user",
		content: [
			{
				type: "text",
				text: `Workflow: ${workflow}\n\nAssistant message:\n${assistantText}`,
			},
		],
		timestamp: Date.now(),
	};

	const response = await complete(
		extractionModel,
		{ systemPrompt: EXTRACTION_SYSTEM_PROMPT, messages: [userMessage] },
		{ apiKey: auth.apiKey, headers: auth.headers, signal: ctx.signal },
	);
	if (response.stopReason === "aborted") return null;
	const responseText = response.content
		.filter((part): part is { type: "text"; text: string } => part.type === "text")
		.map((part) => part.text)
		.join("\n")
		.trim();
	return parseExtractionEnvelope(responseText);
}

function coerceExtractedPrompt(workflow: WorkflowName, extracted: ExtractedPromptEnvelope | null): GuidedPrompt | null {
	if (!extracted || extracted.kind === "none") return null;
	if (extracted.confidence === "low") return null;
	if (extracted.kind === "single_choice") {
		const options = (extracted.options ?? [])
			.filter((option) => option && typeof option.label === "string" && option.label.trim() !== "")
			.map((option) => ({ label: normalizeInline(option.label), description: option.description ? normalizeInline(option.description) : undefined }));
		if (options.length < 2 || options.length > 5) return null;
		return {
			kind: "single_choice",
			workflow,
			question: normalizeInline(extracted.question),
			context: extracted.context ? normalizeInline(extracted.context) : undefined,
			options,
			answerInstruction: extracted.answerInstruction ? normalizeInline(extracted.answerInstruction) : undefined,
			confidence: extracted.confidence,
		};
	}
	return {
		kind: "text",
		workflow,
		question: normalizeInline(extracted.question),
		context: extracted.context ? normalizeInline(extracted.context) : undefined,
		answerInstruction: extracted.answerInstruction ? normalizeInline(extracted.answerInstruction) : undefined,
		confidence: extracted.confidence,
	};
}

class GuidedPromptComponent implements Component {
	private prompt: GuidedPrompt;
	private tui: TUI;
	private onDone: (result: string | null) => void;
	private editor?: Editor;
	private selectedIndex = 0;
	private showingConfirmation = false;
	private cachedWidth?: number;
	private cachedLines?: string[];
	private dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
	private bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
	private cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
	private green = (s: string) => `\x1b[32m${s}\x1b[0m`;
	private yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
	private gray = (s: string) => `\x1b[90m${s}\x1b[0m`;

	constructor(prompt: GuidedPrompt, tui: TUI, onDone: (result: string | null) => void) {
		this.prompt = prompt;
		this.tui = tui;
		this.onDone = onDone;

		if (prompt.kind === "text") {
			const editorTheme: EditorTheme = {
				borderColor: this.dim,
				selectList: {
					selectedBg: (s: string) => `\x1b[44m${s}\x1b[0m`,
					matchHighlight: this.cyan,
					itemSecondary: this.gray,
				},
			};
			this.editor = new Editor(tui, editorTheme);
			this.editor.disableSubmit = true;
			this.editor.onChange = () => {
				this.invalidate();
				this.tui.requestRender();
			};
		}
	}

	private invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	private cancel(): void {
		this.onDone(null);
	}

	private submit(): void {
		if (this.prompt.kind === "single_choice") {
			const option = this.prompt.options?.[this.selectedIndex];
			this.onDone(option?.label ?? null);
			return;
		}
		const value = this.editor?.getText().trim() ?? "";
		if (!value) return;
		this.onDone(value);
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
			this.cancel();
			return;
		}

		if (this.prompt.kind === "single_choice") {
			const options = this.prompt.options ?? [];
			if (matchesKey(data, Key.up) || matchesKey(data, Key.shift("tab"))) {
				this.selectedIndex = Math.max(0, this.selectedIndex - 1);
				this.invalidate();
				this.tui.requestRender();
				return;
			}
			if (matchesKey(data, Key.down) || matchesKey(data, Key.tab)) {
				this.selectedIndex = Math.min(options.length - 1, this.selectedIndex + 1);
				this.invalidate();
				this.tui.requestRender();
				return;
			}
			if (matchesKey(data, Key.enter)) {
				this.submit();
				return;
			}
			return;
		}

		if (this.showingConfirmation) {
			if (matchesKey(data, Key.enter) || data.toLowerCase() === "y") {
				this.submit();
				return;
			}
			if (data.toLowerCase() === "n") {
				this.showingConfirmation = false;
				this.invalidate();
				this.tui.requestRender();
				return;
			}
		}

		if (matchesKey(data, Key.enter) && !matchesKey(data, Key.shift("enter"))) {
			const text = this.editor?.getText().trim() ?? "";
			if (!text) return;
			this.showingConfirmation = true;
			this.invalidate();
			this.tui.requestRender();
			return;
		}

		this.editor?.handleInput(data);
		this.invalidate();
		this.tui.requestRender();
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

		const lines: string[] = [];
		const boxWidth = Math.min(width - 4, 110);
		const contentWidth = boxWidth - 4;
		const horizontalLine = (count: number) => "─".repeat(count);
		const padToWidth = (line: string): string => line + " ".repeat(Math.max(0, width - visibleWidth(line)));
		const boxLine = (content: string, leftPad = 2): string => {
			const padded = " ".repeat(leftPad) + content;
			const rightPad = Math.max(0, boxWidth - visibleWidth(padded) - 2);
			return this.dim("│") + padded + " ".repeat(rightPad) + this.dim("│");
		};
		const emptyLine = (): string => this.dim("│") + " ".repeat(boxWidth - 2) + this.dim("│");

		lines.push(padToWidth(this.dim("╭" + horizontalLine(boxWidth - 2) + "╮")));
		lines.push(padToWidth(boxLine(`${this.bold(this.cyan("Heart of Gold"))} ${this.dim(`(${this.prompt.workflow})`)}`)));
		lines.push(padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")));

		for (const line of wrapTextWithAnsi(`${this.bold("Q:")} ${this.prompt.question}`, contentWidth)) {
			lines.push(padToWidth(boxLine(line)));
		}
		if (this.prompt.context) {
			lines.push(padToWidth(emptyLine()));
			for (const line of wrapTextWithAnsi(this.gray(`> ${this.prompt.context}`), contentWidth)) {
				lines.push(padToWidth(boxLine(line)));
			}
		}
		if (this.prompt.answerInstruction) {
			lines.push(padToWidth(emptyLine()));
			for (const line of wrapTextWithAnsi(this.dim(this.prompt.answerInstruction), contentWidth)) {
				lines.push(padToWidth(boxLine(line)));
			}
		}

		lines.push(padToWidth(emptyLine()));

		if (this.prompt.kind === "single_choice") {
			for (let i = 0; i < (this.prompt.options ?? []).length; i++) {
				const option = this.prompt.options![i];
				const isSelected = i === this.selectedIndex;
				const marker = isSelected ? this.cyan("❯") : this.dim("•");
				const label = isSelected ? this.bold(option.label) : option.label;
				const line = option.description ? `${marker} ${label} ${this.gray(`— ${option.description}`)}` : `${marker} ${label}`;
				for (const wrapped of wrapTextWithAnsi(line, contentWidth)) {
					lines.push(padToWidth(boxLine(wrapped)));
				}
				if (i < (this.prompt.options?.length ?? 0) - 1) lines.push(padToWidth(emptyLine()));
			}
		} else {
			const editorWidth = contentWidth - 4;
			const editorLines = this.editor?.render(editorWidth) ?? [];
			for (let i = 1; i < editorLines.length - 1; i++) {
				lines.push(padToWidth(boxLine(i === 1 ? `${this.bold("A:")} ${editorLines[i]}` : `   ${editorLines[i]}`)));
			}
		}

		lines.push(padToWidth(emptyLine()));
		lines.push(padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")));
		const footer =
			this.prompt.kind === "single_choice"
				? `${this.dim("↑/↓ or Tab")} move · ${this.dim("Enter")} choose · ${this.dim("Esc")} cancel`
				: this.showingConfirmation
					? `${this.yellow("Submit answer?")} ${this.dim("Enter/y confirm · n continue editing · Esc cancel")}`
					: `${this.dim("Enter")} submit · ${this.dim("Shift+Enter")} newline · ${this.dim("Esc")} cancel`;
		lines.push(padToWidth(boxLine(truncateToWidth(footer, contentWidth))));
		lines.push(padToWidth(this.dim("╰" + horizontalLine(boxWidth - 2) + "╯")));

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}
}

async function showExtractionLoaderAndPrompt(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	workflow: WorkflowName,
	assistantText: string,
): Promise<GuidedPrompt | null> {
	if (!ctx.hasUI) return null;

	const extracted = await ctx.ui.custom<ExtractedPromptEnvelope | null>((tui, theme, _kb, done) => {
		const loader = new BorderedLoader(tui, theme, `Heart of Gold: extracting ${workflow} prompt...`);
		loader.onAbort = () => done(null);

		const run = async () => {
			const modelResult = await extractPromptWithModel(ctx, workflow, assistantText);
			if (modelResult && modelResult.kind !== "none" && modelResult.confidence !== "low") return modelResult;
			return heuristicExtractPrompt(assistantText);
		};

		run().then(done).catch(() => done(heuristicExtractPrompt(assistantText)));
		return loader;
	});

	return coerceExtractedPrompt(workflow, extracted);
}

async function promptForAnswer(pi: ExtensionAPI, ctx: ExtensionContext, prompt: GuidedPrompt): Promise<void> {
	if (!ctx.hasUI) return;
	const answer = await ctx.ui.custom<string | null>((tui, _theme, _kb, done) => new GuidedPromptComponent(prompt, tui, done));
	if (!answer) return;
	if (ctx.isIdle()) {
		pi.sendUserMessage(answer);
	} else {
		pi.sendUserMessage(answer, { deliverAs: "followUp" });
	}
}

export default function guidedWorkflowsExtension(pi: ExtensionAPI) {
	let activeWorkflow: WorkflowName | undefined;
	let lastHandledAssistantText: string | undefined;

	pi.on("input", async (event) => {
		const workflow = detectWorkflow(event.text);
		if (workflow) {
			activeWorkflow = workflow;
			lastHandledAssistantText = undefined;
			return { action: "continue" };
		}
		if (RESET_COMMAND_PATTERN.test(event.text.trim())) {
			activeWorkflow = undefined;
			lastHandledAssistantText = undefined;
		}
		return { action: "continue" };
	});

	pi.on("agent_end", async (event, ctx) => {
		if (!activeWorkflow || !ctx.hasUI) return;
		const assistantText = getLastAssistantText(
			event.messages as Array<{ role?: string; content?: Array<{ type: string; text?: string }>; stopReason?: string }>,
		);
		if (!assistantText || assistantText === lastHandledAssistantText) return;

		lastHandledAssistantText = assistantText;
		const prompt = await showExtractionLoaderAndPrompt(pi, ctx, activeWorkflow, assistantText);
		if (!prompt) return;
		await promptForAnswer(pi, ctx, prompt);
	});
}
