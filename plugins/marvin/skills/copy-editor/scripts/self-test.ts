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

import type { LanguageProfile } from "../rules/types.ts";
import { PROFILES } from "../rules/index.ts";

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
  console.log(`passed: ${passed}`);
  console.log(`failed: ${failed}`);
  console.log("");

  return failed > 0 ? 1 : 0;
}

if (import.meta.main) {
  const code = runAllSelfTests();
  process.exit(code);
}
