import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import architectExtension from "./architect.ts";
import brainstormExtension from "./brainstorm.ts";
import planExtension from "./plan.ts";
import hogAskExtension from "./hog-ask.ts";
import shareExtension from "./share.ts";
import workExtension from "./work.ts";

export default function heartOfGoldPiExtensions(pi: ExtensionAPI) {
	hogAskExtension(pi);
	brainstormExtension(pi);
	planExtension(pi);
	architectExtension(pi);
	shareExtension(pi);
	workExtension(pi);
}
