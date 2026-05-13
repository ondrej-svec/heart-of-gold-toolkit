# Non-negotiable PreToolUse triggers — mockups

Three triggers that fire at PreToolUse regardless of intensity. The bedrock floor: things every Quellis-equipped session refuses without a stated reason.

> **Status:** approved 2026-05-13 (review notes folded in). Ready for promotion to `packs/core/pretool-triggers.toml`.

## What we dropped and why

The first draft of this file listed seven triggers. Four were retired after the Auto Mode reframe (see plan § "Market context"):

- `non-negotiable.git-force-push-protected` — Auto Mode already blocks force-push and pushing directly to main; for non-Auto-Mode users, `Bash(git push --force*)` in `settings.json` allowlist catches it. Pure duplication.
- `non-negotiable.rm-rf-broad` — Auto Mode blocks "mass deletion" on cloud storage and irreversible destruction of pre-session files. The allowlist catches the local case.
- `non-negotiable.prod-db-no-backup` — Brittle without config-driven DB-name lists. Auto Mode's "production deploys" category overlaps partially. Deferred to V1.1 with a `[architect.databases]` config section.
- `non-negotiable.commit-no-verify` — Niche; not worth the maintenance for V1.0.

The remaining three each fill a gap Auto Mode does NOT close — the Tier 2 file-edit exemption, the no-classifier population (Pro plan, Bedrock/Vertex), or operations not in the default block list.

---

## 1. `git reset --hard` on commits not yet pushed

**ID:** `non-negotiable.git-reset-hard-unpushed`
**Tool:** `Bash`
**Pattern:** `^git reset --hard\b`

**Block message (195 chars):**

> Hard reset throws away the working tree — name what is being discarded first. List the commits or changes about to disappear, confirm none are unpushed work the user cares about, then proceed.

**Intended Claude response:**

Run `git status --short`, `git log @{u}..HEAD --oneline`, and `git stash list` first. Report what would be lost. Only then run the reset, and only if the user has acknowledged the loss. Prefer `git restore --staged .` or `git stash` when the goal is "back out of staging." This applies even to `git reset --hard origin/<branch>` — the local working tree still gets wiped, which can erase in-progress work the user forgot about.

**Why Quellis covers this when Auto Mode does not:** Auto Mode allows pushes to the current branch (which often pairs with a reset-hard workflow). The `Bash(git:*)` wildcard in many users' allowlists also lets reset-hard through. Quellis insists on visibility into what's being discarded.

**Positive examples:**
- `git reset --hard`
- `git reset --hard HEAD`
- `git reset --hard HEAD~3`
- `git reset --hard origin/main`

**Negative examples:**
- `git reset HEAD~1` *(soft reset — does not touch the working tree)*
- `git restore .`

---

## 2. Writing or modifying `.env*` files

**ID:** `non-negotiable.env-file-write`
**Tool:** `Edit`, `Write`
**Pattern (against file_path):** `\.env(?:\.[a-zA-Z0-9_-]+)?$` excluding paths matching `\.env\.example$` or `\.env\.template$` or `\.env\.sample$`

**Block message (193 chars):**

> Editing a `.env` file writes secret material into the working tree — refuse. Use the project's secret store (1Password, Doppler, Vercel/Clerk dashboard, GitHub Actions secrets) and reference the variable name only.

**Intended Claude response:**

Stop. Name the secret store this project uses (read from the README or AGENTS.md if not obvious). If the user is bootstrapping a fresh repo and there is no store yet, walk them through choosing one rather than writing the file inline. The only allowed `.env*` writes are `.env.example`, `.env.template`, `.env.sample` — and only with placeholder values.

**Why Quellis covers this when Auto Mode does not:** This is *the* canonical Tier 2 example. File edits inside the working directory are auto-approved by Auto Mode regardless of target. Auto Mode allows `.env` reads-and-uses; it does not police writes. The arXiv stress test paper identifies precisely this class — "in-project file edits" — as the 36.8% structural gap.

**Positive examples:**
- Write to `.env`
- Edit `.env.production`
- Write to `apps/web/.env.local`

**Negative examples:**
- Edit `.env.example` *(with placeholders)*
- Edit `.env.template`
- Edit `.env.sample`
- Edit `README.md` that mentions env vars by name

---

## 3. `npm publish` / `cargo publish` / GitHub release without explicit user confirmation

**ID:** `non-negotiable.package-publish`
**Tool:** `Bash`
**Pattern:** `^(?:npm|yarn|pnpm|bun) publish\b|^cargo publish\b|^gh release create\b`

**Block message (194 chars):**

> Publishing creates an immutable public artifact — refuse without a user "yes." Once a package version is pushed to npm/crates.io/GitHub releases it cannot be unpublished cleanly. Ask before, not after.

**Intended Claude response:**

Stop. Echo back what is about to be published: package name, version, what changed since the last release, who will see this. Ask for an explicit "yes, publish" from the user before running the command. If the user already said yes earlier in the conversation, surface that confirmation back so they can re-confirm rather than rely on memory.

**Why Quellis covers this when Auto Mode does not:** Auto Mode's default block list does not specifically enumerate publish commands; users routinely wildcard `Bash(npm:*)` to reduce prompts, which lets `npm publish` through.

**Positive examples:**
- `npm publish`
- `cargo publish`
- `gh release create v1.2.3`

**Negative examples:**
- `npm publish --dry-run`
- `cargo publish --dry-run`
- `cargo package`

---

## Review summary table

| # | ID | Lead clause | Chars | Auto Mode gap it covers |
|---|---|---|---:|---|
| 1 | `non-negotiable.git-reset-hard-unpushed` | "Hard reset throws away the working tree" | 195 | Wildcarded `Bash(git:*)` allowlists |
| 2 | `non-negotiable.env-file-write` | "Editing a `.env` file writes secret material" | 193 | Tier 2 file-edit exemption (36.8% gap) |
| 3 | `non-negotiable.package-publish` | "Publishing creates an immutable public artifact" | 194 | Not in Auto Mode default block list |

All three under the 200-char ceiling. All three lead with the concern in fewer than 8 words. Three is intentionally narrow — Quellis's value prop is the convention triggers and Stop-time evidence gates, not the non-negotiable list.
