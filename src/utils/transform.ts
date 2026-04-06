/**
 * Transform SKILL.md content from Claude Code conventions to target tool conventions.
 */
export function transformContentForCodex(content: string): string {
  return content
    .replace(/~\/\.claude\//g, "~/.codex/")
    .replace(/\.claude\//g, ".codex/")
    .replace(/\/brainstorm\b/g, "$brainstorm")
    .replace(/\/plan\b/g, "$plan")
    .replace(/\/work\b/g, "$work")
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
