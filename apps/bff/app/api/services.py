"""Service Definition + onboarding API (E08).

Task 2 wiring lives here first: the type-schema endpoint the SPA request form
loads (closing the E05 tracked gap). The onboarding endpoints are added in Task 6.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.db import get_session
from app.services import definition as service_def

router = APIRouter(prefix="/api/services")


@router.get("/type-schema/{resource_type}")
async def get_type_schema(
    resource_type: str,
    _: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Form JSON Schema + ui-schema for a type, from its ACTIVE ServiceDefinition.

    Returns an empty schema when the type has no active definition yet, so the
    request form renders (nothing to fill) rather than erroring.
    """
    d = await service_def.resolve(session, resource_type)
    if d is None:
        return {"resource_type": resource_type, "form_schema": {"properties": {}}, "ui_schema": {}}
    return {
        "resource_type": resource_type,
        "form_schema": d.form_schema,
        "ui_schema": d.ui_schema,
        "version": d.version,
    }
