"""
Source Seeding Script
====================

One-time script that merges three datasets and upserts them into the
Supabase `source` table:

  1. OpenSources (~2,500 domains)
  2. Media Bias / Fact Check sample (~500 domains)
  3. Indian outlets (manual, ~/data/indian_sources.csv)

Usage:
    python scripts/seed_sources.py

Requires:
    SUPABASE_URL and SUPABASE_SERVICE_KEY in environment or .env file.
"""

import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

# Load env from backend/.env
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Label → trust score mapping for OpenSources ────────────────────────────
OPENSOURCES_LABEL_MAP = {
    "reliable": 85,
    "bias": 60,
    "clickbait": 40,
    "satire": 50,
    "conspiracy": 15,
    "fake": 10,
    "junksci": 12,
    "hate": 8,
}


def load_opensources() -> pd.DataFrame:
    """
    Load OpenSources dataset.
    Expected CSV columns: url, type, 2nd_type, 3rd_type, active
    Download from: https://github.com/several27/FakeNewsCorpus (sources.csv)
    Place at: data/opensources.csv
    """
    path = Path(__file__).parent.parent / "data" / "opensources.csv"
    if not path.exists():
        print(f"⚠️ OpenSources CSV not found at {path}. Skipping.")
        return pd.DataFrame()

    df = pd.read_csv(path)
    
    # Rename url column to domain
    if "url" in df.columns:
        df = df.rename(columns={"url": "domain"})
        
    # Use the primary 'type' column for scoring
    df["trust_score"] = df["type"].str.lower().map(OPENSOURCES_LABEL_MAP).fillna(50).astype(int)
    df["category"] = df["type"].str.lower()
    df["bias"] = "unknown"
    df["dataset_origin"] = "opensources"

    # Standardize to required columns
    df = df[["domain", "trust_score", "category", "bias", "dataset_origin"]].copy()
    df["domain"] = df["domain"].str.lower().str.strip()
    return df


def load_mbfc() -> pd.DataFrame:
    """
    Load Media Bias / Fact Check sample dataset.
    Expected CSV columns from Kaggle: site_name, url, bias_rating, factual_reporting_rating
    Place at: data/mbfc.csv
    """
    path = Path(__file__).parent.parent / "data" / "mbfc.csv"
    if not path.exists():
        print(f"⚠️ MBFC CSV not found at {path}. Skipping.")
        return pd.DataFrame()

    df = pd.read_csv(path)

    # Extract domain from URL
    df["domain"] = df["url"].str.extract(r'https?://(?:www\.)?([^/]+)')
    
    # Map factual_reporting_rating to trust_score
    if "factual_reporting_rating" in df.columns:
        cred_map = {"high": 85, "mixed": 50, "low": 30, "very low": 15}
        df["trust_score"] = df["factual_reporting_rating"].str.lower().map(cred_map).fillna(50).astype(int)
    else:
        df["trust_score"] = 50

    if "bias_rating" not in df.columns:
        df["bias"] = "unknown"
    else:
        # Convert numeric bias to categories if needed, or just store as string
        df["bias"] = df["bias_rating"].astype(str).str.strip()

    df["category"] = "reliable"  # default
    df["dataset_origin"] = "mbfc"
    
    # Drop rows without a valid domain
    df = df.dropna(subset=["domain"])
    
    df = df[["domain", "trust_score", "category", "bias", "dataset_origin"]].copy()
    df["domain"] = df["domain"].str.lower().str.strip()
    return df


def load_indian_sources() -> pd.DataFrame:
    """Load the manually curated Indian news sources CSV."""
    path = Path(__file__).parent.parent / "data" / "indian_sources.csv"
    if not path.exists():
        print(f"⚠️ Indian sources CSV not found at {path}. Skipping.")
        return pd.DataFrame()

    df = pd.read_csv(path)
    df["domain"] = df["domain"].str.lower().str.strip()
    return df


def main():
    print("📊 Loading datasets...")

    opensources = load_opensources()
    print(f"  OpenSources: {len(opensources)} domains")

    mbfc = load_mbfc()
    print(f"  MBFC: {len(mbfc)} domains")

    indian = load_indian_sources()
    print(f"  Indian outlets: {len(indian)} domains")

    # Merge all datasets, priority: Indian > MBFC > OpenSources
    all_dfs = [df for df in [opensources, mbfc, indian] if len(df) > 0]
    if not all_dfs:
        print("❌ No datasets found. Place CSVs in /data/ directory.")
        sys.exit(1)

    combined = pd.concat(all_dfs, ignore_index=True)
    # Keep last occurrence (Indian > MBFC > OpenSources due to concat order)
    combined = combined.drop_duplicates(subset="domain", keep="last")

    # Add last_updated
    combined["last_updated"] = pd.Timestamp.now().strftime("%Y-%m-%d")

    print(f"\n📦 Total unique domains: {len(combined)}")
    print("⏳ Upserting to Supabase...")

    # Upsert in batches of 500
    records = combined.to_dict(orient="records")
    batch_size = 500
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        supabase.table("source").upsert(batch).execute()
        print(f"  ✅ Upserted {min(i + batch_size, len(records))}/{len(records)}")

    print(f"\n🎉 Done! {len(records)} domains seeded to Supabase.")


if __name__ == "__main__":
    main()
