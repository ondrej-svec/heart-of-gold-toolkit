# Strategic Decomposition

How to break complex work into steps that are ordered, sized right, and focused on value. Not project management theory — practical decomposition for people building software with AI.

---

## Top-Down Decomposition

Start from the outcome, work backward to steps. Don't start with "what do I do first?" — start with "what does done look like?" and reverse-engineer the path.

### The Process

1. **Define the outcome.** One sentence. "Users can pay with Apple Pay on checkout." Not a wish list — one clear end state.
2. **Identify the major chunks.** What are the 3-5 big pieces? "Payment integration, UI changes, backend handler, testing." These aren't tasks yet — they're areas of work.
3. **Order by dependency.** What blocks what? You can't build the UI until the backend endpoint exists. You can't test until both exist. Draw the dependency chain.
4. **Break chunks into tasks.** Now decompose each chunk into specific, completable tasks. A task is something you can finish in one sitting and commit.
5. **Identify the critical path.** Which chain of dependencies determines the minimum time? That's where to focus attention.

### What Makes a Good Task

| Good Task | Bad Task |
|-----------|----------|
| "Add `payment_method` column to orders table" | "Set up database" |
| "Create POST /api/payments endpoint with Apple Pay token validation" | "Implement backend" |
| "Write integration test for successful Apple Pay flow" | "Add tests" |

A good task is:
- **Specific.** You know exactly what to do when you start.
- **Completable.** You can finish and commit it in one session.
- **Verifiable.** You can tell when it's done (test passes, endpoint returns 200, migration runs).
- **Independent enough.** It can be committed without breaking things, even if the feature isn't complete yet.

---

## Dependency Ordering

Getting the order right is half the battle. Wrong order means rework, blocked work, and wasted time.

### Dependency Types

| Type | Example | How to Handle |
|------|---------|---------------|
| **Hard dependency** | Frontend needs backend endpoint | Do the backend first. No way around it. |
| **Soft dependency** | Tests are easier to write after the implementation | Can be done in parallel, but one direction is more efficient. |
| **No dependency** | Two unrelated features | Do in parallel or any order. |

### Finding the Right Order

1. **Start with the data layer.** Migrations, models, schemas — these are the foundation everything else depends on.
2. **Then the business logic.** Services, handlers, validation — the core behavior.
3. **Then the interface.** API endpoints, UI components — these consume the logic.
4. **Then the glue.** Integration tests, error handling, edge cases — these verify the whole thing works.

This isn't rigid — sometimes you prototype the UI first to validate the approach. But when planning execution, data → logic → interface → verification is a reliable default.

### Parallelism

When you spot tasks with no dependency between them, flag them as parallelizable. This is valuable for:
- Two people working simultaneously
- Separate commits that don't conflict
- AI agents working on different parts

But don't force parallelism. Sequential work with clear dependencies is simpler to manage than parallel work with subtle coordination needs.

---

## The 90/10 Split

90% of the value comes from 10% of the work. Your job is to identify that 10% and do it first.

### How to Find the 10%

Ask for each task: "If this were the ONLY thing we shipped, would it deliver value?"

- The payment endpoint that processes charges → **Yes, this is the 10%.** Core functionality.
- The retry logic for failed payments → No. Important, but the system works without it for now.
- The admin dashboard showing payment history → No. Nice to have, not the core value.
- The email notification on successful payment → No. Can add later without changing the core.

### Ordering by Value

1. **First:** The minimum that delivers the core value. Ship this as soon as it works.
2. **Second:** The things that prevent real problems (error handling for likely failures, basic security).
3. **Third:** Polish, edge cases, monitoring, nice-to-haves.

**The trap:** Starting with the interesting parts instead of the valuable parts. Building the admin dashboard before the payment flow works. Optimizing before the basic path is solid.

### Scope Cuts

When time is tight, cut from the bottom. If you ordered by value, the bottom is the least important:

- Cut polish before functionality
- Cut edge cases before happy paths
- Cut monitoring before core features (but add it soon after)
- Never cut security or data integrity

---

## Scope Boundaries

Clear boundaries prevent scope creep and keep work focused.

### Define Three Lists

1. **In scope.** What we're building. Be specific.
2. **Explicitly out of scope.** What we're NOT building, even though someone might expect it. Name these to prevent creep.
3. **Deferred.** What we'll build later. These are real work, just not now. Track them so they don't get lost.

### Example

**Feature:** Add Apple Pay to checkout

- **In scope:** Apple Pay button on checkout, payment processing, success/failure handling, order status update
- **Out of scope:** Google Pay (separate feature), refund flow redesign, payment analytics dashboard
- **Deferred:** Apple Pay on mobile app (after web proves the pattern), multi-currency Apple Pay (blocked on currency service)

### Boundary Discipline

When someone suggests adding something during implementation:
1. Check: is it in scope?
2. If yes, it was planned — do it.
3. If no, add it to deferred. Don't do it now unless it's genuinely blocking the in-scope work.

The best plans are the ones that say "no" clearly. Unbounded scope is why features take 3x longer than expected.

---

## Checkpoint Design

Where to commit, where to test, where to ask for feedback. Checkpoints turn a long implementation into a series of verifiable steps.

### When to Checkpoint

- **After each task completes.** Commit the work. Run relevant tests. Green? Move on.
- **After each phase completes.** Larger verification — run the full test suite, do a quick manual check.
- **Before risky changes.** About to refactor something big? Commit the current state first. Now you have a rollback point.
- **Before switching context.** Moving from backend to frontend? Commit the backend first. Clean state in each area.

### What a Good Checkpoint Looks Like

1. **Tests pass.** Not "mostly pass" — pass.
2. **The commit message describes a complete unit.** "Add payment endpoint" not "WIP payments."
3. **The code works at this point.** Even if the feature isn't done, the system doesn't crash. Incomplete is fine — broken is not.

### Feedback Checkpoints

Some checkpoints should involve humans:

- **After the first phase ships.** "Here's the basic flow working. Before I build the next phase, does this look right?"
- **Before irreversible changes.** Migrations, API contracts, data model changes — get a second pair of eyes.
- **When you're stuck.** If you've been going back and forth for 15+ minutes, checkpoint what you have and ask for input.

---

## Anti-patterns

- **Flat task lists.** A list of 20 tasks with no ordering is not decomposition — it's a braindump. Order matters.
- **Tasks too big.** "Build the API" is a project, not a task. If it takes more than a session, break it down further.
- **Tasks too small.** "Create the file" / "Add the import" — this is noise. Group into meaningful units.
- **Ignoring dependencies.** Starting with the UI because it's fun, then discovering the backend needs a different data shape. Follow the dependency chain.
- **Gold-plating the plan.** The plan is a tool, not the product. A plan that took 2 hours to write for 4 hours of work is backwards. Match the planning effort to the work effort.
