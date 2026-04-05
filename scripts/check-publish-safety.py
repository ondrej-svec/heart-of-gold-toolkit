#!/usr/bin/env python3
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

BLOCKED_FILE_PATTERNS = [
    re.compile(r"(^|/)\.env($|\.)"),
    re.compile(r"(^|/)\.npmrc$"),
    re.compile(r"(^|/)auth\.json$"),
    re.compile(r"(^|/)secrets?/", re.IGNORECASE),
]

SECRET_PATTERNS = [
    ("private key", re.compile(r"-----BEGIN (RSA|OPENSSH|EC|DSA|PGP)? ?PRIVATE KEY-----")),
    ("slack webhook", re.compile(r"https://hooks\.slack\.com/services/[A-Za-z0-9/_-]+")),
    ("github token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b")),
    ("npm token", re.compile(r"\bnpm_[A-Za-z0-9]{20,}\b")),
    ("slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("aws access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
]

TEXT_EXTENSIONS = {
    ".md", ".txt", ".json", ".yaml", ".yml", ".ts", ".js", ".py", ".sh", ".cjs", ".mjs", ".ini", ".toml", ".plist", ".cfg"
}

SKIP_CONTENT_SCAN = {
    "bun.lock",
}


def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        raise SystemExit(result.returncode)
    return result.stdout


def get_pack_files() -> list[str]:
    out = run(["npm", "pack", "--json", "--dry-run"])
    data = json.loads(out)
    if not data:
        raise SystemExit("npm pack --json --dry-run returned no data")
    return [entry["path"] for entry in data[0].get("files", [])]


def is_text_file(path: Path) -> bool:
    if path.name in SKIP_CONTENT_SCAN:
        return False
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return True
    return False


def main() -> None:
    package_files = get_pack_files()
    errors: list[str] = []

    for rel in package_files:
        normalized = rel.replace("\\", "/")
        for pattern in BLOCKED_FILE_PATTERNS:
            if pattern.search(normalized):
                errors.append(f"Blocked file would be published: {rel}")
                break

    for rel in package_files:
        path = ROOT / rel
        if not path.exists() or not path.is_file() or not is_text_file(path):
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        for label, pattern in SECRET_PATTERNS:
            match = pattern.search(content)
            if match:
                preview = match.group(0)
                if len(preview) > 80:
                    preview = preview[:77] + "..."
                errors.append(f"Possible {label} in {rel}: {preview}")

    if errors:
        print("Publish safety check failed:\n")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print(f"Publish safety check passed for {len(package_files)} packaged files.")


if __name__ == "__main__":
    main()
