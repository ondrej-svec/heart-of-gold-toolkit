import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function planExtension(pi: ExtensionAPI) {
	pi.registerCommand("deep-thought-plan", {
		description: "Start planning — research and produce a plan document",
		handler: async (args, ctx) => {
			const source = args.trim() || (ctx.hasUI ? (await ctx.ui.editor("Plan topic or brainstorm path", ""))?.trim() : undefined);
			if (!source) {
				ctx.ui.notify("Usage: /deep-thought-plan <topic or brainstorm path>", "info");
				return;
			}

			const prompt = `/skill:plan ${source}`;

			if (ctx.isIdle()) {
				pi.sendUserMessage(prompt);
			} else {
				pi.sendUserMessage(prompt, { deliverAs: "followUp" });
				ctx.ui.notify("Plan queued as follow-up", "info");
			}
		},
	});
}
