import uuid
from datetime import datetime
from pydantic import BaseModel
from app.schemas.user import UserPublic


class TagSchema(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class TrackCreate(BaseModel):
    title: str
    description: str | None = None
    genre: str | None = None
    bpm: int | None = None
    cloudinary_public_id: str
    audio_url: str
    waveform_url: str | None = None
    duration_seconds: float | None = None
    file_size_bytes: int | None = None
    tags: list[str] = []


class TrackUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    genre: str | None = None
    bpm: int | None = None
    tags: list[str] | None = None
    is_public: bool | None = None


class TrackPublic(BaseModel):
    id: uuid.UUID
    title: str
    genre: str | None
    bpm: int | None
    audio_url: str
    waveform_url: str | None
    duration_seconds: float | None
    play_count: int
    like_count: int
    comment_count: int
    is_public: bool
    artist: UserPublic
    tags: list[TagSchema] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class TrackDetail(TrackPublic):
    description: str | None
    fingerprint_status: str | None = None
    is_liked: bool = False


class UploadParams(BaseModel):
    """Signed params for direct browser → Cloudinary upload."""
    signature: str
    timestamp: int
    api_key: str
    cloud_name: str
    folder: str
