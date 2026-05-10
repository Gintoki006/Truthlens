"""
Article scraping service using newspaper3k.
Extracts title, body text, authors, and source domain from a URL.
"""

from urllib.parse import urlparse

from newspaper import Article


def scrape_article(url: str) -> dict:
    """
    Scrape an article from a URL using newspaper3k.

    Returns:
        dict with keys: title, body, authors, source_domain, success, error
    """
    try:
        article = Article(url)
        article.download()
        article.parse()

        source_domain = urlparse(url).netloc.lower()
        # Strip www. prefix for cleaner domain matching
        if source_domain.startswith("www."):
            source_domain = source_domain[4:]

        return {
            "title": article.title or "Untitled",
            "body": article.text or "",
            "authors": article.authors or [],
            "source_domain": source_domain,
            "publish_date": article.publish_date,
            "success": True,
            "error": None,
        }

    except Exception as e:
        return {
            "title": None,
            "body": None,
            "authors": [],
            "source_domain": None,
            "success": False,
            "error": f"Failed to scrape article: {str(e)}. Try pasting the article text directly.",
        }
