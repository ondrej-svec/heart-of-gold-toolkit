export const WORKFLOW_PATTERNS = [
  { workflow: "brainstorm", pattern: /^\/(?:skill:brainstorm|brainstorm|deep-thought:brainstorm|deep-thought-brainstorm)\b/i },
  { workflow: "plan", pattern: /^\/(?:skill:plan|plan|deep-thought:plan|deep-thought-plan)\b/i },
  { workflow: "architect", pattern: /^\/(?:skill:architect|architect|deep-thought:architect|deep-thought-architect)\b/i },
];

export const RESET_COMMAND_PATTERN =
  /^\/(?!(?:skill:brainstorm|brainstorm|deep-thought:brainstorm|deep-thought-brainstorm|skill:plan|plan|deep-thought:plan|deep-thought-plan|skill:architect|architect|deep-thought:architect|deep-thought-architect)\b)\S+/i;

export function normalizeInline(text) {
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectWorkflow(text) {
  const trimmed = String(text).trim();
  for (const { workflow, pattern } of WORKFLOW_PATTERNS) {
    if (pattern.test(trimmed)) return workflow;
  }
  return undefined;
}

export function parseExtractionEnvelope(text) {
  try {
    let json = String(text).trim();
    const codeBlock = json.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlock) json = codeBlock[1].trim();
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || typeof parsed.kind !== "string") return null;
    if (parsed.kind === "none") return parsed;
    if (parsed.kind !== "single_choice" && parsed.kind !== "text") return null;
    if (typeof parsed.question !== "string" || parsed.question.trim() === "") return null;
    if (parsed.kind === "single_choice") {
      if (!Array.isArray(parsed.options) || parsed.options.length < 2 || parsed.options.length > 5) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function splitQuestionAndContext(lines, optionStartIndex) {
  const prior = lines.slice(0, optionStartIndex).map((line) => normalizeInline(line)).filter(Boolean);
  if (prior.length === 0) return { question: "Choose an option" };

  let question = prior[prior.length - 1];
  let contextLines = prior.slice(0, -1);

  for (let i = prior.length - 1; i >= 0; i--) {
    const line = prior[i];
    if (line.endsWith("?") || line.endsWith(":")) {
      question = line.replace(/:$/, "");
      contextLines = prior.slice(Math.max(0, i - 2), i);
      break;
    }
  }

  return { question, context: contextLines.join(" ").trim() || undefined };
}

export function heuristicExtractOptions(text) {
  const lines = String(text).split(/\r?\n/);
  const options = [];
  let optionStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/^(\d+\.|[-*])\s+(.*)$/);
    if (!match) {
      if (options.length > 0) break;
      continue;
    }
    if (optionStartIndex === -1) optionStartIndex = i;
    const body = normalizeInline(match[2]);
    const parts = body.split(/\s+[—-]\s+/);
    const label = parts[0]?.trim();
    const description = parts.slice(1).join(" — ").trim() || undefined;
    if (!label) break;
    options.push({ label, description });
  }

  if (optionStartIndex === -1 || options.length < 2 || options.length > 5) return null;
  const { question, context } = splitQuestionAndContext(lines, optionStartIndex);
  return { kind: "single_choice", question, context, options, confidence: "medium" };
}

export function heuristicExtractText(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => normalizeInline(line))
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.endsWith("?")) continue;
    if (/^(if|when|otherwise|for example)\b/i.test(line)) continue;
    return {
      kind: "text",
      question: line,
      context: lines.slice(Math.max(0, i - 2), i).join(" ").trim() || undefined,
      confidence: "low",
    };
  }

  return null;
}

export function heuristicExtractPrompt(text) {
  return heuristicExtractOptions(text) ?? heuristicExtractText(text) ?? { kind: "none", reason: "no clear prompt", confidence: "low" };
}

export function coerceExtractedPrompt(workflow, extracted) {
  if (!extracted || extracted.kind === "none") return null;
  if (extracted.confidence === "low") return null;

  if (extracted.kind === "single_choice") {
    const options = (extracted.options ?? [])
      .filter((option) => option && typeof option.label === "string" && option.label.trim() !== "")
      .map((option) => ({
        label: normalizeInline(option.label),
        description: option.description ? normalizeInline(option.description) : undefined,
      }));
    if (options.length < 2 || options.length > 5) return null;
    return {
      kind: "single_choice",
      workflow,
      question: normalizeInline(extracted.question),
      context: extracted.context ? normalizeInline(extracted.context) : undefined,
      options,
      answerInstruction: extracted.answerInstruction ? normalizeInline(extracted.answerInstruction) : undefined,
      confidence: extracted.confidence,
    };
  }

  return {
    kind: "text",
    workflow,
    question: normalizeInline(extracted.question),
    context: extracted.context ? normalizeInline(extracted.context) : undefined,
    answerInstruction: extracted.answerInstruction ? normalizeInline(extracted.answerInstruction) : undefined,
    confidence: extracted.confidence,
  };
}
