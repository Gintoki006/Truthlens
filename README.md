# TruthLens

TruthLens is a full-stack AI-powered fake news detection system. It analyzes news articles, factual claims, screenshot images, and social media post links — in any language — to determine their authenticity. It returns an explainable confidence score that draws on natural language processing, machine learning classification, semantic analysis, real-world corroboration, professional fact-checking databases, and multimodal vision AI — all evaluated in parallel. A companion **Chrome extension** provides one-click analysis from any news page via a toolbar popup or a passive floating badge.

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

- **Multi-mode input** — Analyze news by submitting a URL (automatically scraped), pasting raw text or a claim, uploading a screenshot image, or pasting a social media / direct image link.
- **Social post and image link analysis** — Paste any Twitter/X or direct image URL into the "Post / Image" tab. `post_extractor.py` fetches the content: direct image links are downloaded and sent to the vision model; HTML pages are parsed for OpenGraph and Twitter Card metadata (`og:image`, `twitter:image`, `og:title`, `og:description`). Reddit links are blocked by Cloudflare — use screenshot or Copy/Paste text mode instead. Instagram and Facebook return graceful errors.
- **Screenshot / image fact-check** — Upload a social media screenshot or news image. `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` (via OpenRouter) extracts the text, identifies key claims, entities, emotional tone, and visual manipulation signals (urgency framing, fake authority cues, ALL-CAPS headlines). The extracted claims are then passed through the full fact-checking pipeline.
- **Multilingual analysis** — Submit content in any language. Language is detected automatically using `langdetect`. Non-English content is translated to English by `facebook/nllb-200-distilled-600M` before analysis. The original text is preserved and shown alongside the translation. A "Translated from [language]" badge appears on results.
- **Adaptive scoring architecture** — The scoring formula changes based on input type. URL input runs Content + Source groups; text and claim input additionally runs a full Fact Verification group. Image input follows the text path after claim extraction.
- **Semantic analysis** — Groq LLaMA-3.3-70b evaluates every submission for plausibility, sensationalism, misinformation patterns, and known conspiracy tropes. It also performs a dedicated factual accuracy check optionally grounded by live web context from Serper.
- **Explainable verdicts** — A plain-English explanation is generated for every result, referencing specific signals, corroborating outlets, and fact-check findings.
- **Sentence-level highlighting** — The article body is color-coded sentence by sentence (green / amber / red). Clicking a sentence shows a tooltip explaining why it was flagged.
- **Visual manipulation signals** — For image input, a dedicated panel shows detected propaganda and manipulation tactics (fear-based framing, urgency language, unverified authority claims).
- **Live analyzed news feed** — A background scheduler fetches top headlines from NewsAPI every 30 minutes, runs them through the full analysis pipeline, and surfaces results in a real-time feed.
- **Per-user history and archive** — Signed-in users have a private history of all their analyses, with verdict and time filters, persistent across devices.
- **Saved articles** — Authenticated users can bookmark any analysis for later reference.
- **Community voting** — Users can vote on each result; votes are stored in the database.
- **Debiased rewrite** — Flagged articles can be rewritten by the LLM in a neutral, balanced tone.
- **Personal stats** — Total analyses run, verdict breakdown, and most-checked domains per user.
- **Dark mode** — System-aware dark and light mode.
- **Mobile responsive** — Single-column layout on screens below 768px.
- **Chrome Extension** — Manifest V3 extension with two modes: active toolbar popup (analyze any page with one click) and passive floating badge (badge injected into every page; clicking opens the popup and auto-runs analysis). Results cached locally for 30 minutes. Popup UI matches the main app's editorial design.

---

## How It Works

TruthLens uses an **adaptive two-path scoring architecture**. Every submission passes through a pre-processing layer before entering one of two scoring paths. All scoring signals run concurrently using Python's `asyncio.gather()`.

---

### Pre-processing Layer (Applied to All Input Types)

Before any scoring takes place, two pre-processing steps run in sequence:

**Step 1 — Image extraction (image input only)**

When an image is uploaded, `services/vision.py` base64-encodes the file and sends it to `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` via the OpenRouter API. The model returns structured JSON:

```json
{
  "extracted_text": "...",
  "main_claims": ["..."],
  "entities": ["NASA", "WHO"],
  "emotional_tone": "fear-based",
  "manipulation_tactics": ["urgency framing", "fake authority"],
  "credibility_red_flags": ["ALL CAPS headline", "no source cited"]
}
```

The `main_claims` array is joined into a single string and passed forward as text. The full structured response is stored in the `visual_flags` column in Supabase. The original image is stored in Supabase Storage and its public URL recorded in `image_url`. A 15-second timeout is applied; if the model fails, the raw OCR text is used as fallback.

**Step 2 — Language detection and translation (all input types)**

`services/language.py` runs `langdetect` on the text. If the detected language is not English, `services/translator.py` loads `facebook/nllb-200-distilled-600M` (cached in memory at startup) and translates the text to English. The original text is preserved in `original_text`; `was_translated` is set to `true` and `original_language` stores the ISO language code (e.g., `bn`, `hi`, `ta`).

For image input in a non-English language, language detection and translation run on the `extracted_text` from the vision step before claims enter the pipeline.

---

### Path 1 — URL Input

When a URL is submitted, `newspaper3k` scrapes the article and two signal groups are computed:

**Group A — Content Intelligence (65% of final score)**

This group evaluates the quality and credibility of the writing and the ML classification of the text.

| Sub-signal | Weight within group | Tool |
|---|---|---|
| NLP style analysis | 20% | VADER + TextBlob + clickbait regex |
| RoBERTa classification | 30% | `hamzab/roberta-fake-news-classification` (HuggingFace) |
| LR / TF-IDF classification | 15% | Logistic Regression trained on LIAR dataset |
| Semantic analysis (Groq) | 35% | LLaMA-3.3-70b — plausibility, sensationalism, misinformation patterns |

The Groq semantic analysis signal carries the most weight within this group. It evaluates the claim on five criteria: logical plausibility, language sensationalism, consistency with known facts, misinformation pattern matching (e.g., microchip conspiracy tropes), and satire / parody detection.

**Group B — Source and Corroboration (35% of final score)**

| Sub-signal | Weight within group | Tool |
|---|---|---|
| Domain trust | 45% | Supabase `source` table (~3,050 curated domains) |
| Cross-check | 55% | Serper API (Google Search) + Groq stance detection |

Serper search queries are anchored to the primary subject using strict quoting and enriched with trusted `site:` hints. Groq classifies each returned snippet as `supports`, `debunks`, or `neutral`.

**URL formula:**
```
final = (content_score x 0.65) + (source_score x 0.35)
```

**Serper fallback** (0 results returned and article is under 6 hours old): the same formula weights are retained but a `crosscheck_fallback` flag is set, and the UI displays a "Story may be too recent to verify" notice.

---

### Path 2 — Text / Claim Input

When plain text or a factual claim is submitted (no URL), there is no source domain available. The system runs all three groups, with the Fact Verification group added to compensate for the absence of domain trust data.

**Group A — Content Intelligence (50% of final score)**

Same four sub-signals as the URL path (NLP, RoBERTa, LR, Groq semantic analysis).

**Group B — Source / Crosscheck (30% of final score)**

Domain trust is excluded. Only the Serper crosscheck score is used. If Serper returns no results, Group B is dropped entirely and the formula becomes:
```
final = (content_score x 0.60) + (facts_score x 0.40)
```

**Group C — Fact Verification (20% of final score)**

This group is only active for text/claim input. It verifies the claim against structured knowledge bases.

| Sub-signal | Weight within group | Tool |
|---|---|---|
| Groq logical fact check | 55% | LLaMA-3.3-70b — factual accuracy check, live web context via Serper |
| Wikidata entity check | 20% | Hybrid REST and SPARQL predicate verification |
| FEVER dataset | 15% | 185,000 labeled claims — semantic similarity search |
| Google Fact Check API | 10% | PolitiFact, Snopes, Reuters, BOOM Live, Alt News, and others |

The Groq logical fact check fetches up to five live web snippets from Serper before prompting the model, grounding its response in current information. It returns a verdict (true / false / partially_true / unverifiable), a confidence level, and specific factual corrections when the claim is false.

**Text input formula (with Serper results):**
```
final = (content_score x 0.50) + (source_score x 0.30) + (facts_score x 0.20)
```

**Text input fallback (no Serper results):**
```
final = (content_score x 0.60) + (facts_score x 0.40)
```

---

### Override Rules

After the path-specific formula produces a score, a set of override rules is applied as a final adjustment. Each override fires only when its confidence threshold is met:

| Condition | Action |
|---|---|
| Groq semantic score is 30 or below AND plausibility is "low" | Cap final score at 35 (Likely Fake) |
| Groq semantic score is 80 or above AND no misinformation pattern AND plausibility is "high" | Floor final score at 75 (Likely Real) |
| Groq fact check confidence is "high" AND score is 25 or below | Cap final score at 35 |
| Groq fact check confidence is "high" AND score is 80 or above | Floor final score at 75 |
| Wikidata score is 75 or above (entity confirmed) | Add 5 points, capped at 100 |
| Wikidata score is 25 or below (entity contradicted) | Subtract 8 points, floored at 0 |

---

### Verdict Thresholds

| Score range | Verdict |
|---|---|
| 70 – 100 | Likely Real |
| 40 – 69 | Suspicious / Unverified |
| 0 – 39 | Likely Fake |

---

### Groq Semantic Analysis — What It Evaluates

The `groq_news_check` service (called for every submission) uses `llama-3.3-70b-versatile` at temperature 0 to evaluate five dimensions and return a structured JSON score:

- **Plausibility** — Is the claim physically, scientifically, and logically possible?
- **Sensationalism** — Is the language neutral and factual, or emotionally charged and clickbait?
- **Known facts** — Does this contradict well-established facts in the model's knowledge base?
- **Misinformation patterns** — Does this match recognized conspiracy or hoax tropes (microchips in vaccines, faked moon landings, 5G causing disease, pharma suppression, etc.)?
- **Satire / parody detection** — Is this clearly a satirical or parody article?

The `groq_fact_check` service (called only for text/claim input) is a separate, distinct call that focuses on factual accuracy — not style or pattern matching. It first fetches live web snippets from Serper, then asks the model to verify specific facts (dates, names, numbers, locations) against both the live context and its training knowledge.

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
| HuggingFace Transformers | >= 4.44 | RoBERTa fake-news model + NLLB-200 translation model |
| scikit-learn / joblib | >= 1.5 | Logistic Regression and TF-IDF model |
| sentence-transformers | >= 2.2 | FEVER semantic embeddings (`all-MiniLM-L6-v2`) |
| VADER / TextBlob / NLTK | — | NLP signal analysis |
| langdetect | >= 1.0.9 | Language identification (ISO code detection) |
| facebook/nllb-200-distilled-600M | — | Neural machine translation — 200 languages to English |
| newspaper3k | >= 0.2.8 | Article scraping from URLs |
| APScheduler | >= 3.10 | Background news feed scheduler |
| httpx | >= 0.27 | Async HTTP client (Serper, Groq, Wikidata, OpenRouter) |
| Groq API (llama-3.3-70b-versatile) | — | Semantic analysis, factual accuracy check, and LLM explanations |
| OpenRouter API (nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free) | — | Multimodal vision — image text extraction and manipulation signal analysis |
| Serper API | — | Google Search corroboration and live web context for Groq fact check |
| Google Fact Check API | — | Professional fact-checker database (PolitiFact, Snopes, etc.) |
| Wikidata REST and SPARQL | — | Entity predicate verification |
| NewsAPI | — | Live news feed headlines |
| Supabase Storage | — | Image upload storage (free tier: 1 GB) |

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
              individual signal scores, sentences, corroborating sources, explanation,
              and new fields for image analysis and multilingual support:

                input_type          — 'url' | 'text' | 'image'
                image_url           — Supabase Storage public URL (image / post URL input)
                source_url          — Original post URL submitted by user (post-extractor path)
                ocr_text            — Raw text extracted from image by vision model
                visual_flags        — JSONB: manipulation_tactics, credibility_red_flags,
                                      emotional_tone, entities (image input only)
                original_language   — ISO 639-1 code, e.g. 'bn', 'hi', 'ta'
                original_text       — The original non-English text before translation
                was_translated      — Boolean; true if NLLB translation was applied

source      — Approximately 3,050 curated domains with trust scores.
              Seeded from OpenSources (~2,500 domains), MBFC (~500 domains),
              and a manually curated Indian outlets CSV (~50 domains).

feed_item   — News headlines fetched from NewsAPI and analyzed by the background
              scheduler. Powers the live feed in the dashboard and landing page.
```

The `source` table is populated once before deployment by running `scripts/seed_sources.py`. All table definitions and Row Level Security policies are in `supabase/migration.sql`.

Note: the `input_type` check constraint must include `'image'`. Run the migration update in `supabase/migration.sql` before deploying the image feature.

---

## API Endpoints

All routes are served by the FastAPI backend under the `/api` prefix.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/analyze` | Main analysis endpoint. Accepts `application/json` with fields `url`, `text`, `post_url`, and `user_id`, or `multipart/form-data` with an `image` file upload. Returns a nested grouped result object. |
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
| `/results/[id]` | Full results view — score gauge, verdict badge, signal group bars (expandable), sentence highlights, and AI explanation. |
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
OPENROUTER_API_KEY=your_openrouter_api_key
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

On first startup, the FEVER index (~200 MB) and NLLB-200 translation model (~600 MB on disk) will be built and cached. Subsequent restarts load from the cache.

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
| Supabase | Auth and Post | Database, Auth, and Storage. |

---

## Project Structure

```
truthlens/
├── backend/
│   ├── main.py                    FastAPI entry point; startup loads models, FEVER index, scheduler
│   ├── requirements.txt
│   ├── scheduler.py               APScheduler — runs feed_analyzer every 30 min
│   ├── routes/
│   │   ├── analyze.py             POST /api/analyze — full pipeline orchestrator
│   │   ├── history.py             GET /api/history
│   │   ├── vote.py                POST /api/vote
│   │   ├── bookmarks.py           GET / POST / DELETE /api/bookmarks
│   │   ├── rewrite.py             POST /api/rewrite
│   │   ├── feed.py                GET /api/feed
│   │   └── stats.py               GET /api/stats
│   └── services/
│       ├── scraper.py             newspaper3k article scraper
│       ├── vision.py              Qwen2.5-VL-32B via OpenRouter (Nvidia). analyze_image()
│       │                          returns extracted_text, main_claims, entities,
│       │                          emotional_tone, manipulation_tactics, credibility_red_flags
│       ├── post_extractor.py      Social post / direct image URL fetcher.
│       │                          10 MB cap, 10s timeout. Reddit blocked by Cloudflare.
│       ├── storage.py             Supabase Storage uploader (file + URL paths)
│       ├── language.py            langdetect — ISO 639-1 language identification
│       ├── translator.py          NLLB-200 distilled-600M — cached in RAM at startup
│       ├── nlp.py                 VADER + TextBlob + clickbait regex
│       ├── ml.py                  RoBERTa + LR/TF-IDF ensemble
│       ├── source.py              Domain trust lookup vs Supabase source table
│       ├── crosscheck.py          Serper API + Groq stance detection
│       ├── google_factcheck.py    Google Fact Check Tools API
│       ├── wikidata_lookup.py     Wikidata REST + SPARQL entity check
│       ├── fever_index.py         FEVER 185k-claim semantic search index
│       ├── factcheck.py           Fact verification group orchestrator (text input)
│       ├── groq_news_check.py     Groq semantic analysis (all input types)
│       ├── groq_fact_check.py     Groq factual accuracy + live Serper web context (text only)
│       ├── scorer.py              Adaptive score fusion + override rules
│       ├── explainer.py           Groq LLM explanation generation
│       ├── claim_analyzer.py      Claim and entity extraction helper
│       ├── news_fetcher.py        NewsAPI headline fetcher
│       └── feed_analyzer.py       Batch-analyzes headlines and writes to feed_item table
│
├── extension/                     Chrome Manifest V3 extension
│   ├── manifest.json              Permissions: activeTab, storage; service_worker: background.js
│   ├── background.js              Service worker: receives analyze_tab from content.js
│   │                              and opens popup.html?url=... window
│   ├── popup.html                 Light editorial popup (cream bg, Newsreader serif)
│   ├── popup.js                   idle/loading/result/error state machine.
│   │                              Renders animated score, bar, signal rows, cross-verify.
│   │                              Auto-analyzes when ?url= present. 30-min local cache.
│   ├── content.js                 Passive floating TruthLens badge on all pages.
│   └── icons/                     16px, 48px, 128px PNGs
│
├── frontend/
│   └── src/
│       ├── app/                   Next.js App Router pages
│       │   ├── page.js            Home / landing page
│       │   ├── results/[id]/      Analysis results page
│       │   ├── history/           Per-user history (ArchiveView)
│       │   ├── saved/             Bookmarked analyses
│       │   ├── dashboard/         Stats charts + live feed
│       │   └── login/ signup/ forgot-password/ auth/callback/
│       ├── components/
│       │   ├── ui/                ScoreGauge, VerdictBadge, GroupScoreBar, SubSignalRow,
│       │   │                      SentenceHighlight, CrosscheckPanel, FactCheckPanel,
│       │   │                      FactCheckBadge, WikidataBadge, OverrideBadge,
│       │   │                      FallbackBadge, TextOnlyBadge, TranslationBadge,
│       │   │                      ManipulationRadar, VisualFlagsPanel,
│       │   │                      ExtractedClaimsPanel, SignalBar, DashboardView,
│       │   │                      LiveFeedView, ArchiveView
│       │   ├── forms/             AnalyzeForm.jsx, AuthForm.jsx
│       │   └── header.jsx, footer.jsx, live-feed-section.jsx, recent-analyses.jsx,
│       │       animations.jsx, smooth-scroll.jsx, theme-provider.jsx, theme-toggle.jsx
│       ├── hooks/                 useAnalysis.js  useHistory.js  useAuth.js
│       ├── context/               AuthContext.jsx
│       └── lib/                   supabase.js  supabaseServer.js  api.js
│
├── supabase/
│   └── migration.sql              Full schema + RLS policies
├── scripts/
│   └── seed_sources.py            Seeds ~3,050 domain trust scores into Supabase
├── notebooks/
│   └── train_lr_model.py          LIAR dataset training for the LR/TF-IDF model
└── data/
    └── indian_sources.csv         ~50 manually curated Indian news domains
```

---

## License

This project is built for demonstration and competition purposes. Model inferences and fact-check outputs are presented as probability estimates, not definitive statements of fact.
