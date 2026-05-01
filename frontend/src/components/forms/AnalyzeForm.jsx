"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

/**
 * Analysis input form with URL / Text toggle.
 * Styled to match the editorial newspaper aesthetic.
 * Submits to the Next.js API proxy → FastAPI backend.
 */
export default function AnalyzeForm() {
  const [mode, setMode] = useState("url"); // 'url' | 'text'
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!input.trim()) {
      setError("Please enter a URL or article text to analyze.");
      return;
    }

    if (mode === "text" && input.trim().length < 20) {
      setError("Text must be at least 20 characters for meaningful analysis.");
      return;
    }

    if (mode === "url") {
      try {
        new URL(input.trim());
      } catch {
        setError("Please enter a valid URL (e.g., https://example.com/article).");
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        ...(mode === "url" ? { url: input.trim() } : { text: input.trim() }),
        user_id: user?.id || undefined,
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
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      {/* Mode toggle — editorial pill style */}
      <div className="flex items-center justify-center gap-0 mb-6">
        <button
          type="button"
          onClick={() => { setMode("url"); setInput(""); setError(null); }}
          className={`
            px-5 py-2 text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] transition-all duration-300 border border-slate-900 dark:border-stone-500
            ${mode === "url"
              ? "bg-primary dark:bg-stone-100 text-on-primary dark:text-stone-900"
              : "bg-transparent text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100"
            }
          `}
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">link</span>
            Paste URL
          </span>
        </button>
        <button
          type="button"
          onClick={() => { setMode("text"); setInput(""); setError(null); }}
          className={`
            px-5 py-2 text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] transition-all duration-300 border border-l-0 border-slate-900 dark:border-stone-500
            ${mode === "text"
              ? "bg-primary dark:bg-stone-100 text-on-primary dark:text-stone-900"
              : "bg-transparent text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100"
            }
          `}
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">article</span>
            Paste Text
          </span>
        </button>
      </div>

      {/* Input field — editorial style */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {mode === "url" ? (
            <motion.div
              key="url"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <label className="block font-label-caps text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-400 mb-2">
                Article URL
              </label>
              <div className="flex flex-col md:flex-row gap-0">
                <input
                  type="url"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="https://news-source.com/article-to-verify"
                  className="w-full bg-transparent border-2 border-primary dark:border-stone-500 dark:text-stone-100 p-4 font-body-md focus:outline-none focus:ring-0 placeholder:text-slate-400 dark:placeholder:text-stone-600 transition-colors"
                  disabled={loading}
                />
                <motion.button
                  type="submit"
                  disabled={loading || !input.trim()}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className="bg-primary dark:bg-stone-100 text-on-primary dark:text-stone-900 px-10 py-4 w-full md:w-auto font-['Work_Sans'] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-stone-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 whitespace-nowrap"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    "Analyze"
                  )}
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <label className="block font-label-caps text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-400 mb-2">
                Article Text or Claim
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste the full article text or type a claim to verify (minimum 20 characters)..."
                rows={5}
                className="w-full bg-transparent border-2 border-primary dark:border-stone-500 dark:text-stone-100 p-4 font-body-md focus:outline-none focus:ring-0 resize-none placeholder:text-slate-400 dark:placeholder:text-stone-600 transition-colors"
                disabled={loading}
              />
              <motion.button
                type="submit"
                disabled={loading || !input.trim()}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="mt-0 bg-primary dark:bg-stone-100 text-on-primary dark:text-stone-900 w-full py-4 font-['Work_Sans'] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-stone-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  "Analyze Text"
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="mt-3 text-sm text-secondary dark:text-red-400 flex items-center gap-2 font-['Work_Sans']">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper text */}
      <p className="mt-4 text-center text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-stone-500">
        Analysis typically completes in 3–8 seconds
      </p>
    </form>
  );
}
