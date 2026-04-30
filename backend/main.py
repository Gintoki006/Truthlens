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

    print("⏳ Loading ML models...")
    load_models()
    print("✅ ML models loaded")

    print("⏳ Downloading NLP resources...")
    download_nlp_resources()
    print("✅ NLP resources ready")

    yield  # App is running

    print("🛑 Shutting down...")


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

# ── Routes ──────────────────────────────────────────────────────────────────
from routes.analyze import router as analyze_router
from routes.history import router as history_router
from routes.vote import router as vote_router

app.include_router(analyze_router, prefix="/api")
app.include_router(history_router, prefix="/api")
app.include_router(vote_router, prefix="/api")


@app.get("/")
async def health():
    return {"status": "ok", "service": "TruthLens API"}
