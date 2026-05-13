# Quellis Architect

A Claude Code plugin that intercepts file-edit conventions and Stop-time evidence claims your `settings.json` allowlist and Auto Mode classifier cannot reach. Paired with the [`quellis`](https://github.com/ondrej-svec/conscience-harness) CLI.

**Status:** V1.0 in build. See the [implementation plan](https://github.com/ondrej-svec/Bobo/blob/main/docs/plans/2026-05-13-feat-quellis-v2-senior-architect-plan.md).

## What it is

Claude Code already ships two layers of safety:

1. **Permission allowlist** (`settings.json`) — gates Bash tool calls. Effective when curated, but most users wildcard (`Bash(git:*)`) to reduce permission fatigue.
2. **Auto Mode classifier** (Sonnet 4.6, Mar–Apr 2026 rollout) — an LLM evaluates every shell and network tool call before execution. Strong on force-push, `curl|bash`, production deploys.

Both layers share a structural gap: **they don't evaluate file edits to non-protected paths**. The arXiv stress-test paper on Auto Mode found 36.8% of state-changing actions skip the classifier this way — agents reach for `Edit`/`Write` when shell options would have been gated.

Quellis Architect lives in that gap. It does **not** duplicate Auto Mode. It does **not** replace the allowlist. It covers the file-edit class neither layer reaches, plus Stop-time evidence gates that no current layer attempts.

## What it does (V1.0)

**Three non-negotiable PreToolUse triggers** (gap-fillers Auto Mode does not cover by default):

- `git reset --hard` — even to `origin/<branch>` it wipes uncommitted local work
- `.env*` writes — never auto-blocked because file edits skip classification; this is *the* canonical Tier 2 example
- `npm/cargo publish`, `gh release create` — not enumerated in Auto Mode's default block list; usually wildcarded in allowlists

**Four convention PreToolUse triggers** (the value prop — project-specific architectural surfaces no generic classifier knows about):

- Editing auth code, or adding an auth library to `package.json` — flag without an ADR or rationale
- Editing migration files — flag without an inline backfill plan or linked ADR
- Editing scoring/payment/billing code — flag without a failing test or explicit recalibration auth
- SQL template-string interpolation — flag unless wrapped in `sql.identifier(...)`, `sql.raw(...)`, or `db.unsafe(...)`

**Three Stop-time evidence gates** (unique territory — Auto Mode is per-call pre-execution; no current layer does this):

- "Done/verified/safe/tested" without a test invocation in the transcript
- "Migration applied" without a verification query (`information_schema`, schema describe, sample row read)
- "Secrets removed" without scanner output (gitleaks, truffleHog, repo grep)

Each Stop trigger consults the session transcript before blocking — if the evidence is genuinely there, no false-positive intercept.

## What it is not

- **Not a teacher.** It does not moralize or lecture.
- **Not a linter.** Mechanical gates are commodity; Quellis reasons about *what evidence justifies what claim*.
- **Not a wrapper replacing Claude Code.** Claude Code is the body; Quellis is the brain.
- **Not a competitor to Auto Mode or `settings.json`.** Quellis is a complement. Run all three layers together.
- **Not configurable to anything.** Opinionated; overridable but defaults are sharp.
- **Not verbose.** Every hook message is ≤ 200 characters.
- **Not cute.** No emojis in hook output, no jokes.

## Architecture in one diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Claude Code session                                         │
│                                                              │
│  Tool call ──► settings.json allowlist ──► Auto Mode         │
│                                            classifier        │
│                ↓ (file edit)               ↓ (Tier 2 exempt) │
│                ╰─────────────╮     ╭──────╯                  │
│                              ▼     ▼                         │
│                ┌──────────────────────────────────────┐      │
│                │  Quellis Architect                   │      │
│                │  - PreToolUse pattern match          │      │
│                │  - Stop-time evidence search         │      │
│                └──────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

Layers are additive. A request can be blocked by any one of them.

## Install

Currently in private testing. Public marketplace install ships at V1.2 (after the V1.0 demo proof gate and V1.1 plan-grilling layer land).

To preview from this repo:

```bash
# After cloning the toolkit:
claude marketplace add /path/to/heart-of-gold-toolkit
claude plugin install quellis-architect
```

You'll also need the `quellis` CLI:

```bash
# From the conscience-harness repo:
cargo install --path crates/quellis-cli
quellis init
```

## Layout

```
plugins/quellis-architect/
├─ .claude-plugin/plugin.json   # Plugin metadata + version
├─ README.md                    # This file
├─ docs/
│   ├─ coordination.md          # The .quellis/ shared-dir protocol
│   ├─ triggers.md              # Trigger TOML schema
│   ├─ evidence.md              # Evidence-kind escape hatches
│   └─ platform-paths.md        # macOS/Linux cross-platform notes
├─ packs/
│   └─ core/
│       ├─ pretool-triggers.toml   # 3 non-negotiable + 4 convention
│       └─ stop-triggers.toml      # 3 evidence-gated
├─ hooks/
│   ├─ hooks.json               # SessionStart / PreToolUse / Stop wiring
│   ├─ sessionstart.sh          # Marks the session as Quellis-active
│   ├─ pretool.sh               # Delegates to hooks/lib/pretool_match.py
│   ├─ stop.sh                  # Delegates to hooks/lib/stop_match.py
│   └─ lib/                     # Python matchers, evidence search, validator
├─ tests/                       # 58 unittest cases (matcher + core pack)
├─ demo/                        # V1.0 demo orchestrator
└─ skills/ agents/ commands/    # V1.1 territory
```

## Recommended usage

> Pair Quellis with Auto Mode where available, and with your `settings.json` allowlist always. The three layers are additive:
>
> - **Allowlist** — what tool calls are pre-approved? Tight allowlists reduce friction without losing safety.
> - **Auto Mode** — what shell/network operations look risky? Classifier catches what the allowlist missed.
> - **Quellis** — what file-edit conventions and Stop-time claims are unique to your project? Catches what the other two exempt.

If you're on a plan without Auto Mode (Pro, Bedrock, Vertex), Quellis is more load-bearing — it's the only intelligent layer above the allowlist. Lean into it.

## References

- [Auto Mode for Claude Code](https://claude.com/blog/auto-mode) — Anthropic's blog post on the classifier
- [Auto Mode engineering deep dive](https://www.anthropic.com/engineering/claude-code-auto-mode)
- [Claude Code permission modes (official docs)](https://code.claude.com/docs/en/permission-modes)
- [arXiv 2604.04978v2 — Stress-test evaluation of Auto Mode](https://arxiv.org/html/2604.04978v2) — identifies the Tier 2 gap
- [Cursor Auto-Run analysis](https://www.backslash.security/blog/cursor-ai-security-flaw-autorun-denylist)

## License

MIT. See [LICENSE](../../LICENSE) in the toolkit root.
