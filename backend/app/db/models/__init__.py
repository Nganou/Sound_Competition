# Import all models so Alembic autogenerate can discover them
from app.db.models.user import User, OAuthAccount, Follow  # noqa: F401
from app.db.models.track import Track, Tag, TrackTag, TrackLike  # noqa: F401
from app.db.models.tournament import Tournament, TournamentParticipant, TournamentStatus  # noqa: F401
from app.db.models.match import Match, BattleVote, MatchResultStatus  # noqa: F401
from app.db.models.social import Comment, CollabRequest, Notification, CollabStatus  # noqa: F401
from app.db.models.fingerprint import (  # noqa: F401
    TrackFingerprint, SimilarityReport, FingerprintStatus,
    SimilarityReportType, SimilarityReportStatus, FEATURE_VECTOR_DIM
)
