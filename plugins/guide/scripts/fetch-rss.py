#!/usr/bin/env python3
"""
fetch-rss.py — Fetch RSS/Atom feeds and output normalized JSON signals.

Usage:
    python3 fetch-rss.py --config <path-to-config.yaml>

Reads RSS sources from config, parses each feed using feedparser,
filters by freshness_hours, strips HTML from content, and outputs
a JSON array of signal objects to stdout.

Exits 0 even if some feeds fail (partial results are fine).
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone, timedelta

import feedparser
import yaml


def strip_html(text):
    """Remove HTML tags from text, preserving plain text content."""
    if not text:
        return ""
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', ' ', text)
    # Collapse whitespace
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def parse_published(entry):
    """Extract published datetime from a feed entry."""
    for field in ('published_parsed', 'updated_parsed'):
        parsed = getattr(entry, field, None) or entry.get(field)
        if parsed:
            try:
                from time import mktime
                return datetime.fromtimestamp(mktime(parsed), tz=timezone.utc)
            except (TypeError, ValueError, OverflowError):
                continue
    return None


def fetch_feed(feed_config, errors):
    """Fetch a single RSS/Atom feed and return a list of signal dicts."""
    url = feed_config.get("url", "")
    freshness_hours = feed_config.get("freshness_hours", 72)
    signals = []

    try:
        feed = feedparser.parse(url)
    except Exception as e:
        errors.append(f"Error parsing {url}: {e}")
        return signals

    if feed.bozo and not feed.entries:
        errors.append(f"Feed error for {url}: {getattr(feed, 'bozo_exception', 'unknown error')}")
        return signals

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=freshness_hours)

    for entry in feed.entries:
        published = parse_published(entry)

        # Apply freshness filter
        if published and published < cutoff:
            continue

        # If no published date, use current time and flag it
        if not published:
            published = now
            no_date = True
        else:
            no_date = False

        # Get content — prefer content field, fall back to summary
        content_raw = ""
        if hasattr(entry, 'content') and entry.content:
            content_raw = entry.content[0].get('value', '')
        elif hasattr(entry, 'summary'):
            content_raw = entry.summary or ""

        content_clean = strip_html(content_raw)

        # Check if content appears truncated
        truncated = len(content_clean) < 200 and len(content_raw) > 200

        title = getattr(entry, 'title', '') or ''
        link = getattr(entry, 'link', '') or ''

        metadata = {}
        if no_date:
            metadata["no_published_date"] = True
        if truncated:
            metadata["truncated"] = True

        signals.append({
            "source": "rss",
            "title": title,
            "url": link,
            "content": content_clean,
            "published_at": published.isoformat(),
            "metadata": metadata,
        })

    return signals


def main():
    parser = argparse.ArgumentParser(description="Fetch RSS feeds and output JSON signals")
    parser.add_argument("--config", required=True, help="Path to config.yaml")
    args = parser.parse_args()

    # Load config
    try:
        with open(args.config) as f:
            config = yaml.safe_load(f)
    except Exception as e:
        print(f"Error reading config: {e}", file=sys.stderr)
        sys.exit(1)

    feeds = config.get("sources", {}).get("rss", [])
    if not feeds:
        print("[]")
        sys.exit(0)

    all_signals = []
    errors = []

    for feed_config in feeds:
        signals = fetch_feed(feed_config, errors)
        all_signals.extend(signals)

    # Log errors to stderr
    for error in errors:
        print(error, file=sys.stderr)

    # Output signals to stdout
    print(json.dumps(all_signals, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
