"""
Swiss-system tournament pairing algorithm.

Ported from the original tournament.py (Python 2, DB-coupled) to pure typed
Python 3 dataclasses with no database dependency. All 8 assertions from
tournament_test.py are preserved.

Scoring: win=3, loss=0, draw=1  (original comment: "for the love of Football!")
"""
from __future__ import annotations
from dataclasses import dataclass, field


WIN_SCORE = 3
LOSS_SCORE = 0
DRAW_SCORE = 1


@dataclass
class Participant:
    id: str
    name: str
    score: int = 0
    matches_played: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0
    is_eliminated: bool = False
    is_bye: bool = False


@dataclass
class MatchResult:
    winner_id: str
    loser_id: str | None  # None = bye round
    is_draw: bool = False


@dataclass
class Pairing:
    participant_a_id: str
    participant_a_name: str
    participant_b_id: str
    participant_b_name: str


def get_standings(participants: list[Participant]) -> list[Participant]:
    """
    Return participants sorted by score descending (then by name for determinism).
    Mirrors playerStandings() from the original.
    """
    return sorted(
        [p for p in participants if not p.is_eliminated],
        key=lambda p: (-p.score, p.name),
    )


def report_match(
    participants: list[Participant],
    winner_id: str,
    loser_id: str,
    is_draw: bool = False,
) -> list[Participant]:
    """
    Apply match result to participants list. Returns updated list (immutable style).
    Mirrors reportMatch() from the original — draw=1pt each, win=3, loss=0.
    """
    updated = []
    for p in participants:
        if p.id == winner_id:
            pts = DRAW_SCORE if is_draw else WIN_SCORE
            updated.append(
                Participant(
                    id=p.id, name=p.name,
                    score=p.score + pts,
                    matches_played=p.matches_played + 1,
                    wins=p.wins + (0 if is_draw else 1),
                    draws=p.draws + (1 if is_draw else 0),
                    losses=p.losses,
                    is_eliminated=p.is_eliminated,
                )
            )
        elif p.id == loser_id:
            pts = DRAW_SCORE if is_draw else LOSS_SCORE
            updated.append(
                Participant(
                    id=p.id, name=p.name,
                    score=p.score + pts,
                    matches_played=p.matches_played + 1,
                    wins=p.wins,
                    draws=p.draws + (1 if is_draw else 0),
                    losses=p.losses + (0 if is_draw else 1),
                    is_eliminated=p.is_eliminated,
                )
            )
        else:
            updated.append(p)
    return updated


def eliminate(participants: list[Participant], player_id: str) -> list[Participant]:
    """
    Mark a player as eliminated (odd-count bye handling).
    Mirrors Elimination() from the original.
    """
    return [
        Participant(**{**p.__dict__, "is_eliminated": True, "is_bye": True})
        if p.id == player_id else p
        for p in participants
    ]


def swiss_pairings(participants: list[Participant]) -> list[Pairing]:
    """
    Generate next-round pairings via the Swiss system.
    Players are paired with the opponent closest to them in the standings.
    If odd number of players, the lowest-ranked active player receives a bye
    (is marked eliminated for pairing purposes this round).

    Mirrors swissPairings() from the original.
    """
    standings = get_standings(participants)
    active = [p for p in standings if not p.is_eliminated]

    # Handle odd player count: give lowest-ranked player a bye
    bye_participant: Participant | None = None
    if len(active) % 2 != 0:
        bye_participant = active.pop()  # lowest ranked

    pairings: list[Pairing] = []
    # Pop from both ends: highest vs second-highest, etc.
    # Original uses .pop() twice which takes from the right (lowest first)
    # then pairs them in order — we replicate: pair adjacent in standings
    i = 0
    while i + 1 < len(active):
        a = active[i]
        b = active[i + 1]
        pairings.append(Pairing(
            participant_a_id=a.id, participant_a_name=a.name,
            participant_b_id=b.id, participant_b_name=b.name,
        ))
        i += 2

    return pairings, bye_participant
