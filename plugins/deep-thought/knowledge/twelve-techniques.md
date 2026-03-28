# Twelve Prompting Techniques — Decision Checklist

Use this when crafting or reviewing a skill. For each technique, ask the question. If yes, add the thing.

*Based on Neo Kim's "12 Ways to Get Good Outputs from LLMs"*

---

## Foundational (default candidates — most skills use all six)

**1. Zero-Shot**
Ask yourself: Is the task clear enough that no examples are needed?
If yes: Write a direct instruction. No examples section required.

**2. Few-Shot**
Ask yourself: Is the desired output style, tone, or structure hard to describe abstractly?
If yes: Add an `## Examples` section with 2-3 real input → output pairs.

**3. Role**
Ask yourself: Does this task benefit from a specific expert perspective or evaluative stance?
If yes: Add a one-sentence identity + one-sentence purpose as the opening line of the skill or agent.

**4. Instruction**
Ask yourself: Are there quality criteria, constraints, or failure modes the model won't infer on its own?
If yes: Add a `## Constraints` section with explicit rules. One rule per line. No shouting.

**5. Format**
Ask yourself: Will the output be parsed, stored, or handed to another step?
If yes: Add an `## Output` section with exact field names, file paths, and any YAML frontmatter schema.

**6. RAG**
Ask yourself: Does the task require knowledge the model can't have (project config, personal voice, recent data)?
If yes: Add explicit `Read` steps at the start of the skill. List documents in `## Knowledge References`.

---

## Structural (add only when the task genuinely needs them)

**7. Reflection**
Ask yourself: Does the output have verifiable quality criteria where one pass is often not enough?
If yes: Add a dedicated critique phase — score the output, fix what fails, re-score before finalizing.

**8. Prompt Chaining**
Ask yourself: Is this task too large or complex for one prompt, with steps that depend on each other's output?
If yes: Split into phases with explicit `**Entry:**` and `**Exit:**` conditions. Write intermediate state to files.

**9. Chain-of-Thought**
Ask yourself: Does the path to the answer matter as much as the answer itself?
If yes: Add numbered reasoning steps inside the task phase, before the conclusion or recommendation.

**10. Meta Prompting**
Ask yourself: Is the prompt itself unknown or context-dependent — does it need to be generated or adapted first?
If yes: Add a phase that generates or tailors the prompt before the main task runs.

**11. Tree of Thoughts**
Ask yourself: Are there multiple plausible approaches where the best isn't obvious without exploring each?
If yes: Add a generation phase (produce N candidates) followed by an evaluation phase (score and rank each).

**12. Self-Consistency**
Ask yourself: Is this a high-stakes reasoning task where a single run might be wrong in costly ways?
If yes: Spawn two independent subagents on the same task, compare findings, surface only what both agree on.
