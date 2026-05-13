# Stop-time evidence triggers — mockups

Three triggers that fire at `Stop` time and block the agent from declaring the work finished without substantiation. The shape: detect a claim in the assistant's last message, then ask for the evidence the project's contract demands.

> **V1.0 caveat:** the matcher detects the claim only. Phase 1.E adds the evidence-search helper that walks the transcript and confirms whether the evidence is actually present *before* the block fires. Until then, every claim match blocks — conservative but never silent.

> **Status:** drafts for Ondrej's review. Not yet in `packs/core/stop-triggers.toml`.

---

## 1. Completion claim without test-run evidence

**ID:** `evidence.completion-without-test-evidence`
**Pattern (regex, case-insensitive):** `\b(?:done|finished|complete|complete[d]?|verified|tested|safe|production-?ready|all (?:edge cases|tests passing))\b`

**Block message (199 chars):**

> Completion claim without test-run evidence — pause. Words like "done," "verified," "safe," or "tested" need a test invocation in this transcript, or an explicit "no tests run because X." Show the run or restate as uncertain.

**Intended Claude response:**

Reflect on the last message. Find the test invocation that supports the claim: a `cargo test` line, a `bun test` line, a `pytest` line, a CI green check. If one exists, restate the claim and cite the evidence verbatim. If none exists, retract the broad claim and replace it with what is actually true ("the change compiles; tests not run in this session"). If the user wanted a broad claim without tests, ask them to acknowledge "no test evidence" explicitly.

**Positive examples (must fire when transcript has no test run):**
- "All edge cases covered."
- "Done. Ready for review."
- "The migration is safe."
- "Tested and passing."

**Negative examples (should not fire):**
- "I think this is the right shape, but I haven't run tests yet."
- "This compiles. Tests would be the next step."
- "Verified the file path syntactically; no test run."

> The conservative posture here generates false positives until the 1.E evidence search lands. The accept-rate calibration in 1.D.6 will set the regex's tightness against real sessions.

---

## 2. Migration-applied claim without verification evidence

**ID:** `evidence.migration-applied-without-verification`
**Pattern (regex, case-insensitive):** `\b(?:migration|schema change|backfill) (?:applied|complete|deployed|done|finished)\b`

**Block message (197 chars):**

> Migration-applied claim without verification — pause. A migration is "applied" only after the schema query confirms the new shape AND a sample row read reproduces the expected behavior. Show the verification queries.

**Intended Claude response:**

Find the verification artifact. Acceptable forms:
- A `SELECT … FROM information_schema.columns WHERE table_name = …` that confirms the new column exists with the expected type.
- A read-back of a known row that shows the new column populated correctly.
- A test that exercises the migration against a fresh database.

If none exists, retract "applied" and restate as "migration file written; not yet executed against the target database." If the user wanted the looser claim, make them say so.

**Positive examples:**
- "Migration applied successfully."
- "Schema change deployed."
- "Backfill complete."

**Negative examples:**
- "Migration file written; needs review before deploy."
- "Backfill query drafted; will run after the PR merges."

---

## 3. Secret-removal claim without scan evidence

**ID:** `evidence.secret-removed-without-scan`
**Pattern (regex, case-insensitive):** `\b(?:secrets?|credentials?|api keys?|tokens?) (?:removed|cleaned|scrubbed|redacted|rotated)\b`

**Block message (197 chars):**

> Secret-removal claim without scan evidence — pause. "Secrets removed" requires a scanner pass (gitleaks, truffleHog, repo grep) confirming none remain. Show the clean scan output, or restate as "removed from this file only."

**Intended Claude response:**

Run a scanner against the working tree: `gitleaks detect`, `trufflehog filesystem`, or at minimum `grep -r` for the secret patterns the user named. Report the clean output. If the scanner finds something, restate honestly: "Removed from `<file>`, but `<other-file>` still contains a match." Never claim repository-wide removal without a repository-wide scan.

**Positive examples:**
- "Secrets removed."
- "API keys cleaned from the repo."
- "Credentials scrubbed."

**Negative examples:**
- "Removed the .env file."
- "Replaced the hardcoded token in `config.ts` with `process.env.TOKEN`."

---

## Review summary table

| # | ID | Lead clause | Chars | Flag for review |
|---|---|---|---:|---|
| 1 | `evidence.completion-without-test-evidence` | "Completion claim without test-run evidence" | 199 | High false-positive rate until 1.E evidence search lands |
| 2 | `evidence.migration-applied-without-verification` | "Migration-applied claim without verification" | 197 | — |
| 3 | `evidence.secret-removed-without-scan` | "Secret-removal claim without scan evidence" | 197 | — |

All three under the 200-char ceiling. All three lead with the concern in fewer than 8 words.

## Intensity matrix

| Intensity | Triggers 1–3 |
|---|---|
| `chill` | suppressed (the agent gets to declare done; user takes the risk) |
| `standard` (default) | fire (block on bare claim; evidence-search 1.E narrows the false positives) |
| `strict` | fire + require an explicit "evidence: …" line in the agent's final message |

The `strict` augmentation lands with V1.1's evidence-contract surface.

## The hardest one to get right

Trigger 1 (completion-without-test-evidence) is the load-bearing one. It is also the most likely to over-fire on legitimate work. Three explicit calibration knobs the 1.D.6 pass should tune:

- **Word list scope.** "done" alone is too broad; "all edge cases" might be too narrow. Need to see what real sessions hit.
- **Negation handling.** "I am not done yet" should not fire. The V1.0 regex does not look behind for negations — Python's `re` does not support lookbehind of arbitrary length. Worth a `_check_negation()` helper in the matcher.
- **Hedging recognition.** "I think this is done" is softer than "this is done." Maybe the regex requires the word to be NOT preceded by `I think|seems|appears|probably|maybe` within 5 tokens.

These three knobs are the cheapest place to spend signal-to-noise calibration time during 1.D.6. The other two triggers have much narrower scope and should mostly behave.
