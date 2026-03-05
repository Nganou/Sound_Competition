import uuid
from datetime import date, datetime
from pydantic import BaseModel
from app.schemas.user import UserPublic
from app.schemas.track import TrackPublic


class TournamentCreate(BaseModel):
    title: str
    description: str | None = None
    voting_enabled: bool = True
    start_date: date | None = None
    end_date: date | None = None


class TournamentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    voting_enabled: bool | None = None
    start_date: date | None = None
    end_date: date | None = None


class ParticipantPublic(BaseModel):
    user: UserPublic
    track: TrackPublic | None
    score: int
    wins: int
    losses: int
    draws: int
    matches_played: int
    is_eliminated: bool

    model_config = {"from_attributes": True}


class StandingsEntry(BaseModel):
    rank: int
    participant: ParticipantPublic


class TournamentPublic(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    banner_url: str | None
    status: str
    voting_enabled: bool
    current_round: int
    total_rounds: int | None
    start_date: date | None
    end_date: date | None
    organizer: UserPublic
    participant_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class TournamentDetail(TournamentPublic):
    standings: list[StandingsEntry] = []
