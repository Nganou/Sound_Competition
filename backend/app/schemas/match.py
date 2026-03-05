import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator
from app.schemas.user import UserPublic
from app.schemas.track import TrackPublic


class MatchPublic(BaseModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    round_number: int
    participant_a: UserPublic
    participant_b: UserPublic | None
    track_a: TrackPublic | None
    track_b: TrackPublic | None
    result_status: str
    vote_a_count: int
    vote_b_count: int
    voting_closes_at: datetime | None
    created_at: datetime
    user_vote: str | None = None  # "a", "b", or None

    model_config = {"from_attributes": True}


class VoteRequest(BaseModel):
    voted_for: str

    @field_validator("voted_for")
    @classmethod
    def must_be_a_or_b(cls, v: str) -> str:
        if v not in ("a", "b"):
            raise ValueError("voted_for must be 'a' or 'b'")
        return v


class ReportMatchRequest(BaseModel):
    result: str  # "track_a_wins" | "track_b_wins" | "draw"

    @field_validator("result")
    @classmethod
    def valid_result(cls, v: str) -> str:
        valid = {"track_a_wins", "track_b_wins", "draw"}
        if v not in valid:
            raise ValueError(f"result must be one of {valid}")
        return v
