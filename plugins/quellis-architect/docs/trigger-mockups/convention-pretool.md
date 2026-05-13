# Convention PreToolUse triggers — mockups

Four architectural-convention triggers. Unlike the non-negotiables, these are *suppressible* at `chill` intensity. They fire at `standard` (the default) and at `strict`. The pattern: code change touches a load-bearing surface; the trigger asks for the documentation, evidence, or coordination that the project's conventions require.

> **Status:** approved 2026-05-13 (review notes folded in). Ready for promotion to `packs/core/pretool-triggers.toml`.

## Why convention triggers are the value prop

After the Auto Mode reframe (see plan § "Market context"), the non-negotiable list shrank from seven to three because most of it duplicated Auto Mode's defaults. The convention triggers don't duplicate anything — they encode *project-specific architectural judgment* that no LLM classifier can know without project context.

The arXiv stress-test paper on Auto Mode identified the file-edit Tier 2 exemption as the load-bearing structural gap: 36.8% of state-changing actions skip the classifier entirely. Convention triggers live exactly in this gap. They are the file-edit-shaped intercepts Auto Mode does not run.

## What we dropped and why

The first draft listed five triggers. One was deferred:

- `convention.new-top-level-dep` — Real diff support (read pre-edit file, compare to post-edit) lands in V1.1. V1.0 would have had to fire on every package.json/Cargo.toml/pyproject.toml edit and accept the false-positive rate on version bumps and `scripts` changes. After the auto-mode reshape trimmed the non-negotiables to three, four cleaner conventions are a better V1.0 surface than five with one shaky member.

---

## 1. Editing auth code or adding an auth library without an ADR or written rationale

**ID:** `convention.auth-without-rationale`
**Tool:** `Edit`, `Write`
**Pattern:**
- against file_path: `(?:^|/)(?:auth|authn|authz|clerk|session|jwt|oauth|saml|sso)/`
- OR against content (when file_path matches `package\.json$|Cargo\.toml$|pyproject\.toml$|go\.mod$`): `clerk|@auth0|next-auth|lucia|supabase[/-]auth|@aws-sdk/client-cognito|firebase-auth|passport|@workos/|stack-auth`

**Block message (198 chars):**

> Editing auth code without a rationale in the diff or an ADR — pause. Auth changes need a one-line "why" in the commit message and a pointer to the decision doc or threat-model note that justifies the shape.

**Intended Claude response:**

Stop the edit. Ask for one of: (a) a sentence describing the auth invariant being preserved, (b) a path to the ADR or decision doc, or (c) explicit confirmation that this is exploratory work and the rationale will land before the PR. Then proceed with the edit, and ensure the commit message carries the rationale.

This trigger generalizes from "editing the auth folder" to "introducing or changing auth in any way." Adding `@clerk/nextjs` to package.json is an architectural decision the same shape as editing `auth/middleware.ts`.

**Positive examples (folder):**
- Editing `apps/web/src/auth/session.ts`
- Editing `clerk/middleware.ts`
- Writing a new file under `auth/`

**Positive examples (package.json):**
- Adding `"@clerk/nextjs": "^4.0.0"` to `dependencies`
- Adding `"next-auth": "..."`
- Adding `passport` or `lucia`

**Negative examples:**
- Editing `tests/auth/session.test.ts` *(test file)*
- Editing `README.md` that mentions auth
- Bumping `@clerk/nextjs` from `4.0.0` to `4.1.0` *(version-only changes are V1.1 territory — V1.0 may fire on these as a false positive)*

---

## 2. Editing a migration file without naming the backfill plan

**ID:** `convention.migration-without-backfill-note`
**Tool:** `Edit`, `Write`
**Pattern:** `(?:^|/)(?:migrations|prisma/migrations|drizzle/migrations|db/migrate|supabase/migrations|alembic/versions)/`

**Block message (196 chars):**

> Editing a migration file without a backfill plan — pause. New columns, type changes, or table renames need a note on how existing rows behave during the deploy. Inline `-- backfill: …` or a linked ADR.

**Intended Claude response:**

Stop the edit. Inspect the migration: is it a new column with a default that covers existing rows? A nullable column that callers handle? A backfill query in the same migration? If none, ask the user what the existing-row strategy is before proceeding. Append the backfill note inline as a SQL comment or link an ADR.

**Why Quellis covers this when Auto Mode does not:** Migration files are file edits — Tier 2. Auto Mode auto-approves them. The intelligence about "is there a backfill plan?" requires reading the migration content, which a generic classifier cannot reliably do.

**Positive examples:**
- Editing `migrations/2026_05_13_add_user_intensity.sql`
- Writing a new file in `prisma/migrations/...`
- Editing `supabase/migrations/20260513_add_column.sql`

**Negative examples:**
- Editing `migrations/README.md`
- Editing `db/migrate/utils.ts` *(helpers, not migrations)*

---

## 3. Touching scoring or payment code paths

**ID:** `convention.scoring-or-payment-path`
**Tool:** `Edit`, `Write`
**Pattern:** `(?:^|/)(?:scoring|score|payment|billing|invoice|stripe|paddle|charge|subscription|pricing|checkout)/`

**Block message (197 chars):**

> Editing scoring or payment code — pause. Money paths and ranking logic must not be edited without a test that fails first and an explicit "this is the change" message in the diff. State the invariant being preserved.

**Intended Claude response:**

Stop the edit. Confirm one of: (a) there is already a failing test that this change makes pass, (b) the change is to comments / types / refactor with no behavior change (and a regression test exists), (c) this is a deliberate scoring/pricing recalibration and the user has authorized it explicitly. Then proceed.

**Why Quellis covers this when Auto Mode does not:** These are file edits — Tier 2. No generic classifier can know that *your* codebase's `apps/api/src/scoring/` is special; that's project-specific architectural knowledge encoded in the pack.

**Positive examples:**
- Editing `apps/api/src/scoring/rank.ts`
- Editing `payments/stripe-webhook.ts`
- Writing a new file under `billing/`

**Negative examples:**
- Editing `docs/scoring.md`
- Editing tests under `tests/scoring/`

---

## 4. SQL template-string interpolation (injection risk)

**ID:** `convention.sql-template-interpolation`
**Tool:** `Edit`, `Write`
**Pattern (against content):** `sql\s*` + backtick + `[^` + backtick + `]*\$\{(?!\s*(?:sql\.identifier|sql\.raw|db\.unsafe))`

> *(Mockup note: the exact regex is rendered carefully because backticks and `${` are notoriously hard to escape in inline docs. The validator will receive an escaped form. The negative-lookahead exempts query-builder helpers.)*

**Block message (199 chars):**

> SQL with `${}` interpolation inside a tagged template literal — pause. Even when the variable looks safe today, interpolated SQL is an injection class. Use a parameterized query or wrap with `sql.identifier`/`sql.raw`/`db.unsafe`.

**Intended Claude response:**

Stop the edit. Inspect the interpolation: if the variable is wrapped in `sql.identifier(...)` (for identifiers verified by the driver), `sql.raw(...)` (for deliberate raw SQL), or `db.unsafe(...)` (for one-off scripts), it is intentional and the trigger should not have fired — report the false positive. If the interpolation is unwrapped data, refactor to a parameterized query (`?` placeholders + bound parameters) or wrap with one of the helpers above and add a comment justifying it.

**Why Quellis covers this when Auto Mode does not:** Code edits — Tier 2. Even when Auto Mode is active, file edits inside the working dir skip the classifier. SQL injection is exactly the class of bug AI-generated code routinely introduces.

**Positive examples:**
- ``sql`SELECT * FROM users WHERE id = ${userId}` ``
- ``sql`INSERT INTO ${tableName} VALUES (...)` ``

**Negative examples (exempt):**
- ``sql`SELECT * FROM users WHERE id = ?` `` *(parameterized)*
- ``sql`SELECT * FROM ${sql.identifier(tableName)}` ``
- ``sql`${sql.raw(dynamicClause)}` ``
- ``db.unsafe(`UPDATE ...`)`` *(deliberate one-off)*

---

## Review summary table

| # | ID | Lead clause | Chars | Differentiator |
|---|---|---|---:|---|
| 1 | `convention.auth-without-rationale` | "Editing auth code without a rationale" | 198 | Project-specific architectural surface — Auto Mode cannot reach |
| 2 | `convention.migration-without-backfill-note` | "Editing a migration file without a backfill plan" | 196 | Tier 2 file edit; needs content-aware judgment |
| 3 | `convention.scoring-or-payment-path` | "Editing scoring or payment code" | 197 | Project-specific load-bearing surface |
| 4 | `convention.sql-template-interpolation` | "SQL with `${}` interpolation" | 199 | Common AI-generated bug class; Tier 2 file edit |

All four under the 200-char ceiling. All four lead with the concern in fewer than 8 words. Each one has a clear "why Auto Mode does not cover this" — the convention triggers are not duplicating any other layer in the stack.

## Intensity matrix

| Intensity | Triggers 1–4 |
|---|---|
| `chill` | suppressed |
| `standard` (default) | fire |
| `strict` | fire + add an inline `pre-deploy verify` reminder *(V1.1)* |

V1.0 ships `standard` behavior only; the `strict` augmentation lands with V1.1's doctrine injection.
