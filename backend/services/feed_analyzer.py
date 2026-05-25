import os
from urllib.parse import urlparse
from supabase import create_client

from services.news_fetcher import fetch_top_headlines
from routes.analyze import analyze, AnalyzeRequest

async def process_live_feed():
    """
    Fetch top headlines, analyze new ones, and store in feed_item table.
    """
    print("[*] Starting feed analyzer job...")
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not supabase_url or not supabase_key:
        print("[-] Supabase env vars missing. Aborting feed_analyzer.")
        return

    supabase = create_client(supabase_url, supabase_key)
    
    categories = ["general", "science", "health", "technology"]
    
    for category in categories:
        print(f"[*] Fetching headlines for category: {category}")
        articles = await fetch_top_headlines(category=category, limit=5)
        
        for article in articles:
            url = article["article_url"]
            
            # Check if we already processed this URL
            existing = supabase.table("feed_item").select("id").eq("article_url", url).execute()
            if existing.data:
                print(f"    [SKIP] Already processed: {article['headline']}")
                continue
                
            print(f"    [ANALYZE] {article['headline']}")
            try:
                # Run through the existing analysis pipeline
                req = AnalyzeRequest(url=url)
                # Call the analyze route handler directly
                response = await analyze(req)
                
                # Extract domain
                domain = None
                try:
                    domain = urlparse(url).netloc.replace("www.", "")
                except:
                    domain = article.get("source_name")

                # Insert into feed_item
                feed_row = {
                    "analysis_id": response.id,
                    "headline": article["headline"],
                    "source_name": article.get("source_name", "Unknown"),
                    "source_domain": domain,
                    "article_url": url,
                    "published_at": article["published_at"].isoformat() if article.get("published_at") else None,
                    "category": category,
                    "score_final": response.score_final,
                    "verdict": response.verdict,
                }
                
                res = supabase.table("feed_item").insert(feed_row).execute()
                if res.data:
                    print(f"    [SUCCESS] Saved feed item: {article['headline']}")
            except Exception as e:
                print(f"    [ERROR] Failed to analyze {url}: {e}")
                
    print("[*] Feed analyzer job complete.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(process_live_feed())
