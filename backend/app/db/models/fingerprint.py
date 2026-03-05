import uuid
from sqlalchemy import String, Float, ForeignKey, Index, LargeBinary, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Enum as SAEnum
from pgvector.sqlalchemy import Vector
import enum

from app.db.base import Base, TimestampMixin


FEATURE_VECTOR_DIM = 128


class FingerprintStatus(str, enum.Enum):
    pending = "pending"
    done = "done"
    failed = "failed"


class SimilarityReportType(str, enum.Enum):
    exact_duplicate = "exact_duplicate"
    plagiarism_flag = "plagiarism_flag"
    collaboration_match = "collaboration_match"


class SimilarityReportStatus(str, enum.Enum):
    pending = "pending"
    reviewed = "reviewed"
    dismissed = "dismissed"


class TrackFingerprint(Base, TimestampMixin):
    __tablename__ = "track_fingerprints"

    track_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"), primary_key=True
    )
    chromaprint: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    fingerprint_duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    feature_vector: Mapped[list[float] | None] = mapped_column(
        Vector(FEATURE_VECTOR_DIM), nullable=True
    )
    fingerprint_status: Mapped[FingerprintStatus] = mapped_column(
        SAEnum(FingerprintStatus, name="fingerprint_status"),
        default=FingerprintStatus.pending,
        nullable=False,
        index=True,
    )
    error_message: Mapped[str | None] = mapped_column(String(512), nullable=True)

    track: Mapped["Track"] = relationship(back_populates="fingerprint")  # noqa: F821

    __table_args__ = (
        # HNSW index created via Alembic raw SQL (pgvector syntax not supported by SA DDL)
    )


class SimilarityReport(Base, TimestampMixin):
    __tablename__ = "similarity_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_track_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_track_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False
    )
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    report_type: Mapped[SimilarityReportType] = mapped_column(
        SAEnum(SimilarityReportType, name="similarity_report_type"), nullable=False
    )
    status: Mapped[SimilarityReportStatus] = mapped_column(
        SAEnum(SimilarityReportStatus, name="similarity_report_status"),
        default=SimilarityReportStatus.pending,
        nullable=False,
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    source_track: Mapped["Track"] = relationship(foreign_keys=[source_track_id], lazy="joined")  # noqa: F821
    target_track: Mapped["Track"] = relationship(foreign_keys=[target_track_id], lazy="joined")  # noqa: F821
