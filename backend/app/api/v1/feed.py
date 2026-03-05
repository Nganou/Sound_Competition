from fastapi import APIRouter
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta, timezone

from app.dependencies import DbDep, CurrentUser, Pagination
from app.db.models.track import Track, TrackLike
from app.db.models.tournament import Tournament, TournamentStatus
from app.db.models.user import User, Follow
from app.db.models.fingerprint import SimilarityReport, SimilarityReportType
from app.schemas.track import TrackPublic
from app.schemas.tournament import TournamentPublic
from app.schemas.user import UserPublic
from app.schemas.feed import FeedResponse, SimilarTrackResult

router = APIRouter()


@router.get("/", response_model=FeedResponse)
async def get_feed(current_user: CurrentUser, db: DbDep):
    trending = await _trending_tracks(db, limit=10)
    active_tournaments = await _active_tournaments(db, limit=5)
    following_tracks = await _following_feed(current_user.id, db, limit=10)
    suggested = await _suggested_artists(current_user.id, db, limit=6)

    return FeedResponse(
        trending_tracks=trending,
        active_tournaments=active_tournaments,
        following_tracks=following_tracks,
        suggested_artists=suggested,
    )


@router.get("/trending", response_model=list[TrackPublic])
async def trending(db: DbDep, pagination: Pagination):
    return await _trending_tracks(db, pagination["limit"], pagination["skip"])


@router.get("/following", response_model=list[TrackPublic])
async def following_feed(current_user: CurrentUser, db: DbDep, pagination: Pagination):
    return await _following_feed(current_user.id, db, pagination["limit"], pagination["skip"])


@router.get("/search", response_model=list[TrackPublic])
async def search_tracks(q: str, db: DbDep, pagination: Pagination):
    """Full-text search across track titles and descriptions."""
    rows = await db.execute(
        select(Track)
        .where(
            Track.is_public == True,
            text("to_tsvector('english', title || ' ' || coalesce(description,'')) @@ plainto_tsquery('english', :q)")
        )
        .order_by(Track.play_count.desc())
        .offset(pagination["skip"])
        .limit(pagination["limit"])
        .params(q=q)
    )
    return rows.scalars().all()


@router.get("/search/similar", response_model=list[SimilarTrackResult])
async def similar_tracks(track_id: str, db: DbDep, pagination: Pagination):
    """Find tracks with similar sonic fingerprints (collaboration_match type)."""
    import uuid
    rows = await db.execute(
        select(SimilarityReport)
        .where(
            SimilarityReport.source_track_id == uuid.UUID(track_id),
            SimilarityReport.report_type == SimilarityReportType.collaboration_match,
        )
        .order_by(SimilarityReport.similarity_score.desc())
        .offset(pagination["skip"])
        .limit(pagination["limit"])
    )
    results = []
    for report in rows.scalars().all():
        track_row = await db.execute(select(Track).where(Track.id == report.target_track_id))
        track = track_row.scalar_one_or_none()
        if track:
            results.append(SimilarTrackResult(
                track=TrackPublic.model_validate(track),
                similarity_score=report.similarity_score,
                report_type=report.report_type,
            ))
    return results


async def _trending_tracks(db, limit: int = 10, skip: int = 0) -> list[Track]:
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    rows = await db.execute(
        select(Track)
        .where(Track.is_public == True, Track.created_at >= week_ago)
        .order_by((Track.play_count * 0.3 + Track.like_count * 0.7).desc())
        .offset(skip)
        .limit(limit)
    )
    return rows.scalars().all()


async def _active_tournaments(db, limit: int = 5) -> list[Tournament]:
    rows = await db.execute(
        select(Tournament)
        .where(Tournament.status == TournamentStatus.active)
        .order_by(Tournament.created_at.desc())
        .limit(limit)
    )
    return rows.scalars().all()


async def _following_feed(user_id, db, limit: int = 10, skip: int = 0) -> list[Track]:
    rows = await db.execute(
        select(Track)
        .join(Follow, Follow.following_id == Track.artist_id)
        .where(Follow.follower_id == user_id, Track.is_public == True)
        .order_by(Track.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return rows.scalars().all()


async def _suggested_artists(user_id, db, limit: int = 6) -> list[User]:
    """Artists not yet followed — ordered by total likes received."""
    rows = await db.execute(
        select(User)
        .where(
            User.id != user_id,
            User.is_active == True,
            ~User.id.in_(
                select(Follow.following_id).where(Follow.follower_id == user_id)
            ),
        )
        .order_by(User.created_at.desc())
        .limit(limit)
    )
    return rows.scalars().all()
