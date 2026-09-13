import { Type, type Static } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { LIMITS } from "./hog-ask-core.mjs";

const text = (maxLength: number, description: string) => Type.String({ minLength: 1, maxLength, description });
const id = () => Type.String({ pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$", description: "Stable ID, not a display index" });
export const AskSchema = Type.Object({
	id: id(),
	purpose: StringEnum(["decision", "approval"]),
	title: text(LIMITS.title, "Short, task-specific title"),
	question: text(LIMITS.question, "One genuine unresolved question, not a task checklist"),
	context: Type.Optional(text(LIMITS.context, "Consequences and evidence needed to decide")),
	options: Type.Optional(Type.Array(Type.Object({
		id: id(), label: text(96, "Unique alternative label"),
		description: text(LIMITS.description, "Brief consequence/tradeoff"),
	}, { additionalProperties: false }), { minItems: 2, maxItems: 4, description: "Required for decision; omit for approval (fixed approve/revise/pause options)" })),
	recommendation: Type.Optional(Type.Object({
		optionId: id(), reason: text(400, "Evidence-based reason; never a default answer"),
	}, { additionalProperties: false, description: "Decision only; omit for approval" })),
	scope: Type.Optional(Type.Object({
		action: text(LIMITS.scope, "Concrete action and complete scope, including exclusions"),
		artifactPath: Type.Optional(text(400, "Artifact being approved, when relevant")),
		revision: Type.Optional(text(120, "Exact artifact revision, when relevant")),
	}, { additionalProperties: false, description: "Required for approval; omit for decision" })),
}, { additionalProperties: false });
export type AskInput = Static<typeof AskSchema>;
