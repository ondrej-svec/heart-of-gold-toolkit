/**
 * English language profile — stub with documented extension points.
 *
 * English is a second-class profile in v1. The copy-editor role's
 * language-profile architecture is proven by shipping Czech as a full
 * profile and English as a stub that still works end-to-end (the
 * engine can load it, the CLI accepts `--lang en`, findings are
 * emitted correctly). Adding real English rules is Phase 7 work.
 *
 * Starter rules below are intentionally minimal: they catch obvious
 * breakage without attempting to encode a full English style guide.
 * The list is designed to grow; each rule should document its source
 * and its rationale.
 *
 * When adding a new rule:
 *   1. Add the Rule object to this file (or split into sibling files
 *      if the count grows beyond ~20).
 *   2. Append it to `englishProfile.rules`.
 *   3. Add a matching bad/good fixture pair to fixtures/ so self-test
 *      locks the behaviour.
 */

import type { Finding, LanguageProfile, Rule, TextChunk } from "./types.ts";
import { locateInChunk } from "./types.ts";

/**
 * EN-R1 — Ellipsis character.
 *
 * Same rule as Czech R3. Cross-language typography convention.
 */
const R1: Rule = {
  id: "en-R1-ellipsis",
  label: "Use ellipsis character …",
  severity: "warning",
  description:
    "Replace three ASCII dots `...` with the single ellipsis character `…` (U+2026). Standard typographic convention across modern English and Czech style guides.",
  check(chunk: TextChunk): Finding[] {
    const findings: Finding[] = [];
    const re = /\.{3}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(chunk.text)) !== null) {
      const { line, column } = locateInChunk(chunk, match.index);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: R1.id,
        severity: R1.severity,
        filePath: chunk.filePath,
        line,
        column,
        snippet: "...",
        message: "Replace `...` with `…` (U+2026).",
      });
    }
    return findings;
  },
};

export const englishProfile: LanguageProfile = {
  language: "en",
  name: "English",
  rules: [R1],
};

export default englishProfile;
