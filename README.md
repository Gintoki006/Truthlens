# TruthLens

TruthLens is a full-stack AI-powered fake news detection system. It analyzes news articles and factual claims to determine their authenticity, returning an explainable confidence score that draws on natural language processing, machine learning classification, real-world corroboration, and professional fact-checking databases — all evaluated in parallel.

---

## Table of Contents

1. [Features](#features)
2. [How It Works](#how-it-works)
3. [Tech Stack](#tech-stack)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Pages](#pages)
7. [Setup and Installation](#setup-and-installation)
8. [Deployment](#deployment)
9. [Project Structure](#project-structure)
10. [License](#license)

---

## Features

- **Multi-mode input** — Analyze news by submitting a URL (automatically scraped) or pasting raw text.
- **3-Group Signal Architecture** — Scores are grouped into Content Intelligence, Source and Corroboration, and Fact Verification. Each group is expandable in the UI to reveal its individual sub-signals.
- **Explainable verdicts** — A plain-English explanation is generated for every result, referencing the specific signals, corroborating outlets, and fact-check findings that influenced the score.
- **Sentence-level highlighting** — The article body is color-coded sentence by sentence (green / amber / red). Clicking a sentence shows a tooltip explaining why it was flagged.
- **Live analyzed news feed** — A background scheduler fetches top headlines from NewsAPI every 30 minutes, runs them through the full analysis pipeline, and surfaces results in a real-time feed.
- **Per-user history and archive** — Signed-in users have a private history of all their analyses, with verdict and time filters, persistent across devices.
- **Saved articles** — Authenticated users can bookmark any analysis for later reference.
- **Community voting** — Users can vote on each result; votes are stored in the database.
- **Debiased rewrite** — Flagged articles can be rewritten by the LLM in a neutral, balanced tone.
- **Personal stats** — Total analyses run, verdict breakdown, and most-checked domains per user.
- **Dark mode** — System-aware dark and light mode.
- **Mobile responsive** — Single-column layout on screens below 768px.

---

## How It Works

TruthLens uses a **3-Group Signal Architecture**. When a URL or text is submitted, all sub-signals run concurrently using Python's `asyncio.gather()`. Results are then grouped and fused into a final score.

### Group A — Content Intelligence (35% of final score)

Answers the question: *Does this text look authentic based on writing style and ML classification?*

| Sub-signal | Weight within group | Tool |
|---|---|---|
| NLP style analysis | 40% | VADER + TextBlob + clickbait regex |
| ML ensemble | 60% | RoBERTa (60%) + Logistic Regression/TF-IDF (40%) |

- **RoBERTa** (`hamzab/roberta-fake-news-classification`) is a transformer model pre-trained on 72,000 articles. It is loaded via the HuggingFace Inference API, with a local pipeline as fallback.
- **Logistic Regression** is trained on the LIAR dataset (12,000 labeled statements) with TF-IDF vectorization. The model is serialized as `lr_model.pkl` and `tfidf_vectorizer.pkl`.

### Group B — Source and Corroboration (30% of final score)

Answers the question: *Is the source credible, and have trusted outlets reported this story?*

| Sub-signal | Weight within group | Tool |
|---|---|---|
| Domain trust | 50% | Supabase `source` table (~3,050 curated domains) |
| Cross-check | 50% | Serper API (Google Search) + Groq stance detection |

- Serper search queries are anchored to the primary subject using strict quoting, then enriched with trusted `site:` hints. Up to five search rounds are performed, with a wider fallback round if enough sources are not found.
- Groq LLaMA-3.1-8b-instant classifies each returned search snippet as `supports`, `debunks`, or `neutral`. Articles that actively debunk the claim penalize the crosscheck score by up to 40 points.
- For URL input, additional checks are applied: HTTP-only domains receive a 10-point penalty; domains younger than six months (via WHOIS) receive a 15-point penalty.

### Group C — Fact Verification (35% of final score)

Answers the question: *Has this claim been independently verified by authoritative sources?*

| Sub-signal | Weight within group | Tool |
|---|---|---|
| Google Fact Check API | 40% | PolitiFact, Snopes, Reuters, BOOM Live, Alt News, and others |
| Wikidata entity check | 40% | Hybrid REST and SPARQL predicate verification |
| FEVER dataset | 20% | 185,000 labeled claims — semantic similarity search |

- The Google Fact Check API uses a fuzzy similarity threshold (≥ 80%) to avoid false-positive matches.
- The Wikidata lookup uses the REST API for fast entity description retrieval, falling back to a SPARQL query for deeper predicate matching. Results are cached with `lru_cache` and the query is retried with exponential backoff on rate limit errors.
- The FEVER dataset (185,000 claim-evidence pairs: SUPPORTED, REFUTED, NOT ENOUGH INFO) is loaded into memory at server startup and searched using semantic embeddings from the `all-MiniLM-L6-v2` model.

### Override Rules

After the group scores are fused, a final set of override rules is applied:

- If Groq assigns a plausibility or news check score of 80 or above, the final score is floored at 75 (Likely Real).
- If Groq assigns a score of 30 or below (including detected satire), the final score is capped at 35 (Likely Fake).
- If Wikidata confirms a factual predicate, a 5-point bonus is added.
- If Wikidata contradicts a factual predicate, an 8-point penalty is applied.

### Scoring Formulas

The formula variant is selected automatically based on the input type and Serper availability:

```
Standard (URL input):
  score = (content x 0.35) + (source x 0.30) + (facts x 0.35)

Text-only input (no source domain):
  score = (content x 0.40) + (serper_only x 0.20) + (facts x 0.40)

Serper fallback (0 results, article under 6 hours old):
  score = (content x 0.50) + (facts x 0.50)
```

### Verdict Thresholds

| Score range | Verdict |
|---|---|
| 70 – 100 | Likely Real |
| 40 – 69 | Suspicious / Unverified |
| 0 – 39 | Likely Fake |

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.4 | App Router, server-side rendering, file-based routing |
| React | 19.2.4 | UI framework |
| Tailwind CSS | v4 | Utility-first styling |
| Framer Motion | ^12 | Animations and page transitions |
| Lenis | ^1.3 | Smooth scroll |
| Recharts | ^3.8 | Dashboard charts |
| next-themes | ^0.4 | Dark and light mode |
| Supabase JS | ^2.105 | Auth and Realtime client |
| Vercel Analytics | ^2.0 | Usage analytics |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| FastAPI | >= 0.115 | Python API server |
| uvicorn | >= 0.30 | ASGI server |
| HuggingFace Transformers | >= 4.44 | RoBERTa fake-news model |
| scikit-learn / joblib | >= 1.5 | Logistic Regression and TF-IDF model |
| sentence-transformers | >= 2.2 | FEVER semantic embeddings |
| VADER / TextBlob / NLTK | — | NLP signal analysis |
| newspaper3k | >= 0.2.8 | Article scraping from URLs |
| APScheduler | >= 3.10 | Background news feed jobs |
| httpx | >= 0.27 | Async HTTP client (Serper, Groq, Wikidata) |
| Groq API | — | LLaMA-3.1-8b-instant for explanations and stance detection |
| Serper API | — | Google Search corroboration |
| Google Fact Check API | — | Professional fact-checker database |
| Wikidata REST and SPARQL | — | Entity predicate verification |
| NewsAPI | — | Live news feed headlines |

### Database and Auth

| Technology | Purpose |
|---|---|
| Supabase (PostgreSQL) | Auth, analysis data, source credibility table, live feed table |
| Row Level Security | Per-user data isolation on the `analysis` table |
| Supabase Realtime | Live history updates and live feed refresh |

---

## Database Schema

The database has three core tables:

```
analysis    — One row per article analyzed. Stores the final score, verdict, all
              individual signal scores, sentences, corroborating sources, and explanation.

source      — Approximately 3,050 curated domains with trust scores.
              Seeded from OpenSources (~2,500 domains), MBFC (~500 domains),
              and a manually curated Indian outlets CSV (~50 domains).

feed_item   — News headlines fetched from NewsAPI and analyzed by the background
              scheduler. Powers the live feed in the dashboard and landing page.
```

The `source` table is populated once before deployment by running `scripts/seed_sources.py`. All table definitions and Row Level Security policies are in `supabase/migration.sql`.

---

## API Endpoints

All routes are served by the FastAPI backend under the `/api` prefix.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/analyze` | Main analysis endpoint. Accepts `{ url, text, user_id }`. Returns a nested grouped result object. |
| GET | `/api/history` | Returns the authenticated user's last 50 analyses. Requires a valid Supabase JWT. |
| GET | `/api/analysis/{id}` | Returns a single analysis by ID. Row Level Security enforced — owner access only. |
| POST | `/api/vote` | Submit a community vote. Body: `{ analysis_id, vote: "up" or "down" }`. |
| GET | `/api/bookmarks` | Returns the authenticated user's saved analyses. |
| POST | `/api/bookmarks` | Save an analysis to bookmarks. |
| DELETE | `/api/bookmarks/{id}` | Remove a bookmark. |
| POST | `/api/rewrite` | Returns a debiased rewrite of the submitted article via LLM. |
| GET | `/api/feed` | Returns the latest analyzed news headlines from the background feed. |
| GET | `/api/stats` | Returns global stats: total articles analyzed, verdict breakdown. |
| GET | `/auth/callback` | Supabase OAuth callback handler for Google login. |

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page with hero section, features overview, live feed strip, and recent analyses. |
| `/results/[id]` | Full results view — score gauge, verdict badge, 3-group signal bars (expandable), sentence highlights, and AI explanation. |
| `/history` | The authenticated user's private archive with verdict and time filters, pagination. |
| `/saved` | Bookmarked analyses. |
| `/dashboard` | Stats charts and live analyzed news feed. |
| `/login` | Sign in with email and password or Google OAuth. |
| `/signup` | Register a new account. Email confirmation is sent on sign-up. |
| `/forgot-password` | Request a password reset link via Supabase magic link. |
| `/auth/callback` | OAuth redirect handler — not rendered; redirects to home after session exchange. |

---

## Setup and Installation

### Prerequisites

- Node.js v18 or higher
- Python 3.11 or higher
- A Supabase account (free tier is sufficient)
- API keys for: Serper, Groq, HuggingFace, Google Fact Check Tools, and NewsAPI

---

### Step 1 — Database Setup (Supabase)

1. Create a new Supabase project.
2. Open the Supabase SQL editor and run the contents of `supabase/migration.sql`. This creates the `analysis`, `source`, and `feed_item` tables and applies all Row Level Security policies.
3. Seed the source credibility table by running the seeder script from the `backend` directory:

```bash
cd backend
pip install -r requirements.txt
python scripts/seed_sources.py
```

The seeder script takes approximately two minutes to run. It requires the `SUPABASE_SERVICE_KEY` (service role key), not the anon key, in order to bypass RLS for bulk insertion.

---

### Step 2 — Backend Setup (FastAPI)

Create and activate a Python virtual environment:

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Create a file named `.env` inside the `backend` directory with the following variables:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
HF_API_TOKEN=your_huggingface_api_token
HF_MODEL_NAME=hamzab/roberta-fake-news-classification
SERPER_API_KEY=your_serper_api_key
GROQ_API_KEY=your_groq_api_key
GOOGLE_FACTCHECK_API_KEY=your_google_fact_check_api_key
NEWS_API_KEY=your_newsapi_key
ALLOWED_ORIGINS=http://localhost:3000
HOST=0.0.0.0
PORT=8000
```

Start the backend server:

```bash
uvicorn main:app --reload --port 8000
```

On first startup, the FEVER index (~200 MB) will be built and cached to disk. Subsequent restarts load from the cache.

---

### Step 3 — Frontend Setup (Next.js)

```bash
cd frontend
npm install
```

Create a file named `.env.local` inside the `frontend` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_FASTAPI_URL=http://127.0.0.1:8000
```

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## Deployment

| Service | What it hosts | Notes |
|---|---|---|
| Vercel | Next.js frontend | Auto-deploys on every push to `main`. Set `NEXT_PUBLIC_FASTAPI_URL` to the Railway backend URL in the Vercel dashboard. |
| Railway | FastAPI backend | Set all backend `.env` variables in the Railway dashboard. The Railway plan must have at least 512 MB of RAM to hold the FEVER index in memory. |
| Supabase | Auth and PostgreSQL | Free tier (500 MB database, 50,000 monthly active users) is sufficient for a competition deployment. |

---

## Project Structure

```
truthlens/
├── backend/
│   ├── main.py                    FastAPI app entry point. Handles startup (model loading,
│   │                              NLP resources, FEVER index) and scheduler initialization.
│   ├── requirements.txt
│   ├── scheduler.py               APScheduler configuration. Runs the feed analyzer
│   │                              every 30 minutes as a background task.
│   ├── routes/
│   │   ├── analyze.py             POST /api/analyze — orchestrates the full pipeline
│   │   ├── history.py             GET /api/history
│   │   ├── vote.py                POST /api/vote
│   │   ├── bookmarks.py           GET / POST / DELETE /api/bookmarks
│   │   ├── rewrite.py             POST /api/rewrite
│   │   ├── feed.py                GET /api/feed
│   │   └── stats.py               GET /api/stats
│   └── services/
│       ├── scraper.py             Article scraping via newspaper3k
│       ├── nlp.py                 VADER, TextBlob, and clickbait regex NLP signal
│       ├── ml.py                  RoBERTa and LR/TF-IDF ML ensemble
│       ├── source.py              Domain trust lookup against the Supabase source table
│       ├── crosscheck.py          Serper API integration and Groq stance detection
│       ├── google_factcheck.py    Google Fact Check Tools API integration
│       ├── wikidata_lookup.py     Wikidata REST and SPARQL hybrid entity check
│       ├── fever_index.py         FEVER dataset semantic search index
│       ├── factcheck.py           Fact verification orchestrator (fuses 3 sub-signals)
│       ├── groq_fact_check.py     Groq plausibility scoring
│       ├── groq_news_check.py     Groq satire and tone detection
│       ├── scorer.py              3-group fusion, formula selection, and override rules
│       ├── explainer.py           LLM explanation generation via Groq
│       ├── claim_analyzer.py      Claim and entity extraction helper
│       ├── news_fetcher.py        NewsAPI headline fetcher (used by background scheduler)
│       └── feed_analyzer.py       Batch-analyzes headlines and writes to feed_item table
│
├── frontend/
│   └── src/
│       ├── app/                   Next.js App Router pages
│       │   ├── page.js            Home / landing page
│       │   ├── results/[id]/      Analysis results page
│       │   ├── history/           Per-user history (renders ArchiveView)
│       │   ├── saved/             Bookmarked analyses
│       │   ├── dashboard/         Stats charts and live feed
│       │   ├── login/             Login page
│       │   ├── signup/            Registration page
│       │   ├── forgot-password/   Password reset page
│       │   └── auth/callback/     OAuth redirect handler
│       ├── components/
│       │   ├── ui/
│       │   │   ├── ScoreGauge.jsx          Animated SVG arc dial (0–100)
│       │   │   ├── VerdictBadge.jsx        Color-coded verdict label
│       │   │   ├── GroupScoreBar.jsx       Expandable group score bar
│       │   │   ├── SubSignalRow.jsx        Individual sub-signal score row
│       │   │   ├── SentenceHighlight.jsx   Color-coded sentence renderer with tooltip
│       │   │   ├── CrosscheckPanel.jsx     Corroborating outlet links
│       │   │   ├── FactCheckPanel.jsx      Fact verification sub-signal panel
│       │   │   ├── FactCheckBadge.jsx      Fact-checker name, rating, and link
│       │   │   ├── WikidataBadge.jsx       Entity verified / not found badge
│       │   │   ├── OverrideBadge.jsx       Score override indicator
│       │   │   ├── FallbackBadge.jsx       "Story may be too recent to verify" notice
│       │   │   ├── TextOnlyBadge.jsx       "No source domain" notice
│       │   │   ├── SignalBar.jsx           Generic reusable signal bar
│       │   │   ├── DashboardView.jsx       Stats charts (Recharts)
│       │   │   ├── LiveFeedView.jsx        Live analyzed news feed with category filter
│       │   │   └── ArchiveView.jsx         History list with filters and pagination
│       │   ├── forms/
│       │   │   ├── AnalyzeForm.jsx         URL / text input toggle and submission
│       │   │   └── AuthForm.jsx            Email and password login and signup
│       │   ├── header.jsx                  Navigation bar with user avatar and sign-out
│       │   ├── footer.jsx
│       │   ├── live-feed-section.jsx       Landing page feed strip
│       │   ├── recent-analyses.jsx         Landing page recent analyses strip
│       │   └── animations.jsx              ScrollReveal and HorizontalScroll wrappers
│       ├── hooks/
│       │   ├── useAnalysis.js
│       │   ├── useHistory.js
│       │   └── useAuth.js
│       ├── context/
│       │   └── AuthContext.jsx             Global auth state provider
│       └── lib/
│           ├── supabase.js                 Supabase browser client singleton
│           ├── supabaseServer.js           Supabase server client for Server Components
│           └── api.js                      Fetch wrapper for FastAPI backend calls
│
├── supabase/
│   └── migration.sql              Full database schema and Row Level Security policies
├── scripts/
│   └── seed_sources.py            One-time script to seed the source credibility table
├── notebooks/
│   └── train_lr_model.py          LIAR dataset training script for the LR model
└── data/
    └── indian_sources.csv         Manually curated list of ~50 Indian news domains
```

---

## License

This project is built for demonstration and competition purposes. Model inferences and fact-check outputs are presented as probability estimates, not definitive statements of fact.
