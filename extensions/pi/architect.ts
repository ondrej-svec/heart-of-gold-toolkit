import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function architectExtension(pi: ExtensionAPI) {
	pi.registerCommand("deep-thought-architect", {
		description: "Start architect — turn brainstorm decisions into stories and architecture docs",
		handler: async (args, ctx) => {
			const source =
				args.trim() || (ctx.hasUI ? (await ctx.ui.editor("Architect input (feature or brainstorm path)", ""))?.trim() : undefined);
			if (!source) {
				ctx.ui.notify("Usage: /deep-thought-architect <feature or brainstorm path>", "info");
				return;
			}

			const prompt = `/skill:architect ${source}`;
			if (ctx.isIdle()) {
				pi.sendUserMessage(prompt);
			} else {
				pi.sendUserMessage(prompt, { deliverAs: "followUp" });
				ctx.ui.notify("Architect queued as follow-up", "info");
			}
		},
	});
}
