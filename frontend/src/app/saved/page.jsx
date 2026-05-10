"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import VerdictBadge from "@/components/ui/VerdictBadge";
import Link from "next/link";

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function fetchBookmarks() {
      try {
        const res = await fetch(`/api/bookmarks?user_id=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setBookmarks(data.bookmarks || []);
        }
      } catch (err) {
        console.error("Bookmarks fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBookmarks();
  }, [user]);

  const handleRemoveBookmark = async (analysisId) => {
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis_id: analysisId, user_id: user.id }),
      });
      if (res.ok) {
        setBookmarks((prev) => prev.filter((b) => b.id !== analysisId));
      }
    } catch (err) {
      console.error("Remove bookmark error:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-bright)]">
        <div className="w-8 h-8 border-3 border-[#b7211f]/20 border-t-[#b7211f] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-bright)]">
        <div className="text-center space-y-4 max-w-md p-8">
          <p className="text-5xl">🔖</p>
          <h2
            className="text-2xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: "'Newsreader', serif" }}
          >
            Sign in to view saved articles
          </h2>
          <p
            className="text-sm text-[var(--text-secondary)]"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Bookmark articles to reference them later.
          </p>
          <Link
            href="/login"
            className="inline-block mt-4 px-8 py-3 bg-[#b7211f] text-white rounded-xl text-sm font-semibold hover:bg-[#9a1b19] transition-colors shadow-lg shadow-[#b7211f]/20"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-bright)]">
      <header className="border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Newsreader', serif" }}>
          TruthLens
        </Link>
        <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          Saved Articles
        </span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1
          className="text-3xl font-bold text-[var(--text-primary)] mb-2"
          style={{ fontFamily: "'Newsreader', serif" }}
        >
          Saved Articles
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-8" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          Your bookmarked analyses for easy reference.
        </p>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-[var(--surface-dim)] animate-pulse" />
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-4xl">🔖</p>
            <p className="text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
              No saved articles yet. Bookmark results to see them here!
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-[#b7211f] text-white rounded-lg text-sm font-medium hover:bg-[#9a1b19] transition-colors"
            >
              Analyze an article
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {bookmarks.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-4 rounded-xl border border-[var(--border-color)] hover:bg-[var(--surface-dim)] transition-all duration-200 group"
              >
                <Link
                  href={`/results/${item.id}`}
                  className="flex-1 min-w-0"
                >
                  <h3
                    className="font-semibold text-[var(--text-primary)] truncate group-hover:text-[#b7211f] transition-colors"
                    style={{ fontFamily: "'Newsreader', serif" }}
                  >
                    {item.article_title || "Untitled"}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    {item.source_domain && (
                      <span className="text-xs text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                        {item.source_domain}
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-secondary)]/50">
                      {new Date(item.bookmarked_at || item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="text-lg font-bold tabular-nums"
                    style={{
                      color: item.score_final >= 70 ? "#639922" : item.score_final >= 40 ? "#BA7517" : "#E24B4A",
                      fontFamily: "'Newsreader', serif",
                    }}
                  >
                    {item.score_final}
                  </span>
                  <VerdictBadge verdict={item.verdict} size="sm" />
                  <button
                    onClick={() => handleRemoveBookmark(item.id)}
                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#E24B4A] hover:bg-[#FCEBEB]/50 transition-colors"
                    title="Remove bookmark"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
