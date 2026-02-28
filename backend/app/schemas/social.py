import uuid
from datetime import datetime
from pydantic import BaseModel
from app.schemas.user import UserPublic
from app.schemas.track import TrackPublic


class CommentCreate(BaseModel):
    body: str
    parent_id: uuid.UUID | None = None


class CommentPublic(BaseModel):
    id: uuid.UUID
    body: str
    author: UserPublic
    parent_id: uuid.UUID | None
    track_id: uuid.UUID | None
    match_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CollabRequestCreate(BaseModel):
    recipient_id: uuid.UUID
    track_id: uuid.UUID | None = None
    message: str | None = None


class CollabRequestPublic(BaseModel):
    id: uuid.UUID
    requester: UserPublic
    recipient: UserPublic
    track: TrackPublic | None
    message: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationPublic(BaseModel):
    id: uuid.UUID
    notification_type: str
    payload: dict
    is_read: bool
    created_at: str

    model_config = {"from_attributes": True}
