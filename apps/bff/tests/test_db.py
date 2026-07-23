import pytest
from sqlalchemy import text

from app.db import get_session


@pytest.mark.anyio
async def test_select_1():
    async for session in get_session():
        result = await session.execute(text("SELECT 1"))
        assert result.scalar_one() == 1
