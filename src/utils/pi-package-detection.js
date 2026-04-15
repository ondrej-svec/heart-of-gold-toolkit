import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { homedir } from "node:os";

const HEART_OF_GOLD_PACKAGE_NAME = "@heart-of-gold/toolkit";
const HEART_OF_GOLD_REPO_HINT = /(^|[/:])heart-of-gold-toolkit(?:$|[@/.#?])/i;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function isLocalSource(source) {
  return source.startsWith(".") || source.startsWith("/");
}

function localSourceIsHeartOfGold(source, settingsDir) {
  const resolved = resolve(settingsDir, source);
  const packageJsonPath = existsSync(resolved) && resolved.endsWith("package.json")
    ? resolved
    : join(resolved, "package.json");

  if (!existsSync(packageJsonPath)) return false;

  const manifest = readJson(packageJsonPath);
  return manifest?.name === HEART_OF_GOLD_PACKAGE_NAME;
}

function sourceMatchesHeartOfGold(source, settingsDir) {
  if (typeof source !== "string" || source.length === 0) return false;

  if (source === HEART_OF_GOLD_PACKAGE_NAME) return true;
  if (source.startsWith(`npm:${HEART_OF_GOLD_PACKAGE_NAME}`)) return true;
  if (isLocalSource(source) && localSourceIsHeartOfGold(source, settingsDir)) return true;
  if ((source.startsWith("git:") || source.startsWith("http://") || source.startsWith("https://") || source.startsWith("ssh://")) && HEART_OF_GOLD_REPO_HINT.test(source)) {
    return true;
  }

  return false;
}

function collectMatchingPackageSources(settingsPath) {
  if (!existsSync(settingsPath)) return [];

  const settings = readJson(settingsPath);
  const packages = Array.isArray(settings?.packages) ? settings.packages : [];
  const settingsDir = dirname(settingsPath);
  const matches = [];

  for (const entry of packages) {
    const source = typeof entry === "string" ? entry : entry?.source;
    if (sourceMatchesHeartOfGold(source, settingsDir)) {
      matches.push({ settingsPath, source });
    }
  }

  return matches;
}

function findNearestProjectSettings(startDir = process.cwd()) {
  let current = resolve(startDir);
  const root = parse(current).root;

  while (true) {
    const candidate = join(current, ".pi", "settings.json");
    if (existsSync(candidate)) return candidate;
    if (current === root) return null;
    current = dirname(current);
  }
}

export function findHeartOfGoldPiPackageInstalls(startDir = process.cwd()) {
  const globalSettings = join(homedir(), ".pi", "agent", "settings.json");
  const projectSettings = findNearestProjectSettings(startDir);
  const settingsPaths = [globalSettings, projectSettings].filter(Boolean);

  return settingsPaths.flatMap((settingsPath) => collectMatchingPackageSources(settingsPath));
}
