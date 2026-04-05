# Stub Patterns

Common patterns that indicate an implementation is faked, hardcoded, or incomplete. Use these grep commands to detect them systematically.

## Detection Commands

### Hardcoded Returns

```bash
# Functions that always return the same object
grep -rn "return {" src/ --include="*.ts" --include="*.js" | \
  grep -v "test\|spec\|mock\|\.d\.ts\|config"

# Functions that always return the same string
grep -rn "return ['\"]" src/ --include="*.ts" --include="*.js" | \
  grep -v "test\|spec\|mock\|\.d\.ts\|config\|error\|Error"

# Functions that always return the same number
grep -rn "return [0-9]" src/ --include="*.ts" --include="*.js" | \
  grep -v "test\|spec\|mock\|\.d\.ts\|config"
```

### Explicit Markers

```bash
# Developer left a breadcrumb
grep -rn "TODO\|FIXME\|STUB\|HACK\|XXX\|PLACEHOLDER\|TEMPORARY" src/ \
  --include="*.ts" --include="*.js" | grep -v "node_modules"
```

### Not Implemented

```bash
# Throws on call
grep -rn "throw.*not.*implement\|NotImplementedError\|throw.*TODO" src/ \
  --include="*.ts" --include="*.js"

# Empty catch blocks
grep -rn "catch.*{" src/ --include="*.ts" -A1 | grep -B1 "^--$\|^\s*}$"
```

### Wrong Technology

```bash
# Regex where the architecture specifies LLM/API calls
grep -rn "new RegExp\|\.match(\|\.test(\|\.replace(" src/ \
  --include="*.ts" --include="*.js" | grep -v "test\|spec\|config\|util"

# Hardcoded mappings where dynamic lookup is specified
grep -rn "switch\|case ['\"]" src/ --include="*.ts" | grep -v "test\|spec"
```

### No-op Functions

```bash
# Empty arrow functions
grep -rn "=> {}" src/ --include="*.ts" --include="*.js"

# Functions with only a return statement and no logic
grep -rn "{\s*return" src/ --include="*.ts" -A0 | grep -v "test\|spec"
```

## Verification Strategy

For each suspected stub, write a test that would fail if the stub is real:

1. **Different inputs → different outputs.** Call the function with two meaningfully different inputs. If the outputs are identical, it's hardcoded.

2. **Side effects happen.** If the architecture says "writes to database" or "calls API," verify the side effect occurred. A stub skips side effects.

3. **Error cases error.** Call with invalid input. A stub often returns success regardless. A real implementation validates and rejects.

4. **Performance correlates with work.** If a function should process N items, verify that processing 1 item and 100 items produces proportionally different results (or at minimum, different outputs).

## False Positive Reduction

Not every match is a stub. Exclude:
- Configuration files (`*.config.*`)
- Type definition files (`*.d.ts`)
- Test files (`*.test.*`, `*.spec.*`)
- Utility functions that legitimately return constants (error messages, defaults)
- Guard clauses that return early on edge cases

When in doubt, read the surrounding context. A `return { error: "invalid input" }` in a validation guard is not a stub — it's correct behavior.
