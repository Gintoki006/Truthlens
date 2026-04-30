"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Analysis input form with URL / Text toggle.
 * Submits to the FastAPI backend via a server action.
 */
export default function AnalyzeForm({ userId }) {
  const [mode, setMode] = useState("url"); // 'url' | 'text'
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!input.trim()) {
      setError("Please enter a URL or article text.");
      return;
    }

    if (mode === "text" && input.trim().length < 20) {
      setError("Text must be at least 20 characters.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...(mode === "url" ? { url: input.trim() } : { text: input.trim() }),
        user_id: userId || undefined,
      };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Analysis failed. Please try again.");
      }

      const data = await res.json();
      if (data.id) {
        router.push(`/results/${data.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-[var(--surface-dim)] w-fit mx-auto">
        <button
          type="button"
          onClick={() => { setMode("url"); setInput(""); setError(null); }}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
            ${mode === "url"
              ? "bg-[var(--surface-bright)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }
          `}
          style={{ fontFamily: "'Work Sans', sans-serif" }}
        >
          🔗 Paste URL
        </button>
        <button
          type="button"
          onClick={() => { setMode("text"); setInput(""); setError(null); }}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
            ${mode === "text"
              ? "bg-[var(--surface-bright)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }
          `}
          style={{ fontFamily: "'Work Sans', sans-serif" }}
        >
          📝 Paste Text
        </button>
      </div>

      {/* Input field */}
      <div className="relative">
        {mode === "url" ? (
          <input
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste article URL here (e.g., https://example.com/article)"
            className="
              w-full px-5 py-4 rounded-xl
              bg-[var(--surface-bright)] border border-[var(--border-color)]
              text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50
              text-base focus:outline-none focus:ring-2 focus:ring-[#b7211f]/30 focus:border-[#b7211f]/50
              transition-all duration-200
            "
            style={{ fontFamily: "'Work Sans', sans-serif" }}
            disabled={loading}
          />
        ) : (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste article text or type a claim to verify (min. 20 characters)..."
            rows={5}
            className="
              w-full px-5 py-4 rounded-xl resize-none
              bg-[var(--surface-bright)] border border-[var(--border-color)]
              text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50
              text-base focus:outline-none focus:ring-2 focus:ring-[#b7211f]/30 focus:border-[#b7211f]/50
              transition-all duration-200
            "
            style={{ fontFamily: "'Work Sans', sans-serif" }}
            disabled={loading}
          />
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-2 text-sm text-[#E24B4A] flex items-center gap-1.5" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          <span>⚠</span> {error}
        </p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading || !input.trim()}
        className="
          mt-4 w-full py-3.5 rounded-xl
          bg-[#b7211f] text-white font-semibold text-base
          hover:bg-[#9a1b19] active:bg-[#7d1615]
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
          flex items-center justify-center gap-2
          shadow-lg shadow-[#b7211f]/20
        "
        style={{ fontFamily: "'Work Sans', sans-serif" }}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing...
          </>
        ) : (
          <>Analyze Article</>
        )}
      </button>

      {/* Helper text */}
      <p className="mt-3 text-center text-xs text-[var(--text-secondary)]/60" style={{ fontFamily: "'Work Sans', sans-serif" }}>
        Analysis typically takes 3–8 seconds depending on input type
      </p>
    </form>
  );
}
