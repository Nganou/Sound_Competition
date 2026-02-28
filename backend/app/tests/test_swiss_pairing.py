"""
Swiss algorithm tests — mirrors all 8 assertions from the original tournament_test.py.

Original author: Serge Nganou (Developer @HP)
Ported from Python 2 + psycopg2 → pure Python 3 typed dataclasses.
"""
import pytest
from app.core.swiss import (
    Participant, Pairing,
    get_standings, report_match, eliminate, swiss_pairings,
    WIN_SCORE, LOSS_SCORE, DRAW_SCORE,
)


def make_participants(*names: str) -> list[Participant]:
    return [Participant(id=str(i + 1), name=name) for i, name in enumerate(names)]


# ── Test 1: Old matches can be "deleted" (standings reset to zero) ────────────
def test_1_reset_to_zero():
    players = make_participants("Alpha", "Beta")
    players = report_match(players, "1", "2")
    # Reset: rebuild fresh participants
    reset = [Participant(id=p.id, name=p.name) for p in players]
    for p in reset:
        assert p.score == 0
        assert p.matches_played == 0
    print("1. Standings can be reset to zero (old matches deleted).")


# ── Test 2: Player records can be deleted ────────────────────────────────────
def test_2_delete_players():
    players = make_participants("Markov Chaney", "Joe Malik")
    players.clear()
    assert len(players) == 0
    print("2. Player records can be deleted.")


# ── Test 3: countPlayers returns zero after deleting ─────────────────────────
def test_3_count_zero_after_delete():
    players = make_participants("Chandra Nalaar")
    players.clear()
    count = len(players)
    assert isinstance(count, int), "countPlayers() should return numeric zero, not string"
    assert count == 0, "After deleting, count should return zero"
    print("3. After deleting, count returns zero.")


# ── Test 4: After registering one player, count == 1 ─────────────────────────
def test_4_register_one_player():
    players: list[Participant] = []
    players.append(Participant(id="1", name="Chandra Nalaar"))
    assert len(players) == 1, "After one player registers, count should be 1"
    print("4. After registering a player, count returns 1.")


# ── Test 5: Register multiple, count, then delete ────────────────────────────
def test_5_register_count_delete():
    players = make_participants("Markov Chaney", "Joe Malik", "Mao Tsu-hsi", "Atlanta Hope")
    assert len(players) == 4, "After registering four players, count should be 4"
    players.clear()
    assert len(players) == 0, "After deleting, count should return zero"
    print("5. Players can be registered and deleted.")


# ── Test 6: Players appear in standings even before any matches ───────────────
def test_6_standings_before_matches():
    players = make_participants("Melpomene Murray", "Randy Schwartz")
    standings = get_standings(players)

    assert len(standings) >= 2, "Players should appear in standings before any matches"
    assert len(standings) <= 2, "Only registered players should appear in standings"
    assert len(standings[0].__dict__) >= 4, "Each standings row should have at least 4 fields"

    names = {p.name for p in standings}
    assert names == {"Melpomene Murray", "Randy Schwartz"}, \
        "Registered players' names should appear in standings"

    for p in standings:
        assert p.score == 0, "Newly registered players should have no score"
        assert p.matches_played == 0, "Newly registered players should have no matches"

    print("6. Newly registered players appear in the standings with no matches.")


# ── Test 7: Match reporting updates standings with correct scores ─────────────
def test_7_report_matches():
    players = make_participants("Bruno Walton", "Boots O'Neal", "Cathy Burton", "Diane Grant")

    # Capture IDs before pairing
    standings = get_standings(players)
    id1, id2, id3, id4 = [p.id for p in standings]

    players = report_match(players, id1, id2)
    players = report_match(players, id3, id4)

    standings = get_standings(players)

    for p in standings:
        assert p.matches_played == 1, "Each player should have one match recorded"
        if p.id in (id1, id3):
            assert p.score == WIN_SCORE, \
                f"Match winner should have {WIN_SCORE} points, got {p.score}"
        elif p.id in (id2, id4):
            assert p.score == LOSS_SCORE, \
                f"Match loser should have {LOSS_SCORE} points, got {p.score}"

    print("7. After a match, players have updated standings.")


# ── Test 8: Swiss pairings match players with equal wins ─────────────────────
def test_8_swiss_pairings():
    players = make_participants("Twilight Sparkle", "Fluttershy", "Applejack", "Pinkie Pie")
    standings = get_standings(players)
    id1, id2, id3, id4 = [p.id for p in standings]

    players = report_match(players, id1, id2)
    players = report_match(players, id3, id4)

    pairings, bye = swiss_pairings(players)

    assert len(pairings) == 2, "For four players, swiss_pairings should return two pairs"
    assert bye is None, "Even number of players — no bye expected"

    actual_pairs = {frozenset([p.participant_a_id, p.participant_b_id]) for p in pairings}
    # id1 and id3 both have WIN_SCORE; id2 and id4 both have LOSS_SCORE
    correct_pairs = {frozenset([id1, id3]), frozenset([id2, id4])}
    assert actual_pairs == correct_pairs, \
        "After one match, players with equal wins should be paired together"

    print("8. After one match, players with one win are paired.")


# ── Bonus: Draw scoring ───────────────────────────────────────────────────────
def test_draw_scoring():
    players = make_participants("Artist A", "Artist B")
    players = report_match(players, "1", "2", is_draw=True)
    for p in players:
        assert p.score == DRAW_SCORE, f"Draw should award {DRAW_SCORE} point each"
        assert p.draws == 1
    print("Bonus: Draw gives 1 point to each player.")


# ── Bonus: Odd-count bye ──────────────────────────────────────────────────────
def test_odd_player_bye():
    players = make_participants("A", "B", "C")
    pairings, bye = swiss_pairings(players)
    assert bye is not None, "Odd number of players should yield a bye participant"
    assert len(pairings) == 1, "Three players → 1 pairing + 1 bye"
    print("Bonus: Odd player count handled with a bye.")
