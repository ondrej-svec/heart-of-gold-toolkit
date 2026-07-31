# Harness Doctrine

General rules for how a repository documents itself so agents and humans can do
correct work without re-deriving context every session. This is the doctrine
`marvin:harness-up` and `harness-author` write toward.

Project-agnostic by construction: nothing here assumes a framework, team shape,
or deploy target. Repo-specific facts belong in the repo's own `AGENTS.md`, not
here.

## Why this exists

- Repo-native context before high-autonomy generation
- Progressive disclosure instead of one giant prompt blob
- Executable verification as the trust boundary
- Continuous doc gardening instead of letting drift compound

## The five jobs of a root AGENTS.md

1. Orient the agent to the repo mission and trust boundaries
2. Say what to read before editing
3. Route task types to the right deeper docs
4. State the verification boundary and completion standard
5. Point outward to the real system of record instead of duplicating it

## Anti-goals — do not turn the root file into

- A copy of ADRs, security docs, or other systems of record
- A place for volatile, fast-changing operational state
- A mixed-audience dump blending public-safe guidance with private-ops detail
  without labelling the boundary
- A stale checklist graveyard nobody maintains

Need more detail? Improve a deeper doc and link to it. **The root file is a map,
not a manual.**

## Progressive disclosure

1. Root `AGENTS.md` — repo-wide orientation
2. Focused docs / runbooks — durable domain rules
3. Plans and ADRs — work in flight, architecture decisions
4. Subtree `AGENTS.md` — when one surface has persistent local rules

If a folder keeps needing special instructions, add a subtree file there rather
than growing the root indefinitely.

## Standard shape

Mission → Read First → Task Routing → Repo Map → Language & Trust Boundaries →
Verification Boundary → Done Criteria.

The shape is operational: it should let an agent pick the next safe move fast.
Subtree files follow the same shape at smaller scale. A 300-line subtree file is
a manual, not a map.

**Minimum viable shape** for a new or tiny repo: goal, context, constraints,
done-when. That stays correct as long as it is used as a map.

## The AGENTS.md ↔ CLAUDE.md bridge

Claude Code does **not** read `AGENTS.md` natively — it reads `CLAUDE.md`. If
canonical doctrine lives in `AGENTS.md`, bridge explicitly:

- `@AGENTS.md` as the first line of `CLAUDE.md`, or
- `ln -s AGENTS.md CLAUDE.md` when there is no Claude-specific content

Never maintain two divergent copies. One file is the source of truth; the other
is a pointer.

**Which one is canonical is a per-repo question, not a rule.** AGENTS.md-primary
is the default because it is tool-agnostic. But a repo whose only agent is Claude
Code — a personal harness, most obviously — is better served by CLAUDE.md-primary
with a one-line `AGENTS.md` pointing at it: the canonical file is then the one the
tool loads natively every session, with no bridge to forget. The failure mode this
rule exists to prevent is two divergent copies, and either direction prevents it.

When a repo already has a working CLAUDE.md and no AGENTS.md, do not relocate its
doctrine to satisfy the default. Ask first. Moving a file that is already loading
correctly buys nothing and risks a session where neither file is found.

## Maintenance triggers

Update `AGENTS.md` or its linked docs when:

- Repo entry points change
- Trust boundaries change
- A framework or runtime workflow changes materially
- Contributors repeatedly make the same mistake
- A linked document stops being the true source of truth

## Scoring appendix — PASS/FAIL

Binary only. No score, no grade, no percentage. Output `<check>: PASS` or
`<check>: FAIL — <one-line reason>`.

| Check | Verifies |
|---|---|
| `agents_md_exists` | `AGENTS.md` exists at the repo root |
| `map_not_dump` | Orientation and routing, not a manual. Heuristic: under ~180 lines, routes rather than restates, no ADR copy, no volatile state |
| `read_first_present` | An explicit "Read First" section names what to read before editing |
| `task_routing_present` | At least three distinct task areas, each with at least one linked reference |
| `verification_boundary_stated` | Names the actual boundary — specific test/lint/build commands — not a gesture at "testing" |
| `done_criteria_explicit` | States what done means operationally, not vibes |
| `next_safe_move_obvious` | An agent stopping mid-task can leave the next move visible |
| `repo_map_matches_reality` | If a repo map exists, it lists every load-bearing directory |
| `links_repo_relative` | Links are repo-relative so they work on the forge and in local clones |
| `no_chat_only_rules` | No critical rule lives only in chat or prompt memory |
| `public_private_boundaries_current` | Trust boundaries are described and current |
| `maintenance_triggers_named` | The file names the events that should trigger an update |

### Plans-directory checks

| Check | Verifies |
|---|---|
| `no_complete_plans_in_plans_root` | No `docs/plans/*.md` outside `archive/` has `status: complete` or `superseded` |
| `no_non_plan_types_in_plans_root` | No `docs/plans/*.md` has a `type:` other than `plan` or `research` |
| `plan_status_field_canonical` | Every `status:` is in the canonical list — no `completed` typo |

## Known ways to game this (don't)

- **Keeping the root file short by routing to a doc that doesn't exist.** A
  broken link is worse than inlining. `map_not_dump` PASS with
  `links_repo_relative` FAIL is the tell.
- **Claiming `verification_boundary_stated` because the file contains the word
  "test".** The check wants the command, not the string.
- **Splitting one overgrown file into several overgrown subtree files.** The
  shape applies at every level.
- **Marking a plan `in_progress` to dodge the archive check.** The checks count
  status values; they don't read intent.
- **Reviewing FAILs in bulk as noise.** If more than half the FAILs in one run
  point at the same check, that is a cluster — report it as a pattern.

## Plan lifecycle

Plans are durable artifacts, never deleted. A plan is either live in
`docs/plans/` or archived in `docs/plans/archive/`.

**Canonical status values:** `approved` (reviewed, not started) · `in_progress`
(execution begun) · `complete` (criteria green, shipped) · `superseded` (a newer
plan replaced it, and links back) · `captured` (reference-only, used sparingly).

`completed` is not canonical — normalize to `complete`. Plans move forward only:
`approved → in_progress → complete | superseded`. To restart a complete plan,
open a new one and mark the old superseded.

```
docs/plans/
├── archive/              # complete + superseded, append-only, flat
├── <slug>-plan.md        # live only (approved | in_progress)
└── <slug>-notes.md       # type: research, with for-plan:
```

**Archive rules**

- **Same commit.** Status flip and file move happen together. A half-moved state
  is worse than no move — the directory can't be trusted either way.
- **`git mv`**, to preserve blame.
- **Update inbound links** in that same commit.
- **Append-only.** A wrong plan gets superseded, never deleted.
- **Flat**, until it grows unreadable — and that restructure is its own plan.

## Enforce it or it rots

The reference implementation this doctrine was extracted from drifted: twelve
plans marked `complete` were never moved out of `docs/plans/`, and three used
non-canonical status values — all accumulating in the final week before the repo
went dormant. The doctrine was sound and consistently applied for months; what
was missing was a check that ran without anyone remembering to run it.

Wire the scoring checks into CI or a pre-push hook. A doctrine document only
humans reread is a doctrine document that goes stale between rereads.
