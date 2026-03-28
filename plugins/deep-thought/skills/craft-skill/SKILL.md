---
name: craft-skill
description: >
  Meta-skill that generates and refines SKILL.md files using the 12 prompting techniques as a
  quality checklist. The skill that writes skills. Triggers: craft skill, create skill, generate skill,
  write skill, skill template, meta prompt, improve skill, refine skill.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - AskUserQuestion
  - Agent
---

# Craft Skill

The question of how to write a good skill is, of course, merely a subset of the question of how to communicate clearly with any intelligence — a problem that has vexed civilizations far more advanced than yours. Nevertheless, we shall attempt it.

## Boundaries

**This skill MAY:** read existing skills for patterns, read knowledge files, write new SKILL.md files.
**This skill MAY NOT:** execute other skills, modify existing skills without explicit permission, write code files, run commands.

**You are a skill author, not an executor. Write the instructions — do not follow them.**

---

## Phase 0: Understand

**Entry:** User invoked `/craft-skill` with a topic, or nothing.

**If invoked with a topic** (e.g., `/craft-skill database migration helper`): use it as the starting brief.

**If invoked without a topic:** use **AskUserQuestion** (header: "Skill Brief", question: "What should this skill do, who uses it, and what triggers it?"). Then ask where the SKILL.md should live — exact path or suggest one.

**Exit:** You know what the skill does, who uses it, what triggers it, and where it lives.

---

## Phase 1: Research

**Entry:** Skill brief understood.

Read `../knowledge/twelve-techniques.md` — this is the technique checklist you will apply in Phase 2.

Scan existing skills using **Glob** on `**/skills/*/SKILL.md`, then **Read** 2-3 structurally similar ones. Note their AskUserQuestion patterns, phase structure, boundary language, and length.

**Exit:** Twelve techniques loaded, 2-3 reference skills read.

---

## Phase 2: Generate

**Entry:** Research complete.

Draft the SKILL.md. As you write each section, run through the technique checklist. For each technique, make a conscious decision:

| Technique | Decision for this skill |
|-----------|------------------------|
| **Role Prompting** | What persona does this skill assume? Define it in the preamble. |
| **Instruction Prompting** | Are phase entry/exit criteria explicit? Is each step unambiguous? |
| **Few-Shot Examples** | Does this skill produce structured output? Add 1-2 concrete examples. |
| **Chain-of-Thought** | Should the model reason step-by-step before acting? Add a reasoning prompt. |
| **RAG** | What knowledge files should this skill read? Reference them explicitly. |
| **Prompt Chaining** | Is the task multi-step? Structure as numbered phases with clear handoffs. |
| **Format Specification** | What does the output look like? Specify headers, sections, length constraints. |
| **Reflection** | Should there be a self-critique pass? Add it as an explicit phase if yes. |
| **Meta Prompting** | Is the skill generating prompts or instructions itself? Flag and handle it. |
| **Negative Prompting** | What must this skill NOT do? Make it explicit in Boundaries. |
| **Constraints** | Length, tool, scope limits? Enumerate them. |
| **Personas** | Does the skill need to simulate multiple viewpoints? Structure them. |

Write the draft. Keep it under 150 lines. If it exceeds that, you are over-specifying — cut.

**Exit:** SKILL.md draft complete.

---

## Phase 3: Reflect

**Entry:** Draft complete.

Self-critique the draft against these questions. Answer each honestly:

1. **Executability:** Could a fresh Claude instance with no prior context execute this skill without asking clarifying questions? If no — what is ambiguous?
2. **Scope creep:** Does the skill try to do more than one thing? If yes — what should be split out?
3. **Boundaries violation:** Does any phase risk the skill doing something the Boundaries section forbids?
4. **Length:** Is anything repeated, padded, or obvious? Mark it for removal.
5. **Technique coverage:** Which of the 12 techniques added genuine value, and which were applied mechanically just to check a box? Remove the mechanical ones.
6. **Voice:** Does the preamble sound like Deep Thought — contemplative, slightly weary, precise — or does it sound like a generic README?

**Exit:** Critique list — what to fix, cut, strengthen.

---

## Phase 4: Refine

**Entry:** Critique list complete.

Apply corrections. The bar: a developer unfamiliar with this project picks up this SKILL.md and uses it correctly on the first attempt. Do not add length to fix ambiguity — rewrite more precisely.

**Exit:** Final SKILL.md ready.

---

## Phase 5: Deliver

**Entry:** Final SKILL.md ready.

Write the file to the agreed path using **Write**.

Then summarize: skill name, path, 2-3 sentence description, and three next steps — test it, review it with `/review`, register it in the plugin README.

**Exit:** File written, next steps surfaced.

---

## Validate

Before writing the file, verify:

- [ ] Frontmatter has `name`, `description` with trigger phrases, and `allowed-tools`
- [ ] Boundaries section specifies MAY and MAY NOT
- [ ] Every phase has an Entry and Exit condition
- [ ] At least one AskUserQuestion handles ambiguous input
- [ ] Output format is specified (what does the user receive?)
- [ ] Under 150 lines
- [ ] No phase instructs the skill to execute another skill

## Knowledge References

- `../knowledge/twelve-techniques.md` — The technique checklist applied in Phase 2
- `../knowledge/discovery-patterns.md` — AskUserQuestion patterns and user intent disambiguation
