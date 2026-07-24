from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Group(Base):
    """A local groups-registry entry (F3). Groups usually come from Keycloak/LDAP
    via the OIDC `groups` claim; imported groups live here so admins can manage
    them and map projects to them. `source` is e.g. "import" or "ldap".
    """

    __tablename__ = "group_registry"  # "group" is reserved in SQL

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)
    source: Mapped[str] = mapped_column(default="import")
    description: Mapped[str | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
