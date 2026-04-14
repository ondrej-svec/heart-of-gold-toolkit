import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, normalize, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { artifactPath, copyDirectoryContents, ensureStorageLayout, generateSlug, writeAlias, writeMetadata } from "./storage";
import type { ShareRecord, ShareServerConfig } from "./types";

interface PublishResult {
  record: ShareRecord;
  viewerUrl: string;
  publicUrl: string;
  aliasUrl: string | null;
}

function buildViewerUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/$/, "")}/s/${slug}/`;
}

function buildAliasUrl(baseUrl: string, alias: string): string {
  return `${baseUrl.replace(/\/$/, "")}/latest/${alias}/`;
}

function safeZipEntries(zipPath: string): string[] {
  const stdout = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf-8" });
  const entries = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const entry of entries) {
    if (isAbsolute(entry)) {
      throw new Error(`Archive contains absolute path entry: ${entry}`);
    }
    const normalized = normalize(entry);
    if (normalized.startsWith("..") || normalized.includes("../")) {
      throw new Error(`Archive contains unsafe path traversal entry: ${entry}`);
    }
  }
  return entries;
}

function resolveSiteRoot(extractDir: string): string {
  const rootIndex = join(extractDir, "index.html");
  if (existsSync(rootIndex)) return extractDir;

  const entries = readdirSync(extractDir)
    .map((name) => join(extractDir, name))
    .filter((path) => statSync(path).isDirectory());

  if (entries.length === 1 && existsSync(join(entries[0], "index.html"))) {
    return entries[0];
  }

  throw new Error("Archive must contain index.html at the root or in a single top-level directory");
}

export async function publishArtifact(
  formData: FormData,
  config: ShareServerConfig,
  dataRoot: string,
): Promise<PublishResult> {
  ensureStorageLayout(dataRoot);

  const artifact = formData.get("artifact");
  const artifactType = String(formData.get("artifactType") ?? "");
  const requestedSlug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const alias = String(formData.get("alias") ?? "").trim() || null;

  if (!(artifact instanceof File)) {
    throw new Error("artifact file is required");
  }
  if (artifactType !== "html-file" && artifactType !== "static-site-zip") {
    throw new Error("artifactType must be one of: html-file, static-site-zip");
  }

  const stem = requestedSlug || title || basename(artifact.name || "share");
  const slug = generateSlug(stem);
  const destinationDir = artifactPath(dataRoot, slug);
  mkdirSync(destinationDir, { recursive: true });

  if (artifactType === "html-file") {
    const html = await artifact.text();
    writeFileSync(join(destinationDir, "index.html"), html, "utf-8");
  } else {
    const tempRoot = mkdtempSync(join(tmpdir(), "hog-share-zip-"));
    const zipPath = join(tempRoot, artifact.name || `${randomUUID()}.zip`);
    const extractDir = join(tempRoot, "extract");

    try {
      writeFileSync(zipPath, Buffer.from(await artifact.arrayBuffer()));
      safeZipEntries(zipPath);
      mkdirSync(extractDir, { recursive: true });
      execFileSync("unzip", ["-qq", zipPath, "-d", extractDir]);
      const siteRoot = resolveSiteRoot(extractDir);
      copyDirectoryContents(siteRoot, destinationDir);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  const record: ShareRecord = {
    id: `shr_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    slug,
    title,
    alias,
    artifactType: artifactType as ShareRecord["artifactType"],
    createdAt: new Date().toISOString(),
    sourceName: artifact.name || "share",
  };

  writeMetadata(dataRoot, record);
  if (alias) {
    writeAlias(dataRoot, alias, slug);
  }

  const viewerUrl = buildViewerUrl(config.server.viewerUrl, slug);
  const publicUrl = buildViewerUrl(config.server.publicBaseUrl ?? config.server.viewerUrl, slug);
  const aliasUrl = alias ? buildAliasUrl(config.server.publicBaseUrl ?? config.server.viewerUrl, alias) : null;

  return {
    record,
    viewerUrl,
    publicUrl,
    aliasUrl,
  };
}

export function safeResolveArtifactFile(baseDir: string, relativePath: string): string | null {
  const clean = relativePath.replace(/^\/+/, "");
  const resolved = resolve(baseDir, clean);
  if (!resolved.startsWith(resolve(baseDir))) return null;
  return resolved;
}
