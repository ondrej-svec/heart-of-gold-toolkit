---
name: test-writer
description: >
  Write failing tests from user stories and architecture docs. Behavioral tests
  verify WHAT (acceptance criteria), conformance tests verify HOW (architecture
  compliance). All tests must fail (RED state). Standalone or pipeline-aware via
  env vars. Triggers: test-writer, write tests, TDD, red phase, failing tests.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Write
  - Edit
  - Agent
  - AskUserQuestion
hooks:
  Stop:
    - hooks:
        - type: command
          command: |
            TEST_CMD=$(jq -r '.scripts.test // empty' package.json 2>/dev/null)
            if [ -z "$TEST_CMD" ]; then TEST_CMD="npx vitest run 2>&1"; fi
            RESULT=$(eval "$TEST_CMD" 2>&1)
            if echo "$RESULT" | grep -qE "[1-9][0-9]* passed"; then
              echo '{"ok":false,"reason":"Some tests are passing — ALL must fail in RED state"}'
            else
              echo '{"ok":true}'
            fi
          timeout: 120
---

# Test Writer

Write failing tests that define what "done" means. Behavioral tests verify acceptance criteria. Conformance tests verify the architecture is followed — not faked.

## Boundaries

**This skill MAY:** read stories and architecture docs, write test files, run the test suite.
**This skill MAY NOT:** write implementation code, modify existing source files, fix failing tests by changing expectations.

**ALL tests must FAIL when this skill completes. That's the point — RED state.**

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Write tests that pass with mocks" | Tests that pass with mocks prove nothing about real behavior | False confidence → bugs in production |
| "Skip conformance tests — unit tests are enough" | Unit tests don't verify architecture compliance | Stubs pass tests, real deps aren't wired |
| "Relax assertions — they're too strict" | Loose assertions let wrong implementations pass | Tests are decoration, not verification |
| "Test the happy path only" | Edge cases are where bugs hide | Happy path works, edge cases crash |

---

## Step 1: Read Stories

**If `$STORIES_PATH` is set (pipeline mode):**
1. Read the stories file at `$STORIES_PATH`
2. Extract all stories with their acceptance criteria and edge cases

**If no env var (standalone mode):**
1. Search `docs/stories/` for recent story files
2. **If found:** Use **AskUserQuestion** (header: "Stories", question: "Found stories: [list]. Which should I write tests for?") with each as an option
3. **If not found:** Use **AskUserQuestion** (header: "Stories", question: "Where are the stories? Provide a path, or describe what to test.")

**Exit:** Stories loaded, acceptance criteria extracted.

---

## Step 2: Read Architecture Doc

**If `$ARCH_PATH` is set (pipeline mode):**
1. Read the architecture doc at `$ARCH_PATH`
2. Extract: dependencies, integration pattern, file structure

**If no env var (standalone mode):**
1. Look for `*.architecture.md` near the stories file
2. **If found:** Read it automatically
3. **If not found:** Use **AskUserQuestion** (header: "Architecture", question: "Is there an architecture doc? Provide path or skip.") with options: "Skip (behavioral tests only)" and "Provide path"

**Exit:** Architecture context loaded (or skipped for standalone behavioral-only mode).

---

## Step 3: Write Behavioral Tests

For each story, write tests that verify acceptance criteria:

**Test naming convention:** Match project conventions (from CLAUDE.md or existing tests).

**Rules:**
- One test per acceptance criterion — no bundled assertions
- Each test references its story: `// STORY-001: criterion description`
- Tests assert on observable behavior, not implementation details
- Edge cases from stories become explicit test cases
- Tests MUST import from the expected implementation paths (from architecture doc's File Structure)
- Tests MUST call real functions with real arguments — no mocks of the thing under test

**Anti-patterns to avoid** (see `anti-patterns.md`):
- Testing that a function exists (it always will once created)
- Asserting on return type only (any stub returns the right type)
- Mocking the module under test
- Testing internal state instead of behavior

**Exit:** Behavioral test files written.

---

## Step 4: Write Conformance Tests

**Skip this step if no architecture doc is available.**

For each dependency and integration point in the architecture doc, write tests that verify compliance:

**Rules:**
- For each dependency listed: test that it is imported and used in the source
- For each integration pattern: test that the pattern is followed (events emitted, entry points exist)
- For each file in the File Structure: test that it exists and exports expected symbols

**Conformance test patterns** (see `conformance-patterns.md`):
- Import verification: test that source files import listed dependencies
- Pattern verification: test that the integration pattern is followed
- Structure verification: test that files exist at expected paths

**Exit:** Conformance test files written.

---

## Step 5: Verify RED State

Run the full test suite:

```bash
# Use project's test command
npm test 2>&1 || true
```

**ALL tests must fail.** This is the executable self-check.

**If any tests pass:**
1. Identify which tests are passing and why
2. Fix the tests to be more specific (tighter assertions, real imports, no mocks)
3. Re-run and verify

**Retry up to 3 times.** If tests still pass after 3 attempts, report the issue:
```
INCOMPLETE: {N} tests are passing when they should fail.
Passing tests: {list}
Reason: {why they pass — likely testing something that already exists}
```

**Exit:** All tests fail (RED state confirmed) or INCOMPLETE reported.

---

## Validate

Before completing, verify:

- [ ] Every acceptance criterion has at least one test
- [ ] Every test references its story ID (STORY-NNN)
- [ ] Conformance tests cover every dependency in the architecture doc
- [ ] ALL tests fail — RED state confirmed by running the suite
- [ ] No mocks of the module under test — tests call real functions
- [ ] Edge cases from stories have explicit test cases
- [ ] Test files are at the paths expected by the project's test framework

## What Makes This Heart of Gold

- **Building (4.3):** Tests define "done" before implementation starts — the foundation of TDD.
- **The 90/10 Craft (4.2):** Conformance tests catch stubs. They verify architecture is real, not faked.
- **Critical Trust (2.1):** RED state is verified by running the suite, not by assumption.
- **Creative Courage (4.1):** Testing edge cases takes courage — it's where the uncomfortable truths live.

## Knowledge References

- `./anti-patterns.md` — Weak test patterns that pass with stubs
- `./conformance-patterns.md` — How to write tests that verify architecture compliance
