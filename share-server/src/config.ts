import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ShareServerConfig } from "./types";

export const DEFAULT_CONFIG_PATH = join(homedir(), ".agent-share", "config.json");

export function resolveConfigPath(input?: string): string {
  return resolve(input ?? DEFAULT_CONFIG_PATH);
}

export function defaultConfig(): ShareServerConfig {
  return {
    server: {
      apiUrl: "http://127.0.0.1:4815",
      viewerUrl: "http://127.0.0.1:4816",
      publicBaseUrl: null,
      apiToken: null,
      provider: "reference",
      version: 1,
    },
    defaults: {
      publishMode: "immutable",
      aliasStrategy: "none",
      openAfterPublish: false,
    },
  };
}

export function loadConfig(configPath?: string): ShareServerConfig {
  const resolved = resolveConfigPath(configPath);
  if (!existsSync(resolved)) return defaultConfig();

  const raw = JSON.parse(readFileSync(resolved, "utf-8")) as Partial<ShareServerConfig>;
  const base = defaultConfig();
  return {
    server: {
      ...base.server,
      ...(raw.server ?? {}),
    },
    defaults: {
      ...base.defaults,
      ...(raw.defaults ?? {}),
    },
  };
}

export function writeConfig(config: ShareServerConfig, configPath?: string): string {
  const resolved = resolveConfigPath(configPath);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
  return resolved;
}

export function dataRootForConfig(configPath?: string): string {
  return join(dirname(resolveConfigPath(configPath)), "data");
}

export function ensureConfigAndDataDirs(configPath?: string): { configPath: string; dataRoot: string } {
  const resolved = resolveConfigPath(configPath);
  const dataRoot = dataRootForConfig(resolved);
  mkdirSync(dirname(resolved), { recursive: true });
  mkdirSync(dataRoot, { recursive: true });
  return { configPath: resolved, dataRoot };
}
