from pydantic import BaseModel
from app.schemas.track import TrackPublic
from app.schemas.user import UserPublic
from app.schemas.tournament import TournamentPublic


class FeedResponse(BaseModel):
    trending_tracks: list[TrackPublic] = []
    active_tournaments: list[TournamentPublic] = []
    suggested_artists: list[UserPublic] = []
    following_tracks: list[TrackPublic] = []


class SimilarTrackResult(BaseModel):
    track: TrackPublic
    similarity_score: float
    report_type: str
