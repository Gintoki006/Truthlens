"""
post_extractor.py — Fetch and extract content from social post URLs and direct image links.

Handles:
  - Direct image URLs  (image/jpeg, image/png, image/webp, image/gif)
  - HTML pages with OpenGraph / Twitter Card metadata
  - Fails gracefully with specific error messages for downstream handling

Security:
  - 10-second timeout on all requests
  - 10MB download cap
  - Content-type checked before downloading full body
"""

import logging
import re

import urllib.parse
import httpx

logger = logging.getLogger(__name__)

MAX_BYTES = 10 * 1024 * 1024  # 10 MB
TIMEOUT   = 10.0               # seconds

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Browser-like UA so most sites don't block us outright
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _mime_from_content_type(content_type: str) -> str:
    """Strip parameters, e.g. 'image/jpeg; charset=utf-8' -> 'image/jpeg'."""
    return content_type.split(";")[0].strip().lower()


def _ext_from_mime(mime: str) -> str:
    return {
        "image/jpeg": "jpg",
        "image/png":  "png",
        "image/webp": "webp",
        "image/gif":  "gif",
    }.get(mime, "jpg")


async def _download_image(url: str, client: httpx.AsyncClient) -> tuple[bytes, str]:
    """
    Stream-download an image URL, capping at MAX_BYTES.
    Returns (image_bytes, mime_type).
    """
    async with client.stream("GET", url, headers=HEADERS, timeout=TIMEOUT) as resp:
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/jpeg")
        mime = _mime_from_content_type(content_type)

        chunks = []
        total = 0
        async for chunk in resp.aiter_bytes(chunk_size=65536):
            total += len(chunk)
            if total > MAX_BYTES:
                raise ValueError(f"Image at {url} exceeds 10 MB limit.")
            chunks.append(chunk)

    return b"".join(chunks), mime


def _parse_og(html: str) -> dict:
    """
    Extract OpenGraph and Twitter Card meta tags from raw HTML string.
    Returns dict with keys: title, description, image_url
    """
    # We use regex here to avoid a BeautifulSoup dependency assumption.
    # If beautifulsoup4 is installed, we prefer it.
    result = {"title": None, "description": None, "image_url": None}
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")

        def _meta(prop_attr: str, prop_val: str) -> str | None:
            tag = soup.find("meta", attrs={prop_attr: prop_val})
            return tag["content"].strip() if tag and tag.get("content") else None

        result["title"] = (
            _meta("property", "og:title")
            or _meta("name", "twitter:title")
            or (soup.title.string.strip() if soup.title else None)
        )
        result["description"] = (
            _meta("property", "og:description")
            or _meta("name", "twitter:description")
        )
        result["image_url"] = (
            _meta("property", "og:image")
            or _meta("name", "twitter:image")
            or _meta("name", "twitter:image:src")
        )
    except ImportError:
        # Fallback regex — less accurate but zero extra deps
        def _re_meta(patterns: list[str]) -> str | None:
            for pattern in patterns:
                m = re.search(pattern, html, re.IGNORECASE)
                if m:
                    return m.group(1).strip()
            return None

        result["title"] = _re_meta([
            r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+name=["\']twitter:title["\'][^>]+content=["\']([^"\']+)["\']',
            r'<title[^>]*>([^<]+)</title>',
        ])
        result["description"] = _re_meta([
            r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+name=["\']twitter:description["\'][^>]+content=["\']([^"\']+)["\']',
        ])
        result["image_url"] = _re_meta([
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+name=["\']twitter:image:src["\'][^>]+content=["\']([^"\']+)["\']',
        ])

    return result


async def fetch_post_content(url: str) -> dict:
    """
    Main entry point.

    Given a URL, determines its content type and extracts:
      - image_bytes   : raw image bytes (if found)
      - mime_type     : MIME type of the image
      - filename      : suggested filename for storage
      - context_text  : OG title + description text (may be None)
      - text_only     : True if we extracted text but no image

    Raises ValueError with a human-readable message on hard failures.

    Returns:
        {
            "image_bytes":   bytes | None,
            "mime_type":     str | None,
            "filename":      str | None,
            "context_text":  str | None,
            "text_only":     bool,
        }
    """
    logger.info(f"[POST_EXTRACTOR] Fetching: {url}")

    # ── Twitter / X Interceptor ──────────────────────────────────────
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc in ["x.com", "www.x.com", "twitter.com", "www.twitter.com"]:
        api_url = f"https://api.vxtwitter.com{parsed.path}"
        logger.info(f"[POST_EXTRACTOR] Rewriting Twitter URL to: {api_url}")
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
                resp = await client.get(api_url, timeout=TIMEOUT)
                resp.raise_for_status()
                data = resp.json()
                
                text = data.get('text', '')
                user = data.get('user_screen_name', 'unknown')
                context_text = f"Author: @{user}\nText: {text}"
                
                image_bytes, mime, ext = None, None, None
                media_urls = data.get('mediaURLs', [])
                if media_urls:
                    # Fetch first media
                    img_resp = await client.get(media_urls[0], timeout=TIMEOUT)
                    img_resp.raise_for_status()
                    image_bytes = img_resp.content
                    mime = _mime_from_content_type(img_resp.headers.get("content-type", "image/jpeg"))
                    ext = _ext_from_mime(mime)
                
                return {
                    "image_bytes": image_bytes,
                    "mime_type": mime,
                    "filename": f"post_image.{ext}" if ext else None,
                    "context_text": context_text,
                    "text_only": image_bytes is None,
                }
        except Exception as e:
            logger.warning(f"[POST_EXTRACTOR] vxtwitter extraction failed: {e}")
            raise ValueError("Could not extract Twitter post. Ensure the link points to a valid public tweet.")

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        # ── HEAD request to determine content type cheaply ──────────────
        try:
            head = await client.head(url, headers=HEADERS, timeout=TIMEOUT)
            content_type = _mime_from_content_type(
                head.headers.get("content-type", "")
            )
        except Exception:
            # Some servers refuse HEAD — fall back to GET
            content_type = ""

        # ── Path A: direct image URL ─────────────────────────────────────
        if content_type in IMAGE_TYPES:
            logger.info(f"[POST_EXTRACTOR] Direct image ({content_type}): {url}")
            image_bytes, mime = await _download_image(url, client)
            ext = _ext_from_mime(mime)
            return {
                "image_bytes": image_bytes,
                "mime_type":   mime,
                "filename":    f"post_image.{ext}",
                "context_text": None,
                "text_only":   False,
            }

        # ── Path B: HTML page — extract OG metadata ──────────────────────
        logger.info(f"[POST_EXTRACTOR] HTML page — extracting OpenGraph metadata: {url}")
        try:
            resp = await client.get(url, headers=HEADERS, timeout=TIMEOUT)
            resp.raise_for_status()

            # Safety: only read up to 5 MB for HTML parsing
            html = resp.text[:5 * 1024 * 1024]
        except httpx.HTTPStatusError as e:
            raise ValueError(
                f"Could not fetch post URL (HTTP {e.response.status_code}). "
                "The page may require login or is protected."
            )
        except Exception as e:
            raise ValueError(f"Failed to fetch post URL: {e}")

        og = _parse_og(html)

        # Build a clean context string from whatever text we found
        context_parts = []
        if og["title"]:
            context_parts.append(og["title"])
        if og["description"]:
            context_parts.append(og["description"])
        context_text = "\n".join(context_parts) if context_parts else None

        logger.info(
            f"[POST_EXTRACTOR] OG results — title={bool(og['title'])} "
            f"description={bool(og['description'])} image={bool(og['image_url'])}"
        )

        # ── Path B1: OG image found ─────────────────────────────────────
        if og["image_url"]:
            try:
                image_bytes, mime = await _download_image(og["image_url"], client)
                ext = _ext_from_mime(mime)
                logger.info(f"[POST_EXTRACTOR] Downloaded og:image ({mime})")
                return {
                    "image_bytes": image_bytes,
                    "mime_type":   mime,
                    "filename":    f"post_image.{ext}",
                    "context_text": context_text,
                    "text_only":   False,
                }
            except Exception as e:
                logger.warning(f"[POST_EXTRACTOR] og:image download failed: {e} — falling back to text")

        # ── Path B2: text only (no OG image or download failed) ─────────
        if context_text:
            logger.info("[POST_EXTRACTOR] No image — returning text-only content")
            return {
                "image_bytes": None,
                "mime_type":   None,
                "filename":    None,
                "context_text": context_text,
                "text_only":   True,
            }

        # ── Path C: total failure ────────────────────────────────────────
        raise ValueError(
            "Could not extract any content from this URL. "
            "The page may be login-protected (e.g. Instagram) or have no metadata."
        )
