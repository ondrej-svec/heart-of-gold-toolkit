---
name: harness-sync
description: Replicate a known-good Claude Code harness onto another machine or into another repo. Clones or updates the user's config repo, verifies it against the shipped conventions, reinstalls plugin marketplaces, and reports drift between two machines. Use when setting up a second machine, onboarding a new laptop, recovering a harness, or checking whether two machines have diverged. Triggers - harness sync, replicate harness, set up my config on this machine, sync claude config, new laptop setup, harness drift, are my machines in sync.
argument-hint: [check|install|drift]
disable-model-invocation: true
allowed-tools: Bash, Read, Glob, Grep, AskUserQuestion
---

# Harness Sync

Move a working Claude Code harness to a second machine, and keep the two from
drifting apart afterwards.

Distinct from its siblings: `marvin:harness-up` writes *doctrine into a target
repo* (AGENTS.md, docs taxonomy). `marvin:scaffold` installs *dependencies and
configs*. This skill replicates *the harness itself* — `~/.claude`.

## Boundaries

**This skill MAY:** clone or pull the user's config repo, read local config,
run `claude plugin` install commands, run the harness validator, report drift.

**This skill MAY NOT:** push to any remote, commit on the user's behalf, write
credentials, overwrite an existing `~/.claude` without explicit confirmation,
or copy machine-local state (logs, auto memory, plugin caches, tokens).

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|---|---|---|
| "Just rsync the whole `~/.claude`" | Carries credentials, logs, plugin caches and per-machine auto memory | Tokens leak onto a second machine; caches for the wrong architecture |
| "Clone over the existing config, it's probably the same" | It usually is not, and the delta is invisible after the fact | Local-only skills and hooks destroyed with no record |
| "Config is tracked, so the machines match" | Plugins install out-of-band; a tracked settings.json can name marketplaces that were never added here | Skills silently missing, hooks referencing plugins that aren't installed |
| "Skip validation, the repo was fine on the other machine" | Absolute paths, missing binaries and unexecutable scripts are all machine-specific | A harness that looks installed and silently no-ops |

---

## Phase 0: Detect Mode

**Entry:** Skill invoked, optionally with `check`, `install`, or `drift`.

Resolve the mode:

| Signal | Mode |
|---|---|
| Argument given | Use it |
| `~/.claude/.git` absent | `install` — nothing here yet |
| `~/.claude/.git` present, argument absent | `check` |

If `install` and `~/.claude` already contains un-tracked local work, **stop and
ask** via AskUserQuestion before touching anything.

**Exit:** Mode known.

---

## Phase 1: Locate the Source of Truth

**Entry:** Mode known.

Find the config repo:

1. `git -C ~/.claude remote get-url origin` if the repo exists
2. Otherwise ask the user for the repo URL

Confirm the remote is reachable (`git ls-remote --exit-code`) and **private**
(`gh repo view --json visibility`). A public harness repo is a finding, not a
detail — report it and stop for confirmation. Config files routinely name
internal hostnames, project paths and tooling.

**Exit:** Reachable private remote identified.

---

## Phase 2: What Travels, and What Does Not

**Entry:** Source identified.

This split is the substance of the skill. State it explicitly before acting.

**Travels** — the portable harness:
`CLAUDE.md` · `settings.json` · `output-styles/` · `rules/` · `skills/` ·
`agents/` · `hooks/` · `scripts/` · `docs/`

**Never travels** — machine-local or secret:

| Path | Why |
|---|---|
| `.credentials.json` | Auth token for this machine only |
| `secrets/` | API keys |
| `logs/`, `history.jsonl`, `hook-approvals.log` | Capture raw tool inputs — this is how credentials leak into a repo |
| `projects/` | Auto memory, per-machine and per-repo by design |
| `plugins/` | Caches reinstalled from marketplaces, often arch-specific |
| `daemon/`, `jobs/`, `tasks/`, `session-env/`, `shell-snapshots/`, `file-history/` | Runtime state |

If any of these are tracked in the source repo, report it as a finding before
cloning. Something has already gone wrong upstream.

**Exit:** Split confirmed against the repo's actual `.gitignore`.

---

## Phase 3: Install or Compare

**Entry:** Split confirmed.

### Mode `install`

1. Clone into `~/.claude` (or into a temp dir and merge, if the directory is
   non-empty and the user confirmed).
2. `chmod +x` every script under `hooks/` and `scripts/` — the executable bit
   survives git, but verify rather than assume.
3. Add each marketplace named in `settings.json.extraKnownMarketplaces`, then
   install each plugin listed in `enabledPlugins`.
4. Run Phase 4.

### Mode `check`

`git -C ~/.claude fetch` then report ahead/behind against `origin/main`, plus
any uncommitted local changes. Do not pull automatically — local edits may be
deliberate work not yet committed.

### Mode `drift`

Compare this machine against the committed state and report:

- Tracked files modified locally
- Skills, hooks or rules present locally but untracked
- Marketplaces in `settings.json` that are not installed here
- Installed plugins absent from `enabledPlugins`
- Hook scripts referenced by `settings.json` that are missing or non-executable

**Exit:** Installed, or drift reported.

---

## Phase 4: Verify

**Entry:** Config present locally.

Run the harness validator if the repo ships one
(`~/.claude/scripts/validate-harness.sh`). Otherwise assert directly:

- `settings.json` parses
- Every hook script referenced exists, is executable, and has a `timeout`
- No Bash permission rule contains a pipe or continues after `:*` — prefix
  matchers cannot express either, so those rules are silently dropped
- Every skill has a `description`; no `agent:` value that is not a real
  subagent type
- No credential material in tracked config
- Binaries the hooks call (`jq`, formatters) are present on this machine

Report failures verbatim. **A harness that installs cleanly and silently
no-ops is the failure mode this phase exists to catch.**

**Exit:** Verification reported.

---

## Phase 5: Handoff

**Entry:** Verified.

Report: what was installed, what differs from the source, what needs manual
attention (launchd agents, OS-level permissions, credentials to authenticate
on this machine).

State plainly that credentials were **not** copied and must be established
here — `claude` login, and any API keys the skills expect in `secrets/`.

---

## Validate

- [ ] No credential, log, or auto-memory file copied between machines
- [ ] Remote confirmed private before any clone
- [ ] Every hook script executable and referenced correctly
- [ ] Marketplaces and plugins reinstalled, not assumed
- [ ] Validator run and its output reported verbatim
- [ ] Nothing pushed, nothing committed on the user's behalf

## When NOT to Use

- **Installing doctrine into a project repo** — that is `marvin:harness-up`.
- **Installing project dependencies** — that is `marvin:scaffold`.
- **Auditing whether a harness is any good** — this skill checks that two
  machines *match*, not that the thing they match on is well designed.

## What Makes This Heart of Gold

- **Critical Trust (2.1):** Verifies the installed result rather than trusting
  that a clean clone means a working harness. Reports drift as evidence.
- **Knowledge Compounding (3.2):** The harness becomes a versioned artifact
  that improves on one machine and propagates, instead of two configurations
  diverging until neither is trusted.
