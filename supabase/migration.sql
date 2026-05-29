-- TruthLens Database Schema
-- Run this in the Supabase SQL Editor to set up the database.

-- ============================================================================
-- Table: source (credibility reference data, ~3,050 domains)
-- ============================================================================

CREATE TABLE IF NOT EXISTS source (
  domain          TEXT PRIMARY KEY,
  trust_score     INT,                          -- 0–100; unknown domains default to 50
  category        TEXT,                         -- 'reliable' | 'fake' | 'satire' | 'clickbait' | 'conspiracy' | 'bias' | 'junksci' | 'hate'
  bias            TEXT,                         -- 'left' | 'center' | 'right' | 'unknown'
  dataset_origin  TEXT,                         -- 'opensources' | 'mbfc' | 'india_manual'
  last_updated    DATE
);

-- Source table is public read (no RLS) — all users can read domain trust scores
-- No RLS enabled on this table intentionally.


-- ============================================================================
-- Table: analysis (one row per article checked)
-- ============================================================================

CREATE TABLE IF NOT EXISTS analysis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users ON DELETE SET NULL,
  input_type      TEXT CHECK (input_type IN ('url', 'text')),
  raw_input       TEXT NOT NULL,
  article_title   TEXT,
  article_body    TEXT,
  source_domain   TEXT,

  score_final     INT,
  score_nlp       INT,
  score_source    INT,
  score_ml        INT,
  score_roberta   INT,
  score_lr        INT,

  verdict         TEXT CHECK (verdict IN ('real', 'suspicious', 'fake')),
  explanation     TEXT,
  sentences       JSONB,

  votes_up        INT DEFAULT 0,
  votes_down      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast history queries
CREATE INDEX IF NOT EXISTS idx_analysis_user_created 
  ON analysis (user_id, created_at DESC);


-- ============================================================================
-- Row Level Security (RLS) on analysis table
-- ============================================================================

ALTER TABLE analysis ENABLE ROW LEVEL SECURITY;

-- Users can read their own analyses
CREATE POLICY "Users read own analyses"
  ON analysis FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert analyses (user_id auto-set to auth.uid(), or null for guests)
CREATE POLICY "Users insert own analyses"
  ON analysis FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow public read for analyses without user_id (guest analyses)
-- This allows the results page to load without auth for shared links
CREATE POLICY "Public read guest analyses"
  ON analysis FOR SELECT
  USING (user_id IS NULL);

-- Allow service role to read/write all (for backend operations)
-- The service role key bypasses RLS by default in Supabase.


-- ============================================================================
-- Enable Realtime on analysis table (for live history updates)
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE analysis;


-- ============================================================================
-- Migration: Add crosscheck columns to analysis table (run after initial setup)
-- ============================================================================

ALTER TABLE analysis ADD COLUMN IF NOT EXISTS score_crosscheck INT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS crosscheck_sources JSONB;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS crosscheck_fallback BOOLEAN DEFAULT FALSE;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS article_age_hours INT;


-- ============================================================================
-- Table: bookmarks (saved articles per user)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookmarks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  analysis_id     UUID NOT NULL REFERENCES analysis(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, analysis_id)
);

-- Index for fast bookmark lookups
CREATE INDEX IF NOT EXISTS idx_bookmarks_user
  ON bookmarks (user_id, created_at DESC);

-- RLS on bookmarks
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own bookmarks"
  ON bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own bookmarks"
  ON bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own bookmarks"
  ON bookmarks FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- Migration: Add fact verification columns to analysis table (Signal 5)
-- ============================================================================

ALTER TABLE analysis ADD COLUMN IF NOT EXISTS score_factcheck INT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS score_fever INT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS score_gfactcheck INT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS score_wikidata INT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS factcheck_details JSONB;

-- ============================================================================
-- Migration: Add 3-Group Architecture overrides to analysis table (Phase 11)
-- ============================================================================

ALTER TABLE analysis ADD COLUMN IF NOT EXISTS score_override INT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS score_override_reason TEXT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS text_only_formula BOOLEAN;

-- ============================================================================
-- Migration: Add Live Analyzed News Feed table (Phase 12)
-- ============================================================================

CREATE TABLE IF NOT EXISTS feed_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id     UUID REFERENCES analysis(id) ON DELETE SET NULL,
  headline        TEXT NOT NULL,
  source_name     TEXT,
  source_domain   TEXT,
  article_url     TEXT,
  published_at    TIMESTAMPTZ,
  category        TEXT,  -- 'politics' | 'health' | 'sports' | 'tech' | 'general'
  score_final     INT,
  verdict         TEXT CHECK (verdict IN ('real', 'suspicious', 'fake')),
  analyzed_at     TIMESTAMPTZ DEFAULT NOW(),
  is_stale        BOOLEAN DEFAULT FALSE
);

-- Index for fast feed queries by category and recency
CREATE INDEX IF NOT EXISTS idx_feed_category_published 
  ON feed_item (category, published_at DESC);

-- Enable RLS
ALTER TABLE feed_item ENABLE ROW LEVEL SECURITY;

-- Allow public read of all feed items
CREATE POLICY "Public read feed_items"
  ON feed_item FOR SELECT
  USING (true);

-- Enable Realtime on feed_item table
ALTER PUBLICATION supabase_realtime ADD TABLE feed_item;


-- ============================================================================
-- Migration: Add Multilingual Support columns (Phase 13)
-- ============================================================================

ALTER TABLE analysis ADD COLUMN IF NOT EXISTS original_language TEXT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS original_text TEXT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS was_translated BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- Migration: Add Screenshot/Image Analysis columns (Phase 14)
-- ============================================================================

ALTER TABLE analysis ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS ocr_text TEXT;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS visual_flags JSONB;

ALTER TABLE analysis DROP CONSTRAINT IF EXISTS analysis_input_type_check;
ALTER TABLE analysis ADD CONSTRAINT analysis_input_type_check
  CHECK (input_type IN ('url', 'text', 'image', 'post'));
