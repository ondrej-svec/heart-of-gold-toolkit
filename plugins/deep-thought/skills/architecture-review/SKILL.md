---
name: architecture-review
description: >
  Deep architectural review of a platform or product — cross-references code against claims,
  maps failure modes, evaluates scaling bottlenecks, and produces a decision-grade handoff document
  with ADRs. Use when: reviewing an existing system for scaling readiness, performing a CTO handoff,
  evaluating platform architecture for enterprise readiness, or auditing a codebase before a major
  migration. Triggers: architecture review, scaling review, platform review, CTO handoff,
  system audit, scaling analysis, architecture assessment, production readiness.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - Bash
  - WebSearch
  - WebFetch
  - Write
  - Edit
---

# Architecture Review

Deep, evidence-based architectural review that produces a decision-grade document. Not a checklist pass — a systematic investigation that cross-references every claim against actual code, maps failure modes through the full lifecycle, and evaluates whether the architecture can support its intended scale.

## Boundaries

**This skill MAY:** read code, analyze architecture, research platforms, write review documents, ask architectural decision questions via AskUserQuestion.
**This skill MAY NOT:** modify application code, deploy changes, or make architectural changes. It produces a review document — the team decides what to act on.

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Just summarize the issue/checklist" | Restating what the team already knows adds no value | CTO handoff that tells the team nothing new |
| "The README says X, so X is true" | Code drifts from docs constantly | False claims in the review become false decisions |
| "Recommend best practices without checking constraints" | A 3-person vibe-coding team can't run Kubernetes | Recommendations that are technically correct but impossible to execute |
| "Skip the edge cases — focus on happy path" | Production failures happen on the unhappy path | Architecture that works in demos but breaks under real load |
| "Trust the security audit's line numbers" | Code changes daily; audits are snapshots | Wrong file:line references destroy reviewer credibility |

---

## Phase 1: Scope and Context

**Entry:** User invokes `/architecture-review` with a target (repo path, issue URL, or description).

### 1.1 Identify the target

| Input | Action |
|-------|--------|
| GitHub issue URL | Fetch issue body via `gh issue view` |
| Repo path | Explore codebase structure |
| Description | Clarify scope via AskUserQuestion |

### 1.2 Gather context (parallel subagents)

Launch these **concurrently**:

1. **Codebase explorer** (subagent, sonnet): Map the tech stack, directory structure, API routes, database schema, external dependencies, deployment config. Read `package.json`/`requirements.txt`, `Dockerfile`, CI configs, `README.md`, `CLAUDE.md`.

2. **Documentation explorer** (subagent, sonnet): Find existing architecture docs, security audits, ADRs, brainstorms, plans. Check sibling repos for shared context (GDPR docs, design system, infrastructure).

3. **Issue/checklist analyzer** (if issue provided): Parse the issue into discrete concerns. Note what's covered vs. what's missing.

### 1.3 Ask the user

Use **AskUserQuestion** to clarify:
- What's the team size and technical capability? (dev team vs. vibe-coding vs. non-technical)
- What's the target scale? (users, concurrency, enterprise requirements)
- What constraints matter most? (cost, simplicity, compliance, speed)
- Any specific concerns not in the issue?

**Exit:** Target identified, codebase mapped, team constraints understood.

---

## Phase 2: Deep Analysis (Parallel Tracks)

Run these as **parallel subagents** to maximize depth without blowing context:

### Track A: Security Posture

- Read existing security audits — verify every finding against current code (line numbers drift!)
- Check auth on every API route (verify Method + Auth for each)
- Look for: unauthenticated endpoints, rate limiting gaps, input validation, CSRF, injection vectors
- Check for post-audit code that hasn't been reviewed
- Verify positive security findings still hold

### Track B: Scaling Bottlenecks

- Identify the **compute profile** of each critical path (CPU-bound vs I/O-bound vs LLM-waiting)
- Map database connection architecture (how many pools? shared or competing?)
- Check for synchronous blocking in request handlers (especially AI/LLM calls)
- Evaluate the deployment platform's actual limits (not marketing claims — read the docs)
- Identify the **single point of failure** for each external dependency

### Track C: Data Architecture & GDPR

- Inventory all personal data: what's collected, where it's stored, who it's sent to
- Map every external processor (LLM providers, email services, payment, analytics)
- Check for: privacy policy, terms of service, cookie consent, data deletion endpoints, data export
- Evaluate consent mechanisms — are they wired end-to-end or cosmetic?
- Check public-facing pages for data exposure (robots indexing, shared links without expiry)

### Track D: Lifecycle & Failure Modes

This is the most critical and most often skipped phase. Map the **complete user lifecycle**:

1. Identify every state transition in the product (signup → action → payment → result → delivery)
2. For each transition, answer:
   - What state is persisted at this point?
   - What's lost if the process fails here?
   - Is recovery possible? How?
   - Are there race conditions with concurrent requests?
3. Build a **drop-off table**: each row is a failure point, columns are {what's saved, what's lost, recovery path}
4. Identify the **critical gap** — the one failure mode that would cause the most damage

### Track E: Operational Readiness

- Error monitoring: can the team see production errors?
- Alerting: will anyone know when something breaks?
- Admin tooling: can the team administer the platform without raw SQL?
- Support mechanism: can users get help?
- CI/CD: do tests run automatically?
- Dev/prod separation: are environments isolated?

**Exit:** Findings from all tracks collected.

---

## Phase 3: Architecture Decisions (Interactive)

For each major architectural choice, present an **ADR** to the user via **AskUserQuestion**:

Format each question as:
- **Header:** Short label (e.g., "Hosting", "Database", "LLM Fallback")
- **Options:** 2-4 concrete choices with honest trade-offs
- **Recommendation:** Mark one as `(Recommended)` with clear rationale tied to the team's constraints

Common ADR categories (adapt to the specific platform):

| ADR | Typical Question |
|-----|-----------------|
| Hosting | Where should this run? (serverless vs containers vs hybrid) |
| Database | Managed vs self-hosted? Connection pooling strategy? |
| External API resilience | Fallback strategy for critical third-party dependencies |
| Background processing | Job queue vs synchronous with resilience patterns |
| Observability | What's the minimum viable monitoring stack? |
| Admin tooling | API-first? MCP? CLI? Web UI? |
| Compliance | GDPR docs, DPAs, data deletion — build vs adapt? |
| i18n | When and how to add language support |
| Security priority | Fix before or during migration? |

**Principle: fewer components is better.** For each recommendation, apply the test: *"Can this team set this up with AI tools in under an hour, and will they understand it 3 months later?"*

**Exit:** All ADRs decided by the user.

---

## Phase 4: Document Assembly

Write the review document with this structure:

```markdown
# [Platform Name] — Architecture Review

**Date / Author / Repo / Audience**

## Architecture Decision Records
(Table summarizing all ADRs from Phase 3)

## Executive Summary
(5 key findings, core recommendation table)

## Current Architecture
(Tech stack, data flow, API routes — verified against code)

## Security
(Audit status, unfixed findings, new findings in post-audit code)

## Architecture Bottlenecks
(Each bottleneck with compute profile and recommended fix)

## Edge Cases and Failure Modes
(Drop-off table, critical gap, recommended resilience pattern)

## [Topic-specific sections]
(GDPR, observability, admin, support, i18n — as relevant)

## Execution Order
(Phased plan with task numbers, effort estimates, dependencies)

## Component Summary
(Before/after table, what was deliberately not added)

## Appendices
(Env var inventory, post-audit routes, key file references)
```

### Document Quality Rules

1. **Every factual claim must be verifiable.** File paths, line numbers, API methods — cross-reference against the actual code. If the code has changed since an audit, say so.
2. **Effort estimates must be honest.** Add up the individual items. If they total 4 hours, don't write "~1 hour" in the summary.
3. **Internal consistency.** A finding labeled "critical" in one section must not be "medium" elsewhere. Counts must match. Task numbers must not duplicate.
4. **Distinguish evidence types.** Code-verified claims are stronger than vendor-doc assumptions. Platform pricing can change. Label accordingly.
5. **Every recommendation must pass the team constraint test.** If the team is 3 non-dev vibe coders, don't recommend Kubernetes.

**Exit:** Document written.

---

## Phase 5: Cross-Verification

The review document must be verified before shipping. Two approaches (use one or both):

### Option A: Dual-Model Review

Launch the same review prompt to two different models (e.g., Codex + Opus, or any two available). Compare findings:
- Unique findings from each model → evaluate and fix if valid
- Disagreements → investigate which is correct against the code
- Agreement → high confidence

### Option B: Self-Review Protocol

Re-read the document with this checklist:
- [ ] Every API route's Method, Path, and Auth matches the actual `route.ts` export
- [ ] Every line number reference is within 5 lines of the actual code
- [ ] File line counts match reality (check with `wc -l`)
- [ ] Effort estimates add up correctly across phases
- [ ] Task numbers are sequential with no gaps or duplicates
- [ ] ADR table decisions match the detailed section recommendations
- [ ] No claim says "zero" or "none" when the reality is "minimal" or "partial"
- [ ] Env var inventory is complete (grep for `process.env` across the codebase)
- [ ] External pricing/limits are marked as assumptions to verify

**Exit:** Document verified, fixes applied.

---

## Phase 6: Ship

1. Write the document to the target repo's `docs/` directory
2. Commit with a descriptive message summarizing scope
3. If a GitHub issue exists, add a comment linking to the document with a summary
4. Inform the user the review is complete

---

## Anti-Patterns

| Anti-Pattern | What to Do Instead |
|---|---|
| Restating the issue checklist with filler | Add value — find what the checklist misses |
| Recommending tools the team can't operate | Match recommendations to team capability |
| Listing 15 monitoring services | Pick the minimum stack that covers the gaps |
| Writing "best practice" without checking the code | Verify every claim against the actual implementation |
| Ignoring failure modes | Map the full lifecycle — production breaks on the unhappy path |
| Single-provider fallback (same vendor, different model) | Cross-provider fallback (different vendors entirely) |
| Treating the security audit as current truth | Audits are snapshots — code changes daily, verify everything |
