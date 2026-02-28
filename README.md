# Sound Competition — Modern Mobile-First App Plan

## Context

The existing codebase is a Python 2 / PostgreSQL console app implementing a Swiss-system instrumental battle tournament (4 tables: T_TOURNAMENTS, T_PLAYERS, T_MATCHES, T_RESULTS). There is no web UI, no audio playback, and no social layer. The goal is to modernize it into a full-stack, mobile-first web platform where sound engineers can compete in Swiss-system battles, listen to tracks with waveform playback, vote on battles, collaborate, follow artists, like/comment/share/tag tracks, and discover trending content — all from Angular on any device.

**User choices:**
- Frontend: Angular 18 (mobile-first web app)
- Audio storage: Cloudinary (free tier, waveform generation)
- Auth: Email + password (JWT), placeholder hooks for social OAuth2
- Competition: Enhance existing Swiss system + add community voting

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Angular 18 (standalone components) | Strong TypeScript, RxJS, user-requested |
| UI | Angular Material + custom dark SCSS theme | Mobile-first grid, bottom nav, dialogs |
| Audio Player | WaveSurfer.js 7.x | Waveform render from Cloudinary URLs, seek |
| State | NgRx Signal Store | Lightweight signals for auth + global player |
| Backend | FastAPI (Python 3.12) | Async, Pydantic v2, auto OpenAPI docs, JWT built-in |
| ORM | SQLAlchemy 2.0 (async) + Alembic | Migrations, asyncpg driver |
| Auth | python-jose + passlib[bcrypt] | JWT sign/verify, bcrypt hashing |
| Audio | Cloudinary SDK | Direct browser upload, CDN, fl_waveform transform |
| Cache / Queue | Redis + Celery | Refresh token blacklist, async jobs, feed caching |
| Database | PostgreSQL 16 | Same engine as existing project |
| Vector Search | pgvector extension | Approximate nearest-neighbor for sonic similarity |
| Audio Fingerprinting | Chromaprint / pyacoustid | Compact acoustic fingerprint; exact + fuzzy dedup |
| Audio Features | librosa | MFCC / spectral centroid / chroma for collab matching |
| Dev Env | Docker + docker-compose | Replaces Vagrant |

---

## Project Structure

```
sound-competition/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/versions/
│   │   ├── 0001_initial_schema.py
│   │   ├── 0002_add_tracks_table.py
│   │   ├── 0003_add_social_tables.py
│   │   └── 0004_add_tournament_rounds.py
│   └── app/
│       ├── main.py                  # FastAPI factory, CORS, lifespan
│       ├── config.py                # Pydantic Settings from .env
│       ├── dependencies.py          # get_db, get_current_user, pagination
│       ├── core/
│       │   ├── security.py          # JWT, bcrypt
│       │   ├── cloudinary.py        # Cloudinary client + signed upload
│       │   ├── fingerprint.py       # Chromaprint generation + librosa feature extraction
│       │   └── swiss.py             # ← Ported Swiss algorithm (pure typed Python 3)
│       ├── db/
│       │   ├── base.py              # Async engine + session
│       │   └── models/
│       │       ├── user.py          # users, oauth_accounts
│       │       ├── track.py         # tracks, tags, track_tags, track_likes
│       │       ├── tournament.py    # tournaments, tournament_participants
│       │       ├── match.py         # matches, battle_votes
│       │       ├── social.py        # follows, comments, collab_requests, notifications
│       │       └── fingerprint.py   # track_fingerprints, similarity_reports
│       ├── schemas/                 # Pydantic request/response models
│       ├── api/v1/
│       │   ├── router.py
│       │   ├── auth.py
│       │   ├── users.py
│       │   ├── tracks.py
│       │   ├── tournaments.py
│       │   ├── matches.py
│       │   ├── social.py
│       │   └── feed.py
│       ├── services/
│       │   ├── auth_service.py
│       │   ├── track_service.py
│       │   ├── tournament_service.py  # calls swiss.py
│       │   ├── match_service.py
│       │   ├── feed_service.py
│       │   ├── notification_service.py
│       │   └── fingerprint_service.py # orchestrates fingerprint pipeline
│       └── tests/
│           ├── conftest.py
│           ├── test_swiss_pairing.py      # mirrors tournament_test.py's 8 assertions
│           ├── test_auth.py
│           ├── test_tournaments.py
│           ├── test_tracks.py
│           ├── test_social.py
│           └── test_fingerprinting.py    # duplicate detection, similarity, collab suggestions
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── angular.json
    └── src/
        ├── main.ts
        ├── app.config.ts
        ├── app.routes.ts            # Lazy-loaded feature routes
        ├── styles.scss              # Dark theme CSS custom properties
        ├── manifest.webmanifest     # PWA
        └── app/
            ├── core/
            │   ├── auth/
            │   │   ├── auth.service.ts
            │   │   ├── auth.guard.ts
            │   │   ├── jwt.interceptor.ts
            │   │   └── token-refresh.interceptor.ts
            │   ├── services/
            │   │   ├── api.service.ts
            │   │   └── toast.service.ts
            │   └── store/
            │       ├── auth.store.ts    # currentUser, isAuthenticated
            │       └── player.store.ts  # currentTrack, isPlaying, queue
            ├── shared/components/
            │   ├── audio-player/        # WaveSurfer.js waveform player
            │   ├── track-card/          # Mini waveform, like, share, fingerprint badge
            │   ├── battle-card/         # Side-by-side with vote bar
            │   ├── avatar/              # Avatar + follow toggle
            │   ├── bottom-nav/          # Mobile bottom navigation
            │   ├── similarity-chip/     # "85% similar to..." badge with link
            │   ├── collab-suggestion/   # Suggested collaborator card
            │   ├── tag-chip/
            │   └── empty-state/
            ├── features/
            │   ├── auth/               # login, register
            │   ├── feed/               # discovery home
            │   ├── profile/            # view + edit
            │   ├── tracks/             # upload + detail
            │   ├── tournaments/        # list, create, detail
            │   ├── battles/            # battle-view (dual player + vote)
            │   ├── social/             # notifications, collab-requests
            │   └── search/
            └── layout/
                ├── shell/              # Authenticated shell + bottom-nav
                └── auth-layout/        # Unauthenticated wrapper
```

---

## Database Schema (New — Evolves Existing 4 Tables)

### Core tables
- **`users`** — replaces T_PLAYERS; adds UUID PK, bio, avatar_url, username, is_verified
- **`oauth_accounts`** — OAuth2 placeholder (provider, provider_uid, tokens)
- **`tracks`** — audio metadata: cloudinary_public_id, audio_url, waveform_url, genre, bpm, play_count
- **`tags`** + **`track_tags`** — many-to-many tag system
- **`track_likes`** — user × track join table

### Tournament tables (evolved from T_TOURNAMENTS / T_RESULTS / T_MATCHES)
- **`tournaments`** — adds UUID PK, status ('open'/'active'/'completed'), voting_enabled, total_rounds, current_round
- **`tournament_participants`** — replaces T_RESULTS: preserves score/wins/losses/draws/matches_played/is_eliminated, adds is_bye for odd-player rounds, links user + track entered
- **`matches`** — replaces T_MATCHES: adds round_number, track_a_id/track_b_id, result_status, vote_a_count, vote_b_count, voting_closes_at
- **`battle_votes`** — one vote per user per battle (UNIQUE constraint)

### Social tables
- **`follows`** — follower × following with self-follow CHECK
- **`comments`** — on tracks OR battles (CHECK constraint enforces one target), supports threading via parent_id
- **`collab_requests`** — requester → recipient, optional track_id, status pending/accepted/declined
- **`notifications`** — JSONB payload for flexible per-type data (new_follower, track_liked, battle_started, etc.)

### Audio Fingerprinting tables
- **`track_fingerprints`** — chromaprint (bytea), fingerprint_duration, feature_vector `vector(128)` (pgvector), fingerprint_status (pending/done/failed), computed at upload time by Celery worker
- **`similarity_reports`** — source_track_id → target_track_id, similarity_score FLOAT (0–1), report_type ('exact_duplicate'/'plagiarism_flag'/'collaboration_match'), status ('pending'/'reviewed'/'dismissed'), reviewed_by (nullable moderator user_id)

### Key indexes
```sql
CREATE INDEX ON tracks(play_count DESC);
CREATE INDEX ON tournament_participants(tournament_id, score DESC);
CREATE INDEX ON matches(tournament_id, round_number);
CREATE INDEX ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX ON track_fingerprints(fingerprint_status);
-- pgvector HNSW index for fast ANN similarity search
CREATE INDEX ON track_fingerprints USING hnsw (feature_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## API Routes Summary

### `/api/v1/auth` — register, login, refresh, logout, forgot/reset password, OAuth2 stubs (501)
### `/api/v1/users` — me (GET/PUT), avatar upload, public profile, followers/following, follow/unfollow, stats
### `/api/v1/tracks` — CRUD, like/unlike, comments, play count, Cloudinary signed upload params
### `/api/v1/tracks/{id}/fingerprint` — GET fingerprint status + similarity report for a track
### `/api/v1/tournaments` — CRUD, join/leave, standings, matches by round, advance-round (triggers swiss.py)
### `/api/v1/matches` — detail, report result, cast/retract vote, comments
### `/api/v1/social` — notifications (list/read), collab requests (send/accept/decline), tags
### `/api/v1/feed` — trending, following feed, active tournaments, suggested artists, full-text search
### `/api/v1/search/similar` — find tracks with similar sonic fingerprint (pgvector ANN)

---

## Angular Routes (Lazy-Loaded)

```
/auth/login            → LoginComponent
/auth/register         → RegisterComponent
/feed                  → FeedComponent (home, virtual scroll)
/search                → SearchComponent
/tournaments           → TournamentListComponent
/tournaments/new       → TournamentCreateComponent
/tournaments/:id       → TournamentDetailComponent (standings + bracket)
/battles/:id           → BattleViewComponent (dual player + vote)
/upload                → TrackUploadComponent
/tracks/:id            → TrackDetailComponent
/u/:username           → ProfileViewComponent
/u/me/edit             → ProfileEditComponent
/notifications         → NotificationsComponent
/collab                → CollabRequestsComponent
```

Bottom navigation (mobile): **Feed | Search | + Upload | ⚔ Battles | Profile**

---

## Mobile UI Theme

```scss
:root {
  --color-bg-primary:     #0A0A0F;   // near-black canvas
  --color-bg-surface:     #13131A;   // card background
  --color-bg-elevated:    #1C1C28;   // modals / sheets
  --color-accent-primary: #7C3AED;   // electric purple (brand)
  --color-accent-hot:     #F43F5E;   // like / vote red
  --color-accent-gold:    #F59E0B;   // winner / trophy
  --color-text-primary:   #F8FAFC;
  --color-text-secondary: #94A3B8;
  --radius-card:          16px;
}
```

---

## Key Porting Decision: `swiss.py`

The existing `swissPairings()`, `reportMatch()`, `playerStandings()`, and `Elimination()` functions in `tournament.py` will be faithfully ported to `backend/app/core/swiss.py` as **pure typed Python 3 functions** with no DB coupling. They take lists of typed dataclasses and return pairs/updated standings. `tournament_service.py` calls them and persists the results. `test_swiss_pairing.py` mirrors all 8 assertions from `tournament_test.py` (win=3, loss=0, draw=1 scoring; adjacent-rank pairing; bye on odd count).

---

## Implementation Phases

### Phase 1 — Foundation (Weeks 1–2)
- Docker-compose: PostgreSQL 16, Redis, FastAPI, Angular dev server, Nginx
- SQLAlchemy async engine + all ORM models
- Alembic `0001_initial_schema.py` migration
- FastAPI app factory + `/health` endpoint
- Port Swiss algorithm → `backend/app/core/swiss.py`
- All 8 Swiss algorithm tests passing in `test_swiss_pairing.py`

### Phase 2 — Authentication (Week 3)
- JWT auth flow: register, login, refresh, logout (Redis blacklist)
- OAuth2 stub routes (501)
- Angular: `LoginComponent`, `RegisterComponent`, `AuthService`, `JwtInterceptor`, `AuthGuard`

### Phase 3 — Tracks + Cloudinary (Weeks 4–5)
- Cloudinary signed upload endpoint; Angular uploads direct to Cloudinary
- Track CRUD, like/unlike, play count (Redis-debounced)
- `AudioPlayerComponent` (WaveSurfer.js), `TrackCardComponent`, `TrackUploadComponent`, `TrackDetailComponent`

### Phase 4 — Tournaments + Battles (Weeks 6–7)
- Tournament lifecycle: create, join, advance round (calls swiss.py), standings
- Battle reporting + community voting (vote window, vote bar, countdown timer)
- `TournamentDetailComponent`, `BattleViewComponent`, `BattleCardComponent`

### Phase 5 — Social Graph + Profiles (Week 8)
- Follow/unfollow, comments (tracks + battles), notifications
- `ProfileViewComponent`, `ProfileEditComponent`, `NotificationsComponent`
- `BottomNavComponent` with notification badge

### Phase 6 — Discovery Feed + Search (Week 9)
- Trending algorithm: `score = play_count * 0.3 + likes * 0.7` (last 7 days)
- Following feed, active tournaments, suggested artists
- PostgreSQL `tsvector` full-text search (tracks, users, tournaments)
- `FeedComponent` (CDK virtual scroll), `SearchComponent` (tabbed results)

### Phase 7 — Audio Fingerprinting (Weeks 10–11)

**Backend (`backend/app/core/fingerprint.py` + `fingerprint_service.py`):**

Three-stage pipeline, triggered as a Celery background task immediately after Cloudinary upload completes:

**Stage 1 — Chromaprint (Duplicate Detection)**
- Download audio from Cloudinary URL into a temp buffer
- Run `fpcalc -json -length 120` (via `pyacoustid`) → 32-bit integer array fingerprint
- Store in `track_fingerprints.chromaprint`
- Query all existing fingerprints: compare with XOR bitwise difference + Hamming distance
- If Hamming distance ≤ 2 on first 120 integers → 409 duplicate flag; `similarity_reports` entry created with type `'exact_duplicate'`, score 1.0

**Stage 2 — Librosa Feature Extraction (Plagiarism + Collab Matching)**
- Load audio with `librosa.load()` (max 60s to control RAM)
- Extract 13-dimensional MFCC mean + std (26 values), spectral centroid mean, zero crossing rate mean, chromagram mean (12 values) → 40-value feature vector → pad/normalize to 128 dimensions
- Store in `track_fingerprints.feature_vector` (pgvector `vector(128)`)
- Run pgvector cosine similarity query: `ORDER BY feature_vector <=> $1 LIMIT 20`
- Scores > 0.85 → `similarity_report` type `'plagiarism_flag'`; notify original artist
- Scores 0.60–0.85 → `similarity_report` type `'collaboration_match'`; feed into collab suggestions

**Stage 3 — Surface Results in UI**
- `TrackDetailComponent`: "Similar Tracks" section (collaboration_match type)
- `TrackUploadComponent`: fingerprint status badge (🔄 Processing → ✅ Unique / ⚠ Similar / ❌ Duplicate)
- `ProfileViewComponent`: "Suggested Collaborators" — artists whose track feature vectors are complementary (opposite spectral regions = e.g., bass-heavy + treble-heavy)
- `/api/v1/search/similar?track_id={id}` → returns top-10 collaboration_match tracks with similarity score and artist info

**New Angular components:** `SimilarityChipComponent`, `CollabSuggestionCardComponent`, `FingerprintStatusBadgeComponent`

**Test coverage (`test_fingerprinting.py`):**
- Upload identical audio twice → second returns 409
- Upload near-duplicate (pitch-shifted +2 semitones) → plagiarism_flag similarity_report created
- Upload complementary track → collaboration_match similarity_report with score 0.60–0.85
- Feature vector stored is 128-dimensional with values in [0, 1]
- Similarity reports created are visible on track detail

### Phase 8 — Collaboration + PWA Polish (Week 12)
- Collab requests (send/accept/decline), Web Share API integration
- `@angular/pwa` service worker, offline feed caching
- Tag browsing, infinite scroll, loading skeletons

### Phase 9 — Hardening + Deployment (Weeks 13–14)
- Rate limiting (`slowapi`), file type/size validation
- Fingerprint pipeline circuit-breaker: if librosa fails, Chromaprint still runs
- Production docker-compose with Nginx SSL termination
- Full Alembic migration chain, OpenAPI docs at `/api/docs`
- Load testing key endpoints (standings, feed, vote, `/search/similar`) with Locust

---

## Verification

1. **Swiss algorithm**: `pytest backend/tests/test_swiss_pairing.py` — all 8 tests mirror `tournament_test.py`
2. **Auth**: Register → login → receive JWT → call `/users/me` returns profile
3. **Track upload**: Upload MP3 via Angular → see waveform via WaveSurfer.js → like it → count increments
4. **Tournament flow**: Create tournament → join with track → organizer advances round → matches generated → cast vote → result reported → standings updated
5. **Social**: Follow artist → their new track appears in `/feed/following` → notification created
6. **Audio fingerprinting**:
   - Upload identical track twice → second upload rejected with 409 + link to original
   - Upload acoustically similar track → `similarity_report` type `plagiarism_flag` created; original artist notified
   - `/api/v1/search/similar?track_id={id}` returns ≥1 collaboration_match with score ∈ [0.60, 0.85]
   - Profile "Suggested Collaborators" section shows artists with complementary sonic signatures
7. **Mobile**: All screens pass at 375px (iPhone SE), 768px (tablet), 1280px (desktop)
8. **PWA**: App installs from browser on mobile; feed loads offline from service worker cache
