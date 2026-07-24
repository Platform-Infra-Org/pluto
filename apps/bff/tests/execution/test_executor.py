"""Task 2: APPROVED -> submit executor, idempotent (ArgoClient faked)."""

import pytest

from app.execution.executor import on_approved

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
    # request-id label = Argo-side idempotency key; must equal the request id, no commas.
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
