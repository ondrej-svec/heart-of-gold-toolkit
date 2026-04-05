import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function sendPrompt(pi: ExtensionAPI, prompt: string, ctx: Parameters<NonNullable<Parameters<ExtensionAPI["registerCommand"]>[1]["handler"]>>[1]) {
	if (ctx.isIdle()) {
		pi.sendUserMessage(prompt);
	} else {
		pi.sendUserMessage(prompt, { deliverAs: "followUp" });
		ctx.ui.notify("Brainstorm prompt queued as follow-up", "info");
	}
}

export default function brainstormExtension(pi: ExtensionAPI) {
	pi.registerCommand("deep-thought-brainstorm", {
		description: "Interactive pi-first intake for the shared brainstorm skill",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/deep-thought-brainstorm requires interactive mode", "warning");
				return;
			}

			const topic = args.trim() || (await ctx.ui.editor("Brainstorm topic", ""))?.trim();
			if (!topic) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			const clarity = await ctx.ui.select("How clear are the requirements right now?", [
				"Unclear — need discovery",
				"Partly clear — explore tradeoffs",
				"Quite clear — validate before planning",
			]);
			if (!clarity) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			const goal = await ctx.ui.select("What should the brainstorm optimize for first?", [
				"Find the right problem framing",
				"Compare 2-3 viable approaches",
				"Pressure-test the chosen direction",
			]);
			if (!goal) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			const prompt = [
				`/skill:brainstorm ${topic}`,
				"",
				"Use a pi-friendly interactive flow:",
				"- Ask one question at a time.",
				"- Use explicit option lists whenever there are natural choices.",
				"- Keep momentum high and avoid dumping questionnaires.",
				"",
				`Current clarity: ${clarity}`,
				`Primary goal: ${goal}`,
			].join("\n");

			const theme = ctx.ui.theme;
			ctx.ui.setStatus(
				"deep-thought-brainstorm",
				theme.fg("accent", "◉") + theme.fg("dim", " Brainstorm flow active"),
			);
			sendPrompt(pi, prompt, ctx);
		},
	});
}
