"""Service Definition model + pin-until-migrated versioning (E08 Task 1).

A `ServiceDefinition` is the unit the builder produces: the form JSON Schema +
ui-schema + workflow binding + default approval policy for one requestable
resource type. It formalizes the E05/E06 seams: `type_schema`, `definition_default`
(approval policy) and `resolve_binding` all read from the ACTIVE definition.

Versioning is **pin-until-migrated**: each `(name, version)` is its own row.
Approving an edit creates a NEW version row; existing resources record the
`definition_version` they were created under and keep resolving *that* row, so a
form edit never retroactively invalidates live resources. `retire` is blocked
while any resource of the type still exists.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.resource import ResourceIndex

DRAFT = "DRAFT"
PENDING_ONBOARDING = "PENDING_ONBOARDING"
ACTIVE = "ACTIVE"
RETIRED = "RETIRED"


class ServiceDefinition(Base):
    __tablename__ = "service_definition"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(index=True)  # == resource_type
    category: Mapped[str] = mapped_column(default="")
    owner_team: Mapped[str] = mapped_column(default="")
    form_schema: Mapped[dict] = mapped_column(JSONB, default=dict)
    ui_schema: Mapped[dict] = mapped_column(JSONB, default=dict)
    # {create/update/delete: {template_ref, param_map}}
    workflow_binding: Mapped[dict] = mapped_column(JSONB, default=dict)
    # {mode: SINGLE|N_OF_M|RBAC, n?}
    approval_policy: Mapped[dict] = mapped_column(JSONB, default=dict)
    # CB04: per-verb composed graphs {create?,update?,delete?} (only defined verbs),
    # the regenerated artifacts, and the block versions each node was wired against.
    graphs: Mapped[dict] = mapped_column(JSONB, default=dict)
    generated: Mapped[dict] = mapped_column(JSONB, default=dict)  # {build_json_j2, workflow_template_yaml}
    block_versions: Mapped[dict] = mapped_column(JSONB, default=dict)  # {block_name: pinned_version}
    git_path: Mapped[str] = mapped_column(default="")
    status: Mapped[str] = mapped_column(default=DRAFT)
    version: Mapped[int] = mapped_column(default=1)


class RetireBlocked(Exception):
    """Retire attempted while resources of the type still exist (API -> 409)."""


async def next_version(session: AsyncSession, name: str) -> int:
    """The version number a new definition row for `name` should take."""
    cur = await session.scalar(
        select(func.max(ServiceDefinition.version)).where(ServiceDefinition.name == name)
    )
    return (cur or 0) + 1


async def resolve(
    session: AsyncSession, resource_type: str, version: int | None = None
) -> ServiceDefinition | None:
    """Pin-until-migrated lookup.

    `version` given -> that exact row (a resource resolves against its pinned
    version). `version=None` -> the latest ACTIVE definition (new requests use it).
    """
    stmt = select(ServiceDefinition).where(ServiceDefinition.name == resource_type)
    if version is not None:
        stmt = stmt.where(ServiceDefinition.version == version)
    else:
        stmt = stmt.where(ServiceDefinition.status == ACTIVE).order_by(
            ServiceDefinition.version.desc()
        )
    return await session.scalar(stmt.limit(1))


# --- E05/E06 seam formalization -------------------------------------------
# These replace the config stubs (`policy.definition_default`,
# `schema_forms.type_schema`, `binding.resolve_binding`) by reading the resource
# type's ACTIVE (or pinned) ServiceDefinition. Each falls back to the old default
# when no definition is onboarded yet, so dynamic types still work pre-onboarding.

_DEFAULT_PAYLOAD_SCHEMA: dict = {
    "type": "object",
    "required": ["spec"],
    "properties": {"spec": {"type": "object"}},
}


async def effective_policy(
    session: AsyncSession, resource_type: str, version: int | None = None
) -> dict:
    """The type's default approval policy from its definition, else SINGLE."""
    d = await resolve(session, resource_type, version)
    return d.approval_policy if d and d.approval_policy else {"mode": "SINGLE"}


async def payload_schema(
    session: AsyncSession, resource_type: str, version: int | None = None
) -> dict:
    """JSON Schema for the request payload: the form schema wrapped under `spec`."""
    d = await resolve(session, resource_type, version)
    if not d or not d.form_schema:
        return _DEFAULT_PAYLOAD_SCHEMA
    return {
        "type": "object",
        "required": ["spec"],
        "properties": {"spec": d.form_schema},
    }


async def effective_binding(
    session: AsyncSession, resource_type: str, action: str, version: int | None = None
) -> dict | None:
    """The workflow binding for one action from the definition, else None."""
    d = await resolve(session, resource_type, version)
    if not d or not d.workflow_binding:
        return None
    return d.workflow_binding.get(action.lower())


async def retire(session: AsyncSession, resource_type: str) -> None:
    """Retire a type. Blocked (409) while any resource of the type still exists."""
    live = await session.scalar(
        select(func.count())
        .select_from(ResourceIndex)
        .where(ResourceIndex.type == resource_type)
    )
    if live:
        raise RetireBlocked(
            f"{live} resource(s) of type {resource_type!r} exist; remove them first"
        )
    rows = (
        await session.scalars(
            select(ServiceDefinition).where(ServiceDefinition.name == resource_type)
        )
    ).all()
    for row in rows:
        row.status = RETIRED
    await session.commit()
