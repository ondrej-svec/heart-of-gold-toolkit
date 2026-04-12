#!/usr/bin/env bun
/**
 * self-test — fixture-based regression tests for every rule in every
 * language profile.
 *
 * For each rule we assert:
 *   - it fires at least once on a known-bad fixture
 *   - it does NOT fire on a known-good fixture
 *
 * Run via:
 *   bun self-test.ts
 *   bun copy-audit.ts --self-test  (delegates here)
 *
 * Exit code 0 = all tests passed; 1 = one or more failed.
 *
 * Adding a new rule:
 *   1. Add a case to TESTS below with bad/good fixture strings
 *   2. Run `bun self-test.ts`
 *   3. The test fails loudly if the new rule doesn't behave
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Finding, LanguageProfile, Rule } from "../rules/types.ts";
import { PROFILES } from "../rules/index.ts";
import {
  hashFileBytes,
  lookupSpanAt,
  readLockfile,
  writeLockfile,
  type Lockfile,
  type LockfileSpan,
} from "./lockfile.ts";
import { filterFindingsBySpans } from "./finding-filter.ts";

interface RuleTest {
  ruleId: string;
  bad: string;
  good: string;
}

const TESTS: Record<string, RuleTest[]> = {
  cs: [
    {
      ruleId: "cs-R1-nbsp-prep",
      bad: "Najdete to v repu pod AGENTS.md",
      good: "Najdete to v\u00A0repu pod AGENTS.md",
    },
    {
      ruleId: "cs-R2-quotes",
      bad: 'Řekl jen: "workshop začíná v devět"',
      good: 'Řekl jen: „workshop začíná v devět"',
    },
    {
      ruleId: "cs-R3-ellipsis",
      bad: "Počkejte chvíli... pak pokračujte",
      good: "Počkejte chvíli… pak pokračujte",
    },
    {
      ruleId: "cs-R4-number-unit",
      bad: "Zaplatíte 50Kč a máte 99% šanci",
      good: "Zaplatíte 50 Kč a máte 99 % šanci",
    },
    {
      ruleId: "cs-R5-ordinal-space",
      bad: "Přijďte 1.dubna ráno",
      good: "Přijďte 1. dubna ráno",
    },
    {
      ruleId: "cs-R6-dash",
      bad: "Strana 23-26 obsahuje české texty mezi slova - vložené - parenteticky",
      good: "Strana 23–26 obsahuje české texty mezi slova – vložené – parenteticky",
    },
    {
      // R6 must NOT fire on multi-segment identifiers like the
      // Liberating Structures method name `1-2-4-All`. The bad example
      // uses a standalone numeric range; the good example uses the
      // method name, which should be left alone.
      ruleId: "cs-R6-dash",
      bad: "Pošlete mi 2-3 otázky před sessionou",
      good: "Použijte 1-2-4-All formát na reflexi, pošlete mi 2–3 otázky",
    },
    {
      ruleId: "cs-R7-sentence-case-heading",
      bad: "# Jak Nastavit Vývojové Prostředí Pro Workshop",
      good: "# Jak nastavit vývojové prostředí pro workshop",
    },
    {
      ruleId: "cs-R8-english-day-month",
      bad: "Workshop začne v Monday 1. April ráno podle českého času",
      good: "Workshop začne v pondělí 1. dubna ráno podle českého času",
    },
  ],
  en: [
    {
      ruleId: "en-R1-ellipsis",
      bad: "Wait a moment... then continue",
      good: "Wait a moment… then continue",
    },
  ],
};

interface TestResult {
  language: string;
  ruleId: string;
  passed: boolean;
  reason?: string;
}

function runProfileTests(
  profile: LanguageProfile,
  tests: RuleTest[],
): TestResult[] {
  const results: TestResult[] = [];
  const ruleMap = new Map(profile.rules.map((r) => [r.id, r]));

  for (const test of tests) {
    const rule = ruleMap.get(test.ruleId);
    if (!rule) {
      results.push({
        language: profile.language,
        ruleId: test.ruleId,
        passed: false,
        reason: `rule not found in profile ${profile.language}`,
      });
      continue;
    }

    const badChunk = {
      text: test.bad,
      filePath: `<fixture:${test.ruleId}:bad>`,
      startLine: 1,
      startColumn: 1,
    };
    const goodChunk = {
      text: test.good,
      filePath: `<fixture:${test.ruleId}:good>`,
      startLine: 1,
      startColumn: 1,
    };

    const badFindings = rule.check(badChunk).filter(
      (f) => f.ruleId === test.ruleId,
    );
    const goodFindings = rule.check(goodChunk).filter(
      (f) => f.ruleId === test.ruleId,
    );

    if (badFindings.length === 0) {
      results.push({
        language: profile.language,
        ruleId: test.ruleId,
        passed: false,
        reason: `rule did not fire on known-bad input: ${JSON.stringify(test.bad)}`,
      });
      continue;
    }

    if (goodFindings.length > 0) {
      results.push({
        language: profile.language,
        ruleId: test.ruleId,
        passed: false,
        reason: `rule fired on known-good input: ${JSON.stringify(test.good)} (${goodFindings.length} finding(s))`,
      });
      continue;
    }

    results.push({
      language: profile.language,
      ruleId: test.ruleId,
      passed: true,
    });
  }

  return results;
}

interface LockfileTestResult {
  name: string;
  passed: boolean;
  reason?: string;
}

function runLockfileTests(): LockfileTestResult[] {
  const results: LockfileTestResult[] = [];
  const tmp = mkdtempSync(join(tmpdir(), "copy-editor-lockfile-test-"));

  const record = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err) {
      results.push({
        name,
        passed: false,
        reason: (err as Error).message,
      });
    }
  };

  const synthetic: Lockfile = {
    schemaVersion: 1,
    segmenter: {
      backend: "agent",
      promptVersion: 2,
    },
    files: {
      "workshop-content/agenda.json": {
        contentHash: hashFileBytes("fixture content one"),
        segmentedAt: "2026-04-12T10:30:00Z",
        reviewedBy: "tester@2026-04-12",
        spans: [
          {
            startLine: 6,
            startColumn: 7,
            endLine: 6,
            endColumn: 28,
            language: "en",
            kind: "prose",
            pathHint: "meta.en.title",
            note: null,
          },
          {
            startLine: 10,
            startColumn: 7,
            endLine: 10,
            endColumn: 28,
            language: "cs",
            kind: "prose",
            pathHint: "meta.cs.title",
            note: "no diacritics; tagged from key path",
          },
        ],
      },
      "workshop-skill/SKILL-facilitator.md": {
        contentHash: hashFileBytes("fixture content two"),
        segmentedAt: "2026-04-12T10:30:00Z",
        reviewedBy: null,
        spans: [],
      },
    },
  };

  record("hashFileBytes returns stable sha256: hex", () => {
    const a = hashFileBytes("hello world");
    const b = hashFileBytes("hello world");
    if (a !== b) throw new Error(`hash unstable: ${a} !== ${b}`);
    if (!a.startsWith("sha256:")) {
      throw new Error(`expected sha256: prefix, got ${a}`);
    }
    if (a.length !== "sha256:".length + 64) {
      throw new Error(`expected 64 hex chars, got length ${a.length}`);
    }
  });

  record("hashFileBytes is sensitive to content changes", () => {
    const a = hashFileBytes("hello world");
    const b = hashFileBytes("hello worlds");
    if (a === b) throw new Error("hash collision on different inputs");
  });

  record("round-trip: write then read returns deep-equal data", () => {
    const path = join(tmp, "round-trip.lock.json");
    writeLockfile(path, synthetic);
    const read = readLockfile(path);
    if (read === null) throw new Error("readLockfile returned null after write");
    const expected = JSON.stringify(synthetic);
    const actual = JSON.stringify(read);
    if (expected !== actual) {
      throw new Error(
        `round-trip mismatch.\n  expected: ${expected}\n  actual:   ${actual}`,
      );
    }
  });

  record("readLockfile returns null when file is missing", () => {
    const result = readLockfile(join(tmp, "does-not-exist.lock.json"));
    if (result !== null) throw new Error("expected null for missing file");
  });

  record("schemaVersion mismatch throws", () => {
    const path = join(tmp, "wrong-version.lock.json");
    const bad = { ...synthetic, schemaVersion: 99 };
    writeLockfileRaw(path, bad);
    let threw = false;
    try {
      readLockfile(path);
    } catch (err) {
      threw = true;
      if (!(err as Error).message.includes("schemaVersion")) {
        throw new Error(
          `expected schemaVersion error, got: ${(err as Error).message}`,
        );
      }
    }
    if (!threw) throw new Error("expected throw on schemaVersion mismatch");
  });

  record("agent backend without promptVersion throws", () => {
    const path = join(tmp, "no-prompt-version.lock.json");
    const bad = {
      schemaVersion: 1,
      segmenter: { backend: "agent" },
      files: {},
    };
    writeLockfileRaw(path, bad);
    let threw = false;
    try {
      readLockfile(path);
    } catch (err) {
      threw = true;
      if (!(err as Error).message.includes("promptVersion")) {
        throw new Error(
          `expected promptVersion error, got: ${(err as Error).message}`,
        );
      }
    }
    if (!threw) {
      throw new Error("expected throw on agent backend without promptVersion");
    }
  });

  record("unknown backend value throws", () => {
    const path = join(tmp, "bad-backend.lock.json");
    const bad = {
      schemaVersion: 1,
      segmenter: { backend: "llm" },
      files: {},
    };
    writeLockfileRaw(path, bad);
    let threw = false;
    try {
      readLockfile(path);
    } catch (err) {
      threw = true;
      if (!(err as Error).message.includes("backend")) {
        throw new Error(
          `expected backend error, got: ${(err as Error).message}`,
        );
      }
    }
    if (!threw) throw new Error("expected throw on unknown backend");
  });

  record("invalid contentHash format throws", () => {
    const path = join(tmp, "bad-hash.lock.json");
    const bad = {
      schemaVersion: 1,
      segmenter: {
        backend: "agent",
        promptVersion: 2,
      },
      files: {
        "x.md": {
          contentHash: "md5:abc",
          segmentedAt: "2026-04-12T10:30:00Z",
          reviewedBy: null,
          spans: [],
        },
      },
    };
    writeLockfileRaw(path, bad);
    let threw = false;
    try {
      readLockfile(path);
    } catch (err) {
      threw = true;
      if (!(err as Error).message.includes("contentHash")) {
        throw new Error(
          `expected contentHash error, got: ${(err as Error).message}`,
        );
      }
    }
    if (!threw) throw new Error("expected throw on invalid contentHash");
  });

  record("overlapping spans throw", () => {
    const path = join(tmp, "overlap.lock.json");
    const bad = {
      schemaVersion: 1,
      segmenter: {
        backend: "agent",
        promptVersion: 2,
      },
      files: {
        "x.md": {
          contentHash: hashFileBytes("x"),
          segmentedAt: "2026-04-12T10:30:00Z",
          reviewedBy: null,
          spans: [
            {
              startLine: 1,
              startColumn: 1,
              endLine: 5,
              endColumn: 10,
              language: "en",
              kind: "prose",
            },
            {
              startLine: 3,
              startColumn: 1,
              endLine: 4,
              endColumn: 5,
              language: "cs",
              kind: "prose",
            },
          ],
        },
      },
    };
    writeLockfileRaw(path, bad);
    let threw = false;
    try {
      readLockfile(path);
    } catch (err) {
      threw = true;
      if (!(err as Error).message.includes("overlap")) {
        throw new Error(
          `expected overlap error, got: ${(err as Error).message}`,
        );
      }
    }
    if (!threw) throw new Error("expected throw on overlapping spans");
  });

  record("empty spans array is legal", () => {
    const path = join(tmp, "empty-spans.lock.json");
    const ok: Lockfile = {
      schemaVersion: 1,
      segmenter: { backend: "agent", promptVersion: 2 },
      files: {
        "uniform.md": {
          contentHash: hashFileBytes("uniform content"),
          segmentedAt: "2026-04-12T10:30:00Z",
          reviewedBy: null,
          spans: [],
        },
      },
    };
    writeLockfile(path, ok);
    const read = readLockfile(path);
    if (read === null) throw new Error("readLockfile returned null");
    if (read.files["uniform.md"].spans.length !== 0) {
      throw new Error("expected empty spans array");
    }
  });

  record("write sorts files alphabetically and spans by position", () => {
    const path = join(tmp, "sorted.lock.json");
    const unsorted: Lockfile = {
      schemaVersion: 1,
      segmenter: { backend: "agent", promptVersion: 2 },
      files: {
        "z.md": {
          contentHash: hashFileBytes("z"),
          segmentedAt: "2026-04-12T10:30:00Z",
          reviewedBy: null,
          spans: [
            { startLine: 5, startColumn: 1, endLine: 5, endColumn: 10, language: "en", kind: "prose" },
            { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10, language: "en", kind: "prose" },
          ],
        },
        "a.md": {
          contentHash: hashFileBytes("a"),
          segmentedAt: "2026-04-12T10:30:00Z",
          reviewedBy: null,
          spans: [],
        },
      },
    };
    writeLockfile(path, unsorted);
    const read = readLockfile(path);
    if (read === null) throw new Error("readLockfile returned null");
    const keys = Object.keys(read.files);
    if (keys[0] !== "a.md" || keys[1] !== "z.md") {
      throw new Error(`files not sorted: ${keys.join(", ")}`);
    }
    const zSpans = read.files["z.md"].spans;
    if (zSpans[0].startLine !== 1 || zSpans[1].startLine !== 5) {
      throw new Error("spans not sorted by startLine");
    }
  });

  rmSync(tmp, { recursive: true, force: true });
  return results;
}

function writeLockfileRaw(path: string, data: unknown): void {
  const fs = require("node:fs") as typeof import("node:fs");
  fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

interface SpanFilterTestResult {
  name: string;
  passed: boolean;
  reason?: string;
}

function runSpanFilterTests(): SpanFilterTestResult[] {
  const results: SpanFilterTestResult[] = [];
  const record = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err) {
      results.push({
        name,
        passed: false,
        reason: (err as Error).message,
      });
    }
  };

  // Synthesise a profile with two rules: one cs-only, one with no
  // language restriction. Each rule's check() is a stub — we feed
  // findings directly to the filter.
  const csRule: Rule = {
    id: "test-cs-only",
    description: "test cs-only rule",
    severity: "error",
    languages: ["cs"],
    check: () => [],
  };
  const anyRule: Rule = {
    id: "test-any-language",
    description: "test rule with no language restriction",
    severity: "warning",
    check: () => [],
  };
  const profile: LanguageProfile = {
    language: "cs",
    name: "Test Profile",
    rules: [csRule, anyRule],
  };

  const mkFinding = (ruleId: string, line: number, column: number): Finding => ({
    ruleId,
    severity: "error",
    filePath: "<test>",
    line,
    column,
    snippet: "",
    message: "",
  });

  // ── lookupSpanAt ────────────────────────────────────────────────

  record("lookupSpanAt finds single-line span containing position", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10, language: "en", kind: "prose" },
    ];
    const found = lookupSpanAt(spans, 1, 5);
    if (!found || found.language !== "en") {
      throw new Error("expected en span at (1,5)");
    }
  });

  record("lookupSpanAt finds multi-line span containing position", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 5, endColumn: 20, language: "cs", kind: "prose" },
    ];
    if (!lookupSpanAt(spans, 3, 100)) throw new Error("expected hit on inner line");
    if (!lookupSpanAt(spans, 1, 1)) throw new Error("expected hit at start");
    if (!lookupSpanAt(spans, 5, 20)) throw new Error("expected hit at end");
  });

  record("lookupSpanAt returns undefined outside any span", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10, language: "en", kind: "prose" },
    ];
    if (lookupSpanAt(spans, 2, 1) !== undefined) throw new Error("unexpected hit on line 2");
    if (lookupSpanAt(spans, 1, 11) !== undefined) throw new Error("unexpected hit at column 11");
  });

  record("lookupSpanAt respects start/end column on edge lines", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 5, endLine: 3, endColumn: 8, language: "cs", kind: "prose" },
    ];
    if (lookupSpanAt(spans, 1, 4) !== undefined) throw new Error("should miss before startColumn");
    if (!lookupSpanAt(spans, 1, 5)) throw new Error("should hit at startColumn");
    if (!lookupSpanAt(spans, 2, 1)) throw new Error("should hit on inner line at column 1");
    if (!lookupSpanAt(spans, 3, 8)) throw new Error("should hit at endColumn");
    if (lookupSpanAt(spans, 3, 9) !== undefined) throw new Error("should miss after endColumn");
  });

  // ── filterFindingsBySpans ───────────────────────────────────────

  record("filterFindingsBySpans returns input unchanged when spans empty", () => {
    const findings = [mkFinding("test-cs-only", 1, 1)];
    const result = filterFindingsBySpans(findings, [], profile, "cs");
    if (result.length !== 1) throw new Error("expected pass-through with empty spans");
  });

  record("filterFindingsBySpans drops cs-only finding inside en span", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 10, endColumn: 80, language: "en", kind: "prose" },
    ];
    const findings = [mkFinding("test-cs-only", 5, 10)];
    const result = filterFindingsBySpans(findings, spans, profile, "cs");
    if (result.length !== 0) throw new Error("expected cs finding dropped inside en span");
  });

  record("filterFindingsBySpans keeps cs-only finding inside cs span", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 10, endColumn: 80, language: "cs", kind: "prose" },
    ];
    const findings = [mkFinding("test-cs-only", 5, 10)];
    const result = filterFindingsBySpans(findings, spans, profile, "cs");
    if (result.length !== 1) throw new Error("expected cs finding kept inside cs span");
  });

  record("filterFindingsBySpans drops cs-only finding inside unknown span", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 10, endColumn: 80, language: "unknown", kind: "prose" },
    ];
    const findings = [mkFinding("test-cs-only", 5, 10)];
    const result = filterFindingsBySpans(findings, spans, profile, "cs");
    if (result.length !== 0) throw new Error("expected cs finding dropped inside unknown span");
  });

  record("filterFindingsBySpans drops any finding inside code span", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 10, endColumn: 80, language: "cs", kind: "code" },
    ];
    const findings = [
      mkFinding("test-cs-only", 5, 10),
      mkFinding("test-any-language", 5, 20),
    ];
    const result = filterFindingsBySpans(findings, spans, profile, "cs");
    if (result.length !== 0) throw new Error("expected all findings dropped inside code span");
  });

  record("filterFindingsBySpans drops any finding inside data span", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 10, endColumn: 80, language: "unknown", kind: "data" },
    ];
    const findings = [mkFinding("test-any-language", 5, 10)];
    const result = filterFindingsBySpans(findings, spans, profile, "cs");
    if (result.length !== 0) throw new Error("expected finding dropped inside data span");
  });

  record("filterFindingsBySpans keeps unrestricted rule inside any prose span", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 10, endColumn: 80, language: "en", kind: "prose" },
    ];
    const findings = [mkFinding("test-any-language", 5, 10)];
    const result = filterFindingsBySpans(findings, spans, profile, "cs");
    if (result.length !== 1) {
      throw new Error("expected unrestricted finding kept inside en prose span");
    }
  });

  record("filterFindingsBySpans falls back to default language in gaps", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 5, endColumn: 80, language: "en", kind: "prose" },
    ];
    // Finding at line 10 is in a gap (no span). Default language is cs.
    // cs-only rule applies because cs matches default. Finding kept.
    const findings = [mkFinding("test-cs-only", 10, 1)];
    const result = filterFindingsBySpans(findings, spans, profile, "cs");
    if (result.length !== 1) {
      throw new Error("expected cs-only finding kept in gap when default is cs");
    }
  });

  record("filterFindingsBySpans drops gap finding when default does not match rule", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 5, endColumn: 80, language: "cs", kind: "prose" },
    ];
    const findings = [mkFinding("test-cs-only", 10, 1)];
    // Default is en here; cs-only rule does not match.
    const result = filterFindingsBySpans(findings, spans, profile, "en");
    if (result.length !== 0) {
      throw new Error("expected cs-only finding dropped in gap when default is en");
    }
  });

  record("filterFindingsBySpans handles mixed findings across spans and gaps", () => {
    const spans: LockfileSpan[] = [
      { startLine: 1, startColumn: 1, endLine: 5, endColumn: 80, language: "en", kind: "prose" },
      { startLine: 10, startColumn: 1, endLine: 15, endColumn: 80, language: "cs", kind: "prose" },
      { startLine: 20, startColumn: 1, endLine: 25, endColumn: 80, language: "unknown", kind: "code" },
    ];
    const findings = [
      mkFinding("test-cs-only", 3, 1),     // inside en span → drop
      mkFinding("test-cs-only", 7, 1),     // gap, default cs → keep
      mkFinding("test-cs-only", 12, 1),    // inside cs span → keep
      mkFinding("test-cs-only", 22, 1),    // inside code span → drop
      mkFinding("test-any-language", 22, 1), // inside code span → drop
      mkFinding("test-any-language", 30, 1), // gap, no language restriction → keep
    ];
    const result = filterFindingsBySpans(findings, spans, profile, "cs");
    if (result.length !== 3) {
      throw new Error(
        `expected 3 survivors, got ${result.length}: ${JSON.stringify(result.map((f) => `${f.ruleId}@${f.line}`))}`,
      );
    }
  });

  return results;
}

export function runAllSelfTests(): number {
  const allResults: TestResult[] = [];
  for (const [lang, tests] of Object.entries(TESTS)) {
    const profile = PROFILES[lang];
    if (!profile) {
      console.error(`self-test: no profile registered for ${lang}`);
      allResults.push({
        language: lang,
        ruleId: "(profile)",
        passed: false,
        reason: "profile not registered",
      });
      continue;
    }
    allResults.push(...runProfileTests(profile, tests));
  }

  const lockfileResults = runLockfileTests();
  const spanFilterResults = runSpanFilterTests();

  let passed = 0;
  let failed = 0;
  console.log("");
  console.log("copy-audit self-test");
  console.log("════════════════════");
  for (const r of allResults) {
    if (r.passed) {
      console.log(`  ✓  ${r.language}  ${r.ruleId}`);
      passed += 1;
    } else {
      console.log(`  ✗  ${r.language}  ${r.ruleId}`);
      if (r.reason) console.log(`       ${r.reason}`);
      failed += 1;
    }
  }
  console.log("");
  console.log("lockfile");
  console.log("────────");
  for (const r of lockfileResults) {
    if (r.passed) {
      console.log(`  ✓  ${r.name}`);
      passed += 1;
    } else {
      console.log(`  ✗  ${r.name}`);
      if (r.reason) console.log(`       ${r.reason}`);
      failed += 1;
    }
  }
  console.log("");
  console.log("span filter");
  console.log("───────────");
  for (const r of spanFilterResults) {
    if (r.passed) {
      console.log(`  ✓  ${r.name}`);
      passed += 1;
    } else {
      console.log(`  ✗  ${r.name}`);
      if (r.reason) console.log(`       ${r.reason}`);
      failed += 1;
    }
  }
  console.log("");
  console.log(`passed: ${passed}`);
  console.log(`failed: ${failed}`);
  console.log("");

  return failed > 0 ? 1 : 0;
}

if (import.meta.main) {
  const code = runAllSelfTests();
  process.exit(code);
}
