# /// script
# requires-python = ">=3.12"
# dependencies = ["pyte==0.8.2"]
# ///
"""Capture the installed Pi 0.85.1 question example, not a recreated mockup.

uv run scripts/pi-question-reference-proof.py --output /tmp/hog-question-reference
Only owned temporary offline profiles and harmless demo answers are used.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile

spec = importlib.util.spec_from_file_location("native_proof", Path(__file__).with_name("pi-hog-ask-proof.py"))
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    cli = shutil.which(os.environ.get("PI_BIN", "pi"))
    if not cli:
        raise RuntimeError("Pi CLI not found")
    package = None
    for ancestor in list(Path(cli).resolve().parents)[:6]:
        manifest = ancestor / "package.json"
        if manifest.is_file() and json.loads(manifest.read_text()).get("name") == "@earendil-works/pi-coding-agent":
            package = ancestor
            break
    if package is None:
        raise RuntimeError("Selected Pi CLI does not resolve inside the expected installed package")
    version = json.loads((package / "package.json").read_text())["version"]
    if version != "0.85.1":
        raise RuntimeError(f"Reference was grounded on Pi 0.85.1, found {version}")
    reference = package / "examples/extensions/question.ts"
    source = reference.read_bytes()
    report = []
    for mode, theme in [("regular", "light"), ("fullscreen", "dark")]:
        with tempfile.TemporaryDirectory(prefix="hog-question-reference-") as tmp:
            directory = Path(tmp)
            fixture = directory / "reference.ts"
            fixture.write_text('import question from ' + json.dumps(str(reference)) + ';\n' + '''
import { appendFileSync } from "node:fs";
export default function referenceProof(pi) {
  let tool;
  question(new Proxy(pi, { get(target, key) {
    if (key === "registerTool") return (definition) => {
      if (definition.name === "question") tool = definition;
      return target.registerTool(definition);
    };
    return Reflect.get(target, key);
  }}));
  pi.registerCommand("question-reference", {
    description: "Benign offline reference capture; executes no chosen action.",
    handler: async (_args, ctx) => {
      const result = await tool.execute("demo-reference", {
        question: "Who should have access first?",
        options: [
          { label: "Internal only", description: "Validate with support before wider exposure." },
          { label: "Public", description: "Wider reach and greater rollout risk." }
        ]
      }, undefined, undefined, ctx);
      appendFileSync(process.env.HOG_ASK_PROOF_OUTPUT, JSON.stringify(result.details) + "\\n");
      pi.sendMessage({ customType: "question-reference", content: result.content, details: result.details, display: true });
    }
  });
}
''')
            terminal = proof.Terminal(directory, mode, directory / "results.jsonl", True,
                                      theme=theme, extra_extensions=[fixture])
            name = f"reference-{mode}-{theme}"
            try:
                terminal.wait_ready()

                def open_reference():
                    terminal.keys("\x1b[200~/question-reference\x1b[201~")
                    terminal.wait("/question-reference")
                    terminal.keys(proof.ENTER)
                    terminal.wait("3. Type something.")

                def preset():
                    before = terminal.result_count()
                    open_reference()
                    terminal.capture(args.output, name + "-entry")
                    terminal.keys(proof.ENTER)
                    result = terminal.await_result(before)
                    assert result["answer"] == "Internal only" and not result["wasCustom"], result

                def custom():
                    before = terminal.result_count()
                    open_reference()
                    terminal.keys(proof.DOWN, proof.DOWN, proof.ENTER)
                    terminal.wait("Your answer:")
                    terminal.keys("Support + internal 🦊")
                    terminal.capture(args.output, name + "-custom")
                    terminal.keys(proof.ENTER)
                    result = terminal.await_result(before)
                    assert result["answer"] == "Support + internal 🦊" and result["wasCustom"], result

                proof.proof_case(report, name + "-one-enter-preset", terminal, args.output, preset)
                proof.proof_case(report, name + "-custom-submit", terminal, args.output, custom)
            except Exception as error:
                if not report or report[-1]["status"] != "failed":
                    report.append({"case": name + "-startup", "status": "failed", "error": str(error)[:1200]})
            finally:
                terminal.close()
    record = {
        "piVersion": version,
        "reference": str(reference),
        "referenceSha256": hashlib.sha256(source).hexdigest(),
        "cases": report,
        "transport": "Actual installed question.ts in offline Pi, emulated PTY input and native-cell captures",
        "limits": "Reference behavior/appearance, not approval safety or universal physical-terminal/IME certification",
    }
    (args.output / "verification.json").write_text(json.dumps(record, indent=2) + "\n")
    failures = [case for case in report if case["status"] == "failed"]
    print(json.dumps({"passed": len(report) - len(failures), "failed": failures}, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
