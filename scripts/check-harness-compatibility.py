#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
FLAGSHIP_SKILLS = [
    ROOT / "plugins/deep-thought/skills/brainstorm/SKILL.md",
    ROOT / "plugins/deep-thought/skills/plan/SKILL.md",
    ROOT / "plugins/marvin/skills/work/SKILL.md",
]
FORBIDDEN = [
    "AskUserQuestion",
    "TaskCreate",
    "TaskUpdate",
]
REQUIRED_SNIPPETS = {
    ROOT / "plugins/deep-thought/skills/brainstorm/SKILL.md": [
        "structured question UI when available",
        "plain-text choice list",
    ],
    ROOT / "plugins/deep-thought/skills/plan/SKILL.md": [
        "structured choice UI if available",
        "plain-text choice list",
    ],
    ROOT / "plugins/marvin/skills/work/SKILL.md": [
        "structured choice UI when available",
        "plan checkboxes as the source of truth",
    ],
}

errors: list[str] = []
for path in FLAGSHIP_SKILLS:
    text = path.read_text(encoding="utf-8")
    for token in FORBIDDEN:
        if token in text:
            errors.append(f"{path.relative_to(ROOT)} contains forbidden harness-specific token: {token}")
    for snippet in REQUIRED_SNIPPETS.get(path, []):
        if snippet not in text:
            errors.append(f"{path.relative_to(ROOT)} is missing required portability phrase: {snippet}")

if errors:
    print("Harness compatibility checks failed:\n")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("Harness compatibility checks passed.")
