---
name: scaffold
description: >
  Prepare a project for development — create directories, configs, install dependencies.
  Never creates source or test files. Standalone or pipeline-aware via $ARCH_PATH.
  Triggers: scaffold, setup project, prepare project, init project, create structure.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Write
  - Edit
  - AskUserQuestion
hooks:
  Stop:
    - hooks:
        - type: command
          command: |
            if [ ! -f /tmp/scaffold-start ]; then
              echo '{"ok":true}'
              exit 0
            fi
            FOUND=$(find . -name '*.ts' -newer /tmp/scaffold-start -not -name '*.config.*' -not -name '*.d.ts' | head -1)
            if [ -n "$FOUND" ]; then
              echo "{\"ok\":false,\"reason\":\"Created source files — scaffold must only create configs: $FOUND\"}"
            else
              echo '{"ok":true}'
            fi
---

# Scaffold

Prepare a project for development. Creates directories, configs, and installs dependencies — **never source or test files.**

## Boundaries

**This skill MAY:** create directories, config files, install dependencies, set up tooling.
**This skill MAY NOT:** create source files (*.ts, *.js, *.py, etc.), create test files, write implementation code, write test code.

**NEVER create source or test files. Structure and configuration only.**

## Common Rationalizations

| Shortcut | Why It Fails | The Cost |
|----------|-------------|----------|
| "Create a starter file — just a skeleton" | Skeletons become the implementation. Test writers then test the skeleton, not real behavior | Weak tests that pass with stubs |
| "Skip dependency install — implementer can do it" | Missing deps cause confusing errors downstream | Wasted time debugging missing imports |
| "Use default configs — they'll customize later" | Default configs often conflict with project conventions | Config drift → inconsistent behavior |

---

## Step 1: Read Architecture Doc

**If `$ARCH_PATH` is set (pipeline mode):**
1. Read the architecture doc at `$ARCH_PATH`
2. Extract: dependencies, file structure, external services
3. Announce: "Reading architecture: [filename]."

**If no env var (standalone mode):**
1. Use **AskUserQuestion** (header: "Project", question: "What project are you setting up? Provide an architecture doc path, or describe what you're building.")
2. If they provide a path, read it
3. If they describe it, gather: language/framework, dependencies, project type

**Exit:** Know what directories, dependencies, and configs are needed.

---

## Step 2: Assess Project State

Determine if this is greenfield or brownfield:

```bash
# Check for existing project indicators
ls package.json pyproject.toml Cargo.toml go.mod 2>/dev/null
ls -d src/ lib/ app/ 2>/dev/null
```

- **Greenfield:** No project manifest or source directories exist
- **Brownfield:** Project exists — verify paths, note discrepancies with architecture doc

Announce: "Project state: [greenfield/brownfield]. [Details]."

**Exit:** Project state assessed.

---

## Step 3: Create Structure (Greenfield)

**Only if greenfield.** For brownfield, skip to Step 4.

1. **Create timestamp marker** for Stop hook:
   ```bash
   touch /tmp/scaffold-start
   ```

2. **Create directories** from the architecture doc's File Structure section:
   ```bash
   mkdir -p src/services src/models tests/
   ```

3. **Create package manifest** (package.json, pyproject.toml, etc.):
   - Include all dependencies from the architecture doc's Dependencies section
   - Match version constraints exactly as specified

4. **Install dependencies:**
   ```bash
   npm install  # or pip install, cargo build, etc.
   ```

5. **Set up tooling configs** — ONLY if the project doesn't already have them:
   - Linter config (biome.json, .eslintrc, pyproject.toml [tool.ruff], etc.)
   - Formatter config (if separate from linter)
   - Test framework config (vitest.config.ts, pytest.ini, etc.)
   - TypeScript config (tsconfig.json) if applicable
   - Match project conventions from CLAUDE.md or existing configs

**Exit:** Project structure created, dependencies installed, tooling configured.

---

## Step 4: Verify Structure (Brownfield)

**Only if brownfield.** For greenfield, this was handled in Step 3.

1. Compare architecture doc's File Structure against actual project
2. Note discrepancies:
   - Missing directories → create them
   - Missing dependencies → install them
   - Conflicting configs → flag for user decision
3. Report: "Verified structure. [N] directories created, [M] dependencies added."

**Exit:** Project structure verified and aligned with architecture doc.

---

## Step 5: Write Context File

Write a context file for downstream consumers (test writers, implementers):

**Output path:** `{stories_path}/{slug}.context.md` (or `docs/stories/{slug}.context.md` if no override)

```markdown
# Context: {Feature Title}

## Project State
- Type: greenfield | brownfield
- Language: {language}
- Framework: {framework}
- Test framework: {test framework}

## Installed Dependencies
- {package}: {version} — {purpose}

## Directory Structure
- {path/}: {purpose}

## Config Notes
- {Any non-obvious config decisions}

## Commands
- Test: {test command}
- Lint: {lint command}
- Build: {build command}
```

**Exit:** Context file written. Scaffold complete.

---

## Validate

Before completing, verify:

- [ ] No source files created (*.ts, *.js, *.py — excluding configs like *.config.ts)
- [ ] No test files created
- [ ] All dependencies from architecture doc are installed
- [ ] Directory structure matches architecture doc's File Structure
- [ ] Tooling configs match project conventions (from CLAUDE.md or existing configs)
- [ ] Context file written for downstream consumers

## What Makes This Heart of Gold

- **Building (4.3):** Fast, mechanical setup — the boring work that makes everything after it possible.
- **The 90/10 Craft (4.2):** Configs match conventions exactly. No "close enough."
- **Critical Trust (2.1):** Discrepancies between architecture doc and reality are flagged, not silently ignored.
