# Python & FastAPI Patterns

Read this when reviewing, investigating, or working on Python code — especially FastAPI services, Pydantic models, SQLAlchemy queries, and async patterns.

## Why This Matters

Python's flexibility is a double-edged sword. Type hints are optional, async mistakes are silent, and ORM misuse causes performance issues that don't show up until production load. These patterns catch the problems that linters miss.

## FastAPI Patterns

**Dependency injection** is FastAPI's core pattern. Use it for:
- Database sessions (`Depends(get_db)`)
- Authentication (`Depends(get_current_user)`)
- Service instances (`Depends(get_service)`)
- Configuration (`Depends(get_settings)`)

**Common mistakes:**
- Creating database sessions outside of dependencies — sessions leak or aren't closed on error
- Mutable default arguments in dependencies — shared state across requests
- Missing `Depends()` wrapper — the function runs once at import, not per request

**Middleware ordering matters.** Middleware executes in reverse order of registration. Auth middleware must come after CORS middleware (CORS preflight shouldn't require auth).

**Lifespan pattern** (replaces deprecated `on_startup`/`on_shutdown`):
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: connect to DB, warm caches
    yield
    # Shutdown: close connections, flush buffers
```

**Error handling:** Use exception handlers, not try/except in every endpoint. Register handlers for domain exceptions and let them propagate naturally.

## Pydantic Validation

**Use strict mode** when data integrity matters [strong]:
```python
class Config:
    strict = True  # "123" won't silently become 123
```

**Constrain everything at the boundary:**
- `constr(min_length=1, max_length=255)` — unbounded strings enable DoS
- `conint(ge=0, le=100)` — numeric ranges prevent nonsensical values
- `Literal["active", "inactive"]` instead of `str` for enums
- `EmailStr`, `HttpUrl` — semantic types over raw strings

**Custom validators** for business rules:
```python
@field_validator("score")
@classmethod
def validate_score(cls, v):
    if v < 0 or v > 100:
        raise ValueError("Score must be between 0 and 100")
    return v
```

**`model_config` over `class Config`** — Pydantic v2 pattern. Use `ConfigDict()` for settings.

**Discriminated unions** for polymorphic models — use `Discriminator` field to avoid ambiguous parsing.

## SQLAlchemy Async Patterns

**Session lifecycle** — the most common source of bugs:
- Create session per request via dependency injection
- Never share sessions across requests or tasks
- Always close sessions — use `async with` or dependency cleanup
- Expired objects after session close: access triggers `DetachedInstanceError`

**N+1 query prevention** [strong]:
- Use `selectinload()` or `joinedload()` for relationships you know you'll access
- `selectinload` for collections (one extra query), `joinedload` for single relations (JOIN)
- Never access lazy-loaded relationships in a loop — each access is a separate query

**Relationship loading strategies:**
```python
# Good: explicit loading
stmt = select(User).options(selectinload(User.posts))

# Bad: implicit lazy loading in async (raises error or N+1)
user.posts  # DetachedInstanceError in async, N+1 in sync
```

**Transaction boundaries:**
- Wrap related operations in a single transaction
- `session.begin()` + `await session.commit()` — don't auto-commit per statement
- On error: `await session.rollback()` — partial commits corrupt data

## Async/Await Correctness

**The most dangerous async mistakes are silent:**

- **Forgetting `await`:** The coroutine is created but never executed. No error, no warning, no work done.
- **Blocking the event loop:** `time.sleep()`, synchronous I/O, or CPU-intensive code in async functions blocks ALL concurrent requests. Use `asyncio.sleep()`, async I/O, or `run_in_executor()`.
- **Fire-and-forget tasks:** `asyncio.create_task()` without holding a reference — if the task raises an exception, it's silently swallowed. Hold references and handle exceptions.

**Task groups** (Python 3.11+):
```python
async with asyncio.TaskGroup() as tg:
    tg.create_task(fetch_scores())
    tg.create_task(fetch_profile())
# Both complete or both cancel — no silent failures
```

**`asyncio.gather` vs `TaskGroup`:**
- `gather` with `return_exceptions=True` — collects all results including exceptions
- `TaskGroup` — cancels all tasks if any raises. Stricter but safer.
- Prefer `TaskGroup` for operations that should all succeed or all fail

## Type Hints

**Use strict typing** [consensus]:
- `Annotated[str, Field(min_length=1)]` over bare `str` for function signatures
- `Protocol` for structural typing instead of ABC when you don't need inheritance
- `TypeVar` with bounds for generic functions
- `Never` return type for functions that always raise
- `TypeGuard` for custom type narrowing functions

**Avoid `Any`** — it disables type checking for everything it touches. If a type is truly unknown, use `object` (which requires explicit narrowing) instead of `Any` (which silently passes).

## uv & Ruff Tooling

- **uv:** Fast Python package manager. `uv run` for running scripts with dependencies. `uv sync` for lockfile-based installs.
- **Ruff:** Fast linter + formatter. Replaces Black, isort, flake8, and many pylint rules.
- `ruff check --fix` for auto-fixable issues
- `ruff format` for consistent formatting
- Configure in `pyproject.toml` under `[tool.ruff]`

## Anti-patterns

- **Bare `except:`** — catches `KeyboardInterrupt`, `SystemExit`, and everything else. Always specify the exception type.
- **Mutable default arguments** — `def f(items=[])` shares the list across calls. Use `None` default + create inside.
- **`import *`** — pollutes namespace, breaks IDE completion, hides dependencies.
- **Global state for request context** — use dependency injection or context variables, not module-level globals.
- **String formatting for SQL** — always parameterized queries, even in "internal" tools.
- **Ignoring `DeprecationWarning`** — these become errors in the next major version. Fix them early.
