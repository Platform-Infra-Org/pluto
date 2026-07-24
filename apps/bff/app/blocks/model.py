"""FunctionBlock registry table (CB01 Task 2).

One row per onboarded function block version. The parsed+validated manifest is
stored as jsonb (source of truth for the palette/generator); `(name, version)` is
unique — a new version is a new row (mirrors ServiceDefinition pin-until-migrated).
"""

from datetime import datetime

from sqlalchemy import DateTime, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class FunctionBlock(Base):
    __tablename__ = "function_block"
    __table_args__ = (UniqueConstraint("name", "version", name="uq_function_block_name_version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(index=True)
    version: Mapped[int] = mapped_column(default=1)
    category: Mapped[str] = mapped_column(default="")
    template_ref: Mapped[str] = mapped_column(default="")
    manifest: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_by: Mapped[str] = mapped_column(default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
