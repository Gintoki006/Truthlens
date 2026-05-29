/**
 * TruthLens Chrome Extension — Content Script
 * ─────────────────────────────────────────────
 * Phase 17.5 — Passive Mode Badge
 *
 * Injects a small "Check with TruthLens" badge in the bottom-right corner
 * when the user is on a known news domain. The badge is dismissible per-domain
 * and the preference is stored in chrome.storage.local.
 */

(function () {
  "use strict";

  // ── Config ───────────────────────────────────────────────────────────────
  const NEWS_DOMAINS = [
    "ndtv.com",
    "thehindu.com",
    "bbc.com",
    "bbc.co.uk",
    "reuters.com",
    "theguardian.com",
    "indiatimes.com",
    "timesofindia.indiatimes.com",
    "hindustantimes.com",
    "indianexpress.com",
    "cnn.com",
    "foxnews.com",
    "apnews.com",
    "aljazeera.com",
    "washingtonpost.com",
    "nytimes.com",
    "thewire.in",
    "scroll.in",
    "firstpost.com",
    "news18.com",
    "zeenews.india.com",
  ];

  const STORAGE_KEY_PREFIX = "badge_dismissed_";
  const BADGE_ID = "truthlens-passive-badge";

  // ── Domain Check ─────────────────────────────────────────────────────────
  function isNewsDomain() {
    const host = window.location.hostname.replace(/^www\./, "");
    return NEWS_DOMAINS.some((d) => host === d || host.endsWith("." + d));
  }

  // ── Dismiss Storage Key ──────────────────────────────────────────────────
  function getDismissKey() {
    const host = window.location.hostname.replace(/^www\./, "");
    return STORAGE_KEY_PREFIX + host;
  }

  // ── Inject Badge ─────────────────────────────────────────────────────────
  function injectBadge() {
    if (document.getElementById(BADGE_ID)) return;

    // Inject Google Fonts inside shadow DOM (CSP-safe approach)
    const host = document.createElement("div");
    host.id = BADGE_ID;
    host.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: sans-serif;
    `;

    // Use Shadow DOM to isolate styles from the page
    const shadow = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@500;600&display=swap');

      * { box-sizing: border-box; margin: 0; padding: 0; }

      .badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 14px 9px 11px;
        background: #0f0f0f;
        border: 1px solid #404040;
        border-top: 3px solid #ff554b;
        border-radius: 4px;
        cursor: pointer;
        user-select: none;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        font-family: 'Work Sans', sans-serif;
        max-width: 220px;
        transition: border-color 0.15s, background 0.15s;
      }

      .badge:hover {
        background: #1a1a1a;
        border-color: #555;
        border-top-color: #ff554b;
      }

      @keyframes slideIn {
        from { opacity: 0; transform: translateY(12px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      .badge-icon {
        font-size: 16px;
        flex-shrink: 0;
        line-height: 1;
      }

      .badge-text-group {
        flex: 1;
        min-width: 0;
      }

      .badge-logo {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        color: #f5f5f5;
        line-height: 1;
        margin-bottom: 2px;
      }

      .badge-logo-dot {
        color: #ff554b;
      }

      .badge-sub {
        font-size: 10px;
        font-weight: 500;
        color: #a3a3a3;
        letter-spacing: 0.2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .badge-dismiss {
        background: none;
        border: none;
        cursor: pointer;
        color: #555;
        font-size: 14px;
        line-height: 1;
        padding: 2px 4px;
        flex-shrink: 0;
        transition: color 0.1s;
        font-family: sans-serif;
      }

      .badge-dismiss:hover {
        color: #f5f5f5;
      }

      .badge-dismiss-tooltip {
        display: none;
        position: absolute;
        bottom: calc(100% + 6px);
        right: 0;
        background: #1a1a1a;
        border: 1px solid #404040;
        color: #a3a3a3;
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.3px;
        padding: 5px 8px;
        border-radius: 3px;
        white-space: nowrap;
        pointer-events: none;
      }

      .badge:has(.badge-dismiss:hover) .badge-dismiss-tooltip {
        display: block;
      }
    `;

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.setAttribute("role", "button");
    badge.setAttribute("aria-label", "Check this article with TruthLens");
    badge.tabIndex = 0;

    badge.innerHTML = `
      <span class="badge-icon">🔍</span>
      <div class="badge-text-group">
        <div class="badge-logo">Truth<span class="badge-logo-dot">Lens</span></div>
        <div class="badge-sub">Fact-check this article</div>
      </div>
      <button class="badge-dismiss" id="dismiss-btn" title="Dismiss for this site">×</button>
      <div class="badge-dismiss-tooltip">Hide on this site</div>
    `;

    // Click badge body → open popup (send message to background, or open extension popup)
    badge.addEventListener("click", (e) => {
      if (e.target.id === "dismiss-btn") return;
      // Open the extension popup programmatically by messaging
      // (content scripts can't open popups directly, so we use a new tab approach)
      const currentUrl = window.location.href;
      chrome.runtime.sendMessage({ action: "analyze_tab", url: currentUrl });
    });

    // Keyboard support
    badge.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const currentUrl = window.location.href;
        chrome.runtime.sendMessage({ action: "analyze_tab", url: currentUrl });
      }
    });

    // Dismiss button
    const dismissBtn = badge.querySelector("#dismiss-btn");
    dismissBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissBadge();
    });

    shadow.appendChild(style);
    shadow.appendChild(badge);
    document.body.appendChild(host);
  }

  // ── Dismiss Badge ─────────────────────────────────────────────────────────
  function dismissBadge() {
    const el = document.getElementById(BADGE_ID);
    if (el) {
      // Animate out
      const shadow = el.shadowRoot;
      const badge = shadow && shadow.querySelector(".badge");
      if (badge) {
        badge.style.transition = "opacity 0.2s, transform 0.2s";
        badge.style.opacity = "0";
        badge.style.transform = "translateY(8px) scale(0.95)";
      }
      setTimeout(() => el.remove(), 220);
    }

    // Persist preference
    try {
      const key = getDismissKey();
      chrome.storage.local.set({ [key]: true });
    } catch (_) {}
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  async function init() {
    if (!isNewsDomain()) return;

    // Don't inject on non-article paths (home pages, tag pages, etc.)
    const path = window.location.pathname;
    const isLikelyArticle =
      path.length > 10 && // non-trivial path
      !/^\/(tag|category|search|topics?|author|page)\//i.test(path);
    if (!isLikelyArticle) return;

    // Check if dismissed for this domain
    try {
      const key = getDismissKey();
      const stored = await chrome.storage.local.get(key);
      if (stored[key] === true) return; // user dismissed, don't show
    } catch (_) {
      // storage unavailable — still show badge
    }

    // Inject after a short delay so the page is visually settled
    setTimeout(injectBadge, 1500);
  }

  // Only run if the document is fully loaded or interactive
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

