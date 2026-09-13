import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function brainstormExtension(pi: ExtensionAPI) {
	pi.registerCommand("deep-thought-brainstorm", {
		description: "Start a brainstorm — collaborative discovery before planning",
		handler: async (args, ctx) => {
			const topic = args.trim() || (ctx.hasUI ? (await ctx.ui.editor("Brainstorm topic", ""))?.trim() : undefined);
			if (!topic) {
				ctx.ui.notify("Usage: /deep-thought-brainstorm <topic>", "info");
				return;
			}

			const prompt = `/skill:brainstorm ${topic}`;

			if (ctx.isIdle()) {
				pi.sendUserMessage(prompt, { expandPromptTemplates: true });
			} else {
				pi.sendUserMessage(prompt, { deliverAs: "followUp", expandPromptTemplates: true });
				ctx.ui.notify("Brainstorm queued as follow-up", "info");
			}
		},
	});
}
