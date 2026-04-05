import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const PLAN_SAFE_TOOLS = ["read", "bash", "grep", "find", "ls"];

export default function planExtension(pi: ExtensionAPI) {
	let previousTools: string[] | null = null;

	const applyPlanTools = () => {
		const available = new Set(pi.getAllTools().map((tool) => tool.name));
		const nextTools = PLAN_SAFE_TOOLS.filter((tool) => available.has(tool));
		if (nextTools.length > 0) {
			pi.setActiveTools(nextTools);
		}
	};

	pi.registerCommand("hog-plan", {
		description: "Interactive pi-first entrypoint for planning mode and the shared plan skill",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/hog-plan requires interactive mode", "warning");
				return;
			}

			const source = args.trim() || (await ctx.ui.editor("Plan topic or brainstorm path", ""))?.trim();
			if (!source) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			const mode = await ctx.ui.select("How should planning mode behave?", [
				"Read-only planning (recommended)",
				"Allow normal tools, but stay in planning mode",
			]);
			if (!mode) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			if (previousTools === null) {
				previousTools = pi.getActiveTools();
			}
			if (mode.startsWith("Read-only")) {
				applyPlanTools();
			}

			const prompt = [
				`/skill:plan ${source}`,
				"",
				"Use a pi-friendly planning flow:",
				"- Keep planning read-only unless the user explicitly exits planning mode.",
				"- Ask one question at a time when clarification is needed.",
				"- Use concise option lists when choosing between paths or handoffs.",
			].join("\n");

			const theme = ctx.ui.theme;
			ctx.ui.setStatus(
				"hog-plan",
				theme.fg("accent", "◉") + theme.fg("dim", " Plan mode active"),
			);

			if (ctx.isIdle()) {
				pi.sendUserMessage(prompt);
			} else {
				pi.sendUserMessage(prompt, { deliverAs: "followUp" });
				ctx.ui.notify("Plan prompt queued as follow-up", "info");
			}
		},
	});

	pi.registerCommand("hog-execute", {
		description: "Exit planning mode, restore tools, and optionally start work",
		handler: async (args, ctx) => {
			if (previousTools) {
				pi.setActiveTools(previousTools);
				previousTools = null;
			}
			ctx.ui.setStatus("hog-plan", "");

			const target = args.trim();
			if (!target) {
				ctx.ui.notify("Planning mode cleared. Run /hog-work <plan-path> when ready.", "info");
				return;
			}

			const prompt = `/skill:work ${target}`;
			if (ctx.isIdle()) {
				pi.sendUserMessage(prompt);
			} else {
				pi.sendUserMessage(prompt, { deliverAs: "followUp" });
				ctx.ui.notify("Work prompt queued as follow-up", "info");
			}
		},
	});
}
