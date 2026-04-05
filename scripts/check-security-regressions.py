#!/usr/bin/env python3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUIDE_SCRIPTS = [
    ROOT / "plugins/guide/scripts/fetch-gmail.sh",
    ROOT / "plugins/guide/scripts/fetch-hn.sh",
    ROOT / "plugins/guide/scripts/notify.sh",
    ROOT / "plugins/guide/scripts/run-pipeline-fetch.sh",
]


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, **kwargs)


def check_bash_syntax() -> list[str]:
    errors: list[str] = []
    for script in GUIDE_SCRIPTS:
        result = run(["bash", "-n", str(script)])
        if result.returncode != 0:
            errors.append(f"bash -n failed for {script.relative_to(ROOT)}: {result.stderr.strip()}")
    return errors


def check_notify_safety_markers() -> list[str]:
    errors: list[str] = []
    content = (ROOT / "plugins/guide/scripts/notify.sh").read_text(encoding="utf-8")
    required = [
        'SAFE_MSG=',
        'SAFE_RECIPIENT=',
        'jq -n --arg text "$MESSAGE"',
    ]
    for marker in required:
        if marker not in content:
            errors.append(f"notify.sh is missing safety marker: {marker}")
    return errors


def check_fetch_gmail_quoted_path_regression() -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        awkward = Path(tmp) / "it's-dir"
        awkward.mkdir()
        config = awkward / "config.yaml"
        config.write_text(
            "version: 1\n"
            "sources:\n"
            "  gmail:\n"
            "    enabled: false\n"
            "    label: Content-Feed\n"
            "    max_items: 5\n",
            encoding="utf-8",
        )
        result = run([
            "bash",
            "plugins/guide/scripts/fetch-gmail.sh",
            "--config",
            str(config),
        ])
        if result.returncode != 0:
            errors.append(
                "fetch-gmail.sh should exit 0 when gmail.enabled=false even if config path contains a single quote"
            )
        if result.stdout.strip() != "[]":
            errors.append(
                f"fetch-gmail.sh should output [] for disabled Gmail config, got: {result.stdout.strip()!r}"
            )
    return errors


def main() -> None:
    errors: list[str] = []
    errors.extend(check_bash_syntax())
    errors.extend(check_notify_safety_markers())
    errors.extend(check_fetch_gmail_quoted_path_regression())

    if errors:
        print("Security regression checks failed:\n")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Security regression checks passed.")


if __name__ == "__main__":
    main()
