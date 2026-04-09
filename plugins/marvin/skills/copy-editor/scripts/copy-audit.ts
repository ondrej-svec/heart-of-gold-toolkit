#!/usr/bin/env bun
/**
 * copy-audit — Layer 1 deterministic copy-editor engine.
 *
 * Reads a `.copy-editor.yaml` config (or accepts paths on the CLI),
 * loads a language profile from ../rules/, extracts reviewable text
 * chunks per file type, runs the profile's rules, and emits findings.
 *
 * Usage:
 *   bun copy-audit.ts --config .copy-editor.yaml
 *   bun copy-audit.ts --lang cs --paths "content/**\/*.md"
 *   bun copy-audit.ts --self-test
 *   bun copy-audit.ts --config .copy-editor.yaml --json
 *
 * Exit codes:
 *   0 — clean (no error-severity findings)
 *   1 — one or more error-severity findings
 *   2 — configuration or invocation error
 *
 * Non-goals:
 *   - Fixing findings (Layer 2 job, and not even blocking)
 *   - Voice or rhythm judgement (Layer 2, not here)
 *   - Understanding file semantics beyond text extraction
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import type { Finding, LanguageProfile, TextChunk } from "../rules/types.ts";
import { getProfile, listProfiles } from "../rules/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ────────────────────────────────────────────────────────────────────
// CLI parsing
// ────────────────────────────────────────────────────────────────────

interface CliOptions {
  config?: string;
  lang?: string;
  paths?: string[];
  json: boolean;
  verbose: boolean;
  selfTest: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    verbose: false,
    selfTest: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--config":
        options.config = argv[++i];
        break;
      case "--lang":
        options.lang = argv[++i];
        break;
      case "--paths": {
        const next = argv[++i];
        if (next) {
          options.paths = next.split(",").map((s) => s.trim()).filter(Boolean);
        }
        break;
      }
      case "--json":
        options.json = true;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--self-test":
        options.selfTest = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(2);
        }
    }
  }
  return options;
}

function printHelp(): void {
  console.log(`copy-audit — Layer 1 deterministic copy-editor engine

Usage:
  bun copy-audit.ts [options]

Options:
  --config <path>     Path to .copy-editor.yaml
  --lang <code>       Language profile (e.g. cs, en). Overrides config.
  --paths <globs>     Comma-separated list of paths/globs to scan.
                      Overrides config.
  --json              Emit structured JSON instead of human-readable text.
  --verbose           Print per-file progress.
  --self-test         Run fixture-based self tests. Ignores other options.
  -h, --help          Show this help.

Known language profiles: ${listProfiles().join(", ")}

Exit codes:
  0 = clean
  1 = error-severity findings present
  2 = configuration or invocation error
`);
}

// ────────────────────────────────────────────────────────────────────
// Config loading
// ────────────────────────────────────────────────────────────────────

interface CopyEditorConfig {
  language?: string;
  extends?: string[];
  paths?: {
    include?: string[];
    exclude?: string[];
  };
  ignore_marker?: string;
  rules?: Record<string, string>;
  voice_doctrine?: string;
  output?: {
    review_notes_dir?: string;
    structured_findings_dir?: string;
  };
}

function loadConfig(configPath: string): {
  config: CopyEditorConfig;
  configDir: string;
} {
  const absPath = resolve(configPath);
  if (!existsSync(absPath)) {
    console.error(`Config file not found: ${absPath}`);
    process.exit(2);
  }
  const raw = readFileSync(absPath, "utf8");
  const parsed = yaml.load(raw) as CopyEditorConfig | undefined;
  if (!parsed || typeof parsed !== "object") {
    console.error(`Config file is empty or invalid: ${absPath}`);
    process.exit(2);
  }
  return { config: parsed, configDir: dirname(absPath) };
}

// ────────────────────────────────────────────────────────────────────
// File discovery — tiny portable globber
// ────────────────────────────────────────────────────────────────────

/**
 * Convert a simple glob pattern to a RegExp. Supports:
 *   - `**`  any depth of directories
 *   - `*`   any sequence within a single path segment
 *   - `?`   any single character
 *   - literal segments
 *
 * Enough for the path patterns in .copy-editor.yaml. Not a full
 * micromatch replacement — if we need more, swap in a library.
 */
function globToRegExp(glob: string): RegExp {
  const special = /[.+^${}()|[\]\\]/g;
  let re = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // ** — match any depth
        re += ".*";
        i += 2;
        if (glob[i] === "/") i += 1;
      } else {
        // * — match within one segment
        re += "[^/]*";
        i += 1;
      }
    } else if (c === "?") {
      re += "[^/]";
      i += 1;
    } else if (c.match(special)) {
      re += "\\" + c;
      i += 1;
    } else {
      re += c;
      i += 1;
    }
  }
  return new RegExp("^" + re + "$");
}

function walkDir(root: string): string[] {
  const results: string[] = [];
  const stack: string[] = [root];
  const SKIP_DIRS = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    ".turbo",
    ".cache",
    "coverage",
    "__pycache__",
  ]);
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        stack.push(full);
      } else if (entry.isFile()) {
        results.push(full);
      }
    }
  }
  return results;
}

function resolveFiles(
  baseDir: string,
  include: string[],
  exclude: string[],
): string[] {
  const all = walkDir(baseDir);
  const includeRes = include.map(globToRegExp);
  const excludeRes = exclude.map(globToRegExp);
  const out: string[] = [];
  for (const absPath of all) {
    const rel = relative(baseDir, absPath);
    if (!includeRes.some((re) => re.test(rel))) continue;
    if (excludeRes.some((re) => re.test(rel))) continue;
    out.push(absPath);
  }
  return out.sort();
}

// ────────────────────────────────────────────────────────────────────
// Text extraction per file type
// ────────────────────────────────────────────────────────────────────

/**
 * For markdown files, emit chunks that exclude fenced code blocks,
 * inline code, and link URLs. Preserve absolute line/column.
 */
function extractMarkdownChunks(
  filePath: string,
  text: string,
  ignoreMarker: string,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const ignoreLines = collectIgnoreLines(text, ignoreMarker);

  // Strip fenced code blocks by replacing them with blank lines of the
  // same count (preserves line numbers).
  const lines = text.split("\n");
  let inFence = false;
  const cleanedLines: string[] = [];
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      cleanedLines.push("");
      continue;
    }
    if (inFence) {
      cleanedLines.push("");
      continue;
    }
    // Strip inline code spans
    let stripped = line.replace(/`[^`]*`/g, (match) => " ".repeat(match.length));
    // Strip markdown link URLs: keep [label], drop (url)
    stripped = stripped.replace(
      /\[([^\]]*)\]\(([^)]*)\)/g,
      (_, label, url) => "[" + label + "]" + " ".repeat(url.length + 2),
    );
    cleanedLines.push(stripped);
  }
  const cleaned = cleanedLines.join("\n");

  chunks.push({
    text: cleaned,
    filePath,
    startLine: 1,
    startColumn: 1,
    ignoreLines,
  });
  return chunks;
}

/**
 * For JSON files, walk the parsed structure and emit one chunk per
 * string value, with absolute file position computed by searching for
 * the value in the raw text. For small agenda.json this is fine.
 */
function extractJsonChunks(
  filePath: string,
  text: string,
  ignoreMarker: string,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const ignoreLines = collectIgnoreLines(text, ignoreMarker);

  // Use a streaming regex to find all string literals and their positions.
  // JSON strings cannot contain unescaped newlines, so a single-line match
  // is safe and simpler than AST walking.
  const stringRe = /"((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  // We want to skip keys — a string immediately followed by `:` is a key.
  while ((match = stringRe.exec(text)) !== null) {
    const afterEnd = match.index + match[0].length;
    // Skip keys (followed by `:` with optional whitespace)
    let k = afterEnd;
    while (k < text.length && /\s/.test(text[k])) k++;
    if (text[k] === ":") continue;

    // Decode the string content (JSON escapes) — but keep it simple
    // by replacing common escapes only. Rules operate on the decoded
    // text, and positions below still reference the raw JSON.
    const raw = match[1];
    const decoded = raw
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");

    // Compute absolute line/column at the start of the content (one
    // char after the opening quote).
    const contentStart = match.index + 1;
    const before = text.slice(0, contentStart);
    const line = (before.match(/\n/g) || []).length + 1;
    const lastNl = before.lastIndexOf("\n");
    const column = contentStart - (lastNl + 1) + 1;

    chunks.push({
      text: decoded,
      filePath,
      startLine: line,
      startColumn: column,
      ignoreLines,
    });
  }
  return chunks;
}

/**
 * For TypeScript files, extract string literals and template literals.
 * Ignores identifiers, code, comments, and imports. Good enough for
 * harness-lab's localized-content.ts which is mostly string data.
 */
function extractTypescriptChunks(
  filePath: string,
  text: string,
  ignoreMarker: string,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const ignoreLines = collectIgnoreLines(text, ignoreMarker);

  // Match double-quoted, single-quoted, and backtick template literals.
  // We don't attempt to handle nested template expressions — those are
  // treated as opaque and skipped.
  const literalRe = /"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'|`((?:\\.|[^`\\])*)`/g;
  let match: RegExpExecArray | null;
  while ((match = literalRe.exec(text)) !== null) {
    const raw = match[1] ?? match[2] ?? match[3] ?? "";
    const decoded = raw
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\`/g, "`")
      .replace(/\\\\/g, "\\");
    const contentStart = match.index + 1;
    const before = text.slice(0, contentStart);
    const line = (before.match(/\n/g) || []).length + 1;
    const lastNl = before.lastIndexOf("\n");
    const column = contentStart - (lastNl + 1) + 1;
    chunks.push({
      text: decoded,
      filePath,
      startLine: line,
      startColumn: column,
      ignoreLines,
    });
  }
  return chunks;
}

function collectIgnoreLines(text: string, marker: string): Set<number> {
  const set = new Set<number>();
  if (!marker) return set;
  const lines = text.split("\n");
  const needle = marker;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) {
      // Mark the same line and the next line (where the intended
      // exception usually lives).
      set.add(i + 1);
      set.add(i + 2);
    }
  }
  return set;
}

function extractChunks(
  filePath: string,
  text: string,
  ignoreMarker: string,
): TextChunk[] {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".md" || ext === ".markdown" || ext === ".mdx") {
    return extractMarkdownChunks(filePath, text, ignoreMarker);
  }
  if (ext === ".json") {
    return extractJsonChunks(filePath, text, ignoreMarker);
  }
  if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") {
    return extractTypescriptChunks(filePath, text, ignoreMarker);
  }
  // Default: treat as plain text
  return [
    {
      text,
      filePath,
      startLine: 1,
      startColumn: 1,
      ignoreLines: collectIgnoreLines(text, ignoreMarker),
    },
  ];
}

// ────────────────────────────────────────────────────────────────────
// Rule execution
// ────────────────────────────────────────────────────────────────────

function runProfile(profile: LanguageProfile, chunks: TextChunk[]): Finding[] {
  const findings: Finding[] = [];
  for (const chunk of chunks) {
    for (const rule of profile.rules) {
      try {
        const ruleFindings = rule.check(chunk);
        findings.push(...ruleFindings);
      } catch (err) {
        console.error(
          `Rule ${rule.id} crashed on ${chunk.filePath}: ${(err as Error).message}`,
        );
      }
    }
  }
  return findings;
}

// ────────────────────────────────────────────────────────────────────
// Report formatting
// ────────────────────────────────────────────────────────────────────

interface Report {
  totalFiles: number;
  totalFindings: number;
  errorFindings: number;
  warningFindings: number;
  infoFindings: number;
  findings: Finding[];
  byRule: Record<string, number>;
}

function buildReport(files: string[], findings: Finding[]): Report {
  const byRule: Record<string, number> = {};
  let errorFindings = 0;
  let warningFindings = 0;
  let infoFindings = 0;
  for (const f of findings) {
    byRule[f.ruleId] = (byRule[f.ruleId] || 0) + 1;
    if (f.severity === "error") errorFindings++;
    else if (f.severity === "warning") warningFindings++;
    else infoFindings++;
  }
  return {
    totalFiles: files.length,
    totalFindings: findings.length,
    errorFindings,
    warningFindings,
    infoFindings,
    findings,
    byRule,
  };
}

function printHumanReport(report: Report, baseDir: string): void {
  console.log("");
  console.log("copy-audit report");
  console.log("═════════════════");
  console.log(`files scanned:  ${report.totalFiles}`);
  console.log(`findings total: ${report.totalFindings}`);
  console.log(
    `  errors:       ${report.errorFindings}${
      report.errorFindings > 0 ? "  ← BLOCKING" : ""
    }`,
  );
  console.log(`  warnings:     ${report.warningFindings}`);
  console.log(`  info:         ${report.infoFindings}`);
  console.log("");

  if (report.totalFindings === 0) {
    console.log("✓ clean");
    return;
  }

  console.log("by rule:");
  const sortedRules = Object.entries(report.byRule).sort(
    (a, b) => b[1] - a[1],
  );
  for (const [rule, count] of sortedRules) {
    console.log(`  ${rule.padEnd(32)} ${count}`);
  }
  console.log("");

  // Print up to 20 findings, grouped by file
  const byFile: Record<string, Finding[]> = {};
  for (const f of report.findings) {
    byFile[f.filePath] = byFile[f.filePath] || [];
    byFile[f.filePath].push(f);
  }
  let printed = 0;
  const limit = 20;
  for (const [file, items] of Object.entries(byFile)) {
    if (printed >= limit) break;
    console.log(relative(baseDir, file) || file);
    for (const f of items) {
      if (printed >= limit) break;
      const sev = f.severity === "error" ? "E" : f.severity === "warning" ? "W" : "I";
      console.log(
        `  ${sev} ${f.line}:${f.column}  [${f.ruleId}]  ${f.message}`,
      );
      if (f.snippet) {
        console.log(`      → ${JSON.stringify(f.snippet)}`);
      }
      printed += 1;
    }
  }
  if (report.totalFindings > printed) {
    console.log("");
    console.log(
      `… ${report.totalFindings - printed} more findings (use --json for full output)`,
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// Self-test harness
// ────────────────────────────────────────────────────────────────────

async function runSelfTest(): Promise<number> {
  // Delegates to self-test.ts so the engine and the test harness can
  // be maintained separately.
  const { runAllSelfTests } = await import("./self-test.ts");
  return runAllSelfTests();
}

// ────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.selfTest) {
    const code = await runSelfTest();
    process.exit(code);
  }

  // Resolve config, profile, paths
  let configDir = process.cwd();
  let language = opts.lang;
  let include: string[] = [];
  let exclude: string[] = [];
  let ignoreMarker = "copy-editor: ignore";

  if (opts.config) {
    const { config, configDir: dir } = loadConfig(opts.config);
    configDir = dir;
    language = opts.lang || config.language;
    include = opts.paths || config.paths?.include || [];
    exclude = config.paths?.exclude || [];
    if (config.ignore_marker) ignoreMarker = config.ignore_marker;
  } else {
    include = opts.paths || [];
  }

  if (!language) {
    console.error(
      "No language specified. Use --lang or set `language:` in .copy-editor.yaml.",
    );
    process.exit(2);
  }

  const profile = getProfile(language);
  if (!profile) {
    console.error(
      `Unknown language profile: ${language}. Known: ${listProfiles().join(", ")}`,
    );
    process.exit(2);
  }

  if (include.length === 0) {
    console.error(
      "No paths to scan. Provide --paths or set `paths.include` in .copy-editor.yaml.",
    );
    process.exit(2);
  }

  const files = resolveFiles(configDir, include, exclude);

  if (opts.verbose) {
    console.error(`Resolved ${files.length} file(s) under ${configDir}`);
  }

  const allFindings: Finding[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch (err) {
      console.error(`Failed to read ${file}: ${(err as Error).message}`);
      continue;
    }
    if (!statSync(file).isFile()) continue;
    const chunks = extractChunks(file, text, ignoreMarker);
    const findings = runProfile(profile, chunks);
    if (opts.verbose && findings.length > 0) {
      console.error(`  ${relative(configDir, file)}: ${findings.length}`);
    }
    allFindings.push(...findings);
  }

  const report = buildReport(files, allFindings);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report, configDir);
  }

  process.exit(report.errorFindings > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
