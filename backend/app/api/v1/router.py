from fastapi import APIRouter
from app.api.v1 import auth, users, tracks, tournaments, matches, social, feed

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(tracks.router, prefix="/tracks", tags=["tracks"])
api_router.include_router(tournaments.router, prefix="/tournaments", tags=["tournaments"])
api_router.include_router(matches.router, prefix="/matches", tags=["matches"])
api_router.include_router(social.router, prefix="/social", tags=["social"])
api_router.include_router(feed.router, prefix="/feed", tags=["feed"])
