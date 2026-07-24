"""FunctionBlock model: round-trips the manifest jsonb + (name,version) unique."""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.blocks.model import FunctionBlock

pytestmark = pytest.mark.anyio

_MANIFEST = {
    "name": "api-call",
    "category": "builtin",
    "template_ref": "fn-api-call",
    "inputs": [{"name": "url", "type": "string", "required": True}],
    "outputs": [{"name": "status", "type": "number"}],
}


async def test_insert_and_query_round_trips_manifest(session):
    session.add(
        FunctionBlock(
            name="api-call",
            version=1,
            category="builtin",
            template_ref="fn-api-call",
            manifest=_MANIFEST,
            created_by="adm",
        )
    )
    await session.commit()

    row = await session.scalar(select(FunctionBlock).where(FunctionBlock.name == "api-call"))
    assert row is not None
    assert row.manifest == _MANIFEST
    assert row.created_by == "adm"
    assert row.created_at is not None


async def test_name_version_unique(session):
    session.add(FunctionBlock(name="dup", version=1, category="c", template_ref="fn-dup", manifest={}))
    await session.commit()
    session.add(FunctionBlock(name="dup", version=1, category="c", template_ref="fn-dup", manifest={}))
    with pytest.raises(IntegrityError):
        await session.commit()
