import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function queueOrSend(
	pi: ExtensionAPI,
	prompt: string,
	ctx: {
		isIdle(): boolean;
		hasUI?: boolean;
		ui: { notify(message: string, level: "info" | "warning" | "success" | "error"): void; editor?(title: string, initialValue: string): Promise<string | undefined> };
	},
	queuedMessage: string,
) {
	if (ctx.isIdle()) {
		pi.sendUserMessage(prompt);
	} else {
		pi.sendUserMessage(prompt, { deliverAs: "followUp" });
		ctx.ui.notify(queuedMessage, "info");
	}
}

export default function shareExtension(pi: ExtensionAPI) {
	pi.registerCommand("share", {
		description: "Publish an HTML file or static site directory via the share-html skill",
		handler: async (args, ctx) => {
			const source = args.trim() || (ctx.hasUI ? (await ctx.ui.editor?.("HTML file or static site directory", ""))?.trim() : undefined);
			if (!source) {
				ctx.ui.notify("Usage: /share <html file or static site directory>", "info");
				return;
			}

			queueOrSend(pi, `/skill:share-html ${source}`, ctx, "Share queued as follow-up");
		},
	});

	pi.registerCommand("share-server-setup", {
		description: "Set up or adopt a local share server via the portable share-server-setup skill",
		handler: async (args, ctx) => {
			const prompt = args.trim() ? `/skill:share-server-setup ${args.trim()}` : "/skill:share-server-setup";
			queueOrSend(pi, prompt, ctx, "Share server setup queued as follow-up");
		},
	});
}
