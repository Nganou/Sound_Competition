import uuid
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, func

from app.dependencies import DbDep, CurrentUser, Pagination
from app.db.models.user import User, Follow
from app.db.models.track import Track, TrackLike
from app.schemas.user import UserProfile, UserPublic, UserUpdate, UserStats

router = APIRouter()


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: CurrentUser):
    return current_user


@router.put("/me", response_model=UserProfile)
async def update_me(body: UserUpdate, current_user: CurrentUser, db: DbDep):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/me/stats", response_model=UserStats)
async def get_my_stats(current_user: CurrentUser, db: DbDep):
    return await _get_user_stats(current_user.id, db)


@router.get("/{username}", response_model=UserProfile)
async def get_profile(username: str, db: DbDep):
    result = await db.execute(select(User).where(User.username == username, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.get("/{username}/stats", response_model=UserStats)
async def get_profile_stats(username: str, db: DbDep):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return await _get_user_stats(user.id, db)


@router.get("/{username}/followers", response_model=list[UserPublic])
async def get_followers(username: str, db: DbDep, pagination: Pagination):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    q = (
        select(User)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.following_id == user.id)
        .offset(pagination["skip"])
        .limit(pagination["limit"])
    )
    rows = await db.execute(q)
    return rows.scalars().all()


@router.get("/{username}/following", response_model=list[UserPublic])
async def get_following(username: str, db: DbDep, pagination: Pagination):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    q = (
        select(User)
        .join(Follow, Follow.following_id == User.id)
        .where(Follow.follower_id == user.id)
        .offset(pagination["skip"])
        .limit(pagination["limit"])
    )
    rows = await db.execute(q)
    return rows.scalars().all()


@router.post("/{username}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def follow_user(username: str, current_user: CurrentUser, db: DbDep):
    result = await db.execute(select(User).where(User.username == username))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot follow yourself")

    existing = await db.execute(
        select(Follow).where(Follow.follower_id == current_user.id, Follow.following_id == target.id)
    )
    if existing.scalar_one_or_none():
        return  # already following

    db.add(Follow(follower_id=current_user.id, following_id=target.id))
    await db.commit()


@router.delete("/{username}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_user(username: str, current_user: CurrentUser, db: DbDep):
    result = await db.execute(select(User).where(User.username == username))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    existing = await db.execute(
        select(Follow).where(Follow.follower_id == current_user.id, Follow.following_id == target.id)
    )
    follow = existing.scalar_one_or_none()
    if follow:
        await db.delete(follow)
        await db.commit()


async def _get_user_stats(user_id: uuid.UUID, db: DbDep) -> UserStats:
    track_count = (await db.execute(
        select(func.count()).where(Track.artist_id == user_id)
    )).scalar_one()

    follower_count = (await db.execute(
        select(func.count()).where(Follow.following_id == user_id)
    )).scalar_one()

    following_count = (await db.execute(
        select(func.count()).where(Follow.follower_id == user_id)
    )).scalar_one()

    total_likes = (await db.execute(
        select(func.count(TrackLike.user_id))
        .join(Track, Track.id == TrackLike.track_id)
        .where(Track.artist_id == user_id)
    )).scalar_one()

    return UserStats(
        track_count=track_count,
        follower_count=follower_count,
        following_count=following_count,
        total_likes_received=total_likes,
        tournament_wins=0,  # TODO: aggregate from tournament_participants
    )
