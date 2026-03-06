import uuid
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, update

from app.dependencies import DbDep, CurrentUser, CurrentUserOptional, Pagination
from app.db.models.track import Track, Tag, TrackTag, TrackLike
from app.db.models.fingerprint import TrackFingerprint, FingerprintStatus
from app.schemas.track import TrackCreate, TrackUpdate, TrackPublic, TrackDetail, UploadParams
from app.schemas.social import CommentCreate, CommentPublic
from app.core.cloudinary_client import get_signed_upload_params

router = APIRouter()


@router.get("/upload-params", response_model=UploadParams)
async def get_upload_params(current_user: CurrentUser):
    """Return signed params so Angular can upload directly to Cloudinary."""
    return get_signed_upload_params(folder=f"tracks/{current_user.id}")


@router.post("", response_model=TrackDetail, status_code=status.HTTP_201_CREATED)
async def create_track(body: TrackCreate, current_user: CurrentUser, db: DbDep):
    track = Track(
        artist_id=current_user.id,
        title=body.title,
        description=body.description,
        genre=body.genre,
        bpm=body.bpm,
        cloudinary_public_id=body.cloudinary_public_id,
        audio_url=body.audio_url,
        waveform_url=body.waveform_url,
        duration_seconds=body.duration_seconds,
        file_size_bytes=body.file_size_bytes,
    )
    db.add(track)
    await db.flush()  # get track.id before committing

    # Resolve / create tags
    for tag_name in body.tags:
        tag_name = tag_name.lower().strip()
        result = await db.execute(select(Tag).where(Tag.name == tag_name))
        tag = result.scalar_one_or_none()
        if not tag:
            tag = Tag(name=tag_name)
            db.add(tag)
            await db.flush()
        db.add(TrackTag(track_id=track.id, tag_id=tag.id))

    # Enqueue fingerprint job
    fp = TrackFingerprint(track_id=track.id, fingerprint_status=FingerprintStatus.pending)
    db.add(fp)

    await db.commit()
    await db.refresh(track)

    # Enqueue Celery fingerprint task (non-blocking)
    try:
        from app.workers.tasks import fingerprint_track
        fingerprint_track.delay(str(track.id), track.audio_url)
    except Exception:
        pass  # Worker unavailable in dev — fingerprint pending

    return _track_detail(track, None, False)


@router.get("/{track_id}", response_model=TrackDetail)
async def get_track(track_id: uuid.UUID, db: DbDep, current_user: CurrentUserOptional):
    track = await _get_track_or_404(track_id, db)
    fp = await db.execute(select(TrackFingerprint).where(TrackFingerprint.track_id == track_id))
    fingerprint = fp.scalar_one_or_none()
    is_liked = False
    if current_user:
        like = await db.execute(
            select(TrackLike).where(TrackLike.user_id == current_user.id, TrackLike.track_id == track_id)
        )
        is_liked = like.scalar_one_or_none() is not None
        # Increment play count (debounced by Redis in production)
        await db.execute(
            update(Track).where(Track.id == track_id).values(play_count=Track.play_count + 1)
        )
        await db.commit()
    return _track_detail(track, fingerprint, is_liked)


@router.put("/{track_id}", response_model=TrackPublic)
async def update_track(track_id: uuid.UUID, body: TrackUpdate, current_user: CurrentUser, db: DbDep):
    track = await _get_track_or_404(track_id, db)
    if track.artist_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your track")
    for field, value in body.model_dump(exclude_unset=True, exclude={"tags"}).items():
        setattr(track, field, value)
    if body.tags is not None:
        # Reset tags
        await db.execute(
            TrackTag.__table__.delete().where(TrackTag.track_id == track_id)
        )
        for tag_name in body.tags:
            tag_name = tag_name.lower().strip()
            result = await db.execute(select(Tag).where(Tag.name == tag_name))
            tag = result.scalar_one_or_none()
            if not tag:
                tag = Tag(name=tag_name)
                db.add(tag)
                await db.flush()
            db.add(TrackTag(track_id=track.id, tag_id=tag.id))
    await db.commit()
    await db.refresh(track)
    return track


@router.delete("/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_track(track_id: uuid.UUID, current_user: CurrentUser, db: DbDep):
    track = await _get_track_or_404(track_id, db)
    if track.artist_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your track")
    from app.core.cloudinary_client import delete_asset
    delete_asset(track.cloudinary_public_id)
    await db.delete(track)
    await db.commit()


@router.post("/{track_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def like_track(track_id: uuid.UUID, current_user: CurrentUser, db: DbDep):
    await _get_track_or_404(track_id, db)
    existing = await db.execute(
        select(TrackLike).where(TrackLike.user_id == current_user.id, TrackLike.track_id == track_id)
    )
    if not existing.scalar_one_or_none():
        db.add(TrackLike(user_id=current_user.id, track_id=track_id))
        await db.execute(
            update(Track).where(Track.id == track_id).values(like_count=Track.like_count + 1)
        )
        await db.commit()


@router.delete("/{track_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def unlike_track(track_id: uuid.UUID, current_user: CurrentUser, db: DbDep):
    existing = await db.execute(
        select(TrackLike).where(TrackLike.user_id == current_user.id, TrackLike.track_id == track_id)
    )
    like = existing.scalar_one_or_none()
    if like:
        await db.delete(like)
        await db.execute(
            update(Track).where(Track.id == track_id).values(like_count=Track.like_count - 1)
        )
        await db.commit()


@router.get("/{track_id}/comments", response_model=list[CommentPublic])
async def get_track_comments(track_id: uuid.UUID, db: DbDep, pagination: Pagination):
    from app.db.models.social import Comment
    result = await db.execute(
        select(Comment)
        .where(Comment.track_id == track_id, Comment.parent_id == None)
        .order_by(Comment.created_at.desc())
        .offset(pagination["skip"])
        .limit(pagination["limit"])
    )
    return result.scalars().all()


@router.post("/{track_id}/comments", response_model=CommentPublic, status_code=status.HTTP_201_CREATED)
async def add_track_comment(track_id: uuid.UUID, body: CommentCreate, current_user: CurrentUser, db: DbDep):
    from app.db.models.social import Comment
    await _get_track_or_404(track_id, db)
    comment = Comment(author_id=current_user.id, body=body.body, track_id=track_id, parent_id=body.parent_id)
    db.add(comment)
    await db.execute(update(Track).where(Track.id == track_id).values(comment_count=Track.comment_count + 1))
    await db.commit()
    await db.refresh(comment)
    return comment


@router.get("/{track_id}/fingerprint")
async def get_fingerprint_status(track_id: uuid.UUID, db: DbDep):
    from app.db.models.fingerprint import SimilarityReport
    fp = await db.execute(select(TrackFingerprint).where(TrackFingerprint.track_id == track_id))
    fingerprint = fp.scalar_one_or_none()
    if not fingerprint:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fingerprint not found")

    reports = await db.execute(
        select(SimilarityReport).where(SimilarityReport.source_track_id == track_id)
    )
    return {
        "status": fingerprint.fingerprint_status,
        "similarity_reports": [
            {"report_type": r.report_type, "similarity_score": r.similarity_score, "target_track_id": str(r.target_track_id)}
            for r in reports.scalars().all()
        ],
    }


async def _get_track_or_404(track_id: uuid.UUID, db) -> Track:
    result = await db.execute(select(Track).where(Track.id == track_id))
    track = result.scalar_one_or_none()
    if not track:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Track not found")
    return track


def _track_detail(track: Track, fingerprint, is_liked: bool) -> TrackDetail:
    return TrackDetail.model_validate({
        **track.__dict__,
        "fingerprint_status": fingerprint.fingerprint_status if fingerprint else None,
        "is_liked": is_liked,
    })
