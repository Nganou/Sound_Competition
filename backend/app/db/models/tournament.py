import uuid
from sqlalchemy import String, Integer, Boolean, ForeignKey, Index, Enum as SAEnum, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.db.base import Base, TimestampMixin


class TournamentStatus(str, enum.Enum):
    open = "open"
    active = "active"
    completed = "completed"


class Tournament(Base, TimestampMixin):
    __tablename__ = "tournaments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organizer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    status: Mapped[TournamentStatus] = mapped_column(
        SAEnum(TournamentStatus, name="tournament_status"), default=TournamentStatus.open, nullable=False
    )
    voting_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    total_rounds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_round: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    start_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[str | None] = mapped_column(Date, nullable=True)

    # Relationships
    organizer: Mapped["User"] = relationship(lazy="joined")  # noqa: F821
    participants: Mapped[list["TournamentParticipant"]] = relationship(
        back_populates="tournament", lazy="noload"
    )
    matches: Mapped[list["Match"]] = relationship(back_populates="tournament", lazy="noload")  # noqa: F821


class TournamentParticipant(Base, TimestampMixin):
    """Evolved from T_RESULTS — preserves score/wins/losses/draws/is_eliminated."""
    __tablename__ = "tournament_participants"

    tournament_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tournaments.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    track_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True
    )

    # Swiss-system scoring (win=3, loss=0, draw=1 — preserved from original)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    draws: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    matches_played: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_eliminated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_bye: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    tournament: Mapped["Tournament"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship(lazy="joined")  # noqa: F821
    track: Mapped["Track | None"] = relationship(lazy="joined")  # noqa: F821

    __table_args__ = (
        Index("ix_tp_tournament_score", "tournament_id", score.desc()),
    )
