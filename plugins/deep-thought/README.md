# Deep Thought — The Answer Computer

> "The Answer to the Great Question... Of Life, the Universe and Everything... Is... Forty-two."
> But the question matters more. That's what this plugin is for.

A reasoning plugin for Claude Code. Ten skills for thinking clearly about hard problems — from early-stage brainstorming through architectural review and strategic CTO decisions.

## Skills

### `/deep-thought:brainstorm`
Collaborative discovery before planning. Explore the problem space, evaluate approaches, surface past work, and produce a structured brainstorm document. Uses Socratic questioning and assumption auditing.

### `/deep-thought:plan`
Strategic planning with auto-calibrated detail level. Produces dependency-ordered task lists, decision rationale, risk analysis, and acceptance criteria. The output becomes the input for `/marvin:work`.

### `/deep-thought:think`
Deep reasoning for complex decisions. Simulates expert panels, runs devil's advocate scenarios, and structures tradeoff analysis. Use when a decision has high stakes or multiple valid approaches.

### `/deep-thought:investigate`
Detective-style root cause analysis using three investigative lenses:
- **Sherlock** — deduction from evidence
- **Poirot** — psychology and intent
- **Columbo** — "just one more thing" (what's missing?)

Works on code, performance, architecture, data, and systems.

### `/deep-thought:review`
Focused code review — one deep pass with evidence-based findings and clear verdict. Auto-detects what you're reviewing: branch diff, PR, file path, plan, or spec.

### `/deep-thought:architect`
Turn brainstorm decisions into user stories, an architecture doc, and ADRs. Use after brainstorming to define WHAT to build and HOW it fits together. Standalone or pipeline-aware.

### `/deep-thought:architecture-review`
Deep architectural review of a platform or product. Cross-references code against claims, maps failure modes, evaluates scaling bottlenecks, and produces a decision-grade handoff document with ADRs.

### `/deep-thought:cto`
Strategic CTO advisor grounded in the leadership canon (Larson, Fournier, Majors, DHH, Fowler, Team Topologies, DORA, Cagan). Structured sub-commands for architecture decisions, org design, stakeholder communication, and AI-era challenges.

### `/deep-thought:craft-skill`
Meta-skill — generates and refines SKILL.md files for Claude Code. Use it to create new skills with proper structure, boundaries, and validation criteria.

### `/deep-thought:improbable-futures`
Product cartography for any project. Reads current state, sketches three lovable futures worth chasing — each with a named user's love-letter from six months ahead, the capability that future demands, and the first moves toward it. Adds wild-card branches and hands off to `/babel-fish:visualize` for the visual map.

## Agents

Nine specialized agents available for subagent delegation:

| Agent | Focus |
|-------|-------|
| `strategic-reviewer` | Pattern compliance, design integrity |
| `security-reviewer` | OWASP, auth, secrets, input validation |
| `performance-reviewer` | N+1 queries, complexity, memory, scaling |
| `infra-reviewer` | Terraform, Helm, K8s, Dockerfiles, CI/CD |
| `python-reviewer` | Type safety, async, Pydantic, FastAPI patterns |
| `typescript-reviewer` | Type narrowing, hooks, RTK Query, Effect-TS |
| `investigator` | Evidence trails, root causes, hidden problems |
| `cto-advisor` | Leadership, strategy, org design, stakeholders |
| `researcher` | Codebase exploration, documentation, context gathering |

## Knowledge

16 knowledge files providing domain expertise:

**Reasoning:** decision-frameworks, strategic-decomposition, socratic-patterns, critical-evaluation, discovery-patterns, twelve-techniques (prompting patterns)

**CTO Canon:** cto-canon, cto-ai-era, cto-metrics, cto-operating-modes, cto-org-design, cto-stakeholder

**Domain Patterns:** security-review, infrastructure-ops, observability, python-fastapi-patterns, typescript-nextjs-patterns

## Install

```
/plugin install deep-thought@heart-of-gold-toolkit
```
