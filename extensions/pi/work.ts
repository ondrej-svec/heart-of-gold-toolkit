import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const PROTECTED_PATHS = [".env", ".git/", "node_modules/"];
const CONFIRM_COMMANDS = [/\bgit\s+push\b/i, /\bnpm\s+publish\b/i, /\bbun\s+publish\b/i, /\bgh\s+pr\s+create\b/i];
const BLOCKED_COMMANDS = [/\bgit\s+add\s+\.\b/i, /\brm\s+(-rf?|--recursive)/i];

export default function workExtension(pi: ExtensionAPI) {
	let workMode = false;

	pi.registerCommand("hog-work", {
		description: "Interactive pi-first entrypoint for the shared work skill",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/hog-work requires interactive mode", "warning");
				return;
			}

			const planPath = args.trim() || (await ctx.ui.editor("Plan path", ""))?.trim();
			if (!planPath) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			const runMode = await ctx.ui.select("How strict should work mode be?", [
				"Normal guardrails (recommended)",
				"Strict guardrails for shipping work",
			]);
			if (!runMode) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			workMode = true;
			const theme = ctx.ui.theme;
			ctx.ui.setStatus(
				"hog-work",
				theme.fg("accent", "◉") + theme.fg("dim", ` Work mode active — ${runMode}`),
			);

			const prompt = [
				`/skill:work ${planPath}`,
				"",
				"Use pi guardrails while executing:",
				"- keep progress visible as tasks move from in-progress to complete",
				"- do not use `git add .`",
				"- confirm push/publish actions deliberately",
				"- protect .env, .git/, and node_modules/ from accidental edits",
			].join("\n");

			if (ctx.isIdle()) {
				pi.sendUserMessage(prompt);
			} else {
				pi.sendUserMessage(prompt, { deliverAs: "followUp" });
				ctx.ui.notify("Work prompt queued as follow-up", "info");
			}
		},
	});

	pi.registerCommand("hog-work-off", {
		description: "Disable Heart of Gold work-mode guardrails",
		handler: async (_args, ctx) => {
			workMode = false;
			ctx.ui.setStatus("hog-work", "");
			ctx.ui.notify("Work mode disabled", "info");
		},
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!workMode) return undefined;

		if (event.toolName === "write" || event.toolName === "edit") {
			const path = String(event.input.path ?? "");
			if (PROTECTED_PATHS.some((segment) => path.includes(segment))) {
				if (ctx.hasUI) {
					ctx.ui.notify(`Blocked protected path in work mode: ${path}`, "warning");
				}
				return { block: true, reason: `Protected path in work mode: ${path}` };
			}
		}

		if (event.toolName !== "bash") return undefined;
		const command = String(event.input.command ?? "");

		if (BLOCKED_COMMANDS.some((pattern) => pattern.test(command))) {
			return { block: true, reason: `Blocked unsafe command in work mode: ${command}` };
		}

		if (!CONFIRM_COMMANDS.some((pattern) => pattern.test(command))) {
			return undefined;
		}

		if (!ctx.hasUI) {
			return { block: true, reason: `Interactive confirmation required for: ${command}` };
		}

		const choice = await ctx.ui.select(`Confirm work-mode command:\n\n${command}`, ["Allow", "Block"]);
		if (choice !== "Allow") {
			return { block: true, reason: `Blocked by user: ${command}` };
		}

		return undefined;
	});
}
