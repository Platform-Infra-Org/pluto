"""Governance request + append-only audit trail (E05).

One `Request` row drives an explicit state machine; every transition writes a
`RequestEvent`. Execution fields (`workflow_ref`) exist but stay null until E06.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Request(Base):
    __tablename__ = "request"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str]  # RESOURCE_CHANGE | SERVICE_ONBOARDING
    action: Mapped[str]  # CREATE | UPDATE | DELETE
    resource_type: Mapped[str]
    resource_id: Mapped[int | None] = mapped_column(default=None)  # null for CREATE
    owner_team: Mapped[str]
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    requester: Mapped[str]
    state: Mapped[str] = mapped_column(default="PENDING_APPROVAL")
    # {mode: SINGLE|N_OF_M|RBAC, n?}
    approval_policy: Mapped[dict] = mapped_column(JSONB, default=dict)
    # [{approver_id, at, note}]
    approvals: Mapped[list] = mapped_column(JSONB, default=list)
    workflow_ref: Mapped[str | None] = mapped_column(default=None)  # set in E06
    base_git_sha: Mapped[str | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    events: Mapped[list["RequestEvent"]] = relationship(
        back_populates="request",
        order_by="RequestEvent.at",
        cascade="all, delete-orphan",
    )


class RequestEvent(Base):
    """Append-only audit record for one transition."""

    __tablename__ = "request_event"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("request.id"))
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    actor: Mapped[str]
    from_state: Mapped[str | None] = mapped_column(default=None)
    to_state: Mapped[str | None] = mapped_column(default=None)
    note: Mapped[str | None] = mapped_column(default=None)
    flags: Mapped[list] = mapped_column(JSONB, default=list)

    request: Mapped[Request] = relationship(back_populates="events")
