from fastapi import APIRouter, Depends

from app.auth.deps import current_principal
from app.auth.principal import Principal

router = APIRouter()


@router.get("/api/me")
async def me(principal: Principal = Depends(current_principal)) -> dict:
    return {
        "sub": principal.sub,
        "username": principal.username,
        "groups": principal.groups,
        "roles": sorted(principal.roles),
        "teams": sorted(principal.teams),
    }
