from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
from services.feed_analyzer import process_live_feed

# Global scheduler instance
scheduler = AsyncIOScheduler()

def start_scheduler():
    """Configure and start the background scheduler."""
    # Run the feed analyzer every 60 minutes to stay within NewsAPI's 100 requests/day free tier (4 categories * 24 = 96 requests/day)
    scheduler.add_job(
        process_live_feed, 
        'interval', 
        minutes=60, 
        id='live_feed_job', 
        replace_existing=True,
        next_run_time=datetime.now()
    )
    scheduler.start()
    print("[*] Scheduler started. Live feed will refresh every 60 minutes.")

def shutdown_scheduler():
    """Gracefully shut down the scheduler."""
    scheduler.shutdown()
    print("[*] Scheduler shut down.")
