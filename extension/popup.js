/**
 * TruthLens Chrome Extension — Popup Logic
 * ─────────────────────────────────────────
 * Grabs the active tab URL, sends it to the TruthLens API,
 * and renders the result in the popup using a canvas gauge
 * that mirrors the main app's ScoreGauge component.
 */

// ── Configuration ──────────────────────────────────────────────────────────
// In production, point this to the Railway backend URL.
// During local development, use http://127.0.0.1:8000
const API_BASE = "http://127.0.0.1:8000";
const FRONTEND_BASE = "http://localhost:3000";

// ── DOM References ─────────────────────────────────────────────────────────
const tabUrlEl = document.getElementById("tab-url");
const mainContent = document.getElementById("main-content");

// ── State ──────────────────────────────────────────────────────────────────
let currentTabUrl = "";
let analysisResult = null;

// ── Score Color Utility (matches ScoreGauge.jsx) ───────────────────────────
function getScoreColor(score) {
  if (score >= 70) return "#639922";
  if (score >= 40) return "#BA7517";
  return "#E24B4A";
}

// ── Verdict Config (matches VerdictBadge.jsx) ──────────────────────────────
function getVerdictConfig(verdict) {
  const configs = {
    real:       { label: "Likely Real",  icon: "✓", cssClass: "verdict-real" },
    suspicious: { label: "Suspicious",   icon: "⚠", cssClass: "verdict-suspicious" },
    fake:       { label: "Likely Fake",  icon: "✗", cssClass: "verdict-fake" },
  };
  return configs[verdict] || configs.suspicious;
}

// ── Draw Score Gauge (canvas, matching the app's ScoreGauge) ───────────────
function drawGauge(canvasId, score, size = 150) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const strokeWidth = 10;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2 + 8;
  const radius = (size - strokeWidth * 2) / 2 - 4;
  const startAngle = Math.PI * 0.8;
  const endAngle = Math.PI * 2.2;
  const totalArc = endAngle - startAngle;

  // Animate the score
  let currentScore = 0;
  const duration = 900;
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    currentScore = Math.round(score * eased);

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = "rgba(150, 150, 150, 0.12)";
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.stroke();

    // Score arc
    if (currentScore > 0) {
      const scoreAngle = startAngle + (currentScore / 100) * totalArc;
      const color = getScoreColor(currentScore);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, scoreAngle);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.stroke();

      // Glow
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, scoreAngle);
      ctx.strokeStyle = color + "30";
      ctx.lineWidth = strokeWidth + 6;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Score text (Newsreader serif)
    ctx.fillStyle = getScoreColor(currentScore);
    ctx.font = `bold ${size * 0.24}px 'Newsreader', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(currentScore.toString(), cx, cy - 6);

    // Label
    ctx.fillStyle = "rgba(150, 150, 150, 0.6)";
    ctx.font = `500 ${size * 0.06}px 'Work Sans', sans-serif`;
    ctx.fillText("AUTHENTICITY SCORE", cx, cy + size * 0.17);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

// ── Render: Idle State ─────────────────────────────────────────────────────
function renderIdle() {
  mainContent.innerHTML = `
    <div class="idle-container">
      <button class="analyze-btn" id="analyze-btn">
        ▸ Analyze This Page
      </button>
      <div class="idle-hint">
        <strong>How it works:</strong> TruthLens sends this page's URL to
        our AI backend, which evaluates it across 8+ signals including NLP,
        ML classification, cross-verification, and fact-check databases.
      </div>
    </div>
  `;

  document.getElementById("analyze-btn").addEventListener("click", () => {
    analyzeUrl(currentTabUrl);
  });
}

// ── Render: Loading State ──────────────────────────────────────────────────
function renderLoading() {
  mainContent.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <div class="loading-text">Analyzing Article…</div>
      <div class="loading-stage" id="loading-stage">Connecting to TruthLens API</div>
    </div>
  `;

  // Rotate loading messages
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

// ── Render: Signal Bar ─────────────────────────────────────────────────────
function renderSignalBar(name, score) {
  const color = getScoreColor(score);
  const val = score != null ? score : "—";
  const width = score != null ? score : 0;
  return `
    <div class="signal-row">
      <span class="signal-name">${name}</span>
      <div class="signal-bar-container">
        <div class="signal-bar-track">
          <div class="signal-bar-fill" style="width: ${width}%; background: ${color};"></div>
        </div>
        <span class="signal-value">${val}</span>
      </div>
    </div>
  `;
}

// ── Render: Result State ───────────────────────────────────────────────────
function renderResult(data) {
  const vConfig = getVerdictConfig(data.verdict);

  // Truncate explanation to ~2 sentences for the popup
  let explanation = data.explanation || "";
  const sentences = explanation.match(/[^.!?]+[.!?]+/g) || [explanation];
  explanation = sentences.slice(0, 2).join(" ").trim();
  if (explanation.length > 220) {
    explanation = explanation.substring(0, 217) + "…";
  }

  // Signal scores — show the 3 main groups
  const signals = [];
  if (data.grouped_scores) {
    const gs = data.grouped_scores;
    if (gs.content) signals.push({ name: "Content", score: gs.content.group_score });
    if (gs.source)  signals.push({ name: "Source",  score: gs.source.group_score });
    if (gs.facts)   signals.push({ name: "Facts",   score: gs.facts.group_score });
  } else {
    // Fallback to individual scores
    if (data.score_nlp != null)    signals.push({ name: "NLP",    score: data.score_nlp });
    if (data.score_source != null) signals.push({ name: "Source", score: data.score_source });
    if (data.score_ml != null)     signals.push({ name: "ML",     score: data.score_ml });
  }

  // Build result title
  const title = data.article_title || "Analysis Complete";

  mainContent.innerHTML = `
    <div class="result-container">
      <!-- Score Gauge -->
      <div class="gauge-section">
        <div class="gauge-canvas-container">
          <canvas id="score-gauge"></canvas>
        </div>
        <span class="verdict-badge ${vConfig.cssClass}">
          ${vConfig.icon} ${vConfig.label}
        </span>
      </div>

      <!-- Signal Bars -->
      ${signals.length > 0 ? `
        <div class="signals-section">
          <div class="signals-label">Signal Breakdown</div>
          ${signals.map(s => renderSignalBar(s.name, s.score)).join("")}
        </div>
      ` : ""}

      <!-- Explanation -->
      ${explanation ? `
        <div class="explanation-section">
          <div class="explanation-label">AI Explanation</div>
          <div class="explanation-text">${escapeHtml(explanation)}</div>
        </div>
      ` : ""}

      <!-- View Full Analysis Link -->
      <a href="#" class="view-full-link" id="view-full-link">
        View Full Analysis →
      </a>
    </div>
  `;

  // Draw the animated gauge
  drawGauge("score-gauge", data.score_final || 0);

  // Wire up the full analysis link
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
      body: JSON.stringify({ url: url }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || errData.error || `Server returned ${res.status}`);
    }

    const data = await res.json();
    analysisResult = data;

    // Cache in local storage for this URL
    try {
      await chrome.storage.local.set({
        [`result_${hashUrl(url)}`]: {
          data: data,
          timestamp: Date.now(),
        },
      });
    } catch (_) { /* storage not critical */ }

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
  // Simple string hash for storage key
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const chr = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function truncateUrl(url, maxLen = 50) {
  if (url.length <= maxLen) return url;
  try {
    const u = new URL(url);
    const domain = u.hostname;
    const path = u.pathname;
    const maxPath = maxLen - domain.length - 5;
    if (maxPath > 5) {
      return domain + path.substring(0, maxPath) + "…";
    }
    return domain + "/…";
  } catch {
    return url.substring(0, maxLen) + "…";
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Get the current tab URL
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      currentTabUrl = tab.url;
      tabUrlEl.textContent = truncateUrl(tab.url, 55);
    } else {
      tabUrlEl.textContent = "No URL detected";
    }
  } catch (err) {
    tabUrlEl.textContent = "Unable to read tab URL";
  }

  // Check if we have a cached result for this URL (less than 30 min old)
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

          // Add a "cached" indicator after render
          const gaugeSection = document.querySelector(".gauge-section");
          if (gaugeSection) {
            const badge = document.createElement("div");
            badge.className = "cached-badge";
            badge.innerHTML = `<span class="cached-dot"></span> Cached · ${Math.round(ageMinutes)}m ago`;
            gaugeSection.appendChild(badge);
          }
          return;
        }
      }
    } catch (_) { /* no cache, proceed to idle */ }
  }

  // Check if this is a non-analyzable URL
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

  renderIdle();
});
