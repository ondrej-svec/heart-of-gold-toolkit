"""
pipeline_utils.py — Shared utilities for the content pipeline.

Provides signal validation, path collision detection, signal merging,
and score normalization used by fetch scripts and the runner.
"""
import os
from datetime import datetime, timezone


# Required fields for a valid signal object
SIGNAL_REQUIRED_FIELDS = {"source", "title", "url", "content", "published_at", "metadata"}


def validate_signal(signal: dict) -> tuple[bool, list[str]]:
    """Validate a signal dict against the required schema.

    Returns (is_valid, errors) where errors is a list of human-readable strings.
    """
    errors = []
    for field in SIGNAL_REQUIRED_FIELDS:
        if field not in signal:
            errors.append(f"Missing required field: {field}")
    return (len(errors) == 0, errors)


def next_pipeline_path(directory: str, base_filename: str) -> str:
    """Return a non-colliding path for a file in the pipeline directory.

    If base_filename doesn't exist, returns directory/base_filename.
    If it exists, appends -2, -3, etc. before the extension.
    """
    candidate = os.path.join(directory, base_filename)
    if not os.path.exists(candidate):
        return candidate

    name, ext = os.path.splitext(base_filename)
    counter = 2
    while True:
        candidate = os.path.join(directory, f"{name}-{counter}{ext}")
        if not os.path.exists(candidate):
            return candidate
        counter += 1


def combine_signals(*signal_lists: list[dict]) -> list[dict]:
    """Merge multiple signal lists into a single flat list.

    Accepts variadic list arguments. Preserves all fields.
    """
    combined = []
    for signal_list in signal_lists:
        combined.extend(signal_list)
    return combined


def normalize_score(signal: dict, source_weights: dict, freshness_hours: int = 72) -> dict:
    """Add a normalized relevance_score (0.0-1.0) to a signal dict.

    Source weights dict maps source type to multiplier, e.g.:
        {"rss": 1.5, "hn": 1.0, "gmail": 1.2, "event": 1.3, "capture": 2.0}

    Modifies and returns the signal dict with relevance_score added.
    """
    source = signal.get("source", "")
    metadata = signal.get("metadata", {})

    # Determine source type from the source string
    if source == "hn":
        source_type = "hn"
    elif source == "rss":
        source_type = "rss"
    elif source == "gmail":
        source_type = "gmail"
    elif source == "capture":
        source_type = "capture"
    elif metadata.get("type") == "event":
        source_type = "event"
    else:
        # Platform-prefixed sources (e.g., "luma:prague-tech")
        if ":" in source:
            source_type = "event" if metadata.get("type") == "event" else "rss"
        else:
            source_type = "rss"  # default fallback

    weight = source_weights.get(source_type, 1.0)

    # Compute raw score (0-1) based on source type
    if source_type == "hn":
        hn_score = metadata.get("score", 0)
        raw = min(hn_score / 500.0, 1.0)

    elif source_type == "rss":
        # Freshness decay: newer = higher score
        published = signal.get("published_at", "")
        raw = _freshness_score(published, freshness_hours)

    elif source_type == "gmail":
        # Base score for Gmail — upgraded when full content is available
        content = signal.get("content", "")
        title = signal.get("title", "")
        # If content differs from title, we have body text — boost score
        if content and content != title and len(content) > len(title) * 2:
            raw = 0.7  # has body content
        else:
            raw = 0.5  # subject-only

    elif source_type == "event":
        raw = 1.0  # all configured events are relevant

    elif source_type == "capture":
        raw = 1.0  # user's own thoughts are always highest value

    else:
        raw = 0.5

    score = min(raw * weight, 1.0)
    signal["relevance_score"] = round(score, 3)
    return signal


def _freshness_score(published_at: str, max_hours: int) -> float:
    """Compute a 0-1 freshness score. Newer = higher."""
    if not published_at:
        return 0.3  # no date → low confidence

    try:
        # Normalize trailing Z to +00:00 for fromisoformat
        pub = published_at.replace("Z", "+00:00")
        dt = datetime.fromisoformat(pub)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return 0.3

    now = datetime.now(timezone.utc)
    hours_old = (now - dt).total_seconds() / 3600.0

    if hours_old <= 0:
        return 1.0
    if hours_old >= max_hours:
        return 0.1

    # Linear decay
    return round(1.0 - (hours_old / max_hours) * 0.9, 3)
