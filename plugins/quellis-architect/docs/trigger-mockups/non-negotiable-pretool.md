# Non-negotiable PreToolUse triggers — mockups

Seven triggers that fire at PreToolUse regardless of intensity. These are the bedrock floor: security, destructive operations, secrets, distribution-level mistakes. They block first and explain after.

> **Status:** drafts for Ondrej's review. Not yet in `packs/core/pretool-triggers.toml`.

---

## 1. Force-push to a protected branch

**ID:** `non-negotiable.git-force-push-protected`
**Tool:** `Bash`
**Pattern (regex against the command):** `^git push (?:--force|-f)\b.* (?:main|master|production|release)\b`

**Block message (197 chars):**

> Force-push to a protected branch — refuse and escalate to a maintainer. The remote history of main/master/production/release is shared state; rewrite needs a documented coordination plan, not a flag.

**Intended Claude response:**

Stop the push. Surface the user-stated goal back to them, then offer one of: (a) a regular `git push` if the divergence is unintended, (b) a maintainer-coordinated rewrite if it's intended. Do not retry with a different flag.

**Positive examples (must fire):**
- `git push --force origin main`
- `git push -f production`
- `git push --force-with-lease origin master` *(escape-hatch question for Ondrej: should `--force-with-lease` get a softer message rather than the same block?)*

**Negative examples (must not fire):**
- `git push origin feature-branch`
- `git push origin :stale-branch`
- `git push --force origin scratch/2026-04-throwaway`

---

## 2. Destructive `rm -rf` outside designated paths

**ID:** `non-negotiable.rm-rf-broad`
**Tool:** `Bash`
**Pattern:** `\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f|-rf|-fr)\s+(/|~|\$HOME|\*|\.\.)`

**Block message (192 chars):**

> Recursive delete targets a broad path — refuse without a project-scoped target. `rm -rf` against `/`, `~`, `..`, or a bare glob is one missed quote away from wiping the host. Name the exact directory.

**Intended Claude response:**

Refuse and ask for the specific target path. If the goal is "clean a build directory," propose the project-scoped command (`rm -rf ./target`, `rm -rf node_modules`). Never improvise a wider target.

**Positive examples:**
- `rm -rf /`
- `rm -rf ~`
- `rm -rf ../*`
- `cd /; rm -rf *`

**Negative examples:**
- `rm -rf ./target`
- `rm -rf node_modules`
- `rm -rf .next/cache`

---

## 3. `git reset --hard` on commits not yet pushed

**ID:** `non-negotiable.git-reset-hard-unpushed`
**Tool:** `Bash`
**Pattern:** `^git reset --hard\b(?!.* (?:origin/|HEAD~0))`

**Block message (195 chars):**

> Hard reset throws away the working tree — name what is being discarded first. List the commits or changes about to disappear, confirm none are unpushed work the user cares about, then proceed.

**Intended Claude response:**

Run `git status --short`, `git log @{u}..HEAD --oneline`, and `git stash list` first. Report what would be lost. Only then run the reset, and only if the user has acknowledged the loss. Prefer `git restore --staged .` or `git stash` when the goal is "back out of staging."

**Positive examples:**
- `git reset --hard`
- `git reset --hard HEAD`
- `git reset --hard HEAD~3`

**Negative examples:**
- `git reset --hard origin/main` *(when reconciling with remote — but still surface what's discarded)*
- `git reset HEAD~1` *(soft reset)*
- `git restore .`

> Open question for Ondrej: do you want even `origin/<branch>` resets to fire? They preserve nothing local and can still wipe in-progress work.

---

## 4. Writing or modifying `.env*` files

**ID:** `non-negotiable.env-file-write`
**Tool:** `Edit`, `Write`
**Pattern (against file_path):** `\.env(?:\.[a-zA-Z0-9_-]+)?$`

**Block message (193 chars):**

> Editing a `.env` file writes secret material into the working tree — refuse. Use the project's secret store (1Password, Doppler, Vercel/Clerk dashboard, GitHub Actions secrets) and reference the variable name only.

**Intended Claude response:**

Stop. Name the secret store this project uses (read from the README or AGENTS.md if not obvious). If the user is bootstrapping a fresh repo and there is no store yet, walk them through choosing one rather than writing the file inline. The only allowed `.env` write is `.env.example` with placeholder values.

**Positive examples:**
- Write to `.env`
- Edit `.env.production`
- Write to `apps/web/.env.local`

**Negative examples:**
- Edit `.env.example` *(only if all values are placeholders — flagged by a softer convention trigger)*
- Edit `README.md` *(may mention env vars by name; that's fine)*

---

## 5. Production-targeted DB commands without backup evidence

**ID:** `non-negotiable.prod-db-no-backup`
**Tool:** `Bash`
**Pattern:** `\b(psql|mysql|mongosh|redis-cli|wrangler d1)\b.* (?:prod|production|live|main)\b.*(?:DROP|TRUNCATE|DELETE|ALTER|UPDATE)\b`

**Block message (199 chars):**

> Destructive command on a production-labeled database — refuse without an explicit backup reference. Name the snapshot, dump, or PITR window that covers the rollback path, then re-issue with that evidence cited.

**Intended Claude response:**

Stop. Ask for the backup reference: a snapshot ID, a `pg_dump` filename and timestamp, or a point-in-time recovery window. If none exists, refuse to run the command and propose the safer transactional approach instead (test on staging, dry-run with `EXPLAIN`, wrap in a transaction with a verification query before commit).

**Positive examples:**
- `psql prod -c "DROP TABLE users"`
- `mysql production < migration.sql` *(when migration.sql contains a destructive statement)*

**Negative examples:**
- `psql staging -c "SELECT * FROM users LIMIT 10"`
- `psql prod -c "SELECT COUNT(*) FROM events"` *(read-only)*

> Open question for Ondrej: this one's brittle (depends on database name conventions). Want the regex tightened to only fire on a configurable list of "production DB names" from `.quellis/config.toml`? Defer to V1.1?

---

## 6. `npm publish` / `cargo publish` without explicit user confirmation

**ID:** `non-negotiable.package-publish`
**Tool:** `Bash`
**Pattern:** `^(?:npm|yarn|pnpm|bun) publish\b|^cargo publish\b|^gh release create\b`

**Block message (194 chars):**

> Publishing creates an immutable public artifact — refuse without a user "yes." Once a package version is pushed to npm/crates.io/GitHub releases it cannot be unpublished cleanly. Ask before, not after.

**Intended Claude response:**

Stop. Echo back what is about to be published: package name, version, what changed since the last release, who will see this. Ask for an explicit "yes, publish" from the user before running the command. If the user already said yes earlier in the conversation, surface that confirmation back so they can re-confirm rather than rely on memory.

**Positive examples:**
- `npm publish`
- `cargo publish`
- `gh release create v1.2.3`

**Negative examples:**
- `npm publish --dry-run`
- `cargo publish --dry-run`
- `cargo package`

---

## 7. Force-bypassing pre-commit hooks

**ID:** `non-negotiable.commit-no-verify`
**Tool:** `Bash`
**Pattern:** `\b(?:git commit|git rebase|git push).*--no-verify\b`

**Block message (197 chars):**

> Skipping the pre-commit hook — refuse without a stated reason. The hook is the project's last automated check. Bypassing it silently turns a bug into a future archaeology problem. Name what is wrong with the hook.

**Intended Claude response:**

Stop. Surface the hook output that's blocking the commit. If the hook is broken (not the code), propose fixing the hook config rather than bypassing it. If the user has a legitimate reason (working around a hook bug while it's being fixed), make them say so explicitly and include the reason in the commit message body.

**Positive examples:**
- `git commit --no-verify -m "WIP"`
- `git push --no-verify`
- `git rebase --no-verify`

**Negative examples:**
- `git commit -m "normal commit"`
- `pre-commit run --all-files` *(running the hook manually is fine)*

---

## Review summary table

| # | ID | Lead clause | Chars | Flag for review |
|---|---|---|---:|---|
| 1 | `non-negotiable.git-force-push-protected` | "Force-push to a protected branch" | 197 | `--force-with-lease` softer message? |
| 2 | `non-negotiable.rm-rf-broad` | "Recursive delete targets a broad path" | 192 | — |
| 3 | `non-negotiable.git-reset-hard-unpushed` | "Hard reset throws away the working tree" | 195 | Fire on `origin/<branch>` resets? |
| 4 | `non-negotiable.env-file-write` | "Editing a `.env` file writes secret material" | 193 | `.env.example` exemption needs separate convention trigger |
| 5 | `non-negotiable.prod-db-no-backup` | "Destructive command on a production-labeled database" | 199 | Brittle pattern; config-driven names in V1.1? |
| 6 | `non-negotiable.package-publish` | "Publishing creates an immutable public artifact" | 194 | — |
| 7 | `non-negotiable.commit-no-verify` | "Skipping the pre-commit hook" | 197 | — |

All seven are under the 200-char ceiling. All seven lead with the concern in fewer than 8 words. Three carry explicit follow-up questions for the review pass.
