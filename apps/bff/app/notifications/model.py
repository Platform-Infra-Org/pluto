"""Notification row — the system of record (E07).

`user_id` is a recipient *key*: either a user's `sub` or an owner-team name.
The BFF has no user directory to expand a team to member subs, so team-scoped
notifications (APPROVAL_NEEDED) are addressed to the team and every member sees
them by listing on their sub + teams. Read-state is therefore shared per team —
fine for v1 (once one approver handles it, it's handled).
"""

from datetime import datetime

from sqlalchemy import DateTime, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Notification(Base):
    __tablename__ = "notification"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(index=True)  # user sub OR team name
    type: Mapped[str]  # APPROVAL_NEEDED | REQUEST_APPROVED | ... | WORKFLOW_FAILED
    request_id: Mapped[int | None] = mapped_column(default=None)  # link back
    title: Mapped[str]
    body: Mapped[str] = mapped_column(default="")
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Unread-inbox query: filter by recipient, newest first.
    __table_args__ = (Index("ix_notification_user_created", "user_id", "created_at"),)
