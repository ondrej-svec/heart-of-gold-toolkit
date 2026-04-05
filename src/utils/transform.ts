/**
 * Transform SKILL.md content from Claude Code conventions to target tool conventions.
 */
export function transformContentForCodex(content: string): string {
  return content
    .replace(/~\/\.claude\//g, "~/.codex/")
    .replace(/\.claude\//g, ".codex/");
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
