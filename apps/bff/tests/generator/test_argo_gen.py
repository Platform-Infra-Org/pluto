"""CB02 Task 4 — emit the per-service WorkflowTemplate (golden §7) + per-verb opt-in."""

from __future__ import annotations

from pathlib import Path

import yaml

from app.generator.argo_gen import emit_workflow_template
from tests.generator import fixtures

GOLDEN = Path(__file__).parent / "golden"


def _emit(graphs):
    return emit_workflow_template(graphs.name, graphs.defined())


def _tasks(doc, verb):
    tmpl = next(t for t in doc["spec"]["templates"] if t["name"] == verb)
    return {t["name"]: t for t in tmpl["dag"]["tasks"]}


def test_create_only_matches_golden():
    assert _emit(fixtures.app_database(create=True)) == (
        GOLDEN / "app-database.workflowtemplate.yaml"
    ).read_text()


def test_create_delete_matches_golden():
    assert _emit(fixtures.app_database(create=True, delete=True)) == (
        GOLDEN / "app-database.create-delete.workflowtemplate.yaml"
    ).read_text()


def test_verbs_are_opt_in():
    create_only = yaml.safe_load(_emit(fixtures.app_database(create=True)))
    assert [t["name"] for t in create_only["spec"]["templates"]] == ["create"]
    both = yaml.safe_load(_emit(fixtures.app_database(create=True, delete=True)))
    assert [t["name"] for t in both["spec"]["templates"]] == ["create", "delete"]
    # one object, named for the service
    assert both["kind"] == "WorkflowTemplate"
    assert both["metadata"]["name"] == "app-database"


def test_create_dag_shape_matches_section_7():
    doc = yaml.safe_load(_emit(fixtures.app_database(create=True)))
    tasks = _tasks(doc, "create")
    assert list(tasks) == ["render-0", "network", "lookup-account", "extract-account",
                           "render-1", "main-call"]
    # dependency invoked via templateRef to the dep service + verb (recursion by ref)
    assert tasks["network"]["templateRef"] == {"name": "network", "template": "create"}
    # extractor reads its source api-call's task output directly
    assert tasks["extract-account"]["depends"] == "lookup-account"
    # render-1 depends on the payload's producers, in body order
    assert tasks["render-1"]["depends"] == "network && extract-account"
    resolved = tasks["render-1"]["arguments"]["parameters"][2]["value"]
    assert "mapping.children.network.outputs.subnet_id" in resolved
    assert "mapping.internals.lookup_account.outputs.account_id" in resolved
    # main-call consumes the fully-resolved payload
    assert tasks["main-call"]["depends"] == "render-1"


def test_delete_dag_is_independent():
    doc = yaml.safe_load(_emit(fixtures.app_database(create=True, delete=True)))
    delete = _tasks(doc, "delete")
    # no placeholders -> render-0 feeds main-call directly (nothing like create)
    assert list(delete) == ["render-0", "main-call"]
    assert delete["main-call"]["depends"] == "render-0"
