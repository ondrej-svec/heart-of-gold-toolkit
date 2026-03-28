# Security Review Patterns

Read this when reviewing code that touches authentication, authorization, input validation, secrets, or external inputs. Also useful for `/investigate security` investigations.

## Why This Matters

Security bugs look like regular code. They pass tests, they pass linting, they work correctly for legitimate inputs. The difference is what happens with illegitimate inputs — and nobody tests those by default. Security review is about asking "what happens when someone deliberately tries to break this?"

## OWASP Top 10 Quick Scan

Not a full audit — a focused check for the most common vulnerabilities [strong — OWASP consensus]:

| # | Vulnerability | What to Look For |
|---|--------------|-----------------|
| **A01** | Broken Access Control | Missing auth checks on endpoints; IDOR (user A accessing user B's data by changing an ID); privilege escalation paths |
| **A02** | Cryptographic Failures | Hardcoded secrets; weak algorithms (MD5, SHA1 for passwords); secrets in logs or error messages |
| **A03** | Injection | SQL built from string concatenation; unescaped user input in templates; command injection via `exec`/`eval` |
| **A04** | Insecure Design | Business logic flaws; missing rate limiting on sensitive endpoints; no account lockout |
| **A05** | Security Misconfiguration | Debug mode in production; default credentials; overly permissive CORS; stack traces in error responses |
| **A06** | Vulnerable Components | Known CVEs in dependencies; outdated packages with security patches |
| **A07** | Auth Failures | Weak password policies; JWT without expiration; session tokens in URLs |
| **A08** | Data Integrity | Deserialization of untrusted data; unsigned updates; CI/CD pipeline without integrity checks |
| **A09** | Logging Failures | No audit trail for auth events; sensitive data in logs (passwords, tokens, PII) |
| **A10** | SSRF | User-controlled URLs passed to server-side HTTP clients; internal service URLs exposed |

## Authentication & Session Review

**JWT patterns to check:**
- Token has expiration (`exp` claim) — tokens without expiry are permanent credentials
- Algorithm is explicit and validated server-side — never trust the `alg` header from the client [strong]
- Refresh token rotation — old refresh tokens are invalidated when a new one is issued
- Token storage — not in localStorage (XSS accessible). Use httpOnly cookies or in-memory.

**Session patterns:**
- Session invalidation on password change and logout
- Session timeout for inactive sessions
- Concurrent session limits (or at least visibility)

**The `alg: none` trap:** JWTs support `"alg": "none"` which means "no signature." If your verification library accepts this, anyone can forge tokens. Always validate the algorithm server-side against an allowlist. [strong — CVE history]

## Secret Management

**Hierarchy of secret handling** (from best to worst):
1. **Secret manager** (Vault, AWS Secrets Manager, GCP Secret Manager) — secrets never in code or config
2. **Sealed secrets / encrypted at rest** — secrets encrypted in version control, decrypted at deploy time
3. **Environment variables** — secrets injected at runtime, not in code
4. **Config files** (gitignored) — risk of accidental commit
5. **Hardcoded in source** — never acceptable [strong]

**Detection patterns for hardcoded secrets:**
- `getenv()` or `process.env` with fallback defaults: `SECRET = os.getenv('KEY', 'default')` — the app runs with 'default' if the env var is missing (fail-open)
- Connection strings with embedded passwords
- API keys in constants or config objects
- Private keys committed to the repository

**Fail-open vs. fail-secure:** A secret with a fallback default is fail-open — the application runs in an insecure state when configuration is missing. The secure pattern is to fail on startup if required secrets are absent.

## Input Validation

**Validate at system boundaries** — where external data enters your system:
- API request bodies (Pydantic models, Zod schemas)
- URL parameters and headers
- File uploads (type, size, content — not just extension)
- Webhook payloads from external services
- Database query results from untrusted databases

**Pydantic/Zod patterns:**
- Use strict mode — don't coerce `"123"` to `123` silently
- Constrain string lengths — unbounded strings enable DoS
- Validate enums — don't accept arbitrary string values for fields with known options
- Custom validators for business rules — Pydantic `@field_validator`, Zod `.refine()`

**SQL injection prevention:**
- Parameterized queries always — `WHERE id = $1`, never `WHERE id = '${id}'`
- ORM usage doesn't guarantee safety — raw query methods exist in every ORM
- Stored procedures don't prevent injection if they concatenate strings internally

## Dependency Risk Assessment

**High-risk dependency indicators** [moderate]:
- Single maintainer (individual, not org-backed)
- Unmaintained (no commits in 12+ months, no response to issues)
- Low adoption (few stars/downloads relative to category)
- High-privilege features (FFI, deserialization, code execution)
- History of CVEs (pattern of exploitation, not just one-off)
- No security contact (`SECURITY.md` absent)

When a dependency scores high on multiple indicators, consider: is there a more established alternative? Can the functionality be implemented directly?

## Adversarial Threat Modeling

For security-sensitive changes, think through three adversaries:

1. **The External Attacker:** Can they reach this code? What's the attack surface? Can they manipulate inputs?
2. **The Insider:** Can a user with legitimate access escalate privileges or access other users' data?
3. **The Compromised Dependency:** If a dependency is malicious, what can it access? What's the blast radius?

**For each finding, document:**
- Entry point (how the attacker reaches the vulnerable code)
- Attack sequence (step-by-step exploitation)
- Impact (specific, measurable harm — not theoretical)
- Evidence (code location, proof of reachability)

## Anti-patterns

- **"No security concerns here."** Auth checks, input validation, and secrets leak through seemingly innocent code. Always check.
- **Security by obscurity.** Internal APIs need auth too. Attackers find undocumented endpoints.
- **Trusting client-side validation.** Server must re-validate everything. Client validation is UX, not security.
- **Catching and swallowing auth errors.** A caught auth exception that returns a default value is a bypass.
- **Reviewing security in isolation.** Security issues often span multiple files. Trace the full request lifecycle.
