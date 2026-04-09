/**
 * Language profile registry.
 *
 * Adding a new language:
 *   1. Create rules/<lang>.ts exporting a LanguageProfile
 *   2. Import it here and add it to the PROFILES map
 *   3. Add fixtures/<lang>-bad.md and fixtures/<lang>-good.md
 *   4. Extend scripts/self-test.ts to assert the new profile's rules
 *
 * No change is required to the engine (scripts/copy-audit.ts) itself —
 * the engine loads profiles via this registry by language code.
 */

import type { LanguageProfile } from "./types.ts";
import czechProfile from "./czech.ts";
import englishProfile from "./english.ts";

export const PROFILES: Record<string, LanguageProfile> = {
  cs: czechProfile,
  en: englishProfile,
};

export function getProfile(language: string): LanguageProfile | undefined {
  return PROFILES[language.toLowerCase()];
}

export function listProfiles(): string[] {
  return Object.keys(PROFILES).sort();
}
