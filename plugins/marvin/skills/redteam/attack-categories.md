# Attack Categories

Checklist for adversarial review. Work through each category systematically.

## 1. Architecture Conformance

**Target:** Every claim in the architecture doc must be true in the code.

| Check | How | Failing means |
|-------|-----|--------------|
| Dependency imports | `grep -r "from ['\"]{dep}['\"]" src/` per dep in arch doc | Stub — using a fake instead of the real thing |
| Integration pattern | Read source for pattern match (events, middleware, etc.) | Wrong integration — will break in production |
| File structure | `ls` each path in arch doc's File Structure | Missing files — incomplete implementation |
| Export symbols | Import and check `typeof` for each expected export | Missing exports — downstream consumers will break |

## 2. Stub/Scaffolding Detection

**Target:** No hardcoded, faked, or placeholder implementations shipped as "done."

| Pattern | Grep Command | Severity |
|---------|-------------|----------|
| Hardcoded return values | `grep -rn "return.*{.*:.*}" src/ --include="*.ts"` | High — always produces same output |
| TODO/FIXME markers | `grep -rn "TODO\|FIXME\|STUB\|HACK\|XXX" src/` | High — explicitly unfinished |
| Not implemented throws | `grep -rn "throw.*not.*implement\|NotImplementedError" src/` | High — crashes at runtime |
| Regex where LLM specified | `grep -rn "new RegExp\|\.match(\|\.test(" src/` | High — wrong technology |
| Empty function bodies | `grep -rn "() => {}" src/` or functions with only `return;` | Medium — no-op |
| Console.log as error handling | `grep -rn "console\.\(log\|warn\|error\)" src/` near catch blocks | Medium — swallowed errors |
| Magic numbers | Unexplained numeric literals in business logic | Low — hard to maintain |

## 3. Security

**Target:** Input boundaries are defended. Auth is enforced. Data is handled safely.

### Input Validation
- [ ] All user inputs validated (type, length, format)
- [ ] Null/undefined/empty handled explicitly
- [ ] Numeric inputs bounded (no negative prices, no infinite quantities)
- [ ] String inputs bounded in length
- [ ] File uploads validated (type, size, content)

### Auth/Authz
- [ ] Protected endpoints check authentication
- [ ] Authorization checks match business rules (not just "is logged in")
- [ ] Token validation is real (not just "token exists")
- [ ] Session handling is secure (httpOnly, secure flags, expiry)

### Data Handling
- [ ] SQL queries use parameterized statements
- [ ] User input sanitized before HTML rendering (XSS)
- [ ] No secrets in source code (`grep -rn "password\|secret\|api_key\|token" src/`)
- [ ] Sensitive data not logged
- [ ] Error messages don't leak internal details

### Injection
- [ ] SQL injection: `'; DROP TABLE users; --`
- [ ] XSS: `<script>alert('xss')</script>`
- [ ] Command injection: `; rm -rf /`
- [ ] Path traversal: `../../etc/passwd`
- [ ] SSRF: internal URLs in user-controlled fields

## 4. Story Completeness

**Target:** Every acceptance criterion is implemented and tested.

| Check | How |
|-------|-----|
| Criterion coverage | Map each `- [ ]` in stories to a test file |
| Edge case coverage | Map each edge case to a test |
| Integration tag coverage | Each `[INTEGRATION]` tag has both a test and an import |
| Negative cases | Each story has at least one "what happens when X fails" test |

## Prioritization

Always work priorities in order: 1 → 2 → 3 → 4. Architecture conformance is the highest priority because it catches structural problems that behavioral tests miss. A working stub passes behavioral tests but fails conformance tests.
