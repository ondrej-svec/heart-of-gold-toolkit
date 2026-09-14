// Benign manual/automated proof only, never a packaged extension entrypoint.
// Load instead of the package's extension (skills may still come from the package).
import { appendFileSync } from "node:fs";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import heartOfGold from "../../extensions/pi/index.ts";

export default function proof(pi: ExtensionAPI) {
	let ask: ToolDefinition;
	const wrapped = new Proxy(pi, {
		get(target, key) {
			if (key === "registerTool") return (tool: ToolDefinition) => {
				if (tool.name === "hog_ask") ask = tool;
				return target.registerTool(tool);
			};
			return Reflect.get(target, key);
		},
	});
	heartOfGold(wrapped);
	pi.registerCommand("hog-ask-proof", {
		description: "Benign offline decision/approval proof. Records a demo answer; executes nothing.",
		handler: async (args, ctx) => {
			const purpose = args.trim() === "decision" ? "decision" : "approval";
			const question = {
				id: `demo-${purpose}`, purpose, title: purpose === "decision" ? "Rollout audience (demo)" : "Record a demo approval",
				question: purpose === "decision" ? "Who should have access first?" : "Approve only this demonstration scope?",
				context: "Demonstration only. No implementation, publishing or deployment will run.",
				...(purpose === "decision" ? {
					options: [{ id: "internal", label: "Internal only", description: "Validate with support before wider exposure." }, { id: "public", label: "Public", description: "Wider reach and greater rollout risk." }],
					recommendation: { optionId: "internal", reason: "A smaller pilot reduces risk." },
				} : { scope: { action: `${args.trim() === "long" ? "START_SCOPE. " + "Demo verification note. ".repeat(40) + "END_SCOPE. " : ""}Record this demo answer only. No real-world operation is authorized.`, artifactPath: "demo/plan.md", revision: "demo-r1" } }),
			};
			const result = await ask.execute("demo", question, undefined, undefined, ctx);
			// Optional owned PTY evidence, never an application action. Avoid proving
			// success by matching an old result still visible in terminal scrollback.
			if (process.env.HOG_ASK_PROOF_OUTPUT) appendFileSync(process.env.HOG_ASK_PROOF_OUTPUT, JSON.stringify(result.details) + "\n");
			pi.sendMessage({ customType: "hog-ask-proof", content: result.content, details: result.details, display: true });
		},
	});
}
