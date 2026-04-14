import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import brainstormExtension from "./brainstorm";
import guidedWorkflowsExtension from "./guided-workflows";
import planExtension from "./plan";
import workExtension from "./work";

export default function heartOfGoldPiExtensions(pi: ExtensionAPI) {
	guidedWorkflowsExtension(pi);
	brainstormExtension(pi);
	planExtension(pi);
	workExtension(pi);
}
