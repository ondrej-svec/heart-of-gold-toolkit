/**
 * Span-aware finding filter.
 *
 * Rules run on every chunk regardless of language tagging — that part is
 * unchanged from the original engine. After rules produce findings, this
 * filter drops findings whose source position lies inside a span that
 * should not have triggered the rule:
 *
 * - Findings inside `code` or `data` spans are dropped (typography rules
 *   don't apply to code or machine-readable data).
 * - Findings inside spans whose `language` is not in the rule's
 *   `languages` allowlist are dropped.
 * - Findings outside any span fall back to the config default language.
 *
 * The filter is the load-bearing piece that makes the lockfile actually
 * affect audit output. It is intentionally a post-processing step rather
 * than a chunk-splitting transform — the existing extractor stays simple,
 * and the filter is easy to reason about and easy to self-test.
 */

import type { Finding, LanguageProfile } from "../rules/types.ts";
import { lookupSpanAt, type LockfileSpan } from "./lockfile.ts";

export function filterFindingsBySpans(
  findings: Finding[],
  spans: LockfileSpan[],
  profile: LanguageProfile,
  defaultLanguage: string,
): Finding[] {
  if (spans.length === 0) return findings;
  const ruleMap = new Map(profile.rules.map((r) => [r.id, r]));
  const survivors: Finding[] = [];
  for (const finding of findings) {
    const span = lookupSpanAt(spans, finding.line, finding.column);
    if (span) {
      if (span.kind === "code" || span.kind === "data") continue;
      const rule = ruleMap.get(finding.ruleId);
      if (rule?.languages && !rule.languages.includes(span.language)) {
        continue;
      }
    } else {
      // Gap: no span covers this position. Treat as the config default.
      const rule = ruleMap.get(finding.ruleId);
      if (rule?.languages && !rule.languages.includes(defaultLanguage)) {
        continue;
      }
    }
    survivors.push(finding);
  }
  return survivors;
}
