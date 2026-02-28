"""
Audio fingerprinting pipeline — three stages:

  Stage 1: Chromaprint (pyacoustid)  → exact duplicate detection
  Stage 2: librosa feature extraction → 128-dim feature vector
  Stage 3: pgvector cosine search     → similarity reports (done in service layer)
"""
from __future__ import annotations
import io
import struct
import tempfile
import os
from typing import Optional

import acoustid
import numpy as np


FEATURE_VECTOR_DIM = 128
DUPLICATE_HAMMING_THRESHOLD = 2       # Hamming distance ≤ 2 → exact duplicate
PLAGIARISM_SIMILARITY_THRESHOLD = 0.85
COLLAB_SIMILARITY_THRESHOLD = 0.60


def _hamming_distance(fp1: list[int], fp2: list[int]) -> int:
    """Bitwise Hamming distance between two Chromaprint integer arrays."""
    min_len = min(len(fp1), len(fp2))
    dist = 0
    for a, b in zip(fp1[:min_len], fp2[:min_len]):
        diff = a ^ b
        dist += bin(diff).count("1")
    return dist


def generate_chromaprint(audio_bytes: bytes) -> tuple[float, list[int]]:
    """
    Generate a Chromaprint fingerprint from raw audio bytes.
    Returns (duration_seconds, fingerprint_integers).
    Raises RuntimeError if fpcalc is not available.
    """
    with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        duration, fp_b64 = acoustid.fingerprint_file(tmp_path)
        # Decode raw fingerprint to list of 32-bit integers
        raw = acoustid.chromaprint.decode_fingerprint(fp_b64)[0]
        return float(duration), raw
    finally:
        os.unlink(tmp_path)


def chromaprint_to_bytes(fp_ints: list[int]) -> bytes:
    """Serialize fingerprint integer list to bytes for PostgreSQL storage."""
    return struct.pack(f">{len(fp_ints)}I", *fp_ints)


def bytes_to_chromaprint(data: bytes) -> list[int]:
    count = len(data) // 4
    return list(struct.unpack(f">{count}I", data))


def is_exact_duplicate(fp1: list[int], fp2: list[int]) -> bool:
    return _hamming_distance(fp1, fp2) <= DUPLICATE_HAMMING_THRESHOLD


def extract_feature_vector(audio_bytes: bytes, max_duration: float = 60.0) -> Optional[list[float]]:
    """
    Extract a 128-dimensional feature vector from audio using librosa.

    Features (40 raw values, padded/normalized to 128):
      - MFCC mean (13) + MFCC std (13)
      - Spectral centroid mean (1)
      - Zero crossing rate mean (1)
      - Chromagram mean (12)

    Returns None if librosa is unavailable or audio is unreadable.
    """
    try:
        import librosa  # lazy import — heavyweight dependency
    except ImportError:
        return None

    try:
        with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        y, sr = librosa.load(tmp_path, sr=22050, mono=True, duration=max_duration)
        os.unlink(tmp_path)

        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfcc, axis=1)      # (13,)
        mfcc_std = np.std(mfcc, axis=1)        # (13,)

        spec_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))  # scalar
        zcr = np.mean(librosa.feature.zero_crossing_rate(y))                    # scalar
        chroma = np.mean(librosa.feature.chroma_stft(y=y, sr=sr), axis=1)      # (12,)

        raw = np.concatenate([mfcc_mean, mfcc_std, [spec_centroid], [zcr], chroma])  # (40,)

        # Pad to FEATURE_VECTOR_DIM with zeros, then L2-normalize
        padded = np.zeros(FEATURE_VECTOR_DIM, dtype=np.float32)
        padded[: len(raw)] = raw
        norm = np.linalg.norm(padded)
        if norm > 0:
            padded = padded / norm

        return padded.tolist()

    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        return None


def classify_similarity(score: float) -> str | None:
    """Map a cosine similarity score to a report type string."""
    if score >= PLAGIARISM_SIMILARITY_THRESHOLD:
        return "plagiarism_flag"
    if score >= COLLAB_SIMILARITY_THRESHOLD:
        return "collaboration_match"
    return None
