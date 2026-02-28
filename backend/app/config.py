from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
import json


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "development"
    frontend_url: str = "http://localhost:4200"
    cors_origins: str = '["http://localhost:4200"]'

    # Database
    database_url: str = "postgresql+asyncpg://soundcomp:soundcomp@db:5432/soundcomp"
    database_url_sync: str = "postgresql://soundcomp:soundcomp@db:5432/soundcomp"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Cloudinary
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Celery
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.cors_origins)
        except Exception:
            return [self.cors_origins]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
