"""
Demo data seeder — idempotent (safe to run multiple times).

Creates 3 demo users, 9 demo tracks, and 2 demo tournaments with
pre-populated standings and matches so the platform looks alive on first visit.

Demo credentials (all passwords: demo1234):
  beatmaster@demo.com  — Trap & Hip-Hop, Atlanta
  luna@demo.com        — Lo-Fi & Jazz, Tokyo
  bass@demo.com        — Electronic & DnB, London

Run standalone:
  cd backend && python -m app.db.seed

Or called from main.py lifespan if DEMO_MODE=true.
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import AsyncSessionLocal
from app.core.security import hash_password

# ---------------------------------------------------------------------------
# Demo content data
# ---------------------------------------------------------------------------

DEMO_USERS = [
    {
        "username": "beatmaster",
        "display_name": "Beat Master",
        "email": "beatmaster@demo.com",
        "bio": "Trap & Hip-Hop producer from Atlanta. Pushing the culture forward one 808 at a time. 🎛️",
        "location": "Atlanta, GA",
        "is_verified": True,
    },
    {
        "username": "lofi_luna",
        "display_name": "Lo-Fi Luna",
        "email": "luna@demo.com",
        "bio": "Chill beats to study and relax to 🌙 Jazz-influenced lo-fi from Tokyo.",
        "location": "Tokyo, Japan",
        "is_verified": False,
    },
    {
        "username": "bassline_king",
        "display_name": "Bass Line King",
        "email": "bass@demo.com",
        "bio": "Electronic & DnB artist from London. Heavy sub-bass & rolling breaks. 🎸",
        "location": "London, UK",
        "is_verified": False,
    },
]

# Free CC0 audio samples (Internet Archive / freemusicarchive.org proxies)
_AUDIO_BASE = "https://upload.wikimedia.org/wikipedia/commons"
DEMO_TRACKS_BY_USER = {
    "beatmaster": [
        {
            "title": "808 Sunrise",
            "genre": "Trap",
            "bpm": 140,
            "duration": 187,
            "audio_url": f"{_AUDIO_BASE}/6/6e/Stephan_Bartkiw_-_Stephan_Bartkiw_-_Jazz.ogg",
            "cloudinary_public_id": "demo/beatmaster_808_sunrise",
        },
        {
            "title": "Concrete Jungle",
            "genre": "Hip-Hop",
            "bpm": 95,
            "duration": 213,
            "audio_url": f"{_AUDIO_BASE}/6/6e/Stephan_Bartkiw_-_Stephan_Bartkiw_-_Jazz.ogg",
            "cloudinary_public_id": "demo/beatmaster_concrete_jungle",
        },
        {
            "title": "Chrome Drip",
            "genre": "Trap",
            "bpm": 150,
            "duration": 158,
            "audio_url": f"{_AUDIO_BASE}/6/6e/Stephan_Bartkiw_-_Stephan_Bartkiw_-_Jazz.ogg",
            "cloudinary_public_id": "demo/beatmaster_chrome_drip",
        },
    ],
    "lofi_luna": [
        {
            "title": "Rainy Café",
            "genre": "Lo-Fi",
            "bpm": 72,
            "duration": 245,
            "audio_url": f"{_AUDIO_BASE}/6/6e/Stephan_Bartkiw_-_Stephan_Bartkiw_-_Jazz.ogg",
            "cloudinary_public_id": "demo/luna_rainy_cafe",
        },
        {
            "title": "Midnight Jazz Walks",
            "genre": "Jazz",
            "bpm": 85,
            "duration": 302,
            "audio_url": f"{_AUDIO_BASE}/6/6e/Stephan_Bartkiw_-_Stephan_Bartkiw_-_Jazz.ogg",
            "cloudinary_public_id": "demo/luna_midnight_jazz",
        },
        {
            "title": "Sakura Tape",
            "genre": "Lo-Fi",
            "bpm": 68,
            "duration": 198,
            "audio_url": f"{_AUDIO_BASE}/6/6e/Stephan_Bartkiw_-_Stephan_Bartkiw_-_Jazz.ogg",
            "cloudinary_public_id": "demo/luna_sakura_tape",
        },
    ],
    "bassline_king": [
        {
            "title": "Underground Protocol",
            "genre": "DnB",
            "bpm": 174,
            "duration": 276,
            "audio_url": f"{_AUDIO_BASE}/6/6e/Stephan_Bartkiw_-_Stephan_Bartkiw_-_Jazz.ogg",
            "cloudinary_public_id": "demo/bass_underground_protocol",
        },
        {
            "title": "Sub Zero",
            "genre": "Electronic",
            "bpm": 128,
            "duration": 334,
            "audio_url": f"{_AUDIO_BASE}/6/6e/Stephan_Bartkiw_-_Stephan_Bartkiw_-_Jazz.ogg",
            "cloudinary_public_id": "demo/bass_sub_zero",
        },
        {
            "title": "Pressure Drop",
            "genre": "DnB",
            "bpm": 170,
            "duration": 248,
            "audio_url": f"{_AUDIO_BASE}/6/6e/Stephan_Bartkiw_-_Stephan_Bartkiw_-_Jazz.ogg",
            "cloudinary_public_id": "demo/bass_pressure_drop",
        },
    ],
}


async def run_seed() -> None:
    """Main entry point — idempotent."""
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        from app.db.models.user import User
        result = await session.execute(select(User).where(User.username == "beatmaster"))
        if result.scalars().first() is not None:
            print("[seed] Demo data already present — skipping.")
            return

        print("[seed] Seeding demo data…")
        await _seed(session)
        await session.commit()
        print("[seed] Done.")


async def _seed(session: AsyncSession) -> None:
    from app.db.models.user import User, Follow
    from app.db.models.track import Track
    from app.db.models.tournament import Tournament, TournamentParticipant
    from app.db.models.match import Match

    pw = hash_password("demo1234")
    now = datetime.now(timezone.utc)

    # ── Users ────────────────────────────────────────────────────────────────
    user_objs: dict[str, User] = {}
    for data in DEMO_USERS:
        u = User(
            id=uuid.uuid4(),
            username=data["username"],
            display_name=data["display_name"],
            email=data["email"],
            bio=data["bio"],
            location=data["location"],
            hashed_password=pw,
            is_verified=data.get("is_verified", False),
            created_at=now,
            updated_at=now,
        )
        session.add(u)
        user_objs[data["username"]] = u

    await session.flush()

    # Mutual follows: beatmaster ↔ lofi_luna, lofi_luna ↔ bassline_king
    for follower_key, following_key in [
        ("beatmaster", "lofi_luna"),
        ("lofi_luna", "beatmaster"),
        ("lofi_luna", "bassline_king"),
        ("bassline_king", "lofi_luna"),
        ("beatmaster", "bassline_king"),
    ]:
        session.add(Follow(
            follower_id=user_objs[follower_key].id,
            following_id=user_objs[following_key].id,
            created_at=now,
        ))

    # ── Tracks ───────────────────────────────────────────────────────────────
    track_objs: dict[str, list[Track]] = {}
    for username, tracks in DEMO_TRACKS_BY_USER.items():
        owner = user_objs[username]
        track_objs[username] = []
        for t in tracks:
            track = Track(
                id=uuid.uuid4(),
                title=t["title"],
                owner_id=owner.id,
                genre=t.get("genre"),
                bpm=t.get("bpm"),
                duration=t.get("duration", 180),
                audio_url=t["audio_url"],
                waveform_url=None,  # no Cloudinary in demo seed
                cloudinary_public_id=t["cloudinary_public_id"],
                play_count=0,
                is_public=True,
                fingerprint_status="pending",
                created_at=now - timedelta(days=len(track_objs[username]) + 1),
                updated_at=now,
            )
            session.add(track)
            track_objs[username].append(track)

    await session.flush()

    # Seed some play counts and likes so trending feed has data
    from app.db.models.track import TrackLike
    beatmaster_track = track_objs["beatmaster"][0]
    luna_track = track_objs["lofi_luna"][0]
    beatmaster_track.play_count = 142
    luna_track.play_count = 89
    track_objs["bassline_king"][0].play_count = 67

    for liker_key, liked_track in [
        ("lofi_luna", beatmaster_track),
        ("bassline_king", beatmaster_track),
        ("beatmaster", luna_track),
    ]:
        session.add(TrackLike(
            user_id=user_objs[liker_key].id,
            track_id=liked_track.id,
            created_at=now,
        ))

    # ── Active Tournament (round 2, mid-battle) ───────────────────────────────
    tournament_active = Tournament(
        id=uuid.uuid4(),
        title="Summer Beat Battle 2024",
        description=(
            "The biggest Swiss-system beat competition of the summer. "
            "Producers battle round by round until a champion is crowned."
        ),
        organizer_id=user_objs["beatmaster"].id,
        status="active",
        current_round=2,
        voting_enabled=True,
        start_date=now - timedelta(days=7),
        end_date=now + timedelta(days=14),
        created_at=now - timedelta(days=8),
        updated_at=now,
    )
    session.add(tournament_active)
    await session.flush()

    # All 3 demo users + beatmaster as 4th slot
    participants_active = []
    standings = [
        ("beatmaster", 0, track_objs["beatmaster"][0], 6, 2, 0, 0),
        ("lofi_luna", 1, track_objs["lofi_luna"][0], 3, 1, 1, 0),
        ("bassline_king", 2, track_objs["bassline_king"][0], 3, 1, 1, 0),
    ]
    for username, rank, track, score, wins, losses, draws in standings:
        p = TournamentParticipant(
            id=uuid.uuid4(),
            tournament_id=tournament_active.id,
            user_id=user_objs[username].id,
            track_id=track.id,
            score=score,
            wins=wins,
            losses=losses,
            draws=draws,
            matches_played=wins + losses + draws,
            is_eliminated=False,
            is_bye=False,
            joined_at=now - timedelta(days=8),
        )
        session.add(p)
        participants_active.append(p)

    await session.flush()

    # Round 1 completed match
    match_r1 = Match(
        id=uuid.uuid4(),
        tournament_id=tournament_active.id,
        round_number=1,
        track_a_id=track_objs["beatmaster"][0].id,
        track_b_id=track_objs["lofi_luna"][0].id,
        participant_a_id=participants_active[0].id,
        participant_b_id=participants_active[1].id,
        result_status="completed",
        winner_id=participants_active[0].id,
        vote_a_count=24,
        vote_b_count=11,
        voting_closes_at=now - timedelta(days=3),
        created_at=now - timedelta(days=6),
        updated_at=now - timedelta(days=3),
    )
    session.add(match_r1)

    # Round 2 ongoing match (voting open)
    match_r2 = Match(
        id=uuid.uuid4(),
        tournament_id=tournament_active.id,
        round_number=2,
        track_a_id=track_objs["beatmaster"][0].id,
        track_b_id=track_objs["bassline_king"][0].id,
        participant_a_id=participants_active[0].id,
        participant_b_id=participants_active[2].id,
        result_status="pending",
        winner_id=None,
        vote_a_count=8,
        vote_b_count=5,
        voting_closes_at=now + timedelta(days=2),
        created_at=now - timedelta(days=1),
        updated_at=now,
    )
    session.add(match_r2)

    # ── Open Tournament (accepting participants) ──────────────────────────────
    tournament_open = Tournament(
        id=uuid.uuid4(),
        title="Lo-Fi Open Championship",
        description=(
            "An open tournament for lo-fi, jazz, and ambient producers. "
            "All skill levels welcome. Swiss system — every match counts."
        ),
        organizer_id=user_objs["lofi_luna"].id,
        status="open",
        current_round=0,
        voting_enabled=True,
        start_date=now + timedelta(days=3),
        end_date=now + timedelta(days=21),
        created_at=now - timedelta(days=1),
        updated_at=now,
    )
    session.add(tournament_open)
    await session.flush()

    # lofi_luna already joined her own tournament
    session.add(TournamentParticipant(
        id=uuid.uuid4(),
        tournament_id=tournament_open.id,
        user_id=user_objs["lofi_luna"].id,
        track_id=track_objs["lofi_luna"][1].id,
        score=0, wins=0, losses=0, draws=0, matches_played=0,
        is_eliminated=False, is_bye=False,
        joined_at=now - timedelta(hours=6),
    ))


if __name__ == "__main__":
    asyncio.run(run_seed())
