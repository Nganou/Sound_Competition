"""
Celery tasks for background audio processing.
"""
import asyncio
import httpx

from app.worker import celery_app
from app.core.fingerprint import (
    generate_chromaprint,
    chromaprint_to_bytes,
    bytes_to_chromaprint,
    extract_feature_vector,
    is_exact_duplicate,
    classify_similarity,
    PLAGIARISM_SIMILARITY_THRESHOLD,
    COLLAB_SIMILARITY_THRESHOLD,
)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def fingerprint_track(self, track_id: str, audio_url: str):
    """
    Three-stage fingerprint pipeline:
      Stage 1: Chromaprint — exact duplicate detection
      Stage 2: librosa feature vector — similarity analysis
      Stage 3: Store results; create similarity_reports (done inline here)
    """
    try:
        asyncio.run(_run_fingerprint(track_id, audio_url))
    except Exception as exc:
        raise self.retry(exc=exc)


async def _run_fingerprint(track_id: str, audio_url: str):
    import uuid
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy import select, update
    from app.config import settings
    from app.db.models.fingerprint import (
        TrackFingerprint, FingerprintStatus, SimilarityReport, SimilarityReportType,
    )

    from app.db.base import _build_engine_args
    _db_url, _connect_args = _build_engine_args(settings.database_url)
    engine = create_async_engine(_db_url, echo=False, connect_args=_connect_args)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(audio_url)
        audio_bytes = response.content

    async with factory() as db:
        track_uuid = uuid.UUID(track_id)

        # Stage 1: Chromaprint
        try:
            duration, fp_ints = generate_chromaprint(audio_bytes)
            fp_bytes = chromaprint_to_bytes(fp_ints)
        except Exception:
            fp_ints, fp_bytes, duration = [], b"", 0.0

        # Check for exact duplicates
        if fp_ints:
            all_fps = await db.execute(
                select(TrackFingerprint)
                .where(
                    TrackFingerprint.track_id != track_uuid,
                    TrackFingerprint.fingerprint_status == FingerprintStatus.done,
                    TrackFingerprint.chromaprint != None,
                )
            )
            for existing_fp in all_fps.scalars().all():
                existing_ints = bytes_to_chromaprint(existing_fp.chromaprint)
                if is_exact_duplicate(fp_ints, existing_ints):
                    db.add(SimilarityReport(
                        source_track_id=track_uuid,
                        target_track_id=existing_fp.track_id,
                        similarity_score=1.0,
                        report_type=SimilarityReportType.exact_duplicate,
                    ))

        # Stage 2: librosa feature vector
        feature_vector = extract_feature_vector(audio_bytes)

        # Update fingerprint row
        await db.execute(
            update(TrackFingerprint)
            .where(TrackFingerprint.track_id == track_uuid)
            .values(
                chromaprint=fp_bytes or None,
                fingerprint_duration=duration or None,
                fingerprint_status=FingerprintStatus.done,
                error_message=None,
            )
        )

        # Stage 3: pgvector similarity search (if feature_vector available)
        if feature_vector:
            # Raw SQL for pgvector cosine similarity
            from sqlalchemy import text
            vec_str = "[" + ",".join(str(v) for v in feature_vector) + "]"
            similar_rows = await db.execute(
                text(
                    """
                    SELECT tf.track_id,
                           1 - (tf.feature_vector_v <=> CAST(:vec AS vector)) AS score
                    FROM track_fingerprints tf
                    WHERE tf.track_id <> :tid
                      AND tf.feature_vector_v IS NOT NULL
                    ORDER BY tf.feature_vector_v <=> CAST(:vec AS vector)
                    LIMIT 20
                    """
                ),
                {"vec": vec_str, "tid": track_uuid},
            )
            for row in similar_rows:
                score = float(row.score)
                report_type_str = classify_similarity(score)
                if report_type_str:
                    db.add(SimilarityReport(
                        source_track_id=track_uuid,
                        target_track_id=row.track_id,
                        similarity_score=score,
                        report_type=report_type_str,
                    ))

            # Update feature vector in DB via raw SQL
            await db.execute(
                text("UPDATE track_fingerprints SET feature_vector_v = CAST(:vec AS vector) WHERE track_id = :tid"),
                {"vec": vec_str, "tid": track_uuid},
            )

        await db.commit()

    await engine.dispose()
