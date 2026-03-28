---
name: review
description: >
  Focused review of code, documents, or architecture — one deep pass with evidence-based
  findings and clear verdict. Auto-detects what you're reviewing: branch diff, PR, file path,
  plan, brainstorm, or spec. One reviewer that reads carefully beats nine that skim.
  Triggers: review, code review, review PR, review diff, review plan, review brainstorm,
  review spec, review document, evaluate, check.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - Bash
---

# Review

One focused review. Not nine shallow passes — one deep one that reads carefully, evaluates with evidence, and gives a clear verdict.

## Boundaries

**This skill MAY:** read code, analyze diffs, read documents, present findings.
**This skill MAY NOT:** edit code, fix issues, create PRs, push changes, modify any files.

**This is a review, not a fix. Present findings — the user decides what to do.**

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Skim the diff — I'll catch the important stuff" | The one line you skip is the one that matters | Bug in production that a careful read would have caught |
| "No security concerns here" | Auth checks, input validation, and secrets leak through seemingly innocent code | Vulnerability shipped because nobody looked |
| "The tests pass, so the logic is correct" | Tests verify what the author THOUGHT, not edge cases they missed | False confidence → undetected regression |
| "Just style nits — not worth mentioning" | Mixing nits with real findings buries critical issues | Author reads 10 nits, misses the 1 security bug |

---

## Phase 1: Detect Review Type

**Entry:** User invoked `/review` with input (or no input = current branch diff).

Auto-detect based on input:

| Input | Review Type | How |
|-------|------------|-----|
| No arguments | **Code** — current branch diff | `git diff $(git merge-base HEAD main)..HEAD` |
| File path to `.md` in docs/plans/ or docs/brainstorms/ | **Document** | Read and evaluate against document criteria |
| File path to code files | **Code** — specific files | Read and review those files |
| PR URL or number | **Code** — PR diff | `gh pr diff <number>` |
| Directory path | **Architecture** — structural review | Analyze patterns, conventions, dependencies |

**If ambiguous:** Use **AskUserQuestion** (header: "Review type", question: "What are we reviewing?") with options: "Code changes" (description: "Review the diff or specific code files") and "Document" (description: "Evaluate the plan, brainstorm, or spec itself").

**Exit:** Review type determined — code, document, or architecture.

---

## Phase 2: Gather Context

**Entry:** Review type known.

**Auto-load relevant knowledge based on file types in the diff:**
- `.py` files → Read `../knowledge/python-fastapi-patterns.md`
- `.ts`/`.tsx` files → Read `../knowledge/typescript-nextjs-patterns.md`
- `.tf`/`.hcl` files → Read `../knowledge/infrastructure-ops.md`
- `.yaml` in k8s/helm paths → Read `../knowledge/infrastructure-ops.md`
- `.github/` or `Dockerfile` → Read `../knowledge/ci-cd-patterns.md`
- Auth/security-related code → Read `../knowledge/security-review.md`

**Load the knowledge BEFORE starting the review.**

Then gather project context:
1. Read the project's CLAUDE.md for conventions
2. Check what the change touches — auth, scoring, data, migrations, money → extra scrutiny
3. Read the related plan or brainstorm if referenced in commits or PR description
4. Note what's tested and what's not in the diff

**Exit:** Conventions loaded, risk areas identified, related context read.

### Evidence-Grounded Challenge (High Challenge)

Before starting the review, check `docs/solutions/` for recurring issues in the same component or domain. If this is a known problem area, note it.

During the review, apply CoVe to each Critical finding before reporting it:
- "What would disprove this finding?" — If you can't construct a scenario where this code is correct, the finding is solid.
- "Is this a real bug or a style preference?" — Only Critical findings that have failure scenarios.

After the review, check: if the same issue has appeared 3+ times across reviews, suggest adding it to the project's CLAUDE.md or `docs/solutions/`.

In autonomous mode (e.g., review triggered as part of a workflow): complete the full review, present all findings as a structured artifact without intermediate check-ins. Append a decision log if any judgment calls were made.

See `../knowledge/socratic-patterns.md` for CoVe technique details.

---

## Phase 3: Review

**Entry:** Context gathered, diff/document available.

### For Code Reviews

**Auto-route to specialized reviewer based on diff content:**

| Diff Composition | Reviewer Agent | Why |
|------------------|---------------|-----|
| >70% `.py` files | Task python-reviewer(diff + conventions) | Python-specific patterns |
| >70% `.ts`/`.tsx` files | Task typescript-reviewer(diff + conventions) | TypeScript-specific patterns |
| Security-sensitive (auth, secrets, validation) | Task security-reviewer(diff + conventions) | OWASP, threat modeling — **in addition to** stack reviewer |
| Infrastructure (`.tf`, `.yaml`, Helm, k8s) | Task infra-reviewer(diff + conventions) | IaC-specific checks |
| Performance-tagged or query-heavy | Task performance-reviewer(diff + conventions) | N+1, complexity, scaling |
| Mixed or unclear | Task strategic-reviewer(diff + conventions) | Generalist — the default |

**If unsure which reviewer:** Use strategic-reviewer. One good review beats a wrong specialist.

**If the diff is large (>500 lines):** Focus on the most impactful files first. Read all, but prioritize findings from core logic over boilerplate or generated code.

### For Document Reviews

Read the full document — don't skim. Evaluate against five criteria:

1. **Does it explain WHY?** Decision rationale, not just "we'll use X."
2. **Are risks identified?** What could go wrong? Mitigations?
3. **Is the scope clear?** Explicit in/out of scope?
4. **Are acceptance criteria measurable?** Testable? "Users can do X" not "the system is good."
5. **Is it actionable?** Could someone start `/work` from this right now?

### For Architecture Reviews

Analyze the directory/codebase structure:
- Pattern consistency (do similar things follow similar patterns?)
- Coupling and dependencies (are boundaries clean?)
- Convention adherence (does it match CLAUDE.md?)

**Exit:** Findings documented with evidence and severity.

---

## Phase 4: Present Findings

**Entry:** Review complete with findings.

### Code Review Format

```markdown
## Review: [scope summary]

### Critical Issues (must fix)
- **[CRIT-1]** [file:line] — Description. Evidence. Failure scenario. Fix suggestion.

### Suggestions (consider)
- **[SUG-1]** [file:line] — Description. Tradeoff if ignored.

### Observations (FYI)
- **[OBS-1]** Description.

### Verdict: APPROVE / APPROVE WITH NOTES / REQUEST CHANGES
```

**Every finding needs:** [evidence] + [failure scenario]. No evidence = no finding. "This looks off" is not a finding. "This will fail when X because Y" is.

### Document Review Format

```markdown
## Document Review: [filename]

### Strengths
- [What's well done — specific, not generic praise]

### Gaps
- [GAP-1] What's missing — why this matters for implementation.

### Suggestions
- [SUG-1] Specific improvement — how this makes the doc more actionable.

### Verdict: READY / NEEDS REFINEMENT
[1-2 sentence summary. If NEEDS REFINEMENT, name the top 1-3 things to fix.]
```

**If no issues found:** Say so clearly. Don't invent problems.

**Exit:** Findings presented in structured format with clear verdict.

---

## Phase 5: Handoff

**Entry:** Findings presented.

Use **AskUserQuestion** with:
- question: "Review complete. What would you like to do next?"
- header: "Next step"
- options:
  1. label: "Address findings", description: "Start fixing the issues (exits review mode)"
  2. label: "Discuss a finding", description: "Push back or get more detail on a specific finding"
  3. label: "Document insights", description: "Run /compound to capture non-obvious patterns found"
  4. label: "Done", description: "Review complete, move on"
- multiSelect: false

**If user selects "Discuss a finding":** Discuss, then return to this choice.

**If user selects "Document insights":** Suggest `/compound` with the specific insight.

---

## Validate

**After code review, verify:**
- [ ] Checked correctness (logic errors, edge cases, broken invariants)
- [ ] Checked security (auth, input validation, secrets, OWASP basics)
- [ ] Checked conventions (project patterns, naming, structure)
- [ ] Checked simplicity (YAGNI, unnecessary abstractions)
- [ ] Checked test coverage (critical paths tested, not just happy path)
- [ ] No files were modified — findings only

**After document review, verify:**
- [ ] Checked WHY (decision rationale, not just what)
- [ ] Checked risks (what could go wrong, mitigations)
- [ ] Checked scope (clear in/out)
- [ ] Checked criteria (measurable, testable)
- [ ] Checked actionability (can `/work` start from this?)

## When NOT to Use /review

- **Trivial changes.** Typo fixes, config updates, formatting. Just commit.
- **Generated code.** Review the input, not the output.
- **You just want a linter.** Run the linter instead.

## What Makes This Heart of Gold

- **Critical Trust (2.1):** Flags uncertainty. "I'm not sure about X — verify with Y" instead of faking confidence.
- **One deep review > nine shallow ones.** Signal, not noise.
- **Knowledge compounding bridge.** Reviews surface insights worth preserving via `/compound`.

## Knowledge References

- `../knowledge/critical-evaluation.md` — Evidence-based evaluation, uncertainty flagging
- `../agents/strategic-reviewer.md` — The default code review agent
- `../knowledge/socratic-patterns.md` — CoVe technique for verifying findings
- `../knowledge/active-memory-integration.md` — Memory read/write patterns
