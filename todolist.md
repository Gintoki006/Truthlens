# TruthLens — Master Todo List

> Derived from [prd.md](file:///c:/Users/Sayan/Desktop/truthlens/prd.md), [techstack.md](file:///c:/Users/Sayan/Desktop/truthlens/techstack.md), and [design.md](file:///c:/Users/Sayan/Desktop/truthlens/design.md)

---

## Current State

The project has a **Next.js 16 frontend** with a landing page and core application pages (/results, /history, /dashboard, /login, /signup). The **FastAPI backend** is structured with services for scraping, NLP, source credibility, ML ensemble, and LLM explanations. **Supabase** infrastructure (schema, RLS, Realtime) is defined in a migration file.

---

## Phase 1 — Project Scaffolding & Config

- [x] Set up monorepo structure: `/frontend` (existing) + `/backend` (new)
- [x] Create `/backend` directory with Python virtual environment
- [x] Create `backend/requirements.txt` (FastAPI, uvicorn, transformers, etc.)
- [x] Create `backend/main.py` with FastAPI app boilerplate + CORS config
- [x] Add `.env.local` to frontend with placeholder vars
- [x] Add `.env` to backend with placeholder vars
- [x] Update `.gitignore` for Python venv, `.env`, `__pycache__`, `.pkl` files
- [x] Install missing frontend dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `recharts`

---

## Phase 2 — Database & Source Seeding (Supabase)

- [ ] Create Supabase project (free tier)
- [x] Run SQL to create `analysis` table (defined in `supabase/migration.sql`)
- [x] Run SQL to create `source` table (defined in `supabase/migration.sql`)
- [x] Enable RLS on `analysis` table (defined in `supabase/migration.sql`)
- [x] Create RLS policies: users read/insert own analyses (defined in `supabase/migration.sql`)
- [x] Create `/data/indian_sources.csv` — ~50 Indian news domains with trust scores
- [ ] Download OpenSources CSV (~2,500 domains)
- [ ] Download MBFC sample CSV (~500 domains)
- [x] Create `/scripts/seed_sources.py` — merge all 3 datasets, deduplicate, upsert to Supabase
- [ ] Run seed script → verify ~3,050 rows in `source` table
- [x] Enable Supabase Realtime on `analysis` table (defined in `supabase/migration.sql`)

---

## Phase 3 — Backend / ML Pipeline (FastAPI)

### 3.1 Article Scraping
- [x] Create `backend/services/scraper.py` — `newspaper3k` scrape from URL
- [x] Handle errors: paywalled sites, JS-rendered pages, invalid URLs

### 3.2 NLP Signal (weight 40%)
- [x] Create `backend/services/nlp.py`
- [x] VADER sentiment polarity scoring (sensationalist language detection)
- [x] TextBlob subjectivity scoring (emotional bias)
- [x] Clickbait regex heuristics (pattern matching)
- [x] Combine sub-scores into single NLP signal (0–100)

### 3.3 Source Credibility Signal (weight 35%)
- [x] Create `backend/services/source.py`
- [x] Lookup domain in Supabase `source` table
- [x] Unknown domain fallback → score 50, flag `is_known: false`
- [x] Author credibility check (unknown/unverifiable author penalty)
- [x] HTTPS check (HTTP-only → −10 points)
- [x] Domain age via WHOIS (< 6 months → −15 points)

### 3.4 ML Ensemble Signal (weight 25%)
- [x] Create `backend/services/ml.py`
- [x] **Model A — RoBERTa**: Load via HuggingFace transformers
- [x] **Model B — TF-IDF + Logistic Regression**: Load via joblib
- [x] Ensemble fusion: `ml_score = (roberta × 0.60) + (lr × 0.40)`
- [x] Log individual model scores for debugging

### 3.5 Model B Training
- [ ] Create `/notebooks/train_lr_model.ipynb` (Google Colab)
- [ ] Download LIAR dataset (12k labeled statements)
- [ ] TF-IDF vectorization
- [ ] Train LogisticRegression
- [ ] Serialize → `tfidf_vectorizer.pkl` + `lr_model.pkl`

### 3.6 Score Fusion & Explanation
- [x] Create `backend/services/scorer.py`
- [x] Final score calculation and verdict mapping
- [x] Sentence-level scoring: split body and score each sentence
- [x] Create `backend/services/explainer.py` — LLM explanation generation

### 3.7 API Endpoints
- [x] `POST /api/analyze` — main endpoint; runs all signals in parallel
- [x] `GET /api/history` — returns last 50 analyses for authenticated user
- [x] `GET /api/analysis/{id}` — returns single analysis by ID
- [x] `POST /api/vote` — accepts community votes
- [x] Store analysis results to Supabase

---

## Phase 4 — Frontend: Lib & Hooks Layer

- [x] Create `/frontend/src/lib/supabase.js` — Browser client singleton
- [x] Create `/frontend/src/lib/supabaseServer.js` — Server client
- [x] Create `/frontend/src/lib/api.js` — fetch wrapper for FastAPI backend
- [x] Create `/frontend/src/hooks/useAnalysis.js` — fetch analysis by ID
- [x] Create `/frontend/src/hooks/useHistory.js` — fetch user history + Realtime subscription
- [x] Create `/frontend/src/hooks/useAuth.js` — AuthContext hook
- [x] Create `/frontend/src/context/AuthContext.jsx` — provides user globally

---

## Phase 5 — Frontend: Core App Pages

### 5.1 Home Page (`/`) — Enhance Existing
- [ ] Integrate `AnalyzeForm` into the landing page `page.js`
- [x] Create `/frontend/src/components/forms/AnalyzeForm.jsx`
- [x] Wire form submission → redirect to `/results/[id]`
- [ ] Add recent analyses strip below the form

### 5.2 Results Page (`/results/[id]`)
- [x] Create `/frontend/src/app/results/[id]/page.jsx`
- [x] Sidebar: verdict, signal scores, source info, community votes
- [x] Main content: score gauge, AI explanation, highlighted article
- [x] Sentence-level highlighting and tooltips
- [x] Create `/frontend/src/components/ui/ScoreGauge.jsx`
- [x] Create `/frontend/src/components/ui/VerdictBadge.jsx`
- [x] Create `/frontend/src/components/ui/SignalBar.jsx`
- [x] Create `/frontend/src/components/ui/SentenceHighlight.jsx`

### 5.3 History Page (`/history`)
- [x] Create `/frontend/src/app/history/page.jsx`
- [x] Display last 50 analyses with real-time updates
- [x] Unauthenticated users prompt

### 5.4 Login Page (`/login`)
- [x] Create `/frontend/src/app/login/page.jsx`
- [x] Create `/frontend/src/components/forms/AuthForm.jsx`
- [x] Google OAuth integration

### 5.5 Signup Page (`/signup`)
- [x] Create `/frontend/src/app/signup/page.jsx`

### 5.6 OAuth Callback (`/auth/callback`)
- [x] Create `/frontend/src/app/auth/callback/page.jsx`

---

## Phase 6 — Authentication & Middleware

- [x] Create `/frontend/middleware.js` — session refresh + protected routes
- [x] Wrap root layout in `AuthContext` provider
- [ ] Update `Navbar.jsx` (existing `header.jsx`) with user avatar and sign-out
- [x] Session management: JWT in httpOnly cookies via `@supabase/ssr`

---

## Phase 7 — Extended Features (Nice to Have)

- [ ] Debiased Rewrite
- [x] Community Voting (Integrated into Results Page)
- [x] Misinformation Heatmap Dashboard (`/dashboard`)
- [ ] Chrome Extension

---

## Phase 8 — Polish, Testing & Deployment

### Polish
- [x] Compiled successfully and initial routes verified
- [x] Loading states and skeleton screens
- [x] Score animations on result load
- [x] Source unknown badge
- [ ] Stream LLM explanation
- [ ] Low-confidence flag for non-English articles

### Deployment
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway
