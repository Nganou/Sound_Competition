"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-02-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── users ────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("avatar_url", sa.String(512), nullable=True),
        sa.Column("location", sa.String(100), nullable=True),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── oauth_accounts ───────────────────────────────────────────────────────
    op.create_table(
        "oauth_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("provider_uid", sa.String(255), nullable=False),
        sa.Column("access_token", sa.Text, nullable=True),
        sa.Column("refresh_token", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── follows ──────────────────────────────────────────────────────────────
    op.create_table(
        "follows",
        sa.Column("follower_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("following_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["follower_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["following_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("follower_id", "following_id"),
        sa.CheckConstraint("follower_id <> following_id", name="ck_no_self_follow"),
    )

    # ── tags ─────────────────────────────────────────────────────────────────
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer, nullable=False, autoincrement=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_tags_name", "tags", ["name"], unique=True)

    # ── tracks ───────────────────────────────────────────────────────────────
    op.create_table(
        "tracks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("artist_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("genre", sa.String(50), nullable=True),
        sa.Column("bpm", sa.Integer, nullable=True),
        sa.Column("cloudinary_public_id", sa.String(512), nullable=False),
        sa.Column("audio_url", sa.String(1024), nullable=False),
        sa.Column("waveform_url", sa.String(1024), nullable=True),
        sa.Column("duration_seconds", sa.Float, nullable=True),
        sa.Column("file_size_bytes", sa.Integer, nullable=True),
        sa.Column("play_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("like_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("comment_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_public", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["artist_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tracks_artist_id", "tracks", ["artist_id"])
    op.create_index("ix_tracks_play_count_desc", "tracks", [sa.text("play_count DESC")])

    # ── track_tags ───────────────────────────────────────────────────────────
    op.create_table(
        "track_tags",
        sa.Column("track_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", sa.Integer, nullable=False),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("track_id", "tag_id"),
    )

    # ── track_likes ──────────────────────────────────────────────────────────
    op.create_table(
        "track_likes",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("track_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "track_id"),
    )

    # ── tournament enums ─────────────────────────────────────────────────────
    op.execute("CREATE TYPE tournament_status AS ENUM ('open', 'active', 'completed')")
    op.execute("CREATE TYPE match_result_status AS ENUM ('pending', 'track_a_wins', 'track_b_wins', 'draw')")
    op.execute("CREATE TYPE collab_status AS ENUM ('pending', 'accepted', 'declined')")
    op.execute("CREATE TYPE fingerprint_status AS ENUM ('pending', 'done', 'failed')")
    op.execute("CREATE TYPE similarity_report_type AS ENUM ('exact_duplicate', 'plagiarism_flag', 'collaboration_match')")
    op.execute("CREATE TYPE similarity_report_status AS ENUM ('pending', 'reviewed', 'dismissed')")

    # ── tournaments ───────────────────────────────────────────────────────────
    op.create_table(
        "tournaments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organizer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.String(2000), nullable=True),
        sa.Column("banner_url", sa.String(1024), nullable=True),
        sa.Column("status", sa.Text, nullable=False, server_default="open"),
        sa.Column("voting_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("total_rounds", sa.Integer, nullable=True),
        sa.Column("current_round", sa.Integer, nullable=False, server_default="0"),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organizer_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tournaments_organizer_id", "tournaments", ["organizer_id"])

    # ── tournament_participants ───────────────────────────────────────────────
    op.create_table(
        "tournament_participants",
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("track_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("score", sa.Integer, nullable=False, server_default="0"),
        sa.Column("wins", sa.Integer, nullable=False, server_default="0"),
        sa.Column("losses", sa.Integer, nullable=False, server_default="0"),
        sa.Column("draws", sa.Integer, nullable=False, server_default="0"),
        sa.Column("matches_played", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_eliminated", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_bye", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("tournament_id", "user_id"),
    )
    op.execute(
        "CREATE INDEX ix_tp_tournament_score ON tournament_participants(tournament_id, score DESC)"
    )

    # ── matches ───────────────────────────────────────────────────────────────
    op.create_table(
        "matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("round_number", sa.Integer, nullable=False),
        sa.Column("participant_a_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_b_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("track_a_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("track_b_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("result_status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("vote_a_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("vote_b_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("voting_closes_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["participant_a_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["participant_b_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["track_a_id"], ["tracks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["track_b_id"], ["tracks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_matches_tournament_round", "matches", ["tournament_id", "round_number"])

    # ── battle_votes ──────────────────────────────────────────────────────────
    op.create_table(
        "battle_votes",
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("voter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("voted_for", sa.String(1), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["voter_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("match_id", "voter_id"),
    )

    # ── comments ─────────────────────────────────────────────────────────────
    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("track_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "(track_id IS NOT NULL)::int + (match_id IS NOT NULL)::int = 1",
            name="ck_comment_one_target",
        ),
    )
    op.create_index("ix_comments_author_id", "comments", ["author_id"])
    op.create_index("ix_comments_track_id", "comments", ["track_id"])
    op.create_index("ix_comments_match_id", "comments", ["match_id"])

    # ── collab_requests ───────────────────────────────────────────────────────
    op.create_table(
        "collab_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("track_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── notifications ─────────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notification_type", sa.String(50), nullable=False),
        sa.Column("payload", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        "CREATE INDEX ix_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)"
    )

    # ── track_fingerprints ────────────────────────────────────────────────────
    op.create_table(
        "track_fingerprints",
        sa.Column("track_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chromaprint", sa.LargeBinary, nullable=True),
        sa.Column("fingerprint_duration", sa.Float, nullable=True),
        sa.Column("feature_vector", sa.Text, nullable=True),  # stored as vector(128) via raw SQL
        sa.Column("fingerprint_status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("error_message", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("track_id"),
    )
    # Add pgvector column and HNSW index via raw SQL
    op.execute("ALTER TABLE track_fingerprints ADD COLUMN feature_vector_v vector(128)")
    op.execute(
        "CREATE INDEX ix_tf_feature_vector_hnsw ON track_fingerprints "
        "USING hnsw (feature_vector_v vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )
    op.execute("CREATE INDEX ix_tf_status ON track_fingerprints(fingerprint_status)")

    # ── similarity_reports ────────────────────────────────────────────────────
    op.create_table(
        "similarity_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_track_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_track_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("similarity_score", sa.Float, nullable=False),
        sa.Column("report_type", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sr_source_track", "similarity_reports", ["source_track_id"])


def downgrade() -> None:
    op.drop_table("similarity_reports")
    op.drop_table("track_fingerprints")
    op.drop_table("notifications")
    op.drop_table("collab_requests")
    op.drop_table("comments")
    op.drop_table("battle_votes")
    op.drop_table("matches")
    op.drop_table("tournament_participants")
    op.drop_table("tournaments")
    op.drop_table("track_likes")
    op.drop_table("track_tags")
    op.drop_table("tracks")
    op.drop_table("tags")
    op.drop_table("follows")
    op.drop_table("oauth_accounts")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS similarity_report_status")
    op.execute("DROP TYPE IF EXISTS similarity_report_type")
    op.execute("DROP TYPE IF EXISTS fingerprint_status")
    op.execute("DROP TYPE IF EXISTS collab_status")
    op.execute("DROP TYPE IF EXISTS match_result_status")
    op.execute("DROP TYPE IF EXISTS tournament_status")
