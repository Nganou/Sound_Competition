import uuid
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, update

from app.dependencies import DbDep, CurrentUser, Pagination
from app.db.models.social import Notification, CollabRequest, CollabStatus
from app.schemas.social import (
    CollabRequestCreate, CollabRequestPublic, NotificationPublic,
)

router = APIRouter()


# ── Notifications ─────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=list[NotificationPublic])
async def get_notifications(current_user: CurrentUser, db: DbDep, pagination: Pagination, unread_only: bool = False):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        q = q.where(Notification.is_read == False)
    q = q.order_by(Notification.created_at.desc()).offset(pagination["skip"]).limit(pagination["limit"])
    rows = await db.execute(q)
    return rows.scalars().all()


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(current_user: CurrentUser, db: DbDep):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(notification_id: uuid.UUID, current_user: CurrentUser, db: DbDep):
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )
    n = result.scalar_one_or_none()
    if n:
        n.is_read = True
        await db.commit()


# ── Collaboration Requests ────────────────────────────────────────────────────

@router.post("/collab", response_model=CollabRequestPublic, status_code=status.HTTP_201_CREATED)
async def send_collab_request(body: CollabRequestCreate, current_user: CurrentUser, db: DbDep):
    if body.recipient_id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot send collab request to yourself")

    req = CollabRequest(
        requester_id=current_user.id,
        recipient_id=body.recipient_id,
        track_id=body.track_id,
        message=body.message,
    )
    db.add(req)

    # Notify recipient
    db.add(Notification(
        user_id=body.recipient_id,
        notification_type="collab_request",
        payload={"requester_id": str(current_user.id), "requester_username": current_user.username},
    ))

    await db.commit()
    await db.refresh(req)
    return req


@router.get("/collab", response_model=list[CollabRequestPublic])
async def get_collab_requests(current_user: CurrentUser, db: DbDep, pagination: Pagination):
    rows = await db.execute(
        select(CollabRequest)
        .where(CollabRequest.recipient_id == current_user.id)
        .order_by(CollabRequest.created_at.desc())
        .offset(pagination["skip"])
        .limit(pagination["limit"])
    )
    return rows.scalars().all()


@router.post("/collab/{request_id}/accept", response_model=CollabRequestPublic)
async def accept_collab(request_id: uuid.UUID, current_user: CurrentUser, db: DbDep):
    return await _update_collab_status(request_id, current_user, db, CollabStatus.accepted)


@router.post("/collab/{request_id}/decline", response_model=CollabRequestPublic)
async def decline_collab(request_id: uuid.UUID, current_user: CurrentUser, db: DbDep):
    return await _update_collab_status(request_id, current_user, db, CollabStatus.declined)


async def _update_collab_status(request_id, current_user, db, new_status: CollabStatus):
    result = await db.execute(
        select(CollabRequest).where(
            CollabRequest.id == request_id,
            CollabRequest.recipient_id == current_user.id,
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Collab request not found")
    if req.status != CollabStatus.pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Request already responded to")
    req.status = new_status
    await db.commit()
    await db.refresh(req)
    return req
