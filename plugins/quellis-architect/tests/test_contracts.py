"""Tests for the evidence-contract loader + validator (plan 2.B.1)."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
HOOKS_LIB = PLUGIN_ROOT / "hooks" / "lib"
sys.path.insert(0, str(HOOKS_LIB))

import contract_loader  # type: ignore  # noqa: E402
import validate_pack  # type: ignore  # noqa: E402


VALID_CONTRACT = '''schema_version = "contract.v1"
task_id = "demo-task-001"
task_title = "Demo task"
status = "active"

[[claim]]
id = "migration-applied"
claim_regex = "\\\\bmigration applied\\\\b"
requires = "verification-query"
block_reason = "Migration-applied claim needs a verifying query."

[[claim]]
id = "rollback-tested"
claim_regex = "\\\\brollback tested\\\\b"
requires = "test-run"
block_reason = "Rollback-tested claim needs a test run."
'''

VALID_POINTER = '''schema_version = "contract.pointer.v1"
task_id = "demo-task-001"
'''


def make_repo_with_contract(
    tmp: Path,
    contract_toml: str = VALID_CONTRACT,
    pointer_toml: str | None = VALID_POINTER,
    task_id: str = "demo-task-001",
) -> Path:
    contracts = tmp / ".quellis" / "contracts"
    contracts.mkdir(parents=True, exist_ok=True)
    (contracts / f"{task_id}.toml").write_text(contract_toml)
    if pointer_toml is not None:
        (contracts / "active.toml").write_text(pointer_toml)
    return tmp


class TestContractLoader(unittest.TestCase):

    def test_no_pointer_returns_none(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            self.assertIsNone(contract_loader.load_active_contract(Path(tmp)))

    def test_valid_pointer_and_contract(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_contract(Path(tmp))
            contract = contract_loader.load_active_contract(repo)
            self.assertIsNotNone(contract)
            assert contract is not None
            self.assertEqual(contract["task_id"], "demo-task-001")
            self.assertEqual(contract["task_title"], "Demo task")
            self.assertEqual(contract["status"], "active")
            self.assertEqual(len(contract["claims"]), 2)
            ids = sorted(c["id"] for c in contract["claims"])
            self.assertEqual(ids, ["migration-applied", "rollback-tested"])

    def test_pointer_to_missing_contract_returns_none(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / ".quellis" / "contracts").mkdir(parents=True)
            (repo / ".quellis" / "contracts" / "active.toml").write_text(VALID_POINTER)
            # contract file not written
            self.assertIsNone(contract_loader.load_active_contract(repo))

    def test_non_active_contract_is_ignored(self) -> None:
        completed = VALID_CONTRACT.replace('status = "active"', 'status = "completed"')
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_contract(Path(tmp), contract_toml=completed)
            self.assertIsNone(contract_loader.load_active_contract(repo))

    def test_malformed_pointer_returns_none(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / ".quellis" / "contracts").mkdir(parents=True)
            (repo / ".quellis" / "contracts" / "active.toml").write_text("this is not = = toml")
            self.assertIsNone(contract_loader.load_active_contract(repo))

    def test_path_traversal_task_id_rejected(self) -> None:
        bad_pointer = '''schema_version = "contract.pointer.v1"
task_id = "../../etc/passwd"
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / ".quellis" / "contracts").mkdir(parents=True)
            (repo / ".quellis" / "contracts" / "active.toml").write_text(bad_pointer)
            self.assertIsNone(
                contract_loader.load_active_contract(repo),
                "path-traversal task_id must be rejected by the loader",
            )

    def test_claim_with_bad_regex_is_skipped(self) -> None:
        bad_claim = '''schema_version = "contract.v1"
task_id = "demo-task-001"
status = "active"

[[claim]]
id = "broken"
claim_regex = "[unclosed"
block_reason = "broken regex — should be skipped at load time"

[[claim]]
id = "good"
claim_regex = "\\\\bgood\\\\b"
block_reason = "valid claim still loads"
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_contract(Path(tmp), contract_toml=bad_claim)
            contract = contract_loader.load_active_contract(repo)
            assert contract is not None
            ids = [c["id"] for c in contract["claims"]]
            self.assertEqual(ids, ["good"], "bad-regex claim must drop, good must survive")

    def test_contract_with_no_claims_returns_none(self) -> None:
        empty = '''schema_version = "contract.v1"
task_id = "demo-task-001"
status = "active"
'''
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo_with_contract(Path(tmp), contract_toml=empty)
            self.assertIsNone(contract_loader.load_active_contract(repo))


class TestContractValidator(unittest.TestCase):

    def _validate(self, toml_text: str) -> list[str]:
        with tempfile.NamedTemporaryFile("w", suffix=".toml", delete=False) as fh:
            fh.write(toml_text)
            path = Path(fh.name)
        try:
            return validate_pack.validate_pack(path)
        finally:
            path.unlink()

    def test_valid_contract_validates(self) -> None:
        self.assertEqual(self._validate(VALID_CONTRACT), [])

    def test_valid_pointer_validates(self) -> None:
        self.assertEqual(self._validate(VALID_POINTER), [])

    def test_missing_claim_array_flagged(self) -> None:
        no_claims = '''schema_version = "contract.v1"
task_id = "demo-task-001"
status = "active"
'''
        findings = self._validate(no_claims)
        self.assertTrue(any("at least one claim" in f for f in findings), findings)

    def test_duplicate_claim_ids_flagged(self) -> None:
        dup = '''schema_version = "contract.v1"
task_id = "demo-task-001"
status = "active"

[[claim]]
id = "x"
claim_regex = "a"
block_reason = "one"

[[claim]]
id = "x"
claim_regex = "b"
block_reason = "two"
'''
        findings = self._validate(dup)
        self.assertTrue(any("duplicate" in f for f in findings), findings)

    def test_bad_claim_regex_flagged(self) -> None:
        bad = '''schema_version = "contract.v1"
task_id = "demo-task-001"
status = "active"

[[claim]]
id = "broken"
claim_regex = "[unclosed"
block_reason = "ok"
'''
        findings = self._validate(bad)
        self.assertTrue(any("does not compile" in f for f in findings), findings)

    def test_block_reason_over_200_chars_flagged(self) -> None:
        overlong = "y" * 250
        big = f'''schema_version = "contract.v1"
task_id = "demo-task-001"
status = "active"

[[claim]]
id = "x"
claim_regex = "a"
block_reason = "{overlong}"
'''
        findings = self._validate(big)
        self.assertTrue(any("over 200 chars" in f for f in findings), findings)

    def test_unknown_evidence_kind_flagged(self) -> None:
        bad = '''schema_version = "contract.v1"
task_id = "demo-task-001"
status = "active"

[[claim]]
id = "x"
claim_regex = "a"
requires = "not-a-real-kind"
block_reason = "ok"
'''
        findings = self._validate(bad)
        self.assertTrue(any("not a known evidence kind" in f for f in findings), findings)

    def test_invalid_task_id_flagged(self) -> None:
        bad = '''schema_version = "contract.v1"
task_id = "../../etc/passwd"
status = "active"

[[claim]]
id = "x"
claim_regex = "a"
block_reason = "ok"
'''
        findings = self._validate(bad)
        self.assertTrue(any("task_id" in f and "must match" in f for f in findings), findings)

    def test_invalid_status_flagged(self) -> None:
        bad = '''schema_version = "contract.v1"
task_id = "demo-task-001"
status = "kinda-active"

[[claim]]
id = "x"
claim_regex = "a"
block_reason = "ok"
'''
        findings = self._validate(bad)
        self.assertTrue(any("status" in f for f in findings), findings)


class TestExampleContractShipped(unittest.TestCase):
    """The example contract that ships with the plugin must validate."""

    def test_example_contract_validates(self) -> None:
        example = PLUGIN_ROOT / "contracts" / "example.toml"
        findings = validate_pack.validate_pack(example)
        self.assertEqual(findings, [], f"example contract must validate: {findings}")


if __name__ == "__main__":
    unittest.main()
