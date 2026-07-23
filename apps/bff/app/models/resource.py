from datetime import datetime

from sqlalchemy import DateTime, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ResourceIndex(Base):
    """Rebuildable cache row for one resource JSON file in the Git catalog.

    Git stays authoritative; this table is dropped/rebuilt from it. `status` is
    'active' or 'invalid' (schema-invalid files are surfaced, never dropped).
    """

    __tablename__ = "resource_index"
    __table_args__ = (UniqueConstraint("type", "name", name="uq_resource_type_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str]
    name: Mapped[str]
    owner_team: Mapped[str]
    git_path: Mapped[str]
    git_sha: Mapped[str]
    payload: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(default="active")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
