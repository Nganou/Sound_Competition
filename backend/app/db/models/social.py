import uuid
from sqlalchemy import Text, ForeignKey, Boolean, Integer, String, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import Enum as SAEnum
import enum

from app.db.base import Base, TimestampMixin


class CollabStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class Comment(Base, TimestampMixin):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), nullable=True
    )

    # Exactly one of these must be set (enforced in service layer)
    track_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"), nullable=True, index=True
    )
    match_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("matches.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Relationships
    author: Mapped["User"] = relationship(lazy="joined")  # noqa: F821
    track: Mapped["Track | None"] = relationship(  # noqa: F821
        foreign_keys=[track_id], back_populates="comments"
    )
    match: Mapped["Match | None"] = relationship(  # noqa: F821
        foreign_keys=[match_id], back_populates="comments"
    )
    replies: Mapped[list["Comment"]] = relationship(lazy="noload")


class CollabRequest(Base, TimestampMixin):
    __tablename__ = "collab_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    track_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CollabStatus] = mapped_column(
        SAEnum(CollabStatus, name="collab_status"), default=CollabStatus.pending, nullable=False
    )

    requester: Mapped["User"] = relationship(foreign_keys=[requester_id], lazy="joined")  # noqa: F821
    recipient: Mapped["User"] = relationship(foreign_keys=[recipient_id], lazy="joined")  # noqa: F821
    track: Mapped["Track | None"] = relationship(lazy="joined")  # noqa: F821


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Flexible JSONB payload: {"actor_id": "...", "track_id": "...", "message": "..."}
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[str] = mapped_column(
        server_default="now()", nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="notifications")  # noqa: F821

    __table_args__ = (
        Index("ix_notifications_user_unread", "user_id", is_read, created_at.desc()),
    )
