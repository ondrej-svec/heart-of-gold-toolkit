#!/usr/bin/env bun
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir, platform } from "node:os";
import { ensureConfigAndDataDirs, loadConfig, resolveConfigPath, writeConfig } from "./config";
import { publishArtifact } from "./publish";
import { deleteAlias, deleteArtifact, ensureStorageLayout, readAlias, readMetadata, removeAliasesForSlug, rewriteMetadata } from "./storage";
import { createViewerHandler } from "./viewer";
import type { HealthResponse } from "./types";

const HELP = `Heart of Gold Share Server

Usage:
  bun share-server/src/index.ts start [--config PATH] [--runtime-mode MODE]
  bun share-server/src/index.ts init [--config PATH] [--api-url URL] [--viewer-url URL] [--public-base-url URL] [--provider NAME]
  bun share-server/src/index.ts health [--config PATH]
  bun share-server/src/index.ts install [--server-dir PATH]
  bun share-server/src/index.ts install-launch-agent [--config PATH] [--server-dir PATH]

Commands:
  start                Run the admin and viewer listeners in the foreground
  init                 Write or update the config file with defaults or overrides
  health               Check the local admin /health endpoint
  install              Copy this share-server package into a stable local server directory
  install-launch-agent Write a macOS LaunchAgent for long-running startup
`;

function parseArgs(argv: string[]): { command: string | null; flags: Record<string, string | boolean> } {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return { command: command ?? null, flags };
}

function getListenParts(urlString: string): { hostname: string; port: number } {
  const url = new URL(urlString);
  return {
    hostname: url.hostname,
    port: Number(url.port),
  };
}

async function startServer(flags: Record<string, string | boolean>): Promise<void> {
  const configPath = typeof flags.config === "string" ? flags.config : undefined;
  const runtimeMode = typeof flags["runtime-mode"] === "string" ? String(flags["runtime-mode"]) : "foreground";
  const config = loadConfig(configPath);
  const { dataRoot } = ensureConfigAndDataDirs(configPath);
  ensureStorageLayout(dataRoot);

  const adminParts = getListenParts(config.server.apiUrl);
  const viewerParts = getListenParts(config.server.viewerUrl);

  const health: HealthResponse = {
    ok: true,
    service: "agent-share-server",
    apiVersion: 1,
    provider: config.server.provider,
    viewerUrl: config.server.viewerUrl,
    publicBaseUrl: config.server.publicBaseUrl,
    supports: ["html-file", "static-site-zip", "alias"],
    runtime: {
      mode: runtimeMode,
      platform: platform(),
    },
  };

  const viewerServer = Bun.serve({
    hostname: viewerParts.hostname,
    port: viewerParts.port,
    fetch: createViewerHandler(dataRoot),
  });

  const adminServer = Bun.serve({
    hostname: adminParts.hostname,
    port: adminParts.port,
    async fetch(request) {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/health") {
        return Response.json(health);
      }

      if (request.method === "GET" && url.pathname === "/shares") {
        return Response.json({ ok: true, items: readMetadata(dataRoot) });
      }

      if (request.method === "POST" && url.pathname === "/publish") {
        try {
          const formData = await request.formData();
          const result = await publishArtifact(formData, config, dataRoot);
          return Response.json({
            ok: true,
            id: result.record.id,
            slug: result.record.slug,
            url: result.publicUrl,
            viewerUrl: result.viewerUrl,
            aliasUrl: result.aliasUrl,
            artifactType: result.record.artifactType,
            createdAt: result.record.createdAt,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const code =
            message.includes("artifactType") ? "UNSUPPORTED_ARTIFACT" :
            message.includes("index.html") ? "INDEX_HTML_MISSING" :
            message.includes("Archive") ? "INVALID_ARCHIVE" :
            "INVALID_REQUEST";
          return Response.json({ ok: false, error: { code, message } }, { status: 400 });
        }
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/shares/")) {
        const slug = decodeURIComponent(url.pathname.replace(/^\/shares\//, "")).trim();
        if (!slug) {
          return Response.json({ ok: false, error: { code: "MISSING_SLUG", message: "Share slug is required." } }, { status: 400 });
        }

        const removedArtifact = deleteArtifact(dataRoot, slug);
        const removedAliases = removeAliasesForSlug(dataRoot, slug);
        const existing = readMetadata(dataRoot);
        const filtered = existing.filter((record) => record.slug !== slug);
        const metadataRemoved = filtered.length !== existing.length;
        rewriteMetadata(dataRoot, filtered);

        if (!removedArtifact && !metadataRemoved && removedAliases.length === 0) {
          return Response.json({ ok: false, error: { code: "NOT_FOUND", message: `Share not found: ${slug}` } }, { status: 404 });
        }

        return Response.json({ ok: true, slug, removedArtifact, removedAliases, metadataRemoved });
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/aliases/")) {
        const alias = decodeURIComponent(url.pathname.replace(/^\/aliases\//, "")).trim();
        if (!alias) {
          return Response.json({ ok: false, error: { code: "MISSING_ALIAS", message: "Alias is required." } }, { status: 400 });
        }
        const slug = readAlias(dataRoot, alias);
        const removed = deleteAlias(dataRoot, alias);
        if (!removed) {
          return Response.json({ ok: false, error: { code: "NOT_FOUND", message: `Alias not found: ${alias}` } }, { status: 404 });
        }
        return Response.json({ ok: true, alias, slug, removed: true });
      }

      return Response.json({ ok: false, error: { code: "INVALID_REQUEST", message: "Unknown route" } }, { status: 404 });
    },
  });

  console.log(`Share admin listening on ${config.server.apiUrl}`);
  console.log(`Share viewer listening on ${config.server.viewerUrl}`);
  if (config.server.publicBaseUrl) {
    console.log(`Public viewer base URL: ${config.server.publicBaseUrl}`);
  }
  console.log("Press Ctrl+C to stop.");

  const stop = () => {
    adminServer.stop(true);
    viewerServer.stop(true);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  await new Promise(() => {});
}

function initConfig(flags: Record<string, string | boolean>): void {
  const configPath = typeof flags.config === "string" ? flags.config : undefined;
  const config = loadConfig(configPath);

  if (typeof flags["api-url"] === "string") config.server.apiUrl = String(flags["api-url"]);
  if (typeof flags["viewer-url"] === "string") config.server.viewerUrl = String(flags["viewer-url"]);
  if (typeof flags["public-base-url"] === "string") config.server.publicBaseUrl = String(flags["public-base-url"]);
  if (flags["public-base-url"] === "") config.server.publicBaseUrl = null;
  if (typeof flags.provider === "string") config.server.provider = String(flags.provider);

  const written = writeConfig(config, configPath);
  ensureConfigAndDataDirs(written);
  console.log(JSON.stringify({ ok: true, configPath: written, config }, null, 2));
}

function sourceServerDir(): string {
  return resolve(dirname(new URL(import.meta.url).pathname), "..");
}

function installServer(flags: Record<string, string | boolean>): void {
  const targetDir = resolve(typeof flags["server-dir"] === "string" ? String(flags["server-dir"]) : join(homedir(), ".agent-share", "server"));
  mkdirSync(dirname(targetDir), { recursive: true });
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(sourceServerDir(), targetDir, { recursive: true });
  console.log(JSON.stringify({ ok: true, serverDir: targetDir }, null, 2));
}

function installLaunchAgent(flags: Record<string, string | boolean>): void {
  if (platform() !== "darwin") {
    throw new Error("install-launch-agent is currently supported only on macOS");
  }

  const configPath = resolveConfigPath(typeof flags.config === "string" ? flags.config : undefined);
  const serverDir = resolve(typeof flags["server-dir"] === "string" ? String(flags["server-dir"]) : join(homedir(), ".agent-share", "server"));
  const bunPath = process.execPath;
  const launchAgentsDir = join(homedir(), "Library", "LaunchAgents");
  const plistPath = join(launchAgentsDir, "com.heart-of-gold.share-server.plist");
  mkdirSync(launchAgentsDir, { recursive: true });

  const scriptPath = join(serverDir, "src", "index.ts");
  const logDir = join(homedir(), ".agent-share", "logs");
  mkdirSync(logDir, { recursive: true });
  const stdoutPath = join(logDir, "share-server.stdout.log");
  const stderrPath = join(logDir, "share-server.stderr.log");

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.heart-of-gold.share-server</string>
    <key>ProgramArguments</key>
    <array>
      <string>${bunPath}</string>
      <string>${scriptPath}</string>
      <string>start</string>
      <string>--config</string>
      <string>${configPath}</string>
      <string>--runtime-mode</string>
      <string>launchd</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${stdoutPath}</string>
    <key>StandardErrorPath</key>
    <string>${stderrPath}</string>
    <key>WorkingDirectory</key>
    <string>${serverDir}</string>
  </dict>
</plist>
`;

  writeFileSync(plistPath, plist, "utf-8");
  console.log(JSON.stringify({
    ok: true,
    plistPath,
    next: [
      `launchctl unload ${plistPath} 2>/dev/null || true`,
      `launchctl load ${plistPath}`,
    ],
  }, null, 2));
}

async function checkHealth(flags: Record<string, string | boolean>): Promise<void> {
  const configPath = typeof flags.config === "string" ? flags.config : undefined;
  const config = loadConfig(configPath);
  const response = await fetch(`${config.server.apiUrl.replace(/\/$/, "")}/health`);
  const body = await response.text();
  console.log(body);
  if (!response.ok) process.exit(1);
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (!command || command === "--help" || command === "help") {
    console.log(HELP);
    return;
  }

  switch (command) {
    case "start":
      await startServer(flags);
      return;
    case "init":
      initConfig(flags);
      return;
    case "install":
      installServer(flags);
      return;
    case "install-launch-agent":
      installLaunchAgent(flags);
      return;
    case "health":
      await checkHealth(flags);
      return;
    default:
      console.error(HELP);
      process.exit(1);
  }
}

await main();
