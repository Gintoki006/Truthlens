"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAnalysis } from "@/hooks/useAnalysis";
import ScoreGauge from "@/components/ui/ScoreGauge";
import VerdictBadge from "@/components/ui/VerdictBadge";
import SignalBar from "@/components/ui/SignalBar";
import SentenceHighlight from "@/components/ui/SentenceHighlight";

export default function ResultsPage() {
  const params = useParams();
  const { analysis, loading, error } = useAnalysis(params.id);
  const [votes, setVotes] = useState({ up: 0, down: 0 });

  useEffect(() => {
    if (analysis) {
      setVotes({
        up: analysis.votes_up || 0,
        down: analysis.votes_down || 0,
      });
    }
  }, [analysis]);

  const handleVote = async (vote) => {
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis_id: params.id, vote }),
      });
      if (res.ok) {
        setVotes((prev) => ({
          ...prev,
          [vote === "up" ? "up" : "down"]: prev[vote === "up" ? "up" : "down"] + 1,
        }));
      }
    } catch (err) {
      console.error("Vote error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-bright)]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#b7211f]/20 border-t-[#b7211f] rounded-full animate-spin mx-auto" />
          <p className="text-[var(--text-secondary)] text-sm" style={{ fontFamily: "'Work Sans', sans-serif" }}>
            Loading analysis...
          </p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-bright)]">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-4xl">🔍</p>
          <h2 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Newsreader', serif" }}>
            Analysis not found
          </h2>
          <p className="text-sm text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
            {error || "This analysis may have expired or does not exist."}
          </p>
          <a href="/" className="inline-block mt-4 px-6 py-2 bg-[#b7211f] text-white rounded-lg text-sm font-medium hover:bg-[#9a1b19] transition-colors">
            Analyze another article
          </a>
        </div>
      </div>
    );
  }

  const communityDisagrees =
    (analysis.verdict === "real" && votes.down >= 5) ||
    (analysis.verdict === "fake" && votes.up >= 5);

  return (
    <div className="min-h-screen bg-[var(--surface-bright)]">
      {/* Top bar */}
      <header className="border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between">
        <a href="/" className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Newsreader', serif" }}>
          TruthLens
        </a>
        <div className="flex items-center gap-4">
          {analysis.source_domain && (
            <span className="text-xs text-[var(--text-secondary)] truncate max-w-[200px]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
              {analysis.source_domain}
            </span>
          )}
          <a
            href="/"
            className="px-4 py-1.5 text-xs font-medium text-[#b7211f] border border-[#b7211f]/30 rounded-lg hover:bg-[#b7211f]/5 transition-colors"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Analyze again
          </a>
        </div>
      </header>

      <div className="flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-[260px] border-b md:border-b-0 md:border-r border-[var(--border-color)] p-6 space-y-6">
          <div className="space-y-3">
            <VerdictBadge verdict={analysis.verdict} size="lg" />
            {communityDisagrees && (
              <span className="block text-xs text-[#BA7517] font-medium bg-[#FAEEDA] px-2 py-1 rounded" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                ⚠ Community disagrees
              </span>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
              Signal Scores
            </h3>
            <SignalBar label="NLP Analysis" score={analysis.score_nlp || 0} />
            <SignalBar label="Source Trust" score={analysis.score_source || 0} />
            <SignalBar label="RoBERTa" score={analysis.score_roberta || 0} />
            <SignalBar label="LR Model" score={analysis.score_lr || 0} />
            <SignalBar label="ML Ensemble" score={analysis.score_ml || 0} />
          </div>

          {/* Source info */}
          {analysis.source_domain && (
            <div className="space-y-2 pt-4 border-t border-[var(--border-color)]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                Source Info
              </h3>
              <p className="text-sm text-[var(--text-primary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                {analysis.source_domain}
              </p>
              {analysis.source_info && !analysis.source_info.is_known && (
                <span className="inline-block text-xs bg-[var(--surface-dim)] text-[var(--text-secondary)] px-2 py-0.5 rounded">
                  Unverified domain
                </span>
              )}
            </div>
          )}

          {/* Community votes */}
          <div className="space-y-2 pt-4 border-t border-[var(--border-color)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
              Community Votes
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleVote("up")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[#EAF3DE]/50 transition-colors text-sm"
              >
                👍 <span className="tabular-nums">{votes.up}</span>
              </button>
              <button
                onClick={() => handleVote("down")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[#FCEBEB]/50 transition-colors text-sm"
              >
                👎 <span className="tabular-nums">{votes.down}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 md:p-10 max-w-4xl">
          {/* Score gauge */}
          <div className="flex justify-center mb-8">
            <ScoreGauge score={analysis.score_final || 0} />
          </div>

          {/* Article title */}
          <h1
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-4"
            style={{ fontFamily: "'Newsreader', serif" }}
          >
            {analysis.article_title || "Untitled Article"}
          </h1>

          {/* AI Explanation */}
          <div className="mb-8 p-5 rounded-xl bg-[var(--surface-dim)] border border-[var(--border-color)]">
            <h3
              className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2"
              style={{ fontFamily: "'Work Sans', sans-serif" }}
            >
              AI Explanation
            </h3>
            <p
              className="text-base text-[var(--text-primary)] leading-relaxed"
              style={{ fontFamily: "'Newsreader', serif" }}
            >
              {analysis.explanation || "No explanation available."}
            </p>
          </div>

          {/* Sentence highlights */}
          {analysis.sentences && analysis.sentences.length > 0 && (
            <div className="mb-8">
              <h3
                className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4"
                style={{ fontFamily: "'Work Sans', sans-serif" }}
              >
                Article Analysis — Click any sentence for details
              </h3>
              <SentenceHighlight sentences={analysis.sentences} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
