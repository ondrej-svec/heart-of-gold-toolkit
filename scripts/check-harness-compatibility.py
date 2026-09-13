#!/usr/bin/env python3
"""Keep flagship authoring portable without deleting the compatibility gate."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
SKILLS = [
    ROOT / f"plugins/deep-thought/skills/{name}/SKILL.md"
    for name in ("brainstorm", "plan", "architect", "think", "investigate", "review")
] + [ROOT / "plugins/marvin/skills/work/SKILL.md"]
FORBIDDEN = (
    "AskUserQuestion",
    "TaskCreate",
    "TaskUpdate",
    "Prefer the harness's structured",
    "hog_ask",  # Pi tool guidance belongs in the adapter, not the shared workflow.
    "/skill:",
)
REQUIRED = (
    "natural conversation is the default",
    "evidence before questioning",
    "agent investigation",
    "later verification",
    "structured ui",
    "prose",
    "authoriz",
)

SPECIFIC_RULES = {
    "brainstorm": ("owner, blocking phase, and disposition",),
    "plan": ("status: draft", "literal slash-command syntax is not required"),
    "architect": ("**Pipeline (`$BRAINSTORM_PATH` set):**",),
    "work": ("plan checkboxes as the source of truth", "Always run applicable quality checks", "explicit execution intent"),
}

errors: list[str] = []
for path in SKILLS:
    text = path.read_text(encoding="utf-8")
    relative = path.relative_to(ROOT)
    for token in FORBIDDEN:
        if token in text:
            errors.append(f"{relative} contains retired or harness-specific token: {token}")
    normalized = text.lower()
    for snippet in (*REQUIRED, *SPECIFIC_RULES.get(path.parent.name, ())):
        if snippet.lower() not in normalized:
            errors.append(f"{relative} is missing portable interaction rule: {snippet}")
    if len(text.splitlines()) > 500:
        errors.append(f"{relative} exceeds the 500-line skill limit")

if errors:
    print("Harness compatibility checks failed:\n")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("Harness compatibility checks passed.")
