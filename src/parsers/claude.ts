import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import yaml from "js-yaml";
import type { Marketplace, Plugin, PluginManifest, Skill } from "../types";

function findPackageRoot(): string {
  // When running via bunx, the package is in a temp dir.
  // Walk up from this file to find the root (where marketplace.json lives).
  let dir = dirname(new URL(import.meta.url).pathname);
  for (let i = 0; i < 10; i++) {
    if (
      existsSync(join(dir, ".claude-plugin", "marketplace.json")) ||
      existsSync(join(dir, "plugins"))
    ) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error("Cannot find toolkit root (no .claude-plugin/marketplace.json found)");
}

export function loadMarketplace(rootDir?: string): Marketplace {
  const root = rootDir ?? findPackageRoot();
  const marketplacePath = join(root, ".claude-plugin", "marketplace.json");
  if (!existsSync(marketplacePath)) {
    throw new Error(`Marketplace manifest not found at ${marketplacePath}`);
  }
  return JSON.parse(readFileSync(marketplacePath, "utf-8"));
}

function parseSkillFrontmatter(
  skillMdPath: string
): { name: string; description: string } | null {
  const content = readFileSync(skillMdPath, "utf-8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try {
    const fm = yaml.load(match[1]) as Record<string, unknown>;
    return {
      name: (fm.name as string) || "",
      description: (fm.description as string)?.trim() || "",
    };
  } catch {
    return null;
  }
}

function discoverSkills(skillsDir: string): Skill[] {
  if (!existsSync(skillsDir)) return [];
  const skills: Skill[] = [];
  for (const entry of readdirSync(skillsDir)) {
    const skillDir = join(skillsDir, entry);
    if (!statSync(skillDir).isDirectory()) continue;
    const skillMd = join(skillDir, "SKILL.md");
    if (!existsSync(skillMd)) continue;
    const fm = parseSkillFrontmatter(skillMd);
    if (!fm || !fm.name) continue;
    skills.push({
      name: fm.name,
      description: fm.description,
      sourceDir: skillDir,
    });
  }
  return skills;
}

export function loadPlugin(pluginDir: string): Plugin {
  const manifestPath = join(pluginDir, ".claude-plugin", "plugin.json");
  const pluginJsonPath = join(pluginDir, "plugin.json");
  let manifest: PluginManifest;

  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } else if (existsSync(pluginJsonPath)) {
    manifest = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
  } else {
    throw new Error(`No plugin manifest found in ${pluginDir}`);
  }

  const skillsDir = join(pluginDir, "skills");
  const skills = discoverSkills(skillsDir);

  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    skills,
    rootDir: pluginDir,
  };
}

export function loadAllPlugins(rootDir?: string): Plugin[] {
  const root = rootDir ?? findPackageRoot();
  const marketplace = loadMarketplace(root);
  return marketplace.plugins.map((entry) => {
    const pluginDir = resolve(root, entry.source);
    return loadPlugin(pluginDir);
  });
}
