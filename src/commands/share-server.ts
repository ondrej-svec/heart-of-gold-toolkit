import { defineCommand } from "citty";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { dataRootForConfig } from "../../share-server/src/config";
import { deleteAlias, deleteArtifact, readAlias, readMetadata, removeAliasesForSlug, rewriteMetadata } from "../../share-server/src/storage";

function packageRoot(): string {
  let dir = dirname(new URL(import.meta.url).pathname);
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "share-server", "src", "index.ts"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error("Cannot find toolkit root from share-server command");
}

const root = packageRoot();
const shareServerEntry = join(root, "share-server", "src", "index.ts");

export const shareServerCommand = defineCommand({
  meta: {
    name: "share-server",
    description: "Manage the Heart of Gold local share server",
  },
  subCommands: {
    start: defineCommand({
      meta: { name: "start", description: "Run the share server in the foreground" },
      args: {
        config: { type: "string", required: false },
        runtimeMode: { type: "string", required: false },
      },
      async run({ args }) {
        const cmd = [shareServerEntry, "start"];
        if (args.config) cmd.push("--config", String(args.config));
        if (args.runtimeMode) cmd.push("--runtime-mode", String(args.runtimeMode));
        const proc = Bun.spawn([process.execPath, ...cmd], { stdout: "inherit", stderr: "inherit", stdin: "inherit" });
        const code = await proc.exited;
        process.exit(code);
      },
    }),
    init: defineCommand({
      meta: { name: "init", description: "Write the share server config" },
      args: {
        config: { type: "string", required: false },
        apiUrl: { type: "string", required: false },
        viewerUrl: { type: "string", required: false },
        publicBaseUrl: { type: "string", required: false },
        provider: { type: "string", required: false },
      },
      async run({ args }) {
        const cmd = [shareServerEntry, "init"];
        if (args.config) cmd.push("--config", String(args.config));
        if (args.apiUrl) cmd.push("--api-url", String(args.apiUrl));
        if (args.viewerUrl) cmd.push("--viewer-url", String(args.viewerUrl));
        if (args.publicBaseUrl) cmd.push("--public-base-url", String(args.publicBaseUrl));
        if (args.provider) cmd.push("--provider", String(args.provider));
        const proc = Bun.spawn([process.execPath, ...cmd], { stdout: "inherit", stderr: "inherit", stdin: "inherit" });
        const code = await proc.exited;
        process.exit(code);
      },
    }),
    health: defineCommand({
      meta: { name: "health", description: "Check local share server health" },
      args: {
        config: { type: "string", required: false },
      },
      async run({ args }) {
        const cmd = [shareServerEntry, "health"];
        if (args.config) cmd.push("--config", String(args.config));
        const proc = Bun.spawn([process.execPath, ...cmd], { stdout: "inherit", stderr: "inherit", stdin: "inherit" });
        const code = await proc.exited;
        process.exit(code);
      },
    }),
    install: defineCommand({
      meta: { name: "install", description: "Install the reference share-server files into ~/.agent-share/server" },
      args: {
        serverDir: { type: "string", required: false },
      },
      run({ args }) {
        const sourceDir = join(root, "share-server");
        const targetDir = resolve(args.serverDir ? String(args.serverDir) : join(homedir(), ".agent-share", "server"));
        mkdirSync(dirname(targetDir), { recursive: true });
        rmSync(targetDir, { recursive: true, force: true });
        cpSync(sourceDir, targetDir, { recursive: true });
        console.log(JSON.stringify({ ok: true, serverDir: targetDir }, null, 2));
      },
    }),
    delete: defineCommand({
      meta: { name: "delete", description: "Delete a published share by slug, or remove an alias" },
      args: {
        slug: { type: "positional", required: false },
        alias: { type: "string", required: false },
        config: { type: "string", required: false },
        onlyAlias: { type: "boolean", required: false },
      },
      run({ args }) {
        const dataRoot = dataRootForConfig(args.config ? String(args.config) : undefined);

        if (args.alias && args.onlyAlias) {
          const alias = String(args.alias);
          const slug = readAlias(dataRoot, alias);
          const removed = deleteAlias(dataRoot, alias);
          console.log(JSON.stringify(removed
            ? { ok: true, alias, slug, removed: true }
            : { ok: false, error: { code: "NOT_FOUND", message: `Alias not found: ${alias}` } }
          ));
          process.exit(removed ? 0 : 1);
        }

        const slug = args.slug ? String(args.slug) : undefined;
        if (!slug) {
          console.error("share-server delete requires either <slug> or --alias <alias> --onlyAlias");
          process.exit(1);
        }

        const removedArtifact = deleteArtifact(dataRoot, slug);
        const removedAliases = removeAliasesForSlug(dataRoot, slug);
        const existing = readMetadata(dataRoot);
        const filtered = existing.filter((record) => record.slug !== slug);
        const metadataRemoved = filtered.length !== existing.length;
        rewriteMetadata(dataRoot, filtered);
        const ok = removedArtifact || metadataRemoved || removedAliases.length > 0;
        console.log(JSON.stringify(ok
          ? { ok: true, slug, removedArtifact, removedAliases, metadataRemoved }
          : { ok: false, error: { code: "NOT_FOUND", message: `Share not found: ${slug}` } }
        ));
        process.exit(ok ? 0 : 1);
      },
    }),
    "install-launch-agent": defineCommand({
      meta: { name: "install-launch-agent", description: "Write a macOS LaunchAgent for the installed reference server" },
      args: {
        config: { type: "string", required: false },
        serverDir: { type: "string", required: false },
      },
      async run({ args }) {
        const cmd = [shareServerEntry, "install-launch-agent"];
        if (args.config) cmd.push("--config", String(args.config));
        if (args.serverDir) cmd.push("--server-dir", String(args.serverDir));
        const proc = Bun.spawn([process.execPath, ...cmd], { stdout: "inherit", stderr: "inherit", stdin: "inherit" });
        const code = await proc.exited;
        process.exit(code);
      },
    }),
  },
});
