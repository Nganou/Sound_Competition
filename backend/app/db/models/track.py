import uuid
from sqlalchemy import String, Integer, Float, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base, TimestampMixin


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    tracks: Mapped[list["Track"]] = relationship(secondary="track_tags", back_populates="tags", lazy="selectin")


class TrackTag(Base):
    __tablename__ = "track_tags"

    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)


class TrackLike(Base, TimestampMixin):
    __tablename__ = "track_likes"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"), primary_key=True)


class Track(Base, TimestampMixin):
    __tablename__ = "tracks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artist_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    genre: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bpm: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Cloudinary fields
    cloudinary_public_id: Mapped[str] = mapped_column(String(512), nullable=False)
    audio_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    waveform_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Stats
    play_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_public: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationships
    artist: Mapped["User"] = relationship(back_populates="tracks", lazy="joined")  # noqa: F821
    tags: Mapped[list["Tag"]] = relationship(secondary="track_tags", back_populates="tracks", lazy="selectin")
    likes: Mapped[list["TrackLike"]] = relationship(lazy="noload")
    comments: Mapped[list["Comment"]] = relationship(  # noqa: F821
        foreign_keys="Comment.track_id", back_populates="track", lazy="noload"
    )
    fingerprint: Mapped["TrackFingerprint | None"] = relationship(  # noqa: F821
        back_populates="track", lazy="noload", uselist=False
    )

    __table_args__ = (Index("ix_tracks_play_count_desc", play_count.desc()),)
