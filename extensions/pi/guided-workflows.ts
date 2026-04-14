import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

type WorkflowName = "brainstorm" | "plan";

type GuidedPrompt =
	| {
			kind: "single_choice";
			workflow: WorkflowName;
			question: string;
			context?: string;
			options: { label: string; description?: string }[];
	  }
	| {
			kind: "text";
			workflow: WorkflowName;
			question: string;
			context?: string;
	  };

const WORKFLOW_PATTERNS: Array<{ workflow: WorkflowName; pattern: RegExp }> = [
	{ workflow: "brainstorm", pattern: /^\/(?:skill:brainstorm|brainstorm|deep-thought:brainstorm)\b/i },
	{ workflow: "plan", pattern: /^\/(?:skill:plan|plan|deep-thought:plan)\b/i },
];

const RESET_COMMAND_PATTERN = /^\/(?!(?:skill:brainstorm|brainstorm|deep-thought:brainstorm|skill:plan|plan|deep-thought:plan|deep-thought-brainstorm|deep-thought-plan)\b)\S+/i;

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
	if (/^\/deep-thought-brainstorm\b/i.test(trimmed)) return "brainstorm";
	if (/^\/deep-thought-plan\b/i.test(trimmed)) return "plan";
	return undefined;
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

	const context = contextLines.join(" ").trim() || undefined;
	return { question, context };
}

function extractOptions(text: string): { question: string; context?: string; options: { label: string; description?: string }[] } | null {
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

	if (options.length < 2 || options.length > 4 || optionStartIndex === -1) return null;
	const { question, context } = splitQuestionAndContext(lines, optionStartIndex);
	return { question, context, options };
}

function extractTextQuestion(text: string): { question: string; context?: string } | null {
	const lines = text
		.split(/\r?\n/)
		.map((line) => normalizeInline(line))
		.filter(Boolean);

	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (!line.endsWith("?")) continue;
		if (/^(if|when|otherwise)\b/i.test(line)) continue;
		const context = lines.slice(Math.max(0, i - 2), i).join(" ").trim() || undefined;
		return { question: line, context };
	}

	return null;
}

function extractPrompt(workflow: WorkflowName, text: string): GuidedPrompt | null {
	const choice = extractOptions(text);
	if (choice) {
		return {
			kind: "single_choice",
			workflow,
			question: choice.question,
			context: choice.context,
			options: choice.options,
		};
	}

	const freeText = extractTextQuestion(text);
	if (freeText) {
		return {
			kind: "text",
			workflow,
			question: freeText.question,
			context: freeText.context,
		};
	}

	return null;
}

function getLastAssistantText(messages: Array<{ role?: string; content?: Array<{ type: string; text?: string }>; stopReason?: string }>): string | null {
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

async function promptForAnswer(pi: ExtensionAPI, ctx: ExtensionContext, prompt: GuidedPrompt): Promise<void> {
	if (!ctx.hasUI) return;

	const title = `Heart of Gold · ${prompt.workflow}`;
	const promptText = prompt.context ? `${prompt.context}\n\n${prompt.question}` : prompt.question;

	if (prompt.kind === "single_choice") {
		const options = prompt.options.map((option) =>
			option.description ? `${option.label} — ${option.description}` : option.label,
		);
		const choice = await ctx.ui.select(title, options);
		if (!choice) return;
		const selected = prompt.options[options.indexOf(choice)] ?? prompt.options.find((option) => option.label === choice);
		const answer = selected?.label ?? choice;
		if (ctx.isIdle()) {
			pi.sendUserMessage(answer);
		} else {
			pi.sendUserMessage(answer, { deliverAs: "followUp" });
		}
		return;
	}

	const answer = (await ctx.ui.editor(title, `${promptText}\n\n`))?.trim();
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
		const assistantText = getLastAssistantText(event.messages as Array<{ role?: string; content?: Array<{ type: string; text?: string }>; stopReason?: string }>);
		if (!assistantText) return;
		if (assistantText === lastHandledAssistantText) return;

		const prompt = extractPrompt(activeWorkflow, assistantText);
		lastHandledAssistantText = assistantText;
		if (!prompt) return;

		await promptForAnswer(pi, ctx, prompt);
	});
}
