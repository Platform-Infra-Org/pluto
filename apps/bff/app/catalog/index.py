"""Upsert/query the resource catalog index. Git is authoritative; this is cache."""

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.principal import Principal
from app.models.resource import ResourceIndex

ADMIN_ROLES = {"platform-admin", "auditor"}


async def upsert(
    session: AsyncSession,
    *,
    type: str,
    name: str,
    owner_team: str,
    git_path: str,
    git_sha: str,
    payload: dict,
    status: str,
) -> None:
    stmt = insert(ResourceIndex).values(
        type=type,
        name=name,
        owner_team=owner_team,
        git_path=git_path,
        git_sha=git_sha,
        payload=payload,
        status=status,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_resource_type_name",
        set_={
            "owner_team": owner_team,
            "git_path": git_path,
            "git_sha": git_sha,
            "payload": payload,
            "status": status,
        },
    )
    await session.execute(stmt)


async def delete_missing(session: AsyncSession, seen_paths: set[str]) -> int:
    """Delete index rows whose git_path is no longer present in the repo."""
    result = await session.execute(
        delete(ResourceIndex).where(ResourceIndex.git_path.not_in(seen_paths))
    )
    return result.rowcount or 0


def _visible(stmt, principal: Principal):
    """RBAC visibility, enforced in SQL: admins/auditors see all; others only
    resources whose owner_team is one of their teams."""
    if principal.roles & ADMIN_ROLES:
        return stmt
    return stmt.where(ResourceIndex.owner_team.in_(principal.teams or [""]))


async def list_resources(
    session: AsyncSession,
    principal: Principal,
    *,
    type: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> list[ResourceIndex]:
    stmt = _visible(select(ResourceIndex), principal)
    if type:
        stmt = stmt.where(ResourceIndex.type == type)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(ResourceIndex.name.ilike(like) | ResourceIndex.owner_team.ilike(like))
    stmt = stmt.order_by(ResourceIndex.type, ResourceIndex.name)
    stmt = stmt.limit(page_size).offset((page - 1) * page_size)
    return list((await session.execute(stmt)).scalars())


async def get_resource(
    session: AsyncSession, principal: Principal, resource_id: int
) -> ResourceIndex | None:
    stmt = _visible(select(ResourceIndex).where(ResourceIndex.id == resource_id), principal)
    return (await session.execute(stmt)).scalar_one_or_none()
