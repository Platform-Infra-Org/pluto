"""Task 2: APPROVED -> submit executor, idempotent (ArgoClient faked)."""

import pytest

from app.execution.executor import on_approved
from app.models.resource import ResourceIndex
from app.services.definition import ServiceDefinition

from .conftest import make_approved

pytestmark = pytest.mark.anyio


async def test_on_approved_submits_mapped_params_and_labels_and_moves_to_executing(session):
    from .conftest import FakeArgo

    argo = FakeArgo()
    req = await make_approved(session, payload={"spec": {"engine": "pg16"}})

    out = await on_approved(req, argo, session)

    # Submitted exactly once, with the bound template + mapped params.
    assert len(argo.submits) == 1
    call = argo.submits[0]
    assert call["template"]  # bound WorkflowTemplate
    assert call["parameters"]["action"] == "UPDATE"
    assert call["parameters"]["resource-type"] == "database"
    # request-id label = query metadata (not the dedup key); equals the request id, no commas.
    assert call["labels"]["request-id"] == str(req.id)
    assert "," not in call["labels"]["request-id"]

    # State advanced + workflow_ref persisted.
    assert out.state == "EXECUTING"
    assert out.workflow_ref == "platform/wf-abc123"
    assert out.events[-1].to_state == "EXECUTING"


async def test_on_approved_is_idempotent(session):
    from .conftest import FakeArgo

    argo = FakeArgo()
    req = await make_approved(session)

    await on_approved(req, argo, session)
    await on_approved(req, argo, session)  # retry must not double-submit

    assert len(argo.submits) == 1
    assert req.state == "EXECUTING"


async def test_on_approved_uses_deterministic_workflow_name(session):
    from .conftest import FakeArgo

    argo = FakeArgo()
    req = await make_approved(session)

    await on_approved(req, argo, session)

    # Executor drives Argo idempotency via a deterministic name (req-<id>).
    assert argo.submits[0]["name"] == f"req-{req.id}"


class _RaisingArgo:
    """submit always reports the workflow already exists (Argo 409)."""

    def __init__(self) -> None:
        self.attempts: list[str] = []

    async def submit(self, template, parameters, labels, name):
        from app.argo.models import WorkflowAlreadyExists

        self.attempts.append(name)
        raise WorkflowAlreadyExists(name)


async def test_on_approved_treats_already_exists_as_submitted(session):
    argo = _RaisingArgo()
    req = await make_approved(session)

    out = await on_approved(req, argo, session)  # must NOT raise

    assert len(argo.attempts) == 1  # no double-submit
    assert out.state == "EXECUTING"
    assert out.workflow_ref == f"platform/req-{req.id}"


class _FakeNamedArgo:
    """Models Argo's deterministic-name semantics: a second submit of the same
    name raises AlreadyExists instead of creating a second workflow."""

    def __init__(self) -> None:
        self.attempts: list[str] = []
        self.created: set[str] = set()

    async def submit(self, template, parameters, labels, name):
        from app.argo.models import WorkflowAlreadyExists, WorkflowRef

        self.attempts.append(name)
        if name in self.created:
            raise WorkflowAlreadyExists(name)
        self.created.add(name)
        return WorkflowRef(namespace="platform", name=name)


async def test_on_approved_crash_window_does_not_double_execute(session):
    argo = _FakeNamedArgo()
    req = await make_approved(session)

    await on_approved(req, argo, session)  # submits + creates the workflow
    # Simulate the crash window: the post-submit commit (state + workflow_ref) is lost.
    req.workflow_ref = None
    req.state = "APPROVED"
    out = await on_approved(req, argo, session)  # retry hits AlreadyExists

    assert len(argo.attempts) == 2  # submit attempted twice
    assert len(argo.created) == 1  # but only one workflow exists
    assert out.state == "EXECUTING"
    assert out.workflow_ref == f"platform/req-{req.id}"


async def test_on_approved_resolves_the_resource_pinned_binding_not_latest(session):
    """Pin-until-migrated: a resource created under v1 must execute v1's binding,
    even though v2 (the latest) has since been onboarded with a different template."""
    from .conftest import FakeArgo

    session.add_all(
        [
            ServiceDefinition(
                name="database",
                workflow_binding={
                    "update": {"template_ref": "resource-change-v1", "param_map": {}}
                },
                status="ACTIVE",
                version=1,
            ),
            ServiceDefinition(
                name="database",
                workflow_binding={
                    "update": {"template_ref": "resource-change-v2", "param_map": {}}
                },
                status="ACTIVE",
                version=2,
            ),
        ]
    )
    resource = ResourceIndex(
        type="database",
        name="pg-prod",
        owner_team="payments",
        git_path="resources/database/pg-prod.json",
        git_sha="abc",
        payload={"spec": {}},
        definition_version=1,  # pinned to v1 at creation time
    )
    session.add(resource)
    await session.commit()
    await session.refresh(resource)

    argo = FakeArgo()
    req = await make_approved(session, resource_id=resource.id)

    out = await on_approved(req, argo, session)

    assert argo.submits[0]["template"] == "resource-change-v1"
    assert out.state == "EXECUTING"
