"""
seed_fever_supabase.py
──────────────────────
Reads the precomputed FEVER embeddings from local disk cache and uploads
them in batches to the Supabase `fever_index` table.

Prerequisite:
  - Run the SQL migration (fever_migration.sql) in Supabase first.
  - Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in backend/.env

Usage (run from the project root or backend/ directory):
  python scripts/seed_fever_supabase.py

It is safe to re-run. If the table already has rows the script will warn
you and ask whether to truncate first.
"""

import os
import sys
import pickle
import time
from pathlib import Path

# ── Resolve paths ──────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent / "backend"
CACHE_DIR   = BACKEND_DIR / "data" / "fever_cache"

EMBEDDINGS_PATH = CACHE_DIR / "fever_embeddings.npy"
CLAIMS_PATH     = CACHE_DIR / "fever_claims.pkl"
LABELS_PATH     = CACHE_DIR / "fever_labels.pkl"

# ── Load .env ──────────────────────────────────────────────────────────────
env_path = BACKEND_DIR / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)
    print(f"[ENV] Loaded .env from {env_path}")
else:
    print(f"[WARN] No .env found at {env_path} — make sure env vars are set.")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Exiting.")
    sys.exit(1)

# ── Validate cache files ───────────────────────────────────────────────────
for p in (EMBEDDINGS_PATH, CLAIMS_PATH, LABELS_PATH):
    if not p.exists():
        print(f"[ERROR] Missing cache file: {p}")
        sys.exit(1)

print("[*] All cache files found.")
print(f"    embeddings : {EMBEDDINGS_PATH}  ({EMBEDDINGS_PATH.stat().st_size / 1e6:.1f} MB)")
print(f"    claims     : {CLAIMS_PATH}  ({CLAIMS_PATH.stat().st_size / 1e6:.1f} MB)")
print(f"    labels     : {LABELS_PATH}  ({LABELS_PATH.stat().st_size / 1e6:.1f} MB)")

# ── Load cache files ───────────────────────────────────────────────────────
import numpy as np

print("\n[*] Loading embeddings from disk… (this may take a few seconds)")
t0 = time.time()
embeddings = np.load(str(EMBEDDINGS_PATH))
print(f"    embeddings shape : {embeddings.shape}  (took {time.time() - t0:.1f}s)")

with open(str(CLAIMS_PATH), "rb") as f:
    claims = pickle.load(f)
with open(str(LABELS_PATH), "rb") as f:
    labels = pickle.load(f)

total = len(claims)
print(f"    total claims     : {total:,}")
assert len(labels) == total, "Mismatch between claims and labels count!"
assert embeddings.shape[0] == total, "Mismatch between embeddings and claims count!"
assert embeddings.shape[1] == 384, f"Expected 384-dim embeddings, got {embeddings.shape[1]}"

# ── Connect to Supabase ────────────────────────────────────────────────────
print("\n[*] Connecting to Supabase…")
from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
print(f"    URL: {SUPABASE_URL}")

# ── Check if table already has rows ───────────────────────────────────────
existing = supabase.table("fever_index").select("id", count="exact").limit(1).execute()
existing_count = existing.count or 0

if existing_count > 0:
    print(f"\n[WARN] fever_index already has {existing_count:,} rows.")
    answer = input("         Truncate and re-seed? (yes/no): ").strip().lower()
    if answer == "yes":
        print("[*] Truncating fever_index table…")
        supabase.rpc("truncate_fever_index", {}).execute()
        print("[OK] Table truncated.")
    else:
        print("[SKIP] Seeding skipped. Exiting.")
        sys.exit(0)

# ── Upload in batches ──────────────────────────────────────────────────────
BATCH_SIZE = 500   # keep payload size small to avoid HTTP 413

print(f"\n[*] Uploading {total:,} claims in batches of {BATCH_SIZE}…")
start = time.time()
errors = 0

for batch_start in range(0, total, BATCH_SIZE):
    batch_end  = min(batch_start + BATCH_SIZE, total)
    batch_rows = [
        {
            "claim":     claims[i],
            "label":     labels[i],
            "embedding": embeddings[i].tolist(),  # list[float] — JSON-serializable
        }
        for i in range(batch_start, batch_end)
    ]

    try:
        supabase.table("fever_index").insert(batch_rows).execute()
    except Exception as e:
        print(f"\n  [ERROR] Batch {batch_start}–{batch_end} failed: {e}")
        errors += 1
        time.sleep(2)   # back off before next batch
        continue

    # Progress
    done = batch_end
    pct  = done / total * 100
    elapsed = time.time() - start
    eta     = (elapsed / done) * (total - done) if done > 0 else 0
    print(
        f"  [{pct:5.1f}%]  {done:>7,} / {total:,}  "
        f"| elapsed {elapsed:6.1f}s  | ETA {eta:6.1f}s",
        end="\r",
    )

elapsed_total = time.time() - start
print(f"\n\n[DONE] Uploaded {total:,} claims in {elapsed_total:.1f}s  ({errors} errors)")
if errors:
    print(f"[WARN] {errors} batches failed — you may want to re-run the script.")
else:
    print("[OK] fever_index table is fully seeded and ready to use!")
