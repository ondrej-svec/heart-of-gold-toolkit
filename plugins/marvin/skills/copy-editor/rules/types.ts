/**
 * Shared types for the copy-editor Layer 1 deterministic engine.
 *
 * Rules are pure data: an id, a description, a severity, and a `check`
 * function that receives a TextChunk and returns Findings. Rules never
 * touch the filesystem — extraction is the engine's job.
 *
 * A LanguageProfile bundles rules per language. Adding a new language is
 * adding a new file under rules/ and registering it in index.ts.
 */

export type Severity = "error" | "warning" | "info";

export interface Finding {
  ruleId: string;
  severity: Severity;
  filePath: string;
  line: number; // 1-indexed absolute line in file
  column: number; // 1-indexed absolute column
  snippet: string; // the matching text (trimmed)
  message: string; // short human-readable reason
}

/**
 * A contiguous span of reviewable text extracted from a source file.
 * The engine produces chunks per file type (markdown strips code
 * fences, JSON walks string values, TS extracts string literals), and
 * rules run against chunks without knowing about file formats.
 *
 * startLine and startColumn are 1-indexed absolute positions so rules
 * can compute accurate file locations by adding line offsets from
 * within the chunk text.
 */
export interface TextChunk {
  text: string;
  filePath: string;
  startLine: number;
  startColumn: number;
  /**
   * Lines (absolute, 1-indexed) the caller has flagged to ignore —
   * typically because an ignore marker was present on or just before
   * them in the source file.
   */
  ignoreLines?: Set<number>;
}

export interface Rule {
  id: string;
  description: string;
  severity: Severity;
  /**
   * Human-readable rule reference for report output. Usually the same
   * as id but friendlier.
   */
  label?: string;
  check(chunk: TextChunk): Finding[];
}

export interface LanguageProfile {
  language: string; // ISO code, e.g. 'cs', 'en'
  name: string; // Display name, e.g. 'Czech', 'English'
  rules: Rule[];
}

/**
 * Helper: compute (line, column) within a chunk from a character offset
 * inside chunk.text, returning the absolute position in the source file.
 */
export function locateInChunk(
  chunk: TextChunk,
  offset: number,
): { line: number; column: number } {
  let line = chunk.startLine;
  let column = chunk.startColumn;
  for (let i = 0; i < offset; i++) {
    if (chunk.text[i] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}
