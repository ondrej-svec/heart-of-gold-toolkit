/**
 * Lockfile I/O for the copy-editor segmentation cache.
 *
 * Reads and writes `.copy-editor.lock.json` — a committed, reviewable
 * cache of LLM segmentation output. Schema is documented in
 * `../knowledge/lockfile-schema.md`.
 *
 * The lockfile is the load-bearing artifact that lets Layer 1 stay
 * reproducible despite the LLM segmenter being non-deterministic. Given
 * the same lockfile, the same input bytes always produce the same
 * Layer 1 verdict.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import type { ChunkKind } from "../rules/types.ts";

export const LOCKFILE_SCHEMA_VERSION = 1;

/**
 * Which segmenter produced the entries in the lockfile.
 *
 * - "agent": the host agent running the copy-editor skill (Claude Code or
 *   any other LLM runtime that drives the skill loop). This is the primary
 *   path. The script itself never calls a model.
 * - "structural": a deterministic, no-agent fallback that walks JSON key
 *   paths, markdown front-matter, and markdown info-strings. Used when
 *   `--offline` is passed or when no agent is in the loop. Strictly less
 *   powerful than the agent path.
 * - "manual": the lockfile was hand-authored from the start. No backend
 *   in the traditional sense.
 */
export type SegmenterBackend = "agent" | "structural" | "manual";

export interface LockfileSegmenter {
  backend: SegmenterBackend;
  /**
   * Prompt template version. Required when backend is "agent". Bumping
   * invalidates only entries where reviewedBy is null — reviewed entries
   * keep their human signoff until a content change forces a refresh.
   */
  promptVersion?: number;
}

export interface LockfileSpan {
  /** 1-based inclusive line numbers. */
  startLine: number;
  /** 1-based inclusive. Column 1 is the first character of the line. */
  startColumn: number;
  endLine: number;
  endColumn: number;
  /** ISO 639-1 lowercase or "unknown". For code/data spans, always "unknown". */
  language: string;
  kind: ChunkKind;
  pathHint?: string | null;
  note?: string | null;
}

export interface LockfileEntry {
  /** Format: "sha256:<hex>" */
  contentHash: string;
  /** ISO 8601 UTC timestamp. */
  segmentedAt: string;
  /** Honour-system reviewer identifier. null = pending review. */
  reviewedBy: string | null;
  /** Ordered, non-overlapping. May be empty for uniform-language files. */
  spans: LockfileSpan[];
}

export interface Lockfile {
  schemaVersion: number;
  segmenter: LockfileSegmenter;
  /** Map from repo-relative path to entry. */
  files: Record<string, LockfileEntry>;
}

/**
 * Compute the content hash for a file's bytes. Returns "sha256:<hex>".
 *
 * The input is normalised to a Buffer to keep the hash stable across
 * call sites that pass strings vs. buffers.
 */
export function hashFileBytes(bytes: string | Buffer): string {
  const hash = createHash("sha256");
  hash.update(typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes);
  return `sha256:${hash.digest("hex")}`;
}

/**
 * Read and validate a lockfile from disk.
 *
 * Returns null if the file does not exist (a missing lockfile is the
 * legal initial state, not an error). Throws on parse errors,
 * schemaVersion mismatch, or shape validation failures — the engine
 * halts in those cases rather than silently degrading.
 */
export function readLockfile(path: string): Lockfile | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Lockfile at ${path} is not valid JSON: ${(err as Error).message}`,
    );
  }
  return validateLockfile(parsed, path);
}

/**
 * Write a lockfile to disk with stable formatting (2-space indent,
 * trailing newline). Stable formatting matters because the lockfile is
 * committed and diffed.
 */
export function writeLockfile(path: string, lockfile: Lockfile): void {
  const validated = validateLockfile(lockfile, path);
  const sorted = sortLockfile(validated);
  const serialized = `${JSON.stringify(sorted, null, 2)}\n`;
  writeFileSync(path, serialized, "utf8");
}

/**
 * Sort the lockfile for deterministic on-disk representation:
 *   - top-level `files` keys sorted alphabetically by path
 *   - each entry's `spans` sorted by (startLine, startColumn)
 *
 * Sorting at write time means hand-edits do not produce diff churn from
 * key reordering across runs.
 */
function sortLockfile(lockfile: Lockfile): Lockfile {
  const sortedFiles: Record<string, LockfileEntry> = {};
  for (const path of Object.keys(lockfile.files).sort()) {
    const entry = lockfile.files[path];
    sortedFiles[path] = {
      ...entry,
      spans: [...entry.spans].sort((a, b) => {
        if (a.startLine !== b.startLine) return a.startLine - b.startLine;
        return a.startColumn - b.startColumn;
      }),
    };
  }
  return { ...lockfile, files: sortedFiles };
}

/**
 * Validate a parsed lockfile against the v1 schema. Throws a detailed
 * error message on the first failure. Returns the value typed as
 * Lockfile on success.
 */
function validateLockfile(value: unknown, source: string): Lockfile {
  if (!isObject(value)) {
    throw new Error(`Lockfile at ${source} must be a JSON object.`);
  }
  const { schemaVersion, segmenter, files } = value as Record<string, unknown>;

  if (schemaVersion !== LOCKFILE_SCHEMA_VERSION) {
    throw new Error(
      `Lockfile at ${source} has schemaVersion ${String(
        schemaVersion,
      )}; expected ${LOCKFILE_SCHEMA_VERSION}. Migration is required.`,
    );
  }

  if (!isObject(segmenter)) {
    throw new Error(`Lockfile at ${source} is missing segmenter object.`);
  }
  const { backend, promptVersion } = segmenter as Record<string, unknown>;
  if (backend !== "agent" && backend !== "structural" && backend !== "manual") {
    throw new Error(
      `Lockfile at ${source} has invalid segmenter.backend: ${String(backend)}. ` +
        `Expected "agent", "structural", or "manual".`,
    );
  }
  if (backend === "agent") {
    if (typeof promptVersion !== "number" || !Number.isInteger(promptVersion)) {
      throw new Error(
        `Lockfile at ${source}: segmenter.backend "agent" requires an integer promptVersion.`,
      );
    }
  }

  if (!isObject(files)) {
    throw new Error(`Lockfile at ${source} is missing files object.`);
  }

  const validatedFiles: Record<string, LockfileEntry> = {};
  for (const [path, entry] of Object.entries(files as Record<string, unknown>)) {
    validatedFiles[path] = validateEntry(entry, path, source);
  }

  return {
    schemaVersion: LOCKFILE_SCHEMA_VERSION,
    segmenter: {
      backend,
      ...(backend === "agent"
        ? { promptVersion: promptVersion as number }
        : {}),
    },
    files: validatedFiles,
  };
}

function validateEntry(
  value: unknown,
  path: string,
  source: string,
): LockfileEntry {
  if (!isObject(value)) {
    throw new Error(`Lockfile at ${source}: entry for ${path} must be an object.`);
  }
  const { contentHash, segmentedAt, reviewedBy, spans } = value as Record<
    string,
    unknown
  >;

  if (typeof contentHash !== "string" || !contentHash.startsWith("sha256:")) {
    throw new Error(
      `Lockfile at ${source}: entry for ${path} has invalid contentHash (must be "sha256:<hex>").`,
    );
  }
  if (typeof segmentedAt !== "string") {
    throw new Error(
      `Lockfile at ${source}: entry for ${path} is missing segmentedAt.`,
    );
  }
  if (reviewedBy !== null && typeof reviewedBy !== "string") {
    throw new Error(
      `Lockfile at ${source}: entry for ${path} has invalid reviewedBy (must be string or null).`,
    );
  }
  if (!Array.isArray(spans)) {
    throw new Error(
      `Lockfile at ${source}: entry for ${path} is missing spans array.`,
    );
  }

  const validatedSpans = spans.map((span, i) => validateSpan(span, path, i, source));
  assertNonOverlapping(validatedSpans, path, source);

  return {
    contentHash,
    segmentedAt,
    reviewedBy,
    spans: validatedSpans,
  };
}

function validateSpan(
  value: unknown,
  path: string,
  index: number,
  source: string,
): LockfileSpan {
  if (!isObject(value)) {
    throw new Error(
      `Lockfile at ${source}: ${path} span ${index} must be an object.`,
    );
  }
  const v = value as Record<string, unknown>;
  for (const field of ["startLine", "startColumn", "endLine", "endColumn"]) {
    const n = v[field];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
      throw new Error(
        `Lockfile at ${source}: ${path} span ${index} has invalid ${field} (must be 1-based integer).`,
      );
    }
  }
  if (typeof v.language !== "string" || v.language.length === 0) {
    throw new Error(
      `Lockfile at ${source}: ${path} span ${index} has invalid language.`,
    );
  }
  const kind = v.kind;
  if (kind !== "prose" && kind !== "code" && kind !== "quote" && kind !== "data") {
    throw new Error(
      `Lockfile at ${source}: ${path} span ${index} has invalid kind: ${String(kind)}`,
    );
  }
  const startLine = v.startLine as number;
  const endLine = v.endLine as number;
  const startColumn = v.startColumn as number;
  const endColumn = v.endColumn as number;
  if (
    endLine < startLine ||
    (endLine === startLine && endColumn < startColumn)
  ) {
    throw new Error(
      `Lockfile at ${source}: ${path} span ${index} ends before it starts.`,
    );
  }
  return {
    startLine,
    startColumn,
    endLine,
    endColumn,
    language: v.language as string,
    kind,
    pathHint: v.pathHint === undefined ? null : (v.pathHint as string | null),
    note: v.note === undefined ? null : (v.note as string | null),
  };
}

/**
 * Assert that spans within a single file do not overlap. Spans must
 * either be on different lines or, on the same line, share no column
 * range. Touching boundaries (one ends at column N, the next starts at
 * N+1) is allowed.
 */
function assertNonOverlapping(
  spans: LockfileSpan[],
  path: string,
  source: string,
): void {
  const sorted = [...spans].sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine;
    return a.startColumn - b.startColumn;
  });
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevAfterCurr =
      prev.endLine < curr.startLine ||
      (prev.endLine === curr.startLine && prev.endColumn < curr.startColumn);
    if (!prevAfterCurr) {
      throw new Error(
        `Lockfile at ${source}: ${path} has overlapping spans at ` +
          `(${prev.startLine}:${prev.startColumn}-${prev.endLine}:${prev.endColumn}) and ` +
          `(${curr.startLine}:${curr.startColumn}-${curr.endLine}:${curr.endColumn}).`,
      );
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Find the span (if any) that contains the given 1-based (line, column)
 * position. Spans are inclusive on both endpoints. Returns undefined when
 * no span covers the position — callers should fall back to the config
 * default in that case.
 *
 * Assumes spans are non-overlapping (validated at lockfile read time),
 * so at most one span can match. Iterates linearly because span lists
 * are short (tens of entries per file at most); a binary search would
 * not pay for itself.
 */
export function lookupSpanAt(
  spans: LockfileSpan[],
  line: number,
  column: number,
): LockfileSpan | undefined {
  for (const span of spans) {
    if (line < span.startLine || line > span.endLine) continue;
    if (line === span.startLine && column < span.startColumn) continue;
    if (line === span.endLine && column > span.endColumn) continue;
    return span;
  }
  return undefined;
}
