/**
 * TruthLens Chrome Extension — Popup Logic
 * ─────────────────────────────────────────
 * Editorial light-mode design matching the main app's results page.
 */

// ── Configuration ──────────────────────────────────────────────────────────
const API_BASE = "http://127.0.0.1:8000";
const FRONTEND_BASE = "http://localhost:3000";

// ── DOM References ─────────────────────────────────────────────────────────
const tabUrlEl = document.getElementById("tab-url");
const mainContent = document.getElementById("main-content");

// ── State ──────────────────────────────────────────────────────────────────
let currentTabUrl = "";
let analysisResult = null;

// ── Verdict Config ──────────────────────────────────────────────────────────
function getVerdictConfig(verdict) {
  const configs = {
    real:       { label: "Likely Real",  icon: "✓", cssClass: "verdict-real" },
    suspicious: { label: "Suspicious",   icon: "⚠", cssClass: "verdict-suspicious" },
    fake:       { label: "Likely Fake",  icon: "✗", cssClass: "verdict-fake" },
  };
  return configs[verdict] || configs.suspicious;
}

// ── Render: Idle State ──────────────────────────────────────────────────────
function renderIdle() {
  mainContent.innerHTML = `
    <div class="idle-container">
      <button class="analyze-btn" id="analyze-btn">▸ Analyze This Page</button>
      <div class="idle-hint">
        <strong>How it works:</strong> TruthLens sends this page's URL to
        our AI backend — evaluating across 8+ signals including NLP,
        ML classification, cross-verification, and fact-check databases.
      </div>
    </div>
  `;
  document.getElementById("analyze-btn").addEventListener("click", () => {
    analyzeUrl(currentTabUrl);
  });
}

// ── Render: Loading State ───────────────────────────────────────────────────
function renderLoading() {
  mainContent.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <div class="loading-text">Analyzing Article…</div>
      <div class="loading-stage" id="loading-stage">Connecting to TruthLens API</div>
    </div>
  `;

  const stages = [
    "Scraping article content…",
    "Running NLP sentiment analysis…",
    "Checking ML classifiers…",
    "Cross-verifying with live sources…",
    "Querying fact-check databases…",
    "Computing final score…",
  ];

  let stageIdx = 0;
  const stageEl = document.getElementById("loading-stage");
  const interval = setInterval(() => {
    if (!stageEl || !document.getElementById("loading-stage")) {
      clearInterval(interval);
      return;
    }
    stageIdx = (stageIdx + 1) % stages.length;
    stageEl.textContent = stages[stageIdx];
  }, 2500);
}

// ── Render: Signal Row ──────────────────────────────────────────────────────
function renderSignalRow(name, sublabel, score) {
  const val = score != null ? score : "—";
  return `
    <div class="signal-row">
      <div class="signal-left">
        <span class="signal-name">${name}</span>
        <span class="signal-sublabel">${sublabel}</span>
      </div>
      <span class="signal-score">${val}</span>
    </div>
  `;
}

// ── Animate score number counting up ───────────────────────────────────────
function animateScore(target) {
  const el = document.getElementById("score-number");
  if (!el) return;
  const duration = 900;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Render: Result State ────────────────────────────────────────────────────
function renderResult(data) {
  const vConfig = getVerdictConfig(data.verdict);

  // Truncate explanation to ~2 sentences
  let explanation = data.explanation || "";
  const sentences = explanation.match(/[^.!?]+[.!?]+/g) || [explanation];
  explanation = sentences.slice(0, 2).join(" ").trim();
  if (explanation.length > 240) explanation = explanation.substring(0, 237) + "…";

  // Build signal rows
  const signals = [];
  if (data.grouped_scores) {
    const gs = data.grouped_scores;
    if (gs.content) signals.push({ name: "Content Intelligence",   sub: "Semantic/NLP Audit",       score: gs.content.group_score });
    if (gs.source)  signals.push({ name: "Source & Corroboration", sub: "Domain/Origin Index",      score: gs.source.group_score });
    if (gs.facts)   signals.push({ name: "Fact Verification",      sub: "Internal Database Match",  score: gs.facts.group_score });
  } else {
    if (data.score_nlp    != null) signals.push({ name: "Content Intelligence",   sub: "Semantic/NLP Audit",      score: data.score_nlp });
    if (data.score_source != null) signals.push({ name: "Source & Corroboration", sub: "Domain/Origin Index",     score: data.score_source });
    if (data.score_ml     != null) signals.push({ name: "Fact Verification",      sub: "ML Classification Score", score: data.score_ml });
  }

  const title  = data.article_title || "Analysis Complete";
  const score  = data.score_final || 0;
  const refId  = data.id ? `TR-${data.id.toString().slice(-3).toUpperCase()}` : "TR-—";
  const sources = data.crosscheck_sources || [];

  // Update header ref no
  const refEl = document.getElementById("ref-no");
  if (refEl) refEl.textContent = `REF NO. ${refId}`;

  mainContent.innerHTML = `
    <div class="result-container">

      <!-- Verification Assessment Header -->
      <div class="verification-header">
        <div class="verification-label">Verification Assessment: ${refId}</div>
      </div>

      <!-- Big Score Number -->
      <div class="score-block">
        <div class="score-number" id="score-number">0</div>
        <div class="score-label">Authenticity Score</div>
      </div>

      <!-- Score Bar -->
      <div class="score-bar-wrap">
        <div class="score-bar-labels">
          <span>000<br>MIN</span>
          <span style="text-align:right">100<br>MAX</span>
        </div>
        <div class="score-bar-track">
          <div class="score-bar-fill" id="score-bar-fill" style="width: 0%"></div>
        </div>
      </div>

      <!-- Article Title -->
      <div class="article-title">${escapeHtml(title)}</div>

      <!-- Verdict -->
      <div class="verdict-section">
        <div class="section-fig-label">Fig 1. Signal Analysis</div>
        <span class="verdict-badge ${vConfig.cssClass}">
          <span class="verdict-icon">${vConfig.icon}</span>
          Verdict: ${vConfig.label}
        </span>
      </div>

      <!-- Signal Rows -->
      ${signals.length > 0 ? `
        <div class="signals-section">
          ${signals.map(s => renderSignalRow(s.name, s.sub, s.score)).join("")}
        </div>
      ` : ""}

      <!-- Cross-Verification -->
      <div class="sources-section">
        <div class="section-fig-label">Fig 2. Cross-Verification</div>
        ${sources.length > 0 ? `
          <div class="sources-list">
            ${sources.slice(0, 5).map(s => {
              const label = (typeof s === "string") ? s : (s.domain || s.name || s.url || "Unknown");
              return `<div class="source-item">${escapeHtml(label.toUpperCase())}</div>`;
            }).join("")}
          </div>
        ` : `
          <div class="no-sources-box">
            <div class="no-sources-label">No Corroboration Found</div>
            <div class="no-sources-text">Extensive search of primary and secondary news registries yields zero corroborating sources.</div>
          </div>
        `}
      </div>

      <!-- Explanation -->
      ${explanation ? `
        <div class="explanation-section">
          <div class="explanation-label">AI Explanation</div>
          <div class="explanation-text">${escapeHtml(explanation)}</div>
        </div>
      ` : ""}

      <!-- View Full Analysis -->
      <a href="#" class="view-full-link" id="view-full-link">View Full Analysis →</a>
    </div>
  `;

  // Animate score
  animateScore(score);
  requestAnimationFrame(() => {
    const fill = document.getElementById("score-bar-fill");
    if (fill) fill.style.width = score + "%";
  });

  // Wire up full analysis link
  const link = document.getElementById("view-full-link");
  if (link && data.id) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: `${FRONTEND_BASE}/results/${data.id}` });
    });
  }
}

// ── Render: Error State ────────────────────────────────────────────────────
function renderError(message) {
  mainContent.innerHTML = `
    <div class="error-container">
      <div class="error-icon">⚠</div>
      <div class="error-title">Analysis Failed</div>
      <div class="error-message">${escapeHtml(message)}</div>
      <button class="retry-btn" id="retry-btn">Try Again</button>
    </div>
  `;
  document.getElementById("retry-btn").addEventListener("click", () => {
    analyzeUrl(currentTabUrl);
  });
}

// ── API Call ────────────────────────────────────────────────────────────────
async function analyzeUrl(url) {
  renderLoading();
  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || errData.error || `Server returned ${res.status}`);
    }
    const data = await res.json();
    analysisResult = data;
    try {
      await chrome.storage.local.set({
        [`result_${hashUrl(url)}`]: { data, timestamp: Date.now() },
      });
    } catch (_) {}
    renderResult(data);
  } catch (err) {
    console.error("TruthLens analysis error:", err);
    renderError(err.message || "Failed to connect to the TruthLens API. Make sure the backend is running.");
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function hashUrl(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const chr = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function truncateUrl(url, maxLen = 55) {
  if (url.length <= maxLen) return url;
  try {
    const u = new URL(url);
    const domain = u.hostname;
    const path = u.pathname;
    const maxPath = maxLen - domain.length - 5;
    if (maxPath > 5) return domain + path.substring(0, maxPath) + "…";
    return domain + "/…";
  } catch {
    return url.substring(0, maxLen) + "…";
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Check if URL was passed via query param (from passive badge)
  const params = new URLSearchParams(window.location.search);
  const passedUrl = params.get("url");

  if (passedUrl) {
    currentTabUrl = passedUrl;
    tabUrlEl.textContent = truncateUrl(passedUrl);
  } else {
    // 2. Query the active tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        currentTabUrl = tab.url;
        tabUrlEl.textContent = truncateUrl(tab.url);
      } else {
        tabUrlEl.textContent = "No URL detected";
      }
    } catch {
      tabUrlEl.textContent = "Unable to read tab URL";
    }
  }

  // Check cache
  if (currentTabUrl) {
    try {
      const key = `result_${hashUrl(currentTabUrl)}`;
      const stored = await chrome.storage.local.get(key);
      if (stored[key]) {
        const { data, timestamp } = stored[key];
        const ageMinutes = (Date.now() - timestamp) / 1000 / 60;
        if (ageMinutes < 30 && data) {
          analysisResult = data;
          renderResult(data);
          // Cached indicator
          const scoreBlock = document.querySelector(".score-block");
          if (scoreBlock) {
            const badge = document.createElement("div");
            badge.className = "cached-badge";
            badge.innerHTML = `<span class="cached-dot"></span> Cached · ${Math.round(ageMinutes)}m ago`;
            scoreBlock.appendChild(badge);
          }
          return;
        }
      }
    } catch (_) {}
  }

  // Block browser-internal URLs
  if (
    !currentTabUrl ||
    currentTabUrl.startsWith("chrome://") ||
    currentTabUrl.startsWith("chrome-extension://") ||
    currentTabUrl.startsWith("about:") ||
    currentTabUrl.startsWith("edge://") ||
    currentTabUrl.startsWith("brave://")
  ) {
    mainContent.innerHTML = `
      <div class="error-container">
        <div class="error-icon">🔒</div>
        <div class="error-title">Browser Page</div>
        <div class="error-message">
          TruthLens can only analyze web pages.<br>
          Navigate to a news article and try again.
        </div>
      </div>
    `;
    return;
  }

  // If opened via passive badge, auto-analyze immediately
  if (passedUrl) {
    analyzeUrl(passedUrl);
    return;
  }

  renderIdle();
});
