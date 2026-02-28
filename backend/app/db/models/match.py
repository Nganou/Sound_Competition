import uuid
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, Index, Enum as SAEnum, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.db.base import Base, TimestampMixin


class MatchResultStatus(str, enum.Enum):
    pending = "pending"
    track_a_wins = "track_a_wins"
    track_b_wins = "track_b_wins"
    draw = "draw"


class Match(Base, TimestampMixin):
    """Evolved from T_MATCHES — adds community voting, round tracking."""
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Participants (track_a / track_b = the two sides of a battle)
    participant_a_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    participant_b_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True  # None = bye round
    )
    track_a_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True
    )
    track_b_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True
    )

    result_status: Mapped[MatchResultStatus] = mapped_column(
        SAEnum(MatchResultStatus, name="match_result_status"),
        default=MatchResultStatus.pending,
        nullable=False,
    )

    # Community voting
    vote_a_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    vote_b_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    voting_closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    tournament: Mapped["Tournament"] = relationship(back_populates="matches")  # noqa: F821
    participant_a: Mapped["User"] = relationship(foreign_keys=[participant_a_id], lazy="joined")  # noqa: F821
    participant_b: Mapped["User | None"] = relationship(foreign_keys=[participant_b_id], lazy="joined")  # noqa: F821
    track_a: Mapped["Track | None"] = relationship(foreign_keys=[track_a_id], lazy="joined")  # noqa: F821
    track_b: Mapped["Track | None"] = relationship(foreign_keys=[track_b_id], lazy="joined")  # noqa: F821
    votes: Mapped[list["BattleVote"]] = relationship(back_populates="match", lazy="noload")
    comments: Mapped[list["Comment"]] = relationship(  # noqa: F821
        foreign_keys="Comment.match_id", back_populates="match", lazy="noload"
    )

    __table_args__ = (
        Index("ix_matches_tournament_round", "tournament_id", "round_number"),
    )


class BattleVote(Base, TimestampMixin):
    """One vote per user per battle."""
    __tablename__ = "battle_votes"

    match_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("matches.id", ondelete="CASCADE"), primary_key=True
    )
    voter_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    voted_for: Mapped[str] = mapped_column(String(1), nullable=False)  # "a" or "b"

    match: Mapped["Match"] = relationship(back_populates="votes")
    voter: Mapped["User"] = relationship(lazy="joined")  # noqa: F821
