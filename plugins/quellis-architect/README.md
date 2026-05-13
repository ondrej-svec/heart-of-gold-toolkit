# Quellis Architect

The senior architect for coding agents. Paired with the [`quellis`](https://github.com/ondrej-svec/conscience-harness) CLI, it wraps a Claude Code session in opinionated bootstrap, in-flight intercepts on non-negotiables, plan-grilling skills, evidence gates at `Stop`, and adaptive personalization driven by your real session history.

**Status:** V1.0 in build. See the [implementation plan](https://github.com/ondrej-svec/Bobo/blob/main/docs/plans/2026-05-13-feat-quellis-v2-senior-architect-plan.md).

## What it is

A coding agent is general-purpose by design. To produce production-grade engineering, it needs a *harness*: opinionated context, hooks, skills, doctrine, verification. Quellis Architect is that harness, in Claude Code-native form.

The work is split between two cooperating processes:

- **CLI (`quellis`)** — offline work. Onboarding, repo survey, pack management, session analysis, intensity calibration. Rust, filesystem-first, no network.
- **Plugin (`quellis-architect`)** — runtime. Hooks (PreToolUse / PostToolUse / Stop / SessionStart), skills (brainstorm, plan, verify, teach), agents (review, architect-sanity).

They coordinate through a single shared directory, `.quellis/`, in your repo. See [`docs/coordination.md`](docs/coordination.md) for the full protocol.

## What it does (V1.0)

- **Bootstrap.** `quellis init` surveys your repo, asks (or reads) three onboarding answers, and installs the plugin with a calibrated default intensity. Under three minutes on a fresh repo.
- **Intercept non-negotiables.** PreToolUse hook blocks `git push --force` to main, `rm -rf` outside designated safe paths, `git reset --hard` on unpushed commits, writes to `.env*`, force-bypass of pre-commit hooks, and a small list of similar footguns.
- **Intercept conventions.** A second tier of triggers fires on architectural-doctrine matches: touching auth code without an ADR reference, editing migrations without a backfill plan, adding top-level dependencies without a security check, touching scoring/payment paths, SQL template-string interpolation.
- **Gate evidence at Stop.** When the agent says "done," "verified," "safe," or "tested" without test-run evidence in the transcript, the Stop hook intercepts and asks for substantiation. Same for "migration applied" without verification, "secrets removed" without scan output.

V1.1, V1.2, V1.3 layer in plan-grilling skills, doctrine injection, adaptive personalization, and cross-agent support. See the plan for the full phase map.

## What it is not

- **Not a teacher.** It does not moralize or lecture.
- **Not a linter.** Mechanical gates are commodity; Quellis reasons about *what evidence justifies what claim*.
- **Not a wrapper replacing Claude Code.** Claude Code is the body; Quellis is the brain.
- **Not configurable to anything.** Opinionated; overridable but defaults are sharp.
- **Not verbose.** Every hook message is ≤ 200 characters.
- **Not cute.** No emojis in hook output, no jokes.

## Hooks in heart-of-gold-toolkit

`quellis-architect` is the second plugin in this toolkit to ship hooks (the first being `marvin`). The pattern in this plugin is *dynamic*: hooks call shell scripts that read trigger packs from the user's `.quellis/packs/` directory. This lets the CLI evolve trigger content without redeploying the plugin.

See `hooks/hooks.json` for the wiring and `docs/coordination.md` for the contract between CLI and plugin.

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
│   └─ coordination.md          # The .quellis/ shared-dir protocol
├─ hooks/
│   ├─ hooks.json               # Hook wiring (PreToolUse / Stop / SessionStart)
│   ├─ pretool.sh               # PreToolUse runner (loads .quellis/packs/core/pretool-triggers.toml)
│   ├─ stop.sh                  # Stop runner (evidence gate + claim-scan)
│   ├─ sessionstart.sh          # SessionStart marker + doctrine injection
│   └─ lib/                     # Shared helpers (evidence-search, etc.)
├─ skills/                      # V1.1: brainstorm / plan / verify / teach
├─ agents/                      # V1.1+: review, architect-sanity
└─ commands/                    # Slash command surface
```

## License

MIT. See [LICENSE](../../LICENSE) in the toolkit root.
