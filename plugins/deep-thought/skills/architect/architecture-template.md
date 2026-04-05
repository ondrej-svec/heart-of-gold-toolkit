# Architecture: {Feature Title}

## Requirements

### Functional Requirements

| ID | Requirement | Story |
|----|------------|-------|
| FR-001 | {What the system must do} | STORY-001 |
| FR-002 | {Another requirement} | STORY-002 |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|------------|--------|
| NFR-001 | {Performance, security, reliability constraint} | {Measurable target} |

## Architecture Decision Records

### ADR-001: {Decision Title}

**Status:** Accepted
**Date:** YYYY-MM-DD

**Context:** {What situation prompted this decision?}

**Decision:** {What was decided and why?}

**Consequences:**
- {Positive consequence}
- {Negative consequence or tradeoff}

**Alternatives Considered:**
- {Alternative 1} — rejected because {reason}
- {Alternative 2} — rejected because {reason}

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| {package-name} | {constraint} | {Why this package is needed} |

> **BINDING:** The implementer MUST install and import every package listed here.
> A regex classifier instead of an LLM call is a STUB.
> A hardcoded response instead of a real API call is a STUB.

## Integration Pattern

{How the new code connects to the existing system}

- **Entry point:** {Where the feature is invoked}
- **Data flow:** {How data moves through the system}
- **Events:** {What events are emitted/consumed}

> **BINDING:** The implementer MUST follow this pattern exactly.

## File Structure

```
{path/to/file1.ts}  — {responsibility}
{path/to/file2.ts}  — {responsibility}
{path/to/file1.test.ts}  — {what it tests}
```

## External Services

| Service | Purpose | Auth | Rate Limit |
|---------|---------|------|------------|
| {service} | {why} | {method} | {limit} |

## Security Considerations

- {Input validation requirements}
- {Auth/authz requirements}
- {Data handling requirements}
