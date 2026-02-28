import uuid
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, update

from app.dependencies import DbDep, CurrentUser, Pagination
from app.db.models.match import Match, BattleVote, MatchResultStatus
from app.db.models.tournament import TournamentParticipant
from app.schemas.match import MatchPublic, VoteRequest, ReportMatchRequest
from app.schemas.social import CommentCreate, CommentPublic
from app.core.swiss import WIN_SCORE, LOSS_SCORE, DRAW_SCORE

router = APIRouter()


@router.get("/{match_id}", response_model=MatchPublic)
async def get_match(match_id: uuid.UUID, db: DbDep, current_user: CurrentUser | None = None):
    match = await _get_or_404(match_id, db)
    user_vote = None
    if current_user:
        vote_row = await db.execute(
            select(BattleVote).where(BattleVote.match_id == match_id, BattleVote.voter_id == current_user.id)
        )
        v = vote_row.scalar_one_or_none()
        user_vote = v.voted_for if v else None
    return {**match.__dict__, "user_vote": user_vote}


@router.post("/{match_id}/vote", status_code=status.HTTP_204_NO_CONTENT)
async def cast_vote(match_id: uuid.UUID, body: VoteRequest, current_user: CurrentUser, db: DbDep):
    match = await _get_or_404(match_id, db)
    if match.result_status != MatchResultStatus.pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Match already decided")

    existing = await db.execute(
        select(BattleVote).where(BattleVote.match_id == match_id, BattleVote.voter_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Already voted on this battle")

    db.add(BattleVote(match_id=match_id, voter_id=current_user.id, voted_for=body.voted_for))

    if body.voted_for == "a":
        await db.execute(update(Match).where(Match.id == match_id).values(vote_a_count=Match.vote_a_count + 1))
    else:
        await db.execute(update(Match).where(Match.id == match_id).values(vote_b_count=Match.vote_b_count + 1))

    await db.commit()


@router.delete("/{match_id}/vote", status_code=status.HTTP_204_NO_CONTENT)
async def retract_vote(match_id: uuid.UUID, current_user: CurrentUser, db: DbDep):
    existing = await db.execute(
        select(BattleVote).where(BattleVote.match_id == match_id, BattleVote.voter_id == current_user.id)
    )
    vote = existing.scalar_one_or_none()
    if not vote:
        return
    if vote.voted_for == "a":
        await db.execute(update(Match).where(Match.id == match_id).values(vote_a_count=Match.vote_a_count - 1))
    else:
        await db.execute(update(Match).where(Match.id == match_id).values(vote_b_count=Match.vote_b_count - 1))
    await db.delete(vote)
    await db.commit()


@router.post("/{match_id}/result", response_model=MatchPublic)
async def report_match_result(match_id: uuid.UUID, body: ReportMatchRequest, current_user: CurrentUser, db: DbDep):
    """Organizer reports the official match result; updates participant scores."""
    match = await _get_or_404(match_id, db)

    # Verify current_user is the tournament organizer
    from app.db.models.tournament import Tournament
    t_row = await db.execute(select(Tournament).where(Tournament.id == match.tournament_id))
    tournament = t_row.scalar_one_or_none()
    if not tournament or tournament.organizer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the organizer can report results")

    if match.result_status != MatchResultStatus.pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Result already recorded")

    result_map = {
        "track_a_wins": MatchResultStatus.track_a_wins,
        "track_b_wins": MatchResultStatus.track_b_wins,
        "draw": MatchResultStatus.draw,
    }
    match.result_status = result_map[body.result]

    # Apply Swiss scoring
    a_id = match.participant_a_id
    b_id = match.participant_b_id
    is_draw = body.result == "draw"

    if body.result == "track_a_wins":
        winner_id, loser_id = a_id, b_id
        w_pts, l_pts = WIN_SCORE, LOSS_SCORE
    elif body.result == "track_b_wins":
        winner_id, loser_id = b_id, a_id
        w_pts, l_pts = WIN_SCORE, LOSS_SCORE
    else:  # draw
        winner_id, loser_id = a_id, b_id
        w_pts = l_pts = DRAW_SCORE

    tid = match.tournament_id
    await db.execute(
        update(TournamentParticipant)
        .where(TournamentParticipant.tournament_id == tid, TournamentParticipant.user_id == winner_id)
        .values(
            score=TournamentParticipant.score + w_pts,
            matches_played=TournamentParticipant.matches_played + 1,
            wins=TournamentParticipant.wins + (0 if is_draw else 1),
            draws=TournamentParticipant.draws + (1 if is_draw else 0),
        )
    )
    await db.execute(
        update(TournamentParticipant)
        .where(TournamentParticipant.tournament_id == tid, TournamentParticipant.user_id == loser_id)
        .values(
            score=TournamentParticipant.score + l_pts,
            matches_played=TournamentParticipant.matches_played + 1,
            losses=TournamentParticipant.losses + (0 if is_draw else 1),
            draws=TournamentParticipant.draws + (1 if is_draw else 0),
        )
    )

    await db.commit()
    await db.refresh(match)
    return match


@router.get("/{match_id}/comments", response_model=list[CommentPublic])
async def get_match_comments(match_id: uuid.UUID, db: DbDep, pagination: Pagination):
    from app.db.models.social import Comment
    result = await db.execute(
        select(Comment)
        .where(Comment.match_id == match_id, Comment.parent_id == None)
        .order_by(Comment.created_at.desc())
        .offset(pagination["skip"])
        .limit(pagination["limit"])
    )
    return result.scalars().all()


@router.post("/{match_id}/comments", response_model=CommentPublic, status_code=status.HTTP_201_CREATED)
async def add_match_comment(match_id: uuid.UUID, body: CommentCreate, current_user: CurrentUser, db: DbDep):
    from app.db.models.social import Comment
    await _get_or_404(match_id, db)
    comment = Comment(author_id=current_user.id, body=body.body, match_id=match_id, parent_id=body.parent_id)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def _get_or_404(match_id: uuid.UUID, db) -> Match:
    result = await db.execute(select(Match).where(Match.id == match_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found")
    return m
