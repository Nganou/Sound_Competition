import uuid
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, func

from app.dependencies import DbDep, CurrentUser, Pagination
from app.db.models.tournament import Tournament, TournamentParticipant, TournamentStatus
from app.db.models.match import Match
from app.schemas.tournament import (
    TournamentCreate, TournamentUpdate, TournamentPublic, TournamentDetail,
    ParticipantPublic, StandingsEntry,
)
from app.schemas.match import MatchPublic

router = APIRouter()


@router.post("/", response_model=TournamentPublic, status_code=status.HTTP_201_CREATED)
async def create_tournament(body: TournamentCreate, current_user: CurrentUser, db: DbDep):
    t = Tournament(
        organizer_id=current_user.id,
        title=body.title,
        description=body.description,
        voting_enabled=body.voting_enabled,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return await _tournament_public(t, db)


@router.get("/", response_model=list[TournamentPublic])
async def list_tournaments(db: DbDep, pagination: Pagination, status_filter: str | None = None):
    q = select(Tournament)
    if status_filter:
        q = q.where(Tournament.status == status_filter)
    q = q.order_by(Tournament.created_at.desc()).offset(pagination["skip"]).limit(pagination["limit"])
    rows = await db.execute(q)
    result = []
    for t in rows.scalars().all():
        result.append(await _tournament_public(t, db))
    return result


@router.get("/{tournament_id}", response_model=TournamentDetail)
async def get_tournament(tournament_id: uuid.UUID, db: DbDep):
    t = await _get_or_404(tournament_id, db)
    standings = await _get_standings(tournament_id, db)
    detail = await _tournament_public(t, db)
    return TournamentDetail(**detail.model_dump(), standings=standings)


@router.put("/{tournament_id}", response_model=TournamentPublic)
async def update_tournament(tournament_id: uuid.UUID, body: TournamentUpdate, current_user: CurrentUser, db: DbDep):
    t = await _get_or_404(tournament_id, db)
    _assert_organizer(t, current_user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    await db.commit()
    await db.refresh(t)
    return await _tournament_public(t, db)


@router.post("/{tournament_id}/join", status_code=status.HTTP_204_NO_CONTENT)
async def join_tournament(
    tournament_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbDep,
    track_id: uuid.UUID | None = None,
):
    t = await _get_or_404(tournament_id, db)
    if t.status != TournamentStatus.open:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tournament is not open for registration")

    existing = await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Already joined")

    db.add(TournamentParticipant(
        tournament_id=tournament_id,
        user_id=current_user.id,
        track_id=track_id,
    ))
    await db.commit()


@router.delete("/{tournament_id}/join", status_code=status.HTTP_204_NO_CONTENT)
async def leave_tournament(tournament_id: uuid.UUID, current_user: CurrentUser, db: DbDep):
    t = await _get_or_404(tournament_id, db)
    if t.status != TournamentStatus.open:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot leave an active tournament")
    existing = await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.user_id == current_user.id,
        )
    )
    p = existing.scalar_one_or_none()
    if p:
        await db.delete(p)
        await db.commit()


@router.post("/{tournament_id}/advance", response_model=list[MatchPublic])
async def advance_round(tournament_id: uuid.UUID, current_user: CurrentUser, db: DbDep):
    """Generate next-round pairings using the Swiss algorithm."""
    t = await _get_or_404(tournament_id, db)
    _assert_organizer(t, current_user)

    if t.status == TournamentStatus.completed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tournament already completed")
    if t.status == TournamentStatus.open:
        t.status = TournamentStatus.active

    # Fetch participants and build Participant dataclasses for Swiss engine
    rows = await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id)
    )
    participants_db = rows.scalars().all()

    from app.core.swiss import Participant, swiss_pairings
    swiss_participants = [
        Participant(
            id=str(p.user_id),
            name=p.user.username if p.user else str(p.user_id),
            score=p.score,
            matches_played=p.matches_played,
            wins=p.wins,
            losses=p.losses,
            draws=p.draws,
            is_eliminated=p.is_eliminated,
        )
        for p in participants_db
    ]

    pairings, bye_participant = swiss_pairings(swiss_participants)

    t.current_round += 1
    new_matches = []
    for pairing in pairings:
        # Look up track IDs
        a_db = next((p for p in participants_db if str(p.user_id) == pairing.participant_a_id), None)
        b_db = next((p for p in participants_db if str(p.user_id) == pairing.participant_b_id), None)
        match = Match(
            tournament_id=tournament_id,
            round_number=t.current_round,
            participant_a_id=uuid.UUID(pairing.participant_a_id),
            participant_b_id=uuid.UUID(pairing.participant_b_id),
            track_a_id=a_db.track_id if a_db else None,
            track_b_id=b_db.track_id if b_db else None,
        )
        db.add(match)
        new_matches.append(match)

    # Mark bye participant
    if bye_participant:
        for p in participants_db:
            if str(p.user_id) == bye_participant.id:
                p.is_eliminated = True
                p.is_bye = True

    await db.commit()
    for m in new_matches:
        await db.refresh(m)
    return new_matches


@router.get("/{tournament_id}/matches", response_model=list[MatchPublic])
async def get_matches(tournament_id: uuid.UUID, db: DbDep, round_number: int | None = None):
    q = select(Match).where(Match.tournament_id == tournament_id)
    if round_number is not None:
        q = q.where(Match.round_number == round_number)
    q = q.order_by(Match.round_number, Match.created_at)
    rows = await db.execute(q)
    return rows.scalars().all()


async def _get_or_404(tournament_id: uuid.UUID, db) -> Tournament:
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tournament not found")
    return t


def _assert_organizer(t: Tournament, current_user):
    if t.organizer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the organizer can do this")


async def _tournament_public(t: Tournament, db) -> TournamentPublic:
    count_result = await db.execute(
        select(func.count()).where(TournamentParticipant.tournament_id == t.id)
    )
    participant_count = count_result.scalar_one()
    data = {**t.__dict__, "participant_count": participant_count}
    return TournamentPublic.model_validate(data)


async def _get_standings(tournament_id: uuid.UUID, db) -> list[StandingsEntry]:
    rows = await db.execute(
        select(TournamentParticipant)
        .where(TournamentParticipant.tournament_id == tournament_id)
        .order_by(TournamentParticipant.score.desc())
    )
    entries = []
    for rank, p in enumerate(rows.scalars().all(), start=1):
        entries.append(StandingsEntry(rank=rank, participant=ParticipantPublic.model_validate(p)))
    return entries
