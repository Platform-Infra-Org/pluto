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


def test_retried_then_recovered_step_is_not_reported():
    # A step failed once, was retried under a Retry node that ultimately Succeeded.
    # The stale failed attempt must NOT be reported — only the genuine later failure.
    ws = normalize_status(load_fixture("retry_recovered.json"))
    failed = find_failed_step(ws)
    assert failed is not None
    assert failed.display_name == "deploy-db"  # genuine failure, not the recovered build attempt
    assert "could not connect to database" in failed.message


def test_multi_leaf_failed_picks_earliest_deterministically():
    # Two parallel failing leaves; the earliest-finished (root-causiest) is reported,
    # regardless of map/insertion order or node id ordering.
    ws = normalize_status(load_fixture("multi_leaf_failed.json"))
    failed = find_failed_step(ws)
    assert failed is not None
    assert failed.display_name == "deploy-east"  # finished 13:01:15, before deploy-west 13:03:30


def test_normalize_parses_node_tree():
    ws = normalize_status(load_fixture("failed_dag.json"))
    assert ws.name == "deploy-bad-xyz98"
    assert ws.phase == "Failed"
    root = ws.nodes["deploy-bad-xyz98"]
    assert root.type == "DAG"
    assert "deploy-bad-xyz98-1111111111" in root.children
