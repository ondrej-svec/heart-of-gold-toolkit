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

export function metadataFilePath(dataRoot: string): string {
  return join(metadataDir(dataRoot), "shares.jsonl");
}

export function writeMetadata(dataRoot: string, record: ShareRecord): void {
  const filePath = metadataFilePath(dataRoot);
  writeFileSync(filePath, `${JSON.stringify(record)}\n`, { flag: "a" });
}

export function readMetadata(dataRoot: string): ShareRecord[] {
  const filePath = metadataFilePath(dataRoot);
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ShareRecord);
}

export function rewriteMetadata(dataRoot: string, records: ShareRecord[]): void {
  const filePath = metadataFilePath(dataRoot);
  const content = records.map((record) => JSON.stringify(record)).join("\n");
  writeFileSync(filePath, `${content}${content ? "\n" : ""}`, "utf-8");
}

export function writeAlias(dataRoot: string, alias: string, slug: string): void {
  const aliasPath = join(aliasesDir(dataRoot), `${slugify(alias)}.json`);
  writeFileSync(aliasPath, `${JSON.stringify({ alias: slugify(alias), slug }, null, 2)}\n`, "utf-8");
}

export function aliasPath(dataRoot: string, alias: string): string {
  return join(aliasesDir(dataRoot), `${slugify(alias)}.json`);
}

export function readAlias(dataRoot: string, alias: string): string | null {
  const filePath = aliasPath(dataRoot, alias);
  if (!existsSync(filePath)) return null;
  const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as { slug?: string };
  return parsed.slug ?? null;
}

export function deleteAlias(dataRoot: string, alias: string): boolean {
  const filePath = aliasPath(dataRoot, alias);
  if (!existsSync(filePath)) return false;
  rmSync(filePath, { force: true });
  return true;
}

export function removeAliasesForSlug(dataRoot: string, slug: string): string[] {
  const removed: string[] = [];
  const root = aliasesDir(dataRoot);
  if (!existsSync(root)) return removed;
  for (const entry of readdirSync(root)) {
    if (!entry.endsWith('.json')) continue;
    const filePath = join(root, entry);
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as { alias?: string; slug?: string };
      if (parsed.slug === slug) {
        rmSync(filePath, { force: true });
        removed.push(parsed.alias ?? entry.replace(/\.json$/, ''));
      }
    } catch {
      // ignore malformed alias records during cleanup
    }
  }
  return removed;
}

export function deleteArtifact(dataRoot: string, slug: string): boolean {
  const path = artifactPath(dataRoot, slug);
  if (!existsSync(path)) return false;
  rmSync(path, { recursive: true, force: true });
  return true;
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
