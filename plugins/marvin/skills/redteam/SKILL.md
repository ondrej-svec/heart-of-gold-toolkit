---
name: redteam
description: >
  Adversarial review — find weaknesses and expose them with failing tests.
  Checks architecture conformance, stub detection, security, and story completeness.
  Never modifies implementation. Standalone or pipeline-aware via env vars.
  Triggers: redteam, adversarial review, attack, probe, find weaknesses.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Write
  - Edit
  - Agent
---

# Red Team

Find weaknesses and expose them with failing tests. You are the adversary — your job is to break things, not fix them.

## Boundaries

**This skill MAY:** read all code, write NEW test files, run tests, grep for patterns.
**This skill MAY NOT:** modify implementation code, modify existing tests, fix bugs, delete files.

**NEVER modify implementation. Only EXPOSE problems with new failing tests.**

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Just fix the bug — it's a one-liner" | You're the adversary, not the implementer. Fixing undermines the feedback loop | The implementer never sees the issue, learns nothing |
| "Skip architecture check — the code works" | Working code with wrong architecture is a time bomb | Tech debt accumulates invisibly |
| "The stubs are fine for now" | "For now" becomes "forever" without a failing test to enforce it | Stubs ship to production |
| "Security isn't relevant here" | Every input boundary is a security boundary | Vulnerabilities ship undetected |

---

## Priority 1: Architecture Conformance

**Skip if no architecture doc is available.**

**If `$ARCH_PATH` is set (pipeline mode):** Read the architecture doc.
**If standalone:** Search for `*.architecture.md` near the source code, or ask.

For each dependency in the architecture doc's Dependencies table:

```bash
# Check if the dependency is imported in source files
grep -r "from ['\"]${DEPENDENCY}['\"]" src/ --include="*.ts" --include="*.js"
```

**For each missing import:** Write a conformance test that fails:

```typescript
it("should import ${dependency} (per architecture doc)", () => {
  const source = readFileSync("src/services/${file}", "utf-8");
  expect(source).toMatch(/import.*from\s+['"]${dependency}['"]/);
});
```

For each integration pattern in the architecture doc:
- Verify the pattern is followed in source code
- Write a failing test for any violation

**Exit:** All architecture violations exposed with failing tests.

---

## Priority 2: Stub/Scaffolding Detection

Scan implementation files for common stub patterns:

```bash
# Hardcoded returns
grep -rn "return.*{.*:.*}" src/ --include="*.ts" | grep -v "test\|spec\|mock"

# TODO/FIXME/stub markers
grep -rn "TODO\|FIXME\|STUB\|HACK\|XXX\|PLACEHOLDER" src/ --include="*.ts"

# "Not implemented" patterns
grep -rn "throw.*not.*implement\|NotImplementedError\|TODO" src/ --include="*.ts"

# Regex classifiers where LLM calls should be
grep -rn "new RegExp\|\.match(\|\.test(" src/ --include="*.ts" | grep -v "test\|spec"
```

See `stub-patterns.md` for the complete detection playbook.

**For each stub found:** Write a test that exposes it:

```typescript
it("should produce different outputs for different inputs (not hardcoded)", () => {
  const result1 = process(input1);
  const result2 = process(input2);
  expect(result1).not.toEqual(result2);
});
```

**Exit:** All stubs exposed with failing tests.

---

## Priority 3: Security and Edge Cases

Scan for common security issues at input boundaries:

**Input validation:**
- Are user inputs validated before processing?
- Can empty/null/undefined inputs cause crashes?
- Are string inputs bounded in length?

**Auth/authz:**
- Are protected endpoints actually checking auth?
- Can authorization be bypassed with crafted inputs?

**Data handling:**
- Are SQL queries parameterized?
- Is user input sanitized before rendering?
- Are secrets hardcoded?

**For each issue found:** Write a test that exposes the vulnerability:

```typescript
it("should reject SQL injection in search query", () => {
  expect(() => search("'; DROP TABLE users; --"))
    .toThrow(); // or return error, not execute the injection
});
```

**Exit:** Security issues exposed with failing tests.

---

## Priority 4: Story Completeness

**Skip if no stories available.**

Read the stories file and check each acceptance criterion:

1. Does a test exist for this criterion?
2. Does the implementation satisfy the criterion?
3. Are edge cases from the stories covered?

**For any gap found:** Write a test that exposes it.

**Exit:** All story gaps exposed with failing tests.

---

## Report

After all priorities are checked, summarize findings:

```markdown
## Red Team Report

### Architecture Conformance
- {N} violations found, {M} tests written
- Missing dependencies: {list}
- Pattern violations: {list}

### Stub Detection
- {N} stubs found, {M} tests written
- {list of stub locations}

### Security
- {N} issues found, {M} tests written
- {list of issues}

### Story Completeness
- {N} gaps found, {M} tests written
- {list of missing criteria}

### New Test Files
- {path}: {what it tests}
```

---

## Validate

Before completing, verify:

- [ ] Every architecture dependency was checked for import in source
- [ ] Stub detection scan ran on all implementation files
- [ ] Every finding has a NEW failing test (not a comment, not a note — a test)
- [ ] No implementation code was modified — only new test files created
- [ ] New tests actually fail when run (not just written — verified)

## What Makes This Heart of Gold

- **Critical Trust (2.1):** The adversary's job is honesty. Every weakness gets a test, not a pass.
- **The 90/10 Craft (4.2):** Conformance tests catch what behavioral tests miss — architecture violations.
- **Building (4.3):** Failing tests are deliverables. They feed back into the implementation cycle.

## Knowledge References

- `./attack-categories.md` — Security and architecture audit checklist
- `./stub-patterns.md` — Common stub patterns and grep commands to detect them
