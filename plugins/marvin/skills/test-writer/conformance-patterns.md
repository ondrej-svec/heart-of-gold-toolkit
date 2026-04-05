# Conformance Test Patterns

Tests that verify the implementation follows the architecture doc — not just that it works, but that it's built correctly.

## Import Verification

Verify that source files actually import and use the dependencies listed in the architecture doc.

```typescript
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Architecture Conformance: Dependencies", () => {
  const sourceFiles = [
    "src/services/scoring-engine.ts",
    "src/services/payment-processor.ts",
  ];

  it("should import @anthropic-ai/sdk (per ADR-001)", () => {
    const source = readFileSync(resolve("src/services/scoring-engine.ts"), "utf-8");
    expect(source).toMatch(/import.*from\s+['"]@anthropic-ai\/sdk['"]/);
  });

  it("should import stripe (per Dependencies table)", () => {
    const source = readFileSync(resolve("src/services/payment-processor.ts"), "utf-8");
    expect(source).toMatch(/import.*from\s+['"]stripe['"]/);
  });
});
```

## Pattern Verification

Verify that the integration pattern from the architecture doc is followed.

```typescript
describe("Architecture Conformance: Integration Pattern", () => {
  it("should emit events via EventBus (per Integration Pattern)", () => {
    const source = readFileSync(resolve("src/services/auth.ts"), "utf-8");
    expect(source).toMatch(/eventBus\.emit\(['"]user:authenticated['"]/);
  });

  it("should use middleware pattern for request handling", () => {
    const source = readFileSync(resolve("src/routes/api.ts"), "utf-8");
    expect(source).toMatch(/app\.(use|get|post|put|delete)\(/);
  });
});
```

## Structure Verification

Verify that files exist at the paths specified in the architecture doc's File Structure section.

```typescript
import { existsSync } from "fs";

describe("Architecture Conformance: File Structure", () => {
  const expectedFiles = [
    "src/services/scoring-engine.ts",
    "src/models/assessment.ts",
    "src/routes/api.ts",
  ];

  expectedFiles.forEach((filePath) => {
    it(`should have ${filePath}`, () => {
      expect(existsSync(resolve(filePath))).toBe(true);
    });
  });
});
```

## Export Verification

Verify that files export the symbols the architecture doc expects.

```typescript
describe("Architecture Conformance: Exports", () => {
  it("should export ScoringEngine class", async () => {
    const mod = await import("../../src/services/scoring-engine");
    expect(mod.ScoringEngine).toBeDefined();
    expect(typeof mod.ScoringEngine).toBe("function"); // class constructor
  });

  it("should export createAssessment factory", async () => {
    const mod = await import("../../src/models/assessment");
    expect(mod.createAssessment).toBeDefined();
    expect(typeof mod.createAssessment).toBe("function");
  });
});
```

## Stub Detection Tests

Tests that specifically detect common stub patterns.

```typescript
describe("Architecture Conformance: No Stubs", () => {
  it("should not use hardcoded return values in scoring", () => {
    // Call with different inputs — stubs return the same thing
    const result1 = score({ responses: [1, 2, 3] });
    const result2 = score({ responses: [5, 5, 5] });
    expect(result1.total).not.toBe(result2.total);
  });

  it("should not use regex classifiers where LLM is specified", () => {
    const source = readFileSync(resolve("src/services/analyzer.ts"), "utf-8");
    // If the arch doc says "use LLM", regex patterns indicate a stub
    expect(source).not.toMatch(/new RegExp\(|\.match\(|\.test\(/);
    expect(source).toMatch(/anthropic|openai|llm|completion/i);
  });
});
```

## Guidelines

1. **One conformance test per architecture doc requirement.** Map them explicitly.
2. **Conformance tests read source files.** They verify structure, not just behavior.
3. **Name tests after the architecture doc section they verify.** Example: "per ADR-001", "per Dependencies table".
4. **Conformance tests should fail when architecture is violated** — even if behavioral tests pass. A working stub passes behavioral tests but fails conformance tests.
5. **Don't test implementation details** — test architecture decisions. The difference: "uses EventBus" (architecture) vs "calls emit on line 42" (implementation detail).
