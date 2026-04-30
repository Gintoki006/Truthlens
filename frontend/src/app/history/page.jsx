"use client";

import { useAuth } from "@/context/AuthContext";
import { useHistory } from "@/hooks/useHistory";
import VerdictBadge from "@/components/ui/VerdictBadge";
import Link from "next/link";

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { history, loading, error } = useHistory();

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
          <p className="text-5xl">🔒</p>
          <h2
            className="text-2xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: "'Newsreader', serif" }}
          >
            Sign in to view history
          </h2>
          <p
            className="text-sm text-[var(--text-secondary)]"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Your analysis history is saved to your account and synced across devices.
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
      {/* Header */}
      <header className="border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="text-xl font-bold text-[var(--text-primary)]"
          style={{ fontFamily: "'Newsreader', serif" }}
        >
          TruthLens
        </Link>
        <span
          className="text-xs text-[var(--text-secondary)]"
          style={{ fontFamily: "'Work Sans', sans-serif" }}
        >
          {user.email}
        </span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1
          className="text-3xl font-bold text-[var(--text-primary)] mb-2"
          style={{ fontFamily: "'Newsreader', serif" }}
        >
          Analysis History
        </h1>
        <p
          className="text-sm text-[var(--text-secondary)] mb-8"
          style={{ fontFamily: "'Work Sans', sans-serif" }}
        >
          Your last 50 analyses. New results appear in real-time.
        </p>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-[var(--surface-dim)] animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-[#E24B4A]">Error: {error}</p>
        ) : history.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-4xl">📰</p>
            <p className="text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
              No analyses yet. Start by analyzing an article!
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
            {history.map((item) => (
              <Link
                key={item.id}
                href={`/results/${item.id}`}
                className="
                  block p-4 rounded-xl border border-[var(--border-color)]
                  hover:bg-[var(--surface-dim)] transition-all duration-200
                  group
                "
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
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
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

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
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
