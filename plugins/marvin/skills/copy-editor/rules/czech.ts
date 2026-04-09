/**
 * Czech language profile — Rules R1-R8.
 *
 * Every rule here is deterministic and regex-level. Voice, rhythm,
 * and judgment work belong to Layer 2 (the SKILL.md loop), not here.
 *
 * Sources for the rule set:
 * - ÚJČ Internetová jazyková příručka (https://prirucka.ujc.cas.cz/)
 * - Mozilla Czech Localization Style Guide
 * - Microsoft Czech Localization Style Guide
 */

import type { Finding, LanguageProfile, Rule, TextChunk } from "./types.ts";
import { locateInChunk } from "./types.ts";

const NBSP = "\u00A0";

/**
 * R1 — Non-breaking space after single-letter preposition/conjunction.
 *
 * Czech typography requires a non-breaking space after `k`, `s`, `v`,
 * `z`, `o`, `u`, `a`, `i` (and the short forms `ke`, `se`, `ve`, `ze`)
 * so the single-letter word does not end a printed line alone.
 *
 * Matches: a preposition/conjunction at a word boundary followed by a
 * regular ASCII space followed by a letter. The boundary check avoids
 * matching inside longer words. Case-insensitive for the leading letter.
 *
 * `a` and `i` as conjunctions are technically required too, but they
 * are also the articles/pronouns/variable names in code and produce a
 * flood of false positives on prose like "a `README`". We therefore
 * only fire R1 on the single-letter prepositions `k|s|v|z|o|u` by
 * default. The conjunctions `a` and `i` are handled by a secondary,
 * lower-severity info rule (R1b) that the report can choose to show.
 */
// R1 uses a literal ASCII space (U+0020) for the "wrong" space that
// should be replaced with a non-breaking space. We intentionally do NOT
// use `\s` because JS `\s` matches U+00A0, which would make the rule
// fire on already-correct text.
const R1_SINGLE_LETTER_PREPS = /(^|[ \t\n(„"'\[«])([ksvzouKSVZOU])( )(?=[\p{L}])/gu;

/**
 * R1b — `a` and `i` as conjunctions. Lower severity because of ambiguity.
 * Only matches when the letter follows whitespace or sentence punctuation
 * AND is followed by whitespace AND then a letter.
 */
const R1B_SHORT_CONJUNCTIONS = /([.!?;:,] |[ \t\n])([aiAI])( )(?=[\p{L}])/gu;

const R1: Rule = {
  id: "cs-R1-nbsp-prep",
  label: "Non-breaking space after single-letter preposition",
  severity: "error",
  description:
    "In Czech typography, single-letter prepositions (k, s, v, z, o, u) must be followed by a non-breaking space (U+00A0) rather than a regular space, so the word never dangles at the end of a line.",
  check(chunk: TextChunk): Finding[] {
    const findings: Finding[] = [];
    R1_SINGLE_LETTER_PREPS.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = R1_SINGLE_LETTER_PREPS.exec(chunk.text)) !== null) {
      const prepIndex = match.index + match[1].length;
      const spaceIndex = prepIndex + 1;
      const { line, column } = locateInChunk(chunk, prepIndex);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: R1.id,
        severity: R1.severity,
        filePath: chunk.filePath,
        line,
        column,
        snippet: chunk.text.slice(prepIndex, prepIndex + 3),
        message: `Replace regular space after \`${match[2]}\` with non-breaking space (\\u00A0).`,
      });
      // Advance to avoid overlapping match on the same space.
      R1_SINGLE_LETTER_PREPS.lastIndex = spaceIndex + 1;
    }
    return findings;
  },
};

const R1b: Rule = {
  id: "cs-R1b-nbsp-conjunction",
  label: "Non-breaking space after single-letter conjunction (a/i)",
  severity: "warning",
  description:
    "Czech typography also prefers a non-breaking space after `a` and `i` when used as conjunctions. Lower severity because these letters appear in many non-conjunction contexts; treat matches as hints to review.",
  check(chunk: TextChunk): Finding[] {
    const findings: Finding[] = [];
    R1B_SHORT_CONJUNCTIONS.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = R1B_SHORT_CONJUNCTIONS.exec(chunk.text)) !== null) {
      const conjIndex = match.index + match[1].length;
      const { line, column } = locateInChunk(chunk, conjIndex);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: R1b.id,
        severity: R1b.severity,
        filePath: chunk.filePath,
        line,
        column,
        snippet: chunk.text.slice(conjIndex, conjIndex + 3),
        message: `Consider a non-breaking space after \`${match[2]}\` if it is a conjunction.`,
      });
      R1B_SHORT_CONJUNCTIONS.lastIndex = conjIndex + 2;
    }
    return findings;
  },
};

/**
 * R2 — Czech quotation marks.
 *
 * Detect English-style straight double quotes `"..."` wrapping text
 * that looks like Czech prose. We only fire on pairs of straight quotes
 * containing at least one Czech letter (diacritic) — this avoids false
 * positives on JSON string syntax, English quotes inside code blocks,
 * and embedded technical tokens.
 */
const R2_ENGLISH_QUOTES = /"([^"\n]*[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^"\n]*)"/g;

const R2: Rule = {
  id: "cs-R2-quotes",
  label: 'Use Czech quotation marks (low-open, high-close)',
  severity: "error",
  description:
    'Czech prose uses lower-opening and upper-closing quotation marks (U+201E and U+201C), not English straight double quotes. Detect pairs of straight quotes whose content contains Czech diacritics (a reliable signal that the quoted text is Czech prose, not a JSON token or a technical identifier).',
  check(chunk: TextChunk): Finding[] {
    const findings: Finding[] = [];
    R2_ENGLISH_QUOTES.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = R2_ENGLISH_QUOTES.exec(chunk.text)) !== null) {
      const { line, column } = locateInChunk(chunk, match.index);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: R2.id,
        severity: R2.severity,
        filePath: chunk.filePath,
        line,
        column,
        snippet: match[0].length > 40 ? match[0].slice(0, 40) + "…" : match[0],
        message: 'Replace English straight quotes with Czech low-open/high-close quotes around Czech prose.',
      });
    }
    return findings;
  },
};

/**
 * R3 — Ellipsis character.
 *
 * Three ASCII dots `...` should be a single `…` (U+2026).
 */
const R3_THREE_DOTS = /\.{3}/g;

const R3: Rule = {
  id: "cs-R3-ellipsis",
  label: "Use ellipsis character …",
  severity: "error",
  description:
    "Replace three ASCII dots `...` with the single ellipsis character `…` (U+2026).",
  check(chunk: TextChunk): Finding[] {
    const findings: Finding[] = [];
    R3_THREE_DOTS.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = R3_THREE_DOTS.exec(chunk.text)) !== null) {
      const { line, column } = locateInChunk(chunk, match.index);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: R3.id,
        severity: R3.severity,
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

/**
 * R4 — Number glued to unit.
 *
 * Matches `50Kč`, `99%` (when not immediately followed by a letter
 * making it an adjective like `99%pokrytí`... actually that would be
 * `99%` followed by a letter, which we should also flag because in
 * prose the correct form is `99 %` followed by a space). We fire on
 * any digit directly followed by a known unit token without a space.
 */
const R4_NUMBER_UNIT =
  /(\d)(Kč|CZK|EUR|USD|€|\$|%|MB|GB|TB|KB|kB|Mbit|Gbit|mm|cm|km|kg|ml|hPa|°C)(?=\b|[^\p{L}\d])/gu;

const R4: Rule = {
  id: "cs-R4-number-unit",
  label: "Space between number and unit",
  severity: "error",
  description:
    "In Czech prose, a number and its unit are separated by a space (ideally non-breaking): `50 Kč`, `99 %`, `5 MB`. Adjectival usage (`99%` directly followed by a noun) is an exception this v1 rule does not distinguish — use the ignore marker for intentional adjective use.",
  check(chunk: TextChunk): Finding[] {
    const findings: Finding[] = [];
    R4_NUMBER_UNIT.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = R4_NUMBER_UNIT.exec(chunk.text)) !== null) {
      const { line, column } = locateInChunk(chunk, match.index);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: R4.id,
        severity: R4.severity,
        filePath: chunk.filePath,
        line,
        column,
        snippet: match[0],
        message: `Insert a space between \`${match[1]}\` and \`${match[2]}\`.`,
      });
    }
    return findings;
  },
};

/**
 * R5 — Ordinal number without space after the period.
 *
 * `1.dubna` is wrong; `1. dubna` is correct. We match a digit, a period,
 * and an immediately following letter.
 */
const R5_ORDINAL_NO_SPACE = /\d+\.[\p{L}]/gu;

const R5: Rule = {
  id: "cs-R5-ordinal-space",
  label: "Ordinal number needs space after period",
  severity: "error",
  description:
    "Czech ordinals are written with a period and a following space: `1. dubna`, `3. místo`. Never `1.dubna` without the space.",
  check(chunk: TextChunk): Finding[] {
    const findings: Finding[] = [];
    R5_ORDINAL_NO_SPACE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = R5_ORDINAL_NO_SPACE.exec(chunk.text)) !== null) {
      const { line, column } = locateInChunk(chunk, match.index);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: R5.id,
        severity: R5.severity,
        filePath: chunk.filePath,
        line,
        column,
        snippet: match[0],
        message: "Insert a space after the ordinal period.",
      });
    }
    return findings;
  },
};

/**
 * R6 — En-dash for ranges and parentheticals.
 *
 * Two heuristics:
 *   a) A hyphen surrounded by spaces in the middle of a sentence should
 *      be an en-dash: `slovo - slovo` → `slovo – slovo`.
 *   b) A hyphen between two bare numbers (range) should be an en-dash:
 *      `10-20` → `10–20`.
 *
 * We avoid firing on code-ish patterns by requiring at least one
 * alphabetic context character around the hyphen in case (a).
 */
const R6A_HYPHEN_AS_DASH = /(\p{L})\s-\s(\p{L})/gu;
const R6B_NUMERIC_RANGE = /(\d)-(\d)/g;

const R6: Rule = {
  id: "cs-R6-dash",
  label: "Use en-dash for ranges and parentheticals",
  severity: "warning",
  description:
    "Czech uses `–` (en-dash, U+2013) as its standard pomlčka: with spaces for parenthetical clauses (`text – vložení – text`) and without spaces for ranges (`23–26`). A hyphen `-` is reserved for compound tokens.",
  check(chunk: TextChunk): Finding[] {
    const findings: Finding[] = [];
    R6A_HYPHEN_AS_DASH.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = R6A_HYPHEN_AS_DASH.exec(chunk.text)) !== null) {
      // Point at the hyphen position
      const hyphenOffset = m.index + m[1].length + 1;
      const { line, column } = locateInChunk(chunk, hyphenOffset);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: R6.id,
        severity: R6.severity,
        filePath: chunk.filePath,
        line,
        column,
        snippet: m[0],
        message:
          "Hyphen between words with spaces should be an en-dash `–` (U+2013).",
      });
    }
    R6B_NUMERIC_RANGE.lastIndex = 0;
    while ((m = R6B_NUMERIC_RANGE.exec(chunk.text)) !== null) {
      const hyphenOffset = m.index + 1;
      const { line, column } = locateInChunk(chunk, hyphenOffset);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: R6.id,
        severity: R6.severity,
        filePath: chunk.filePath,
        line,
        column,
        snippet: m[0],
        message:
          "Numeric range should use en-dash `–` without spaces (e.g. `23–26`).",
      });
    }
    return findings;
  },
};

/**
 * R7 — Sentence-case headings in Czech markdown.
 *
 * Heuristic: for lines matching `^#{1,6}\s+(.+)$` where the text
 * contains Czech diacritics (signalling Czech prose), flag the heading
 * if more than half of the significant words (length > 2) start with
 * an uppercase letter. Czech title case is Title Case After First Word,
 * which is English convention; Czech wants sentence case.
 *
 * This fires on markdown headings only. JSON/TS headings (if any) are
 * out of scope — their capitalisation is handled by voice review.
 */
const R7_MARKDOWN_HEADING = /^(#{1,6})\s+(.+)$/gm;

function isLikelyCzechTitleCase(text: string): boolean {
  if (!/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(text)) return false;
  // Strip backticked spans and leading category prefix like "Talk:"
  const stripped = text
    .replace(/`[^`]*`/g, "")
    .replace(/^[^:]+:\s*/, "");
  const words = stripped.split(/\s+/).filter((w) => w.length > 2);
  if (words.length < 3) return false;
  const uppercaseStarts = words.filter((w) =>
    /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(w),
  ).length;
  return uppercaseStarts >= 2 && uppercaseStarts / words.length > 0.5;
}

const R7: Rule = {
  id: "cs-R7-sentence-case-heading",
  label: "Czech headings use sentence case",
  severity: "warning",
  description:
    "Czech headings are sentence case: only the first word and proper nouns are capitalised. English Title Case is a foreign body. Rule fires on markdown headings whose text is Czech (contains diacritics) and has 2+ words capitalised beyond the first.",
  check(chunk: TextChunk): Finding[] {
    const findings: Finding[] = [];
    R7_MARKDOWN_HEADING.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = R7_MARKDOWN_HEADING.exec(chunk.text)) !== null) {
      const headingText = match[2];
      if (!isLikelyCzechTitleCase(headingText)) continue;
      const { line, column } = locateInChunk(chunk, match.index);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: R7.id,
        severity: R7.severity,
        filePath: chunk.filePath,
        line,
        column,
        snippet:
          headingText.length > 60 ? headingText.slice(0, 60) + "…" : headingText,
        message:
          "Heading looks title-cased. Czech uses sentence case — only the first word and proper nouns capitalised.",
      });
    }
    return findings;
  },
};

/**
 * R8 — English day/month names in Czech prose.
 *
 * Czech uses lowercase Czech month and day names. An English word like
 * `Monday` or `January` inside a chunk that also contains Czech
 * diacritics (signal that the chunk is Czech prose) is almost always a
 * translation artefact.
 */
const ENGLISH_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const R8_PATTERN = new RegExp(
  `\\b(${[...ENGLISH_DAYS, ...ENGLISH_MONTHS].join("|")})\\b`,
  "g",
);

const R8: Rule = {
  id: "cs-R8-english-day-month",
  label: "No English day/month names in Czech prose",
  severity: "error",
  description:
    "English day and month names (Monday, January) should not appear in Czech prose. Rule fires when the chunk also contains Czech diacritics.",
  check(chunk: TextChunk): Finding[] {
    if (
      !/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(chunk.text)
    ) {
      return [];
    }
    const findings: Finding[] = [];
    R8_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = R8_PATTERN.exec(chunk.text)) !== null) {
      const { line, column } = locateInChunk(chunk, match.index);
      if (chunk.ignoreLines?.has(line)) continue;
      findings.push({
        ruleId: R8.id,
        severity: R8.severity,
        filePath: chunk.filePath,
        line,
        column,
        snippet: match[0],
        message: `Replace \`${match[0]}\` with its Czech equivalent (lowercase).`,
      });
    }
    return findings;
  },
};

export const czechProfile: LanguageProfile = {
  language: "cs",
  name: "Czech",
  rules: [R1, R1b, R2, R3, R4, R5, R6, R7, R8],
};

export default czechProfile;
