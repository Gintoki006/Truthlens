"""
TruthLens — FastAPI Backend
AI-Based Fake News Detection System
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# ── Lifespan: load models once on startup ──────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models and NLP resources on startup, clean up on shutdown."""
    from services.ml import load_models
    from services.nlp import download_nlp_resources

    print("[*] Loading ML models...")
    load_models()
    print("[OK] ML models loaded")

    print("[*] Downloading NLP resources...")
    download_nlp_resources()
    print("[OK] NLP resources ready")

    print("[*] Loading FEVER index...")
    from services.fever_index import load_fever_index
    load_fever_index()
    print("[OK] FEVER index ready")

    # Start feed scheduler
    from scheduler import start_scheduler, shutdown_scheduler
    start_scheduler()

    yield  # App is running

    print("[STOP] Shutting down...")
    shutdown_scheduler()


# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="TruthLens API",
    description="AI-Based Fake News Detection System",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print(f"CORS initialized with origins: {ALLOWED_ORIGINS}")

# ── Routes ──────────────────────────────────────────────────────────────────
from routes.analyze import router as analyze_router
from routes.history import router as history_router
from routes.vote import router as vote_router
from routes.bookmarks import router as bookmarks_router
from routes.rewrite import router as rewrite_router
from routes.feed import router as feed_router
from routes.stats import router as stats_router

app.include_router(analyze_router, prefix="/api")
app.include_router(history_router, prefix="/api")
app.include_router(vote_router, prefix="/api")
app.include_router(bookmarks_router, prefix="/api")
app.include_router(rewrite_router, prefix="/api")
app.include_router(feed_router, prefix="/api")
app.include_router(stats_router, prefix="/api")


@app.get("/")
async def health():
    return {"status": "ok", "service": "TruthLens API"}
