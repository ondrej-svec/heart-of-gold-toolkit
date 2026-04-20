#!/usr/bin/env python3
"""
fetch-anthropic-news.py — Fetch Anthropic news posts from sitemap.xml as signals.

Anthropic publishes no RSS feed, but anthropic.com/sitemap.xml lists every
/news/ post with a <lastmod> timestamp. We parse that, filter by freshness,
fetch each recent page for its <title> + meta description, and emit signals
in the same schema as fetch-rss.py.

Usage:
    python3 fetch-anthropic-news.py --config <path-to-config.yaml>

Config (under sources.anthropic_news):
    enabled: true
    freshness_hours: 168
    max_items: 5
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree as ET

import yaml

SITEMAP_URL = "https://www.anthropic.com/sitemap.xml"
PATH_PREFIX = "/news/"
USER_AGENT = "heart-of-gold-pipeline/1.0"
FETCH_TIMEOUT = 10
SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"

TITLE_RE = re.compile(r"<title[^>]*>([^<]*)</title>", re.IGNORECASE)
META_DESC_RES = [
    re.compile(
        r'<meta[^>]+name=["\']description["\'][^>]*content=["\']([^"\']*)["\']',
        re.IGNORECASE,
    ),
    re.compile(
        r'<meta[^>]+content=["\']([^"\']*)["\'][^>]*name=["\']description["\']',
        re.IGNORECASE,
    ),
    re.compile(
        r'<meta[^>]+property=["\']og:description["\'][^>]*content=["\']([^"\']*)["\']',
        re.IGNORECASE,
    ),
]


def fetch_url(url, timeout=FETCH_TIMEOUT):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_sitemap_urls(xml_text, path_prefix, cutoff):
    root = ET.fromstring(xml_text)
    entries = []
    for url_elem in root.findall(f"{SITEMAP_NS}url"):
        loc = (url_elem.findtext(f"{SITEMAP_NS}loc") or "").strip()
        lastmod = (url_elem.findtext(f"{SITEMAP_NS}lastmod") or "").strip()
        if not loc:
            continue
        path = urllib.parse.urlparse(loc).path
        if not path.startswith(path_prefix) or path == path_prefix:
            continue
        if not lastmod:
            continue
        try:
            dt = datetime.fromisoformat(lastmod.replace("Z", "+00:00"))
        except ValueError:
            continue
        if dt < cutoff:
            continue
        entries.append((loc, dt))
    return entries


def extract_meta(html):
    title = ""
    m = TITLE_RE.search(html)
    if m:
        title = m.group(1).strip()
    description = ""
    for pattern in META_DESC_RES:
        m = pattern.search(html)
        if m:
            description = m.group(1).strip()
            break
    return title, description


def slug_to_title(url):
    slug = urllib.parse.urlparse(url).path.rstrip("/").rsplit("/", 1)[-1]
    return slug.replace("-", " ").title()


def main():
    parser = argparse.ArgumentParser(description="Fetch Anthropic news signals from sitemap")
    parser.add_argument("--config", required=True)
    args = parser.parse_args()

    try:
        with open(args.config) as f:
            config = yaml.safe_load(f)
    except Exception as e:
        print(f"Error reading config: {e}", file=sys.stderr)
        sys.exit(1)

    src = (config.get("sources") or {}).get("anthropic_news") or {}
    if not src.get("enabled", False):
        print("[]")
        sys.exit(0)

    freshness_hours = src.get("freshness_hours", 168)
    max_items = src.get("max_items", 5)

    cutoff = datetime.now(timezone.utc) - timedelta(hours=freshness_hours)

    try:
        sitemap_xml = fetch_url(SITEMAP_URL)
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"Error fetching sitemap: {e}", file=sys.stderr)
        print("[]")
        sys.exit(0)

    try:
        entries = parse_sitemap_urls(sitemap_xml, PATH_PREFIX, cutoff)
    except ET.ParseError as e:
        print(f"Error parsing sitemap: {e}", file=sys.stderr)
        print("[]")
        sys.exit(0)

    entries.sort(key=lambda x: x[1], reverse=True)
    entries = entries[:max_items]

    signals = []
    for url, lastmod in entries:
        try:
            html = fetch_url(url)
            title, description = extract_meta(html)
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"Warn: could not fetch {url}: {e}", file=sys.stderr)
            title, description = "", ""

        signals.append({
            "source": "rss",
            "title": title or slug_to_title(url),
            "url": url,
            "content": description,
            "published_at": lastmod.isoformat(),
            "metadata": {"source_name": "anthropic-news"},
        })

    print(json.dumps(signals, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
