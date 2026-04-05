# Test Anti-Patterns

Weak test patterns that pass with stubs, mocks, or incomplete implementations. Avoid these.

## Existence Tests

```typescript
// BAD: Tests that a function exists — it always will once the file is created
it("should have a processPayment function", () => {
  expect(typeof processPayment).toBe("function");
});

// GOOD: Tests that the function does something meaningful
it("should charge the customer's payment method", () => {
  const result = processPayment({ amount: 1000, currency: "USD", customerId: "cust_123" });
  expect(result.chargeId).toMatch(/^ch_/);
  expect(result.status).toBe("succeeded");
});
```

## Type-Only Assertions

```typescript
// BAD: Any stub can return the right type
it("should return an object", () => {
  const result = analyze(input);
  expect(typeof result).toBe("object");
});

// GOOD: Verifies the content, not just the shape
it("should return analysis with sentiment score", () => {
  const result = analyze("I love this product");
  expect(result.sentiment).toBeGreaterThan(0.5);
  expect(result.confidence).toBeGreaterThan(0);
});
```

## Mocking the Module Under Test

```typescript
// BAD: You're testing the mock, not the code
jest.mock("./scoring-engine");
it("should score correctly", () => {
  (scoringEngine.score as jest.Mock).mockReturnValue(42);
  expect(scoringEngine.score(input)).toBe(42); // Always passes!
});

// GOOD: Call the real function
it("should score based on weighted criteria", () => {
  const result = scoringEngine.score({ criteria: weights, responses: answers });
  expect(result.total).toBeCloseTo(expectedScore, 1);
});
```

## Testing Internal State

```typescript
// BAD: Couples tests to implementation details
it("should set internal flag", () => {
  const service = new AuthService();
  service.login(credentials);
  expect(service._isAuthenticated).toBe(true); // Private state!
});

// GOOD: Tests observable behavior
it("should allow access after login", () => {
  const service = new AuthService();
  await service.login(credentials);
  const result = await service.getProtectedResource();
  expect(result.status).toBe(200);
});
```

## Trivially True Assertions

```typescript
// BAD: This always passes
it("should handle errors", () => {
  expect(() => processPayment({})).not.toThrow(); // Swallowing errors is not handling them
});

// GOOD: Verifies specific error behavior
it("should reject invalid currency codes", () => {
  expect(() => processPayment({ amount: 100, currency: "FAKE" }))
    .toThrow("Invalid currency code: FAKE");
});
```

## Happy Path Only

```typescript
// BAD: Only tests the golden path
it("should process a valid order", () => { /* ... */ });

// MISSING: What about...
// - Empty cart
// - Negative quantities
// - Out-of-stock items
// - Concurrent modifications
// - Network timeouts
// - Partial failures
```

## The Stub Detector

If a test can pass with this implementation, the test is too weak:

```typescript
function processPayment(input: any): any {
  return { chargeId: "ch_fake", status: "succeeded" };
}
```

Good tests make hardcoded returns impossible. They verify different inputs produce different outputs, side effects happen (database writes, API calls, events emitted), and edge cases are handled distinctly.
