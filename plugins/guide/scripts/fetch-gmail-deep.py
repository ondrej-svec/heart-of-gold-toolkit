#!/usr/bin/env python3
"""
fetch-gmail-deep.py — Deep Gmail newsletter processing.

Called by fetch-gmail.sh after initial message list. Takes message IDs,
fetches full bodies via gws, extracts article links, follows them with
domain allowlist, and outputs enriched signal objects.

Usage:
    echo '{"messages": [...], "config": {...}}' | python3 fetch-gmail-deep.py

Input (stdin JSON):
    messages: list of {id, subject, from, date} from +triage
    config: gmail config section from config.yaml

Output (stdout JSON):
    Array of signal objects with full content and article metadata.
"""
import base64
import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError


class HTMLTextExtractor(HTMLParser):
    """Strip HTML tags and extract plain text."""

    def __init__(self):
        super().__init__()
        self._text = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "head"):
            self._skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style", "head"):
            self._skip = False
        if tag in ("p", "br", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr"):
            self._text.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self._text.append(data)

    def get_text(self):
        return " ".join("".join(self._text).split())


class LinkExtractor(HTMLParser):
    """Extract href URLs from anchor tags."""

    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            for name, value in attrs:
                if name == "href" and value:
                    self.links.append(value)


def strip_html(html: str) -> str:
    """Convert HTML to plain text."""
    extractor = HTMLTextExtractor()
    try:
        extractor.feed(html)
        return extractor.get_text()
    except Exception:
        # Fallback: regex strip
        return re.sub(r"<[^>]+>", " ", html)


def extract_links(html: str) -> list[str]:
    """Extract all href URLs from HTML."""
    parser = LinkExtractor()
    try:
        parser.feed(html)
        return parser.links
    except Exception:
        # Fallback: regex
        return re.findall(r'href=["\']?(https?://[^"\'>\s]+)', html)


def decode_tracking_url(url: str) -> str | None:
    """Attempt to decode tracking/redirect URLs to find the real destination.

    Handles:
    - Every.to: /emails/click/{hash}/{base64} with JSON payload containing 'url'
    - Generic: URLs with base64 segments that decode to JSON with 'url' field
    """
    # Every.to tracking URLs
    match = re.match(r"https://every\.to/emails/click/[^/]+/([A-Za-z0-9+/=_-]+)", url)
    if match:
        try:
            # Pad base64 if needed
            b64 = match.group(1)
            b64 += "=" * (4 - len(b64) % 4) if len(b64) % 4 else ""
            payload = json.loads(base64.urlsafe_b64decode(b64))
            real_url = unquote(payload.get("url", ""))
            if real_url.startswith("http"):
                return real_url
        except Exception:
            pass
    return None


def is_domain_allowed(url: str, allowed_domains: list[str]) -> bool:
    """Check if a URL's domain matches the allowlist."""
    try:
        hostname = urlparse(url).hostname or ""
        return any(hostname == d or hostname.endswith("." + d) for d in allowed_domains)
    except Exception:
        return False


def is_article_url(url: str) -> bool:
    """Heuristic: is this likely an article URL (not navigation/social/unsubscribe)?"""
    path = urlparse(url).path.lower()

    # Skip obvious non-article URLs
    skip_patterns = [
        "/unsubscribe", "/subscribe", "/account", "/login", "/signup",
        "/settings", "/preferences", "/manage", "/help", "/about",
        "/privacy", "/terms", "/contact", "/jobs", "/careers",
        "/favicon", "/apple-touch", "/manifest",
    ]
    if any(p in path for p in skip_patterns):
        return False

    # Skip social media profile links
    hostname = urlparse(url).hostname or ""
    if hostname in ("twitter.com", "x.com", "linkedin.com", "www.linkedin.com",
                     "facebook.com", "instagram.com"):
        return False

    # Skip image/asset URLs
    if re.search(r"\.(png|jpg|jpeg|gif|svg|webp|ico|css|js)(\?|$)", path):
        return False

    # Prefer URLs with path depth (likely articles)
    segments = [s for s in path.split("/") if s]
    return len(segments) >= 1


def fetch_article(url: str, timeout: int = 10, max_size: int = 1_000_000) -> dict:
    """Fetch an article URL and return {url, content, error}.

    Security: plain HTTP GET, max 2 redirects, size cap, no JS execution.
    """
    try:
        req = Request(url, headers={
            "User-Agent": "HeartOfGold/1.0 (content-pipeline)",
            "Accept": "text/html,text/plain",
        })
        # Python's urlopen follows redirects by default (max ~10).
        # We check the final URL to ensure it's still on allowlist.
        resp = urlopen(req, timeout=timeout)

        # Check content length before reading
        content_length = resp.headers.get("Content-Length", "0")
        if content_length.isdigit() and int(content_length) > max_size:
            return {"url": url, "content": "", "error": f"Too large: {content_length} bytes"}

        # Read with size cap
        raw = resp.read(max_size)
        content_type = resp.headers.get("Content-Type", "")

        if "text/html" in content_type:
            html = raw.decode("utf-8", errors="replace")
            text = strip_html(html)
        elif "text/plain" in content_type:
            text = raw.decode("utf-8", errors="replace")
        else:
            return {"url": url, "content": "", "error": f"Unsupported content type: {content_type}"}

        # Truncate to reasonable size for a signal
        if len(text) > 5000:
            text = text[:5000] + "..."

        return {"url": url, "content": text, "error": None}

    except HTTPError as e:
        return {"url": url, "content": "", "error": f"HTTP {e.code}"}
    except URLError as e:
        return {"url": url, "content": "", "error": str(e.reason)[:100]}
    except Exception as e:
        return {"url": url, "content": "", "error": str(e)[:100]}


def fetch_message_body(msg_id: str) -> str | None:
    """Fetch full email body via gws CLI. Returns HTML string or None."""
    try:
        result = subprocess.run(
            ["gws", "gmail", "users", "messages", "get",
             "--params", json.dumps({"userId": "me", "id": msg_id, "format": "full"}),
             "--format", "json"],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode != 0:
            print(f"  gws get {msg_id}: exit {result.returncode}", file=sys.stderr)
            return None

        msg = json.loads(result.stdout)
        payload = msg.get("payload", {})

        # Find HTML body — either top-level or in parts
        return _extract_body(payload)

    except Exception as e:
        print(f"  gws get {msg_id}: {e}", file=sys.stderr)
        return None


def _extract_body(payload: dict) -> str | None:
    """Recursively extract HTML or text body from Gmail API payload."""
    mime = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")

    # Direct body
    if body_data and ("text/html" in mime or "text/plain" in mime):
        return base64.urlsafe_b64decode(body_data).decode("utf-8", errors="replace")

    # Multipart — recurse into parts, prefer HTML
    parts = payload.get("parts", [])
    html_body = None
    text_body = None
    for part in parts:
        result = _extract_body(part)
        if result:
            part_mime = part.get("mimeType", "")
            if "text/html" in part_mime:
                html_body = result
            elif "text/plain" in part_mime and not text_body:
                text_body = result

    return html_body or text_body


def process_messages(messages: list, config: dict) -> list:
    """Process message list into enriched signal objects."""
    fetch_body = config.get("fetch_body", False)
    follow_links = config.get("follow_links", False)
    allowed_domains = config.get("allowed_domains", [])
    max_links = config.get("max_links_per_email", 5)
    link_timeout = config.get("link_timeout_seconds", 10)

    signals = []

    for email in messages:
        subject = email.get("subject", "") or ""
        sender = email.get("from", "") or ""
        date_str = email.get("date", "") or ""
        msg_id = email.get("id", "") or ""

        if not subject or len(subject.strip()) < 5:
            continue

        # Parse date
        published = datetime.now(timezone.utc).isoformat()
        if date_str:
            for fmt in ('%a, %d %b %Y %H:%M:%S %z', '%a, %d %b %Y %H:%M:%S %z (%Z)',
                        '%a, %d %b %Y %H:%M:%S %Z'):
                try:
                    published = datetime.strptime(date_str.strip(), fmt).isoformat()
                    break
                except (ValueError, TypeError):
                    continue

        # Start with subject as content (backward compatible)
        content = subject
        article_links = []
        articles = []

        # Fetch full body if enabled
        html_body = None
        if fetch_body and msg_id:
            html_body = fetch_message_body(msg_id)
            if html_body:
                content = strip_html(html_body)
                if len(content) > 3000:
                    content = content[:3000] + "..."
                print(f"  {subject[:50]}: body fetched ({len(content)} chars)", file=sys.stderr)

        # Extract and follow links if enabled
        if follow_links and html_body and allowed_domains:
            raw_links = extract_links(html_body)

            # Resolve tracking URLs and filter
            candidate_links = []
            for link in raw_links:
                # Try to decode tracking redirects
                real_url = decode_tracking_url(link)
                if real_url:
                    link = real_url

                if is_domain_allowed(link, allowed_domains) and is_article_url(link):
                    if link not in candidate_links:
                        candidate_links.append(link)

            article_links = candidate_links[:max_links]

            if article_links:
                print(f"  {subject[:50]}: following {len(article_links)} links", file=sys.stderr)
                # Fetch articles in parallel
                with ThreadPoolExecutor(max_workers=5) as executor:
                    futures = {
                        executor.submit(fetch_article, url, link_timeout): url
                        for url in article_links
                    }
                    for future in as_completed(futures):
                        result = future.result()
                        if result["content"]:
                            articles.append(result)
                        elif result["error"]:
                            print(f"    {result['url'][:60]}: {result['error']}", file=sys.stderr)

        signals.append({
            "source": "gmail",
            "title": subject,
            "url": f"gmail://message/{msg_id}",
            "content": content,
            "published_at": published,
            "metadata": {
                "sender": sender,
                "subject": subject,
                "message_id": msg_id,
                "article_links": article_links if article_links else None,
                "articles": articles if articles else None,
            }
        })

    return signals


def main():
    data = json.load(sys.stdin)
    messages = data.get("messages", [])
    config = data.get("config", {})

    signals = process_messages(messages, config)
    json.dump(signals, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
