import json
from pathlib import Path

from app.argo.status import find_failed_step, normalize_status

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_find_failed_step_returns_leaf():
    ws = normalize_status(load_fixture("failed_dag.json"))
    failed = find_failed_step(ws)
    assert failed is not None
    assert failed.display_name == "deploy-db"  # the deepest failing leaf, not the DAG parent
    assert "exit code 1" in failed.message


def test_succeeded_has_no_failed_step():
    assert find_failed_step(normalize_status(load_fixture("succeeded.json"))) is None


def test_pending_phase_missing_is_treated_pending():
    ws = normalize_status({"metadata": {"name": "w"}, "status": {}})  # no status.phase
    assert ws.phase == "Pending"


def test_pending_fixture_normalizes_to_pending():
    ws = normalize_status(load_fixture("pending.json"))
    assert ws.phase == "Pending"
    assert ws.nodes == {}
    assert find_failed_step(ws) is None


def test_normalize_parses_node_tree():
    ws = normalize_status(load_fixture("failed_dag.json"))
    assert ws.name == "deploy-bad-xyz98"
    assert ws.phase == "Failed"
    root = ws.nodes["deploy-bad-xyz98"]
    assert root.type == "DAG"
    assert "deploy-bad-xyz98-1111111111" in root.children
