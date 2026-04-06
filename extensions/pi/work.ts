import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const PROTECTED_PATHS = [".env", ".git/", "node_modules/"];
const CONFIRM_COMMANDS = [/\bgit\s+push\b/i, /\bnpm\s+publish\b/i, /\bbun\s+publish\b/i, /\bgh\s+pr\s+create\b/i];
const BLOCKED_COMMANDS = [/\bgit\s+add\s+\.\b/i, /\brm\s+(-rf?|--recursive)/i];

export default function workExtension(pi: ExtensionAPI) {
	// Always-on guardrails — no mode toggle needed
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName === "write" || event.toolName === "edit") {
			const path = String(event.input.path ?? "");
			if (PROTECTED_PATHS.some((segment) => path.includes(segment))) {
				if (ctx.hasUI) {
					ctx.ui.notify(`⛔ Protected path: ${path}`, "warning");
				}
				return { block: true, reason: `Protected path: ${path}` };
			}
		}

		if (event.toolName !== "bash") return undefined;
		const command = String(event.input.command ?? "");

		if (BLOCKED_COMMANDS.some((pattern) => pattern.test(command))) {
			return { block: true, reason: `Blocked unsafe command: ${command}` };
		}

		if (!CONFIRM_COMMANDS.some((pattern) => pattern.test(command))) {
			return undefined;
		}

		if (!ctx.hasUI) {
			return { block: true, reason: `Interactive confirmation required for: ${command}` };
		}

		const choice = await ctx.ui.select(`Confirm: ${command}`, ["Allow", "Block"]);
		if (choice !== "Allow") {
			return { block: true, reason: `Blocked by user: ${command}` };
		}

		return undefined;
	});

	pi.registerCommand("marvin-work", {
		description: "Start executing a plan — implement with guardrails",
		handler: async (args, ctx) => {
			const planPath = args.trim() || (ctx.hasUI ? (await ctx.ui.editor("Plan path", ""))?.trim() : undefined);
			if (!planPath) {
				ctx.ui.notify("Usage: /marvin-work <plan path>", "info");
				return;
			}

			const prompt = `/skill:work ${planPath}`;

			if (ctx.isIdle()) {
				pi.sendUserMessage(prompt);
			} else {
				pi.sendUserMessage(prompt, { deliverAs: "followUp" });
				ctx.ui.notify("Work queued as follow-up", "info");
			}
		},
	});
}
