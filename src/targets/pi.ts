import { cpSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { transformContentForPi } from "../utils/transform";
import type { Plugin, TargetHandler } from "../types";

export const piTarget: TargetHandler = {
  name: "pi",
  description: "Pi Coding Agent — installs to ~/.pi/agent/skills/",
  defaultRoot: join(homedir(), ".pi", "agent"),

  async write(outputRoot: string, plugin: Plugin): Promise<number> {
    const skillsRoot = join(outputRoot, "skills");
    mkdirSync(skillsRoot, { recursive: true });
    let installed = 0;

    for (const skill of plugin.skills) {
      const destDir = join(skillsRoot, skill.name);
      cpSync(skill.sourceDir, destDir, { recursive: true });

      const skillMdPath = join(destDir, "SKILL.md");
      if (existsSync(skillMdPath)) {
        const content = readFileSync(skillMdPath, "utf-8");
        const transformed = transformContentForPi(content);
        if (transformed !== content) {
          writeFileSync(skillMdPath, transformed);
        }
      }

      installed++;
    }

    return installed;
  },
};
