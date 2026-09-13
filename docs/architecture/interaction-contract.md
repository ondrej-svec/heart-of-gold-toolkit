# Interaction and readiness contract

This is the authoring contract for shared Heart of Gold skills. It describes
portable conversation behavior; a harness may offer optional presentation, but
must not change the meaning.

## Conversation policy

1. Inspect available evidence before asking. Classify an unknown as a
   user-owned decision, agent-owned investigation, or later verification, and
   name its blocking phase and owner.
2. Ask one focused question when its answer determines the next step. Up to
   three independent, related clarifications may be grouped in prose. Give an
   evidence-based recommendation and tradeoffs when useful; do not invent a
   default for open discovery.
3. Preserve settled decisions and stop interviewing when the current phase is
   clear enough to proceed.
4. Structured UI is conditional: use it only for a real consequential choice
   or named approval. Plain prose and custom qualifications must always work.
   Required tasks and dependencies are progress/obligations, not alternatives.
5. End with the result and appropriate next step, never a ritual handoff menu.

## Readiness and authorization

Document existence/status, readiness, and execution authorization are distinct.
New plans are `draft` unless their scope was actually approved. A plan path,
review request, highlight, recommendation, blank answer, dismissal, or timeout
does not authorize implementation. Explicit execution intent, including a
natural request such as "Implement this plan" or `/work <path>`, may authorize
the stated scope subject to readiness and preview gates. Literal command syntax
is not required; never re-ask an already authorized transition. Legacy approved
plans need not be mass-migrated, but status alone cannot override current intent.

A missing prerequisite blocks only dependent work. Resolve agent-owned
prerequisites within the authorized phase; ask the user only for the missing
user-owned decision. Once a scope is authorized and ready, execute it
independently without per-task reapproval. An independent ready phase may ship
while later gated phases remain unchecked; the overall plan is not complete
until its remaining work is complete.

`architect` hands off to creating or continuing an execution plan rather than
treating stories as permission to build; it still writes only stories and
architecture documents. Its pipeline mode returns those paths and stops without
automatically starting another phase. Subjective work must make preview/reviewer
gates visible and must not cross them without explicit approval.

Each installed skill carries the essential rules itself; this repository document
is an authoring reference, not a runtime dependency. Conversation, deliberate
choices/approvals, and progress are distinct surfaces. Pi's automatic extractor
is retired; `hog_ask` remains a proposed, unimplemented presentation layer.
