# Prompting Patterns Reference

Practical reference for the 12 LLM prompting techniques. Each entry covers when to use it, when not to, how to implement it in a skill or agent, and where it already appears in Heart of Gold.

*Based on Neo Kim's "12 Ways to Get Good Outputs from LLMs"*

---

## Technique Tags

- **Foundational** — belongs inside nearly every prompt. These are the baseline.
- **Structural** — changes how you architect the pipeline. Add only when the task demands it.

---

## Foundational Techniques

### 1. Zero-Shot Prompting

**Definition:** Give an instruction with no examples. The model uses training knowledge to respond.

**When to use:**
- Simple, well-defined tasks with clear success criteria
- Tasks the model has strong priors on (formatting, summarizing, translating)
- When you want fast output and don't have examples to provide

**When NOT to use:**
- Output requires a specific style, structure, or domain-specific format the model hasn't seen
- Tasks where "close enough" isn't acceptable — scoring, legal reasoning, code pattern matching
- When the model keeps drifting from what you want (that's your sign to add examples)

**Claude Code implementation:**
```
You are [role]. [Task description]. [Output format].
```
The simplest form of a SKILL.md prompt. No filler. Just instruction + format.

**Heart of Gold example:**
`/guide:capture` — "Write a structured morning or evening capture." No examples needed; the format is defined in the skill.

---

### 2. Few-Shot Prompting

**Definition:** Provide 2-5 examples of input → output before the actual task.

**When to use:**
- Output needs a specific tone, structure, or format that's hard to describe abstractly
- Classification or labeling tasks (signal scoring, severity ratings)
- When zero-shot produces structurally correct but tonally wrong output

**When NOT to use:**
- When you have no real examples and would have to fabricate them (fabricated examples teach the wrong patterns)
- Very long-context tasks where examples eat significant token budget
- When the model already nails the format — don't add overhead for no gain

**Claude Code implementation:**
```markdown
## Examples

**Input:** [example input]
**Output:** [example output]

**Input:** [example input 2]
**Output:** [example output 2]

Now apply this to: [actual task]
```
Add an `## Examples` section to your knowledge file and reference it in the skill.

**Heart of Gold example:**
`/guide/knowledge/content-patterns.md` — the LinkedIn post structure is implicitly few-shot: a pattern for hook → personal connection → insight → reflective question that the model mirrors.

---

### 3. Role Prompting

**Definition:** Assign the model a role or identity before it begins. Changes the lens it applies to the task.

**When to use:**
- Domain expertise is required (security reviewer, CTO advisor, voice editor)
- You want the model to hold a consistent perspective across a long session
- The task benefits from a specific evaluative stance (skeptic, advocate, editor)

**When NOT to use:**
- The task is purely mechanical (renaming files, reformatting JSON) — roles add noise
- When you're tempted to use role to mask vague instructions ("you are a genius who writes perfect code") — this doesn't work, it just sounds like it might
- Research shows persona-based prompts change communication style, not output quality. Use role for perspective, not performance.

**Claude Code implementation:**
```markdown
You are the Scout — a signal analyst responsible for evaluating relevance...
```
In `agent.md` files, the opening paragraph is the role. In skills, the system context (first lines before `##`) sets role. Keep it to one sentence of identity + one sentence of purpose.

**Heart of Gold example:**
`/guide/agents/scout.md` — "You are the Scout, responsible for analyzing and evaluating source signals..."

---

### 4. Instruction Prompting

**Definition:** Set clear rules, tone, success criteria, and constraints before the task.

**When to use:**
- Any task with quality requirements that aren't obvious from the task description alone
- When you need to prevent specific failure modes (e.g., "never fabricate sources")
- Multi-step skills where each phase has different requirements

**When NOT to use:**
- Over-constraining simple tasks creates confusion. Don't specify 12 rules for a one-line task.
- Avoid contradictory instructions (e.g., "be concise" + "cover all edge cases thoroughly")
- Don't use ALL CAPS or aggressive language — models don't try harder with shouting

**Claude Code implementation:**
```markdown
## Constraints

- Never fabricate signals or scores
- If content is unreadable, note it but don't discard it
- Preserve all source metadata for transparency
```
The `## Constraints` section in agent.md files. The "Common Rationalizations" table in skill files is instruction prompting against known failure modes.

**Heart of Gold example:**
`/guide/agents/scout.md` — the `## Constraints` section and `## Source Quality Assessment` rules.

---

### 5. Format Prompting

**Definition:** Specify the exact output format — structure, headings, field names, length.

**When to use:**
- Output will be parsed or used by another step in the pipeline
- Consistent structure is required across multiple runs (daily briefs, drafts with frontmatter)
- You want to constrain scope by defining what goes in each section

**When NOT to use:**
- Freeform exploration phases — imposing format too early stifles the output
- When the "right" format isn't known yet; let the model propose it, then lock it down
- Excessive format specification can cause the model to fill in sections mechanically

**Claude Code implementation:**
```markdown
## Output

Write to `content/daily/YYYY-MM-DD.md` with this frontmatter:

\`\`\`yaml
---
date: YYYY-MM-DD
sources_count: N
---
\`\`\`

Then: ## What's on Your Mind, ## Reading Digest, ## Content Ideas
```
The `## Output` section in a SKILL.md. Include field names, file paths, and YAML frontmatter templates.

**Heart of Gold example:**
`/guide:pipeline` — every phase has an explicit output spec with file path, frontmatter schema, and section structure.

---

### 6. Retrieval-Augmented Generation (RAG)

**Definition:** Inject relevant external documents, context, or data into the prompt before the model responds.

**When to use:**
- The task requires knowledge not in the model's training (project-specific configs, personal voice profiles, recent signals)
- You need the model to reason about specific content it couldn't otherwise access
- When accuracy matters more than creativity — grounded answers beat hallucinated ones

**When NOT to use:**
- Don't inject everything you have — relevance beats volume. Irrelevant context degrades output.
- Avoid injecting documents larger than what the context window can hold usefully
- Don't use RAG to compensate for vague instructions — fix the instructions first

**Claude Code implementation:**
```markdown
### Steps

1. **Read config** from `content/config.yaml`
2. **Read voice reference** from the path in `voice.reference`
3. **Read captures** from `content/captures/` — last 7 days
```
Explicit `Read` instructions in SKILL.md steps are RAG. Use them to pull in knowledge files, configs, and captures before generation begins. The `## Knowledge References` section at the bottom of a skill points to the documents that should be RAG'd.

**Heart of Gold example:**
`/guide:pipeline` — reads RSS signals, Gmail, HN, captures, and recent briefs before generating. `../knowledge/voice-guide.md` is RAG'd into voice-check phases.

---

## Structural Techniques

### 7. Reflection Prompting

**Definition:** After generating an answer, ask the model to critique and improve it before finalizing.

**When to use:**
- Quality-critical output where "good enough on first pass" isn't acceptable (voice scores, architectural recommendations)
- When the model's first output is usually close but contains fixable issues
- Especially effective for output that has verifiable quality criteria (voice scoring, test coverage, security checks)

**When NOT to use:**
- Don't add reflection to fast utility tasks — the cost outweighs the gain
- Avoid open-ended reflection ("is this good?") — it rarely finds anything. Reflection needs specific criteria.
- Don't reflect on code that hasn't been run or tested yet — bugs surface at runtime, not during self-review

**Claude Code implementation:**
```markdown
### Voice Check — Reflection Pass

After generating the LinkedIn draft:
1. Score the draft against voice criteria (jargon, sentence length, first-person)
2. If score < 75: rewrite once, fixing flagged issues
3. Re-score. If still < 75: flag `needs_human_review: true`
```
A dedicated phase in the skill that re-reads output against explicit criteria before finalizing.

**Heart of Gold example:**
`/guide:pipeline Phase 4: Edit — Voice Check` — the model scores its own output against 5 criteria, rewrites once if needed, then either passes or flags for human review.

---

### 8. Prompt Chaining

**Definition:** Break a complex task into sequential steps where each step's output feeds the next.

**When to use:**
- Multi-step pipelines where intermediate state needs to be verified before proceeding
- When the full task is too large to fit coherently in a single prompt
- When different steps require different context (e.g., fetch → analyze → create → edit)

**When NOT to use:**
- Simple one-shot tasks — chaining adds coordination overhead with no benefit
- Don't chain when the steps don't actually depend on each other — run them in parallel instead
- Avoid very long chains (>5-6 steps) without checkpoints — errors compound

**Claude Code implementation:**
```markdown
## Phase 1: Scout (Fetch Sources)
...
**Exit:** Combined signals written to `content/pipeline/YYYY-MM-DD/signals.json`

## Phase 2: Analyze
**Entry:** Signals file exists at the path above.
...
**Exit:** Analysis written to `content/pipeline/YYYY-MM-DD/analysis.md`
```
Explicit `**Entry:**` / `**Exit:**` conditions in each phase create a contract between steps. Each phase reads its input from a file the previous phase wrote.

**Heart of Gold example:**
`/guide:pipeline` is a 5-phase chain (Scout → Analyze → Create → Edit → Deliver). `/deep-thought:think` is a 4-phase chain (Frame → Mode → Think → Conclude).

---

### 9. Chain-of-Thought (CoT)

**Definition:** Ask the model to reason step-by-step before arriving at a conclusion, rather than jumping to the answer.

**When to use:**
- Multi-step reasoning where the path to the answer matters (debugging, tradeoff analysis, root cause investigation)
- When intermediate reasoning steps need to be surfaced for human review
- Math, logic, and inference tasks where a wrong intermediate step causes a wrong final answer

**When NOT to use:**
- Factual lookups — step-by-step reasoning on "what's the syntax for X" wastes tokens
- Creative tasks — CoT forces analytical structure onto tasks that benefit from flow
- When you only need the conclusion and the reasoning is private — in that case, use extended thinking mode instead

**Claude Code implementation:**
```markdown
## Phase 2: Think

For each approach, reason through:
1. What does this optimize for?
2. What constraints does it violate?
3. What's the failure mode if assumptions are wrong?
4. What's the cost to reverse if wrong?

Then synthesize across approaches before recommending.
```
Explicit numbered reasoning steps before the conclusion. In agent.md files, the evaluation rubric forces step-by-step scoring. The "Recommendation" format (Do / Because / Risk / Confidence) is structured CoT output.

**Heart of Gold example:**
`/deep-thought:think` — every analysis mode (Expert Panel, Devil's Advocate, What-If) produces explicit reasoning before the `## Recommendation` section.

---

### 10. Meta Prompting

**Definition:** Use the model itself to generate, improve, or adapt a prompt for another task.

**When to use:**
- You need to create a prompt for a novel task and don't know the best structure yet
- Adapting a generic skill to a user-specific context (e.g., generating a voice profile from blog samples)
- When building skills programmatically — use Claude to generate the first draft, then refine

**When NOT to use:**
- Don't use meta prompting for tasks with well-defined prompts already — it adds a round-trip for no gain
- Avoid meta prompting when you need deterministic, reproducible behavior — generated prompts vary
- Don't use it to avoid doing the thinking yourself; meta prompting surfaces your confusion, it doesn't resolve it

**Claude Code implementation:**
```markdown
## Phase 0: Generate Skill Draft

Use AskUserQuestion: "Describe what this skill should do."

Then: "Based on this description, draft a SKILL.md following the Heart of Gold
skill format: phases with Entry/Exit, Constraints, Output section."

Deliver the draft. User reviews and requests edits.
```
A skill-creation skill. Also used in `capture` → `write-post` flows where capture output is fed into a prompt that adapts the post scaffold to the specific content.

**Heart of Gold example:**
`/guide:capture` → `guide:pipeline` → `guide:write-post` — captures feed into the pipeline analysis, which generates a tailored blog outline, which `write-post` adapts into a full scaffold. Each handoff is a form of meta prompting.

---

### 11. Tree of Thoughts (ToT)

**Definition:** Generate multiple candidate solutions in parallel, evaluate each against criteria, then select the best.

**When to use:**
- Problems with multiple plausible approaches where the best isn't obvious upfront
- When the evaluation criteria are clear but the solution space is large
- Architecture decisions, content angle selection, debugging hypotheses

**When NOT to use:**
- Routine implementation tasks — you don't need 3 approaches to naming a function
- Time-sensitive contexts where generating multiple branches is too expensive
- When you already have a strong prior — ToT is for genuine uncertainty, not ritual exploration

**Claude Code implementation:**
```markdown
## Phase 1: Generate Angles

Generate 3-5 content angles from the signals. For each:
- **Angle:** [title]
- **Internal connection:** [link to captures]
- **External hook:** [source signal]
- **Why now:** [timeliness]
- **Format:** [LinkedIn or blog]

## Phase 2: Evaluate

Score each angle on: theme alignment (1-5), freshness (1-5), personal connection (1-5).
Rank by total score. Select the top angle.
```
The Tradeoff Matrix in `/deep-thought:think` is ToT. Content angle generation + scoring in `pipeline` is ToT applied to content strategy.

**Heart of Gold example:**
`/guide:pipeline Phase 2: Analyze` — generates 2-4 angles, scores and ranks each, then selects the top angle for LinkedIn draft generation.

---

### 12. Self-Consistency

**Definition:** Run the same prompt multiple times, then take the most consistent (most frequent) answer across runs.

**When to use:**
- High-stakes reasoning tasks where one run may be wrong (complex debugging, security analysis)
- When you need confidence intervals, not just a single answer
- Validation of AI-generated assessments (score distributions, risk ratings)

**When NOT to use:**
- Don't use for deterministic tasks — running the same lookup three times doesn't improve accuracy
- Expensive in tokens; reserve for decisions where variance is genuinely costly
- Don't substitute for human review on truly critical decisions — consistency among wrong answers is still wrong

**Claude Code implementation:**
```markdown
## Verification Pass

Run the security analysis twice with independent subagents:
- Agent A: `model: claude-sonnet` — standard analysis
- Agent B: `model: claude-sonnet` — same task, fresh context

Compare findings. Flag any critical issue that appears in both runs.
Treat single-run-only findings as lower confidence.
```
Parallel subagents in Claude Code are the implementation mechanism. Spawn two independent agents on the same problem, compare results, surface consensus findings.

**Heart of Gold example:**
`/deep-thought/agents/security-reviewer.md` and `/deep-thought:architecture-review` — the multi-perspective review pattern (running security, performance, TypeScript, and infra reviewers on the same diff) is self-consistency applied across domain lenses rather than identical runs.

---

## Quick-Reference Matrix

| Technique | Tag | Add When | Skip When |
|-----------|-----|----------|-----------|
| Zero-Shot | Foundational | Task is clear and well-defined | Output needs specific style |
| Few-Shot | Foundational | Format is hard to describe | No real examples exist |
| Role | Foundational | Domain expertise or stance needed | Task is purely mechanical |
| Instruction | Foundational | Quality criteria must be explicit | Simple single-step tasks |
| Format | Foundational | Output will be parsed or reused | Exploration / freeform phase |
| RAG | Foundational | Task needs external/project knowledge | Context is already sufficient |
| Reflection | Structural | Output has verifiable quality criteria | Fast utility tasks |
| Prompt Chaining | Structural | Steps depend on each other's output | Steps are independent |
| Chain-of-Thought | Structural | Reasoning path matters | Factual lookup / creative flow |
| Meta Prompting | Structural | Creating or adapting prompts | Prompt already works well |
| Tree of Thoughts | Structural | Multiple plausible approaches | Routine implementation |
| Self-Consistency | Structural | High-stakes, high-variance decisions | Deterministic tasks |
