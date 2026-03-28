# TypeScript & Next.js Patterns

Read this when reviewing, investigating, or working on TypeScript code — especially Next.js applications, React components, RTK Query, Effect-TS services, or Drizzle ORM.

## Why This Matters

TypeScript's type system is powerful but not foolproof. Runtime behavior can diverge from types when external data enters the system, when `as` casts are used, or when `any` leaks through dependencies. These patterns catch the gaps between what TypeScript promises and what actually happens.

## Next.js 15 Patterns (App Router)

**Server vs. Client components** — the fundamental mental model:
- **Server components** (default): Run on the server only. Can access databases, file systems, secrets. Cannot use hooks, event handlers, or browser APIs.
- **Client components** (`"use client"`): Run on both server (SSR) and client. Can use hooks and interactivity. Cannot directly access server resources.

**Common mistakes:**
- Importing a server-only module (database, secrets) in a client component — exposes secrets to the client bundle [strong]
- Using `"use client"` too high in the tree — makes everything below it client-rendered, increasing bundle size
- Forgetting that client components still SSR — code that assumes `window` exists will crash on the server

**Streaming and Suspense:**
- Wrap slow data fetches in `<Suspense>` with meaningful fallbacks
- Use `loading.tsx` for route-level loading states
- `generateStaticParams` for static generation of dynamic routes

**Caching (Next.js 15):**
- `fetch` is NOT cached by default in Next.js 15 (changed from 14)
- Use `cache: 'force-cache'` or `unstable_cache` for explicit caching
- `revalidateTag` and `revalidatePath` for on-demand invalidation
- Data fetched in server components is per-request by default

**Route handlers:**
- `export async function GET()` — not `getServerSideProps`
- Return `NextResponse.json()` — proper content-type headers
- Validate request bodies with Zod before processing

## React 19 Patterns

**Hook rules remain critical** [strong]:
- Never call hooks conditionally or in loops
- Never call hooks inside regular functions — only in components or custom hooks
- Dependency arrays must be exhaustive — missing deps cause stale closures

**`useActionState`** (React 19, replaces `useFormState`):
- For form submissions with server actions
- Returns `[state, formAction, isPending]`
- Handles optimistic updates and error states

**`use()` hook** (React 19):
- Reads promises and contexts
- Can be called conditionally (unlike other hooks)
- Suspends the component while the promise resolves

**Key React patterns:**
- Derive state from props instead of syncing with `useEffect` — less code, fewer bugs
- Use `useCallback` for functions passed to child components (prevents re-renders)
- Use `useMemo` for expensive computations, not for every value
- Prefer composition over prop drilling — `children` and render props

## RTK Query Patterns

**Cache invalidation** — the most error-prone area:
- Define tag types in `createApi`: `tagTypes: ['User', 'Assessment']`
- Queries provide tags: `providesTags: (result) => [{type: 'User', id: result.id}]`
- Mutations invalidate tags: `invalidatesTags: [{type: 'User', id: 'LIST'}]`
- Missing invalidation = stale UI. Over-invalidation = unnecessary refetches.

**Optimistic updates** for responsive UI:
```typescript
onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
  const patch = dispatch(api.util.updateQueryData('getUser', arg.id, (draft) => {
    Object.assign(draft, arg.update);
  }));
  try { await queryFulfilled; }
  catch { patch.undo(); }
}
```

**Common RTK Query mistakes:**
- Not providing tags on queries — mutations can't invalidate what isn't tracked
- Using `LIST` tag ID inconsistently — pick a convention and stick to it
- Ignoring `isLoading` vs `isFetching` — `isLoading` is first load, `isFetching` includes refetches

## Effect-TS / Fastify Patterns

**Hexagonal architecture layers:**
- **Domain:** Pure types and business logic (no I/O, no framework imports)
- **Application:** Use cases orchestrating domain logic with `Effect`
- **Infrastructure:** Database, HTTP, external services — provided via `Layer`

**Layer dependency injection:**
```typescript
const MainLayer = Layer.mergeAll(
  DatabaseLayer,
  CacheLayer,
  EventBusLayer
);
// Test: replace DatabaseLayer with TestDatabaseLayer
```

**Error handling with Effect:**
- Use typed errors (`Effect<A, E, R>`) — errors are part of the type signature
- `Effect.catchTag` for specific error handling
- Never `catch` and swallow — handle or propagate

## Drizzle ORM Patterns

**Schema definition:**
- Define schemas in dedicated files (`schema/users.ts`, `schema/assessments.ts`)
- Use `pgTable`, `pgEnum` for PostgreSQL-specific types
- Relations defined separately with `relations()`

**Query patterns:**
- `db.select().from(users).where(eq(users.id, id))` — type-safe queries
- `db.query.users.findFirst({ with: { posts: true } })` — relational queries
- Always use parameterized values — Drizzle handles this, but raw SQL fragments bypass it

**Migration safety:**
- `drizzle-kit generate` creates migrations from schema changes
- Review generated SQL before applying — destructive changes need manual handling
- `ALTER TABLE` that adds NOT NULL column without default will fail on existing rows

## TypeScript Strict Mode Patterns

**Essential strictness settings** [consensus]:
- `strict: true` in `tsconfig.json` — enables all strict checks
- `noUncheckedIndexedAccess: true` — array/object access returns `T | undefined`
- `exactOptionalProperties: true` — distinguishes `missing` from `undefined`

**Type narrowing:**
- Use discriminated unions over type casting: `type Result = { ok: true; data: T } | { ok: false; error: E }`
- `satisfies` operator for validation without widening: `const config = {...} satisfies Config`
- Avoid `as` casts — they bypass the type checker. Use type guards instead.
- `unknown` over `any` for untyped external data — forces explicit narrowing

## Anti-patterns

- **`as any` to silence errors** — hides real bugs. Fix the type or use a proper type guard.
- **`// @ts-ignore`** — same as above but worse. Use `// @ts-expect-error` if truly necessary (it errors when the underlying issue is fixed).
- **Barrel exports (`index.ts`)** — re-exporting everything increases bundle size and creates circular dependency risks. Import directly.
- **`useEffect` for data fetching** — use RTK Query, SWR, or server components. `useEffect` has cleanup, race condition, and caching issues.
- **Prop drilling through 5+ levels** — use React context, composition, or state management.
- **Ignoring the `key` prop** — missing or incorrect keys cause subtle re-render bugs and lost component state.
