import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { ShareRecord } from "./types";

export function artifactsDir(dataRoot: string): string {
  return join(dataRoot, "artifacts");
}

export function aliasesDir(dataRoot: string): string {
  return join(dataRoot, "aliases");
}

export function metadataDir(dataRoot: string): string {
  return join(dataRoot, "metadata");
}

export function ensureStorageLayout(dataRoot: string): void {
  mkdirSync(artifactsDir(dataRoot), { recursive: true });
  mkdirSync(aliasesDir(dataRoot), { recursive: true });
  mkdirSync(metadataDir(dataRoot), { recursive: true });
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "share";
}

export function generateSlug(stem: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${slugify(stem)}--${date}--${randomUUID().slice(0, 8)}`;
}

export function artifactPath(dataRoot: string, slug: string): string {
  return join(artifactsDir(dataRoot), slug);
}

export function writeMetadata(dataRoot: string, record: ShareRecord): void {
  const filePath = join(metadataDir(dataRoot), "shares.jsonl");
  writeFileSync(filePath, `${JSON.stringify(record)}\n`, { flag: "a" });
}

export function writeAlias(dataRoot: string, alias: string, slug: string): void {
  const aliasPath = join(aliasesDir(dataRoot), `${slugify(alias)}.json`);
  writeFileSync(aliasPath, `${JSON.stringify({ alias: slugify(alias), slug }, null, 2)}\n`, "utf-8");
}

export function readAlias(dataRoot: string, alias: string): string | null {
  const aliasPath = join(aliasesDir(dataRoot), `${slugify(alias)}.json`);
  if (!existsSync(aliasPath)) return null;
  const parsed = JSON.parse(readFileSync(aliasPath, "utf-8")) as { slug?: string };
  return parsed.slug ?? null;
}

export function copyDirectoryContents(sourceDir: string, destinationDir: string): void {
  mkdirSync(destinationDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    cpSync(join(sourceDir, entry), join(destinationDir, basename(entry)), { recursive: true });
  }
}

export function resetDirectory(path: string): void {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

export function mimeTypeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}
