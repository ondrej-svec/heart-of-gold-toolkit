/**
 * Transform SKILL.md content from Claude Code conventions to target tool conventions.
 */
const CODEX_COMMAND_ALIASES: Record<string, string> = {
  "/architect": "$architect",
  "/architecture-review": "$architecture-review",
  "/audio": "$audio",
  "/babel-fish:visualize": "$visualize",
  "/brainstorm": "$brainstorm",
  "/capture": "$capture",
  "/coach": "$coach",
  "/codex": "$codex",
  "/compound": "$compound",
  "/craft-skill": "$craft-skill",
  "/cto": "$cto",
  "/deep-thought:architect": "$architect",
  "/deep-thought:architecture-review": "$architecture-review",
  "/deep-thought:brainstorm": "$brainstorm",
  "/deep-thought:craft-skill": "$craft-skill",
  "/deep-thought:cto": "$cto",
  "/deep-thought:investigate": "$investigate",
  "/deep-thought:plan": "$plan",
  "/deep-thought:review": "$review",
  "/deep-thought:think": "$think",
  "/gemini": "$gemini",
  "/goal-checkin": "$goal-checkin",
  "/goal-setting": "$goal-setting",
  "/guide:capture": "$capture",
  "/guide:codex": "$codex",
  "/guide:gemini": "$gemini",
  "/guide:pipeline": "$pipeline",
  "/guide:setup": "$setup",
  "/guide:write-post": "$write-post",
  "/image": "$image",
  "/investigate": "$investigate",
  "/marvin:compound": "$compound",
  "/marvin:quick-review": "$quick-review",
  "/marvin:redteam": "$redteam",
  "/marvin:review": "$review",
  "/marvin:scaffold": "$scaffold",
  "/marvin:test-writer": "$test-writer",
  "/marvin:work": "$work",
  "/pipeline": "$pipeline",
  "/plan": "$plan",
  "/quick-review": "$quick-review",
  "/redteam": "$redteam",
  "/reflect": "$reflect",
  "/review": "$review",
  "/scaffold": "$scaffold",
  "/setup": "$setup",
  "/test-writer": "$test-writer",
  "/think": "$think",
  "/visualize": "$visualize",
  "/work": "$work",
  "/write-post": "$write-post",
};

function replaceCodexCommandAliases(content: string): string {
  let transformed = content;
  for (const [source, target] of Object.entries(CODEX_COMMAND_ALIASES).sort(
    ([a], [b]) => b.length - a.length
  )) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    transformed = transformed.replace(new RegExp(`${escaped}\\b`, "g"), target);
  }
  return transformed;
}

export function transformContentForCodex(content: string): string {
  return replaceCodexCommandAliases(content)
    .replace(/~\/\.claude\//g, "~/.codex/")
    .replace(/\.claude\//g, ".codex/")
    .replace(
      /Prefer the harness's structured question UI when available; otherwise ask plainly in text and wait for the answer before continuing\./g,
      "In Codex, prefer the structured user-input UI when available; otherwise ask plainly in text and wait for the answer before continuing."
    )
    .replace(
      /Prefer the harness's structured question UI when available; otherwise ask plainly in text and wait for the answer before continuing:/g,
      "In Codex, prefer the structured user-input UI when available; otherwise ask plainly in text and wait for the answer before continuing:"
    )
    .replace(
      /Prefer the harness's structured question UI if available/g,
      "In Codex, prefer the structured user-input UI when available"
    )
    .replace(
      /Prefer the harness's structured choice UI if available/g,
      "In Codex, prefer the structured user-input choice UI when available"
    )
    .replace(
      /Prefer the harness's structured choice UI when available/g,
      "In Codex, prefer the structured user-input choice UI when available"
    )
    .replace(
      /If the harness provides task or progress UI, mirror the major plan tasks there\./g,
      "If Codex provides task or progress UI, mirror the major plan tasks there."
    );
}

export function transformContentForOpenCode(content: string): string {
  return content
    .replace(/~\/\.claude\//g, "~/.agents/")
    .replace(/\.claude\//g, ".agents/");
}

export function transformContentForPi(content: string): string {
  return content
    .replace(/~\/\.claude\//g, "~/.pi/agent/")
    .replace(/\.claude\//g, ".pi/agent/");
}
