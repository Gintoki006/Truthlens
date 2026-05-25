import os
import httpx
from datetime import datetime

NEWS_API_URL = "https://newsapi.org/v2/top-headlines"

async def fetch_top_headlines(category: str = "general", limit: int = 10) -> list[dict]:
    """
    Fetch top headlines for a given category in India.
    Categories: business, entertainment, general, health, science, sports, technology
    """
    api_key = os.getenv("NEWS_API_KEY")
    if not api_key:
        print("[-] NEWS_API_KEY is not set. Cannot fetch news.")
        return []

    params = {
        "country": "us",
        "category": category,
        "pageSize": limit,
        "apiKey": api_key,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(NEWS_API_URL, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            articles = []
            for item in data.get("articles", []):
                if not item.get("url") or not item.get("title") or item.get("title") == "[Removed]":
                    continue
                    
                published_at = item.get("publishedAt")
                if published_at:
                    try:
                        # Normalize to datetime object
                        published_at = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                    except Exception:
                        published_at = None

                articles.append({
                    "headline": item.get("title"),
                    "article_url": item.get("url"),
                    "source_name": item.get("source", {}).get("name"),
                    "published_at": published_at,
                    "category": category,
                })
            
            return articles
    except Exception as e:
        print(f"[-] Error fetching news for category {category}: {e}")
        return []
