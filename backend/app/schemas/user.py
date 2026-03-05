import uuid
from datetime import datetime
from pydantic import BaseModel


class UserPublic(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str | None
    avatar_url: str | None
    location: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfile(UserPublic):
    bio: str | None
    is_verified: bool


class UserUpdate(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    location: str | None = None
    avatar_url: str | None = None


class UserStats(BaseModel):
    track_count: int
    follower_count: int
    following_count: int
    total_likes_received: int
    tournament_wins: int
