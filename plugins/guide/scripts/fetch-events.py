#!/usr/bin/env python3
"""
fetch-events.py — Fetch local events from iCal feeds and output normalized JSON signals.

Usage:
    python3 fetch-events.py --config <path-to-config.yaml>

Reads the active city's feed list from content/events/cities/<city>.yaml,
fetches each iCal feed, extracts upcoming VEVENT entries, deduplicates
by title+date similarity, and outputs a JSON array of signal objects to stdout.

Exits 0 even if some feeds fail (partial results are fine).
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError

import yaml

# Try to import icalendar; fall back gracefully
try:
    from icalendar import Calendar
except ImportError:
    print("Error: 'icalendar' package required. Install with: pip3 install icalendar", file=sys.stderr)
    sys.exit(1)


def fetch_ical(url, timeout=30):
    """Fetch an iCal feed from a URL and return raw bytes."""
    req = Request(url, headers={"User-Agent": "HeartOfGold/1.0 (event-fetcher)"})
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


def parse_events(ical_data, feed_name, feed_config, lookahead_days=14):
    """Parse iCal data and return event dicts within the lookahead window."""
    cal = Calendar.from_ical(ical_data)
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=lookahead_days)
    events = []

    for component in cal.walk():
        if component.name != "VEVENT":
            continue

        dtstart = component.get("dtstart")
        if not dtstart:
            continue

        # Handle both date and datetime
        start = dtstart.dt
        if hasattr(start, "hour"):
            # It's a datetime — ensure timezone-aware
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
        else:
            # It's a date — convert to datetime at midnight UTC
            start = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)

        # Filter: only future events within lookahead window
        if start < now or start > cutoff:
            continue

        # Extract end time
        dtend = component.get("dtend")
        end = None
        if dtend:
            end = dtend.dt
            if hasattr(end, "hour") and end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)

        summary = str(component.get("summary", ""))
        description = str(component.get("description", ""))
        location = str(component.get("location", ""))
        url = str(component.get("url", ""))
        uid = str(component.get("uid", ""))

        # Extract RSVP/event URL from description if URL field is empty
        event_url = url
        if not event_url or event_url == "None":
            # Look for URLs in description (common in Luma/Meetup descriptions)
            url_match = re.search(r'https?://(?:lu\.ma|luma\.com|www\.meetup\.com)/\S+', description)
            if url_match:
                event_url = url_match.group(0)

        # Clean description — first line or first 200 chars
        desc_clean = description.replace("\\n", "\n").strip()
        if "\n" in desc_clean:
            desc_clean = desc_clean.split("\n")[0].strip()
        if len(desc_clean) > 200:
            desc_clean = desc_clean[:200] + "..."

        platform = feed_config.get("platform", "unknown")
        tags = feed_config.get("tags", [])

        events.append({
            "source": f"{platform}:{feed_name.lower().replace(' ', '-')}",
            "title": summary,
            "url": event_url if event_url and event_url != "None" else "",
            "content": desc_clean,
            "published_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "type": "event",
                "event_date": start.isoformat(),
                "event_end": end.isoformat() if end and hasattr(end, "isoformat") else None,
                "venue": location if location and location != "None" else None,
                "rsvp_url": event_url if event_url and event_url != "None" else None,
                "platform": platform,
                "tags": tags,
                "uid": uid,
            },
        })

    return events


def deduplicate_events(events, similarity_threshold=0.6):
    """Remove duplicate events by title similarity + same-day date proximity."""
    if not events:
        return events

    def normalize_title(title):
        """Normalize title for comparison."""
        return re.sub(r'[^a-z0-9\s]', '', title.lower()).strip()

    def jaccard_similarity(s1, s2):
        """Word-level Jaccard similarity."""
        words1 = set(s1.split())
        words2 = set(s2.split())
        if not words1 or not words2:
            return 0.0
        return len(words1 & words2) / len(words1 | words2)

    seen = []
    unique = []

    for event in events:
        norm_title = normalize_title(event["title"])
        event_date = event["metadata"]["event_date"][:10]  # YYYY-MM-DD
        is_dup = False

        for seen_title, seen_date in seen:
            if seen_date == event_date and jaccard_similarity(norm_title, seen_title) >= similarity_threshold:
                is_dup = True
                break

        if not is_dup:
            seen.append((norm_title, event_date))
            unique.append(event)

    return unique


def main():
    parser = argparse.ArgumentParser(description="Fetch local events from iCal feeds")
    parser.add_argument("--config", required=True, help="Path to config.yaml")
    args = parser.parse_args()

    # Load main config
    try:
        with open(args.config) as f:
            config = yaml.safe_load(f)
    except Exception as e:
        print(f"Error reading config: {e}", file=sys.stderr)
        sys.exit(1)

    events_config = config.get("sources", {}).get("events", {})
    if not events_config.get("enabled", False):
        print("[]")
        sys.exit(0)

    active_city = events_config.get("active_city", "prague")
    cities_dir = events_config.get("cities_dir", "content/events/cities")
    lookahead_days = events_config.get("lookahead_days", 14)
    max_items = events_config.get("max_items", 10)

    # Load city config
    city_path = Path(cities_dir) / f"{active_city}.yaml"
    if not city_path.exists():
        print(f"City config not found: {city_path}", file=sys.stderr)
        print("[]")
        sys.exit(0)

    try:
        with open(city_path) as f:
            city_config = yaml.safe_load(f)
    except Exception as e:
        print(f"Error reading city config: {e}", file=sys.stderr)
        print("[]")
        sys.exit(0)

    feeds = city_config.get("feeds", [])
    if not feeds:
        print("[]")
        sys.exit(0)

    all_events = []
    errors = []

    for feed in feeds:
        name = feed.get("name", "unknown")
        url = feed.get("url", "")
        if not url:
            continue

        try:
            ical_data = fetch_ical(url)
            events = parse_events(ical_data, name, feed, lookahead_days)
            all_events.extend(events)
            print(f"  {name}: {len(events)} events", file=sys.stderr)
        except URLError as e:
            errors.append(f"Failed to fetch {name} ({url}): {e}")
        except Exception as e:
            errors.append(f"Error parsing {name}: {e}")

    # Deduplicate
    before_dedup = len(all_events)
    all_events = deduplicate_events(all_events)
    if before_dedup > len(all_events):
        print(f"  Deduplicated: {before_dedup} → {len(all_events)} events", file=sys.stderr)

    # Sort by event date
    all_events.sort(key=lambda e: e["metadata"]["event_date"])

    # Limit
    if len(all_events) > max_items:
        all_events = all_events[:max_items]

    # Log errors
    for error in errors:
        print(error, file=sys.stderr)

    # Output
    print(json.dumps(all_events, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
