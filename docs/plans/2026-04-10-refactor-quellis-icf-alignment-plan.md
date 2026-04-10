---
title: "refactor: align Quellis coaching skills with ICF Updated Core Competencies"
type: plan
date: 2026-04-10
status: complete
confidence: high
---

# Align Quellis with ICF Core Competencies

**Summary:** Rewrite the Quellis coach skill and cascade changes to reflect, goal-setting, and goal-checkin so that coaching behavior meets ACC-level ICF standards — particularly around single-question discipline, silence, active listening demonstration, and client autonomy.

## Problem Statement

Quellis claims ICF methodology but violates several core competencies in practice:

1. **Multiple questions per turn** — stacks 2-3 questions plus examples. Violates Competency 7 (Evokes Awareness). Overwhelming the client and doing their thinking for them.
2. **Coach generates options for the client** — offers suggestions ("the bike shop, a cycling event...") instead of letting the client generate their own answers. Violates Competency 8 (Facilitates Client Growth) and client autonomy.
3. **No silence instruction** — LLMs default to filling space. Missing Competency 5 (Maintains Presence): "Creates space for silence, pause, reflection."
4. **No reflect-before-ask pattern** — coach moves to next question without demonstrating it heard the last answer. Violates Competency 6 (Listens Actively): "Reflects or summarizes what the client communicated."
5. **Framework treated as checklist** — FLOW is presented as rigid sequential steps. Real coaching follows the client's energy with the framework as a compass.
6. **Missing ICF competencies** — Trust & Safety (4), Presence (5), and Establishing Agreements (3) are underdeveloped or absent.
7. **Outdated ICF reference** — knowledge base has 6 "simplified" competencies instead of the actual 8 competencies across 4 domains.
8. **Turn length unconstrained** — no guidance on brevity. LLM defaults to paragraphs; an ICF coach's turn is often one sentence.

## Target End State

- A coaching session with Quellis reads like an ACC-level ICF coaching conversation
- One question per turn, always
- Coach demonstrates listening (reflects/summarizes) before asking the next question
- Client generates their own options — coach never suggests or gives examples
- Short turns (1-3 sentences typical, 5 absolute max)
- FLOW is a flexible compass, not a rigid sequence
- Knowledge base references the actual ICF Updated Core Competencies (8 competencies, 4 domains)
- All four skills share consistent coaching discipline

## Scope and Non-Goals

**In scope:**
- `plugins/quellis/skills/coach/SKILL.md` — major rewrite
- `plugins/quellis/skills/reflect/SKILL.md` — cascade key patterns
- `plugins/quellis/skills/goal-setting/SKILL.md` — cascade key patterns
- `plugins/quellis/skills/goal-checkin/SKILL.md` — cascade key patterns
- `plugins/quellis/knowledge/coaching-frameworks.md` — replace ICF reference
- `plugins/quellis/plugin.json` — version bump to 0.3.0

**Non-goals:**
- README.md rewrite (current one is fine)
- New skills (e.g., team coaching, feedback skills)
- Quellis app features (memory, nudges — those are Tier 2)
- Changing the FLOW/REVIEW framework names or structure — they're sound, just need different usage guidance

## Proposed Solution

### Core Pattern: The Coaching Turn

Every Quellis response should follow this discipline:

```
1. REFLECT — Show you heard (summarize, mirror, or name the emotion)
2. ONE QUESTION — Ask exactly one powerful question
3. STOP — End your turn. Let them think.
```

This is the single most important change. It addresses issues #1, #2, #3, #4, and #8 simultaneously.

### Framework as Compass

Rewrite FLOW guidance from "follow these steps in order" to "know where you are in the conversation." The coach should:
- Check which FLOW phase the conversation is naturally in
- Follow the client's energy, not force the next phase
- Only nudge toward the next phase if the client is stuck or the session is running out of time

### Hard Rules (Non-Negotiable)

These go at the top of the coach skill, before any framework:

1. **One question per turn.** Never two. Never a question with "or" offering alternatives.
2. **Reflect before you ask.** Show you heard the client before moving forward.
3. **Never suggest, never give examples.** If you catch yourself saying "like X, Y, or Z" — delete it and ask instead.
4. **Short turns.** 1-3 sentences. Your job is to create space, not fill it.
5. **Follow the client.** The framework is your compass, not their rails.

### ICF Competency Coverage

Map each ICF competency to specific Quellis behavior:

| ICF Competency | Quellis Behavior |
|---|---|
| 1. Ethical Practice | Coaching ≠ therapy boundary; referral when needed |
| 2. Coaching Mindset | Anti-sycophancy; client is whole and capable |
| 3. Establishes Agreements | Session goal-setting at open |
| 4. Trust & Safety | *NEW: acknowledgment, empathy, vulnerability* |
| 5. Maintains Presence | *NEW: silence, comfort with uncertainty, following client energy* |
| 6. Listens Actively | *NEW: reflect-before-ask pattern; notice what's unsaid* |
| 7. Evokes Awareness | Powerful questions — ONE at a time, forward-looking |
| 8. Facilitates Growth | Client generates options; commitment to action |

## Implementation Tasks

### Phase 1: Core skill rewrite (coach)

- [x] **1.1 Rewrite coach/SKILL.md — Hard Rules section**
  Add the five hard rules at the top, before any framework. These are the non-negotiable coaching discipline rules that override everything else.

- [x] **1.2 Rewrite coach/SKILL.md — The Coaching Turn pattern**
  Replace the current implicit response pattern with explicit REFLECT → ONE QUESTION → STOP discipline. Include anti-patterns with examples of what NOT to do (stacked questions, offering suggestions).

- [x] **1.3 Rewrite coach/SKILL.md — FLOW as compass**
  Reframe FLOW from sequential steps to a situational compass. Coach checks "where are we?" not "what's next on the checklist?" Add guidance on following client energy vs. forcing phase transitions.

- [x] **1.4 Rewrite coach/SKILL.md — Add Trust & Safety (ICF 4)**
  Add section on creating psychological safety: acknowledge feelings, show empathy, be comfortable with uncertainty, support client expression without judgment.

- [x] **1.5 Rewrite coach/SKILL.md — Add Presence (ICF 5)**
  Add section on maintaining presence: stay with the client's current moment, don't rush to the next question, be comfortable with silence, manage the impulse to fill space.

- [x] **1.6 Rewrite coach/SKILL.md — Strengthen Active Listening (ICF 6)**
  Expand from "listen" to specific behaviors: reflect content, mirror emotion, notice what's NOT said, summarize before transitioning, notice energy shifts.

- [x] **1.7 Rewrite coach/SKILL.md — Anti-patterns gallery**
  Add concrete before/after examples showing violations and corrections. One example per hard rule. The LLM needs to see the bad pattern to avoid it.

### Phase 2: Knowledge base update

- [x] **2.1 Rewrite coaching-frameworks.md — Full ICF competencies**
  Replace the simplified 6-competency list with the actual ICF Updated Core Competencies: 8 competencies across 4 domains (Foundation, Co-Creating the Relationship, Communicating Effectively, Cultivating Learning and Growth). Include behavioral markers.

- [x] **2.2 Add "The Coaching Turn" pattern to frameworks**
  Document REFLECT → ONE QUESTION → STOP as a first-class pattern alongside FLOW and REVIEW.

### Phase 3: Cascade to other skills

- [x] **3.1 Update reflect/SKILL.md**
  Add: one question per turn, reflect before asking, short turns. The reflect skill already has good instincts ("One powerful question is worth more than three observations") — reinforce and make it a hard rule.

- [x] **3.2 Update goal-setting/SKILL.md**
  The goal-setting protocol is more structured (SMART+V steps), so the cascade is lighter: add one-question discipline within each protocol step. Don't stack "What do you want to achieve?" with "What would achieving that give you?" in the same turn.

- [x] **3.3 Update goal-checkin/SKILL.md**
  Same pattern: one question per protocol step, reflect before moving to the next step. The protocol steps are already well-sequenced — just enforce the turn discipline within each.

### Phase 4: Version and finalize

- [x] **4.1 Bump plugin.json version to 0.3.0**
  This is a significant behavioral change — minor version bump warranted.

## Decision Rationale

**Why hard rules at the top, not woven into frameworks?**
LLM prompt priority: instructions at the top of a prompt carry more weight. The five hard rules are the most important behavioral constraints. They need to be encountered first, before the framework details that might dilute them.

**Why "The Coaching Turn" as a named pattern?**
Giving it a name makes it referenceable. The LLM can hold "do The Coaching Turn" more reliably than remembering three separate instructions scattered through the document.

**Why not restructure the four skills into fewer/more skills?**
The current four-skill structure maps well to distinct coaching modalities (open coaching, reflection, goal-setting, accountability). Each has different enough structure to warrant its own skill. The issue is coaching discipline within each, not the skill boundaries.

**Why 0.3.0 and not 0.2.1?**
This changes observable behavior significantly. A client who used 0.2.0 will notice the difference immediately — shorter turns, no suggestions, more silence. That's a minor version change, not a patch.

## Constraints and Boundaries

- **ICF competencies are the authority.** When in doubt about coaching behavior, defer to the ICF Updated Core Competencies, not to what "feels natural" for an LLM.
- **Coaching ≠ therapy boundary stays.** The recent 0.2.0 work on this was good. Preserve it, don't dilute it.
- **Stateless constraint stays.** These skills can't remember previous sessions. Don't add features that pretend otherwise.
- **FLOW and REVIEW frameworks stay.** They're sound structures. The change is how they're used (compass vs. checklist), not what they contain.

## Assumptions

| Assumption | Status | Evidence |
|---|---|---|
| LLM will follow "one question" rule if stated prominently | Verified | Anti-sycophancy rules in current skill work well — same prompting pattern |
| Anti-patterns with examples improve compliance | Verified | Standard prompt engineering practice; used effectively in other toolkit skills |
| Short turn instruction will produce shorter outputs | Medium confidence | LLMs tend toward verbosity; may need reinforcement via "max 3 sentences" |
| ICF Updated Core Competencies (2021) are current standard | Verified | Confirmed via coachfederation.cz — these are the active competencies |

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM still stacks questions despite instruction | Medium | High — defeats the purpose | Multiple reinforcement: hard rule + anti-pattern examples + "STOP" instruction |
| Turns become TOO short — feels robotic | Low | Medium | "1-3 sentences" gives range; reflect step adds warmth |
| FLOW-as-compass is too vague — coach loses structure | Low | Medium | Keep FLOW phases described, just change the usage guidance |
| Goal-setting becomes awkward with strict one-question rule | Medium | Low | Goal-setting is more structured by nature; allow the protocol steps but enforce one-question within each step |

## Acceptance Criteria

- [ ] A simulated coaching conversation produces single-question turns consistently
- [ ] Coach reflects/summarizes client's words before asking next question
- [ ] Coach never offers examples or suggestions — client generates all options
- [ ] Typical coach turn is 1-3 sentences
- [ ] FLOW phases are described as a compass, not a sequential checklist
- [ ] Knowledge base contains all 8 ICF Updated Core Competencies with behavioral markers
- [ ] All four skills share the one-question and reflect-before-ask discipline
- [ ] Plugin version is 0.3.0
