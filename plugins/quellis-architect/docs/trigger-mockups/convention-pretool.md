# Convention PreToolUse triggers — mockups

Five architectural-convention triggers. Unlike the non-negotiables, these are *suppressible* at `chill` intensity. They fire at `standard` (the default) and at `strict`. The pattern: code change touches a load-bearing surface; the trigger asks for the documentation, evidence, or coordination that the project's conventions require.

> **Status:** drafts for Ondrej's review. Not yet in `packs/core/pretool-triggers.toml`.

> The plan's examples for 1.D.4 reference specific surfaces (auth, Clerk, migrations, scoring/payment, SQL templates). These mockups generalize where the project's conventions are stable, and stay specific where the plan named them.

---

## 1. Editing auth code without an ADR or written rationale

**ID:** `convention.auth-without-rationale`
**Tool:** `Edit`, `Write`
**Pattern (against file_path):** `(?:^|/)(?:auth|authn|authz|clerk|session|jwt|oauth|saml|sso)/`

**Block message (198 chars):**

> Editing auth code without a rationale in the diff or an ADR — pause. Auth changes need a one-line "why" in the commit message and a pointer to the decision doc or threat-model note that justifies the shape.

**Intended Claude response:**

Stop the edit. Ask for one of: (a) a sentence describing the auth invariant being preserved, (b) a path to the ADR or decision doc, or (c) explicit confirmation that this is exploratory work and the rationale will land before the PR. Then proceed with the edit, and ensure the commit message carries the rationale.

**Positive examples:**
- Editing `apps/web/src/auth/session.ts`
- Editing `clerk/middleware.ts`
- Writing a new file under `auth/`

**Negative examples:**
- Editing `tests/auth/session.test.ts` *(test file — separate trigger if needed)*
- Editing `README.md` that mentions auth

> Open question for Ondrej: do you want this to also fire on Edits to package.json that add an auth library?

---

## 2. Editing a migration file without naming the backfill plan

**ID:** `convention.migration-without-backfill-note`
**Tool:** `Edit`, `Write`
**Pattern:** `(?:^|/)(?:migrations|prisma/migrations|drizzle/migrations|db/migrate)/`

**Block message (196 chars):**

> Editing a migration file without a backfill plan — pause. New columns, type changes, or table renames need a note on how existing rows behave during the deploy. Inline `-- backfill: …` or a linked ADR.

**Intended Claude response:**

Stop the edit. Inspect the migration: is it a new column with a default that covers existing rows? A nullable column that callers handle? A backfill query in the same migration? If none, ask the user what the existing-row strategy is before proceeding. Append the backfill note inline as a SQL comment or link an ADR.

**Positive examples:**
- Editing `migrations/2026_05_13_add_user_intensity.sql`
- Writing a new file in `prisma/migrations/...`

**Negative examples:**
- Editing `migrations/README.md`

---

## 3. Adding a top-level dependency without a "why" check

**ID:** `convention.new-top-level-dep`
**Tool:** `Edit`
**Pattern:** matches Edit operations on `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` where the dependencies block grows. *(In V1.0 we match the file plus a heuristic regex against the content; a richer check ships in V1.1 by diffing the file pre/post.)*

**Pattern (against file_path AND content):** `package\.json$|pyproject\.toml$|Cargo\.toml$|go\.mod$`
**Pattern (against content):** `"dependencies"\s*:\s*\{|\[dependencies\]|\[tool\.poetry\.dependencies\]|^require \(`

**Block message (199 chars):**

> Adding a top-level dependency — pause. Each new dep is supply-chain surface. Name what it does, why an existing dep does not cover the need, and that the package has at least one recent release and credible maintenance.

**Intended Claude response:**

Stop the edit. For each new dep, report: package name, version, total weekly downloads, last release date, and whether it has a known CVE in the last 12 months. If any of those metrics is missing or alarming, ask the user before adding. Prefer existing deps in the project where they cover the same need.

**Positive examples:**
- Adding a new entry under `"dependencies": {}` in `package.json`
- Adding a new line in `[dependencies]` of `Cargo.toml`

**Negative examples:**
- Bumping an existing dep's version *(covered by a separate softer trigger in V1.1)*
- Editing `package.json` `scripts` block

> Open question for Ondrej: this trigger needs richer diff support than V1.0 has. Ship it as "fire on every package.json edit" and accept some false positives, or defer to V1.1 when we have proper diff inspection?

---

## 4. Touching scoring or payment code paths

**ID:** `convention.scoring-or-payment-path`
**Tool:** `Edit`, `Write`
**Pattern:** `(?:^|/)(?:scoring|score|payment|billing|invoice|stripe|paddle|charge|subscription|pricing)/`

**Block message (197 chars):**

> Editing scoring or payment code — pause. Money paths and ranking logic must not be edited without a test that fails first and an explicit "this is the change" message in the diff. State the invariant being preserved.

**Intended Claude response:**

Stop the edit. Confirm one of: (a) there is already a failing test that this change makes pass, (b) the change is to comments / types / refactor with no behavior change (and a regression test exists), (c) this is a deliberate scoring/pricing recalibration and the user has authorized it explicitly. Then proceed.

**Positive examples:**
- Editing `apps/api/src/scoring/rank.ts`
- Editing `payments/stripe-webhook.ts`
- Writing a new file under `billing/`

**Negative examples:**
- Editing `docs/scoring.md`
- Editing tests under `tests/scoring/`

---

## 5. SQL template-string interpolation (injection risk)

**ID:** `convention.sql-template-interpolation`
**Tool:** `Edit`, `Write`
**Pattern (against content):** `sql\s*` + backtick + `[^` + backtick + `]*\$\{`

> *(Mockup note: the exact regex is rendered carefully because backticks and `${` are notoriously hard to escape in inline docs. The validator will receive an escaped form.)*

**Block message (198 chars):**

> SQL with `${}` interpolation inside a tagged template literal — pause. Even when the variable looks safe today, interpolated SQL is an injection class. Use a parameterized query or a query builder's bound parameters.

**Intended Claude response:**

Stop the edit. Inspect the interpolation: if the variable is a literal constant from the same file, surface that and ask the user whether to inline the constant directly into the SQL string (still bad form). If the variable is data, refactor to a parameterized query (`sql` tag with `${param}` only for identifiers like table names that the driver verifies, or `db.query('... ?', [param])` for values).

**Positive examples:**
- ``sql`SELECT * FROM users WHERE id = ${userId}` ``
- ``sql`INSERT INTO ${tableName} VALUES (...)` ``

**Negative examples:**
- ``sql`SELECT * FROM users WHERE id = ?` `` *(parameterized)*
- ``"SELECT * FROM users"`` *(plain string, no template)*

> Open question for Ondrej: should the trigger have an exemption for `sql.identifier(...)` and `sql.raw(...)` patterns from common query builders? Or keep it strict in V1.0 and accept the false positives?

---

## Review summary table

| # | ID | Lead clause | Chars | Flag for review |
|---|---|---|---:|---|
| 1 | `convention.auth-without-rationale` | "Editing auth code without a rationale" | 198 | Fire on package.json auth-lib adds too? |
| 2 | `convention.migration-without-backfill-note` | "Editing a migration file without a backfill plan" | 196 | — |
| 3 | `convention.new-top-level-dep` | "Adding a top-level dependency" | 199 | Needs V1.1 diff support; ship lossy or defer? |
| 4 | `convention.scoring-or-payment-path` | "Editing scoring or payment code" | 197 | — |
| 5 | `convention.sql-template-interpolation` | "SQL with `${}` interpolation" | 198 | Exempt `sql.identifier` / `sql.raw`? |

All five under the 200-char ceiling. All lead with the concern in fewer than 8 words.

## Intensity matrix

| Intensity | Triggers 1–5 |
|---|---|
| `chill` | suppressed |
| `standard` (default) | fire |
| `strict` | fire + add an inline `pre-deploy verify` reminder *(V1.1)* |

V1.0 ships `standard` behavior only; the `strict` augmentation lands with V1.1's doctrine injection.
