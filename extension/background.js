/**
 * TruthLens Chrome Extension — Background Service Worker
 * ────────────────────────────────────────────────────────
 * Listens for messages from the content script (passive badge)
 * and opens the TruthLens analysis popup window.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze_tab" && request.url) {
    const popupUrl = chrome.runtime.getURL(`popup.html?url=${encodeURIComponent(request.url)}`);
    
    // Open as a detached popup window to simulate the extension popup
    chrome.windows.create({
      url: popupUrl,
      type: "popup",
      width: 400,
      height: 600,
      focused: true
    });
    
    sendResponse({ success: true });
  }
  return true;
});
