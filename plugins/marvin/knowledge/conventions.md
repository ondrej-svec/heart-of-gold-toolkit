# CONVENTIONS

Authoring standard for everything in this marketplace: skills, agents, knowledge
files, and plugin packaging.

`marvin:skill-reviewer` grades against this document and `knowledge-architect`
cites it. Until now it did not exist — both agents referenced it as law while
improvising what it required, so every compliance verdict they produced was
against a phantom. This file is that document.

The toolkit targets the [agentskills.io](https://agentskills.io) standard, so
skills must stay portable across Claude Code, Codex, OpenCode and Pi. Anything
Claude-Code-specific is called out below.

---

## 1. Skills (`SKILL.md`)

### Required frontmatter

| Field | Rule |
|---|---|
| `name` | kebab-case, matches the directory name |
| `description` | Lead with the use case. Include trigger keywords — this is what the model matches on. Description + `when_to_use` is truncated at **1,536 characters** |

### Optional frontmatter, and when it is wrong

| Field | Use it when | Do not |
|---|---|---|
| `allowed-tools` | The skill needs specific tools without prompting | List tools the skill never calls |
| `disable-model-invocation` | The skill has side effects (deploy, commit, publish) | Set it on read-only analysis |
| `context: fork` | The skill is an **actionable task** that benefits from isolation | Set it on reference material — a fork receives guidelines with no prompt and returns nothing. Also never on a skill whose body refers to "the current work": a fork inherits no conversation history |
| `background` | Pair with `context: fork`. Set `false` when the invoking turn needs the result | Leave it defaulting to `true` on anything interactive — a detached fork cannot ask the user a question |
| `agent` | Choosing the execution environment for a fork | Pass a **model name**. `agent` takes a subagent *type* — `Explore`, `Plan`, `general-purpose`, or a custom agent. `agent: sonnet` silently falls back to `general-purpose` |
| `model` | Pinning a model for the skill's turn | — |
| `paths` | The skill only applies to certain file types | — |

### Structure

Required sections, in order:

1. **Boundaries** — explicit `This skill MAY:` / `This skill MAY NOT:`
2. **Common Rationalizations** — 3–5 rows: Shortcut / Why It Fails / The Cost
3. **Numbered phases** — each with an explicit **Entry** and **Exit** gate
4. **Validate** — 3–5 testable checkboxes
5. **When NOT to Use**
6. **What Makes This Heart of Gold** — reference named sub-competencies

### Limits

- **≤500 lines.** Over that, move reference material into sibling files and
  reference them by name. The body loads on invocation; supporting files load
  only when actually needed.
- Instruction specificity must match task fragility. Low-freedom tasks get
  strict steps; high-freedom tasks get principles. Over-specifying a creative
  task produces worse output than under-specifying it.

---

## 2. Agents

### Required frontmatter

`name`, `description`, `model`, `tools` — all four, always.

**Always pin `model` explicitly.** An agent without one inherits the caller's
model, which means a lookup agent silently running on the most expensive tier.

| Task | Model |
|---|---|
| File location, lookup, mechanical extraction | `haiku` |
| Analysis, pattern finding, review | `sonnet` |
| Architecture, strategy, adversarial judgment | `opus` |

### Structure

1. **Scope** — explicit `You DO review:` / `You do NOT review:`
2. **Method** — numbered steps
3. **Output format** — a concrete template, not a description of one
4. **Rules** — numbered, governing behaviour
5. **Failure modes** — what going wrong looks like, and how to self-correct

Grant the minimum tools the agent needs. A read-only reviewer with `Write` is a
review that edits.

---

## 3. Knowledge files

- **800–1,200 words.** Longer belongs in several files.
- No YAML frontmatter — these are loaded by skills, not invoked.
- Accessible voice, structured for practitioners, tables over paragraphs.
- **Must live inside the plugin** (`plugins/<plugin>/knowledge/`). Never
  reference an absolute path into a personal repository: it breaks on every
  other machine and for every other user.
- **Never write generated content into the plugin cache directory.**
  `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` is replaced
  wholesale on every version bump. A file a skill "creates on first run" there
  is silently destroyed by the next update. Write to the target repo or to
  `~/.claude/`, never into the plugin's own installed tree.

---

## 4. Portability

Skills and agents must run on a machine that has this marketplace and nothing
else.

- **No absolute paths into personal repos.** Ship the reference material in
  `knowledge/` instead.
- Use `${CLAUDE_PLUGIN_ROOT}` for plugin-relative paths, `$HOME` for user paths.
- A skill that names a sibling repository as its canonical template is broken
  for everyone who does not have that repository.

---

## 5. Hooks

- Tool arguments arrive under **`.tool_input`**, never the JSON root.
- Exit `0` to allow, `2` to block (stderr reaches the model).
- Every registered hook needs a `timeout`.
- Hooks **merge** across user settings, project settings and plugins. Check what
  is already registered before adding a guard; duplicates double latency for the
  same protection.
- Prefer a script file under `hooks/` referenced via `${CLAUDE_PLUGIN_ROOT}`
  over an inline shell blob in `hooks.json` — inline blobs cannot be tested.
- **Guards that match command text match it everywhere.** A command that merely
  *mentions* a dangerous string — a commit message, a deny rule, documentation —
  gets blocked. Strip heredoc bodies before matching, but only for data
  heredocs: `bash <<EOF` executes its body, so stripping that is a security
  hole. Anchor shell names; `(ba)?sh` matches the `sh` in `shasum`.

---

## 6. Plugin packaging

- Manifest location is `plugins/<name>/.claude-plugin/plugin.json`. Keep every
  plugin consistent; a manifest at the plugin root is a portability gamble on
  which location the host reads.
- **The version appears twice** — in `plugin.json` and again in the plugin's
  entry in the root `.claude-plugin/marketplace.json`. Both must be updated
  together. They had already drifted (`0.4.3` vs `0.4.4`) before anyone
  noticed, because nothing checks.
- Bump the version **in the same commit** as the change it describes. A commit
  message announcing a version the manifest does not carry makes every
  downstream cache ambiguous, and `claude plugin update` will report the plugin
  already current while shipping the old code.
- After pushing, verify installation actually took: refresh the marketplace,
  update the plugin, then confirm the new file exists under
  `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. A push is not a
  release.
- Delisted plugins get removed from `marketplace.json` **and** deleted from the
  tree. A full plugin directory that is not installable is dead code.

---

## 7. Verification

Before declaring authoring work done:

- [ ] Frontmatter parses, and every field is real — check the current docs
      rather than recalling them. Two shipped bugs (`agent: sonnet`,
      `context: fork` on reference skills) came from plausible guesses.
- [ ] Every referenced file exists.
- [ ] No absolute paths outside `$HOME`-relative or `${CLAUDE_PLUGIN_ROOT}`.
- [ ] Line and word budgets respected.
- [ ] Any hook you touched has been executed, not just read.

**Conventions are law — but a convention nobody can check is a wish.** Where a
rule here is mechanically verifiable, it belongs in a script, not only in prose.
