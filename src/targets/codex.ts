import { cpSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { transformContentForCodex } from "../utils/transform";
import type { Plugin, TargetHandler } from "../types";

export const codexTarget: TargetHandler = {
  name: "codex",
  description: "OpenAI Codex CLI — installs to ~/.codex/skills/",
  defaultRoot: join(homedir(), ".codex"),

  async write(outputRoot: string, plugin: Plugin): Promise<number> {
    const skillsRoot = join(outputRoot, "skills");
    mkdirSync(skillsRoot, { recursive: true });
    let installed = 0;

    for (const skill of plugin.skills) {
      const destDir = join(skillsRoot, skill.name);

      // Copy entire skill directory (SKILL.md + scripts/ + references/ + knowledge/)
      cpSync(skill.sourceDir, destDir, { recursive: true });

      // Transform SKILL.md content for Codex conventions
      const skillMdPath = join(destDir, "SKILL.md");
      if (existsSync(skillMdPath)) {
        const content = readFileSync(skillMdPath, "utf-8");
        const transformed = transformContentForCodex(content);
        if (transformed !== content) {
          writeFileSync(skillMdPath, transformed);
        }
      }

      installed++;
    }

    return installed;
  },
};
