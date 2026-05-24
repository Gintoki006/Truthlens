"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAuth } from "@/context/AuthContext";
import ScoreGauge from "@/components/ui/ScoreGauge";
import VerdictBadge from "@/components/ui/VerdictBadge";
import SignalBar from "@/components/ui/SignalBar";
import SentenceHighlight from "@/components/ui/SentenceHighlight";
import CrosscheckPanel from "@/components/ui/CrosscheckPanel";
import FallbackBadge from "@/components/ui/FallbackBadge";
import GroupScoreBar from "@/components/ui/GroupScoreBar";
import OverrideBadge from "@/components/ui/OverrideBadge";
import FactCheckBadge from "@/components/ui/FactCheckBadge";
import WikidataBadge from "@/components/ui/WikidataBadge";
import TextOnlyBadge from "@/components/ui/TextOnlyBadge";

export default function ResultsPage() {
  const params = useParams();
  const { user } = useAuth();
  const { analysis, loading, error } = useAnalysis(params.id);
  const [votes, setVotes] = useState({ up: 0, down: 0 });
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [rewrite, setRewrite] = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [showRewrite, setShowRewrite] = useState(false);

  useEffect(() => {
    if (analysis) {
      setVotes({
        up: analysis.votes_up || 0,
        down: analysis.votes_down || 0,
      });
    }
  }, [analysis]);

  // Check bookmark status
  useEffect(() => {
    if (!user || !params.id) return;
    async function checkBookmark() {
      try {
        const res = await fetch(`/api/bookmarks?user_id=${user.id}&analysis_id=${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setBookmarked(data.bookmarked);
        }
      } catch (err) {
        console.error("Bookmark check error:", err);
      }
    }
    checkBookmark();
  }, [user, params.id]);

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

  const handleBookmark = async () => {
    if (!user) return;
    setBookmarkLoading(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis_id: params.id, user_id: user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarked(data.bookmarked);
      }
    } catch (err) {
      console.error("Bookmark error:", err);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleRewrite = async () => {
    if (rewrite) {
      setShowRewrite(!showRewrite);
      return;
    }
    setRewriteLoading(true);
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_text: analysis.article_body,
          article_title: analysis.article_title,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRewrite(data);
        setShowRewrite(true);
      }
    } catch (err) {
      console.error("Rewrite error:", err);
    } finally {
      setRewriteLoading(false);
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
      <header className="border-b border-[var(--border-color)] px-4 md:px-6 py-3 flex items-center justify-between">
        <a href="/" className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Newsreader', serif" }}>
          TruthLens
        </a>
        <div className="flex items-center gap-2 md:gap-4">
          {analysis.source_domain && (
            <span className="text-xs text-[var(--text-secondary)] truncate max-w-[120px] md:max-w-[200px] hidden sm:inline" style={{ fontFamily: "'Work Sans', sans-serif" }}>
              {analysis.source_domain}
            </span>
          )}
          {user && (
            <button
              onClick={handleBookmark}
              disabled={bookmarkLoading}
              className={`p-2 rounded-lg border transition-all duration-200 ${
                bookmarked
                  ? "border-[#b7211f]/30 bg-[#b7211f]/5 text-[#b7211f]"
                  : "border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[#b7211f] hover:border-[#b7211f]/30"
              }`}
              title={bookmarked ? "Remove bookmark" : "Bookmark this analysis"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
              </svg>
            </button>
          )}
          <a
            href="/"
            className="px-3 md:px-4 py-1.5 text-xs font-medium text-[#b7211f] border border-[#b7211f]/30 rounded-lg hover:bg-[#b7211f]/5 transition-colors"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Analyze again
          </a>
        </div>
      </header>

      {/* Confidence warning banner */}
      {analysis.confidence_warning && (
        <div className="bg-[#FAEEDA] border-b border-[#BA7517]/20 px-4 md:px-6 py-2.5">
          <p className="text-xs text-[#633806] text-center" style={{ fontFamily: "'Work Sans', sans-serif" }}>
            ⚠ {analysis.confidence_warning}
          </p>
        </div>
      )}

      <div className="flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-[280px] border-b md:border-b-0 md:border-r border-[var(--border-color)] p-4 md:p-6 space-y-5 md:space-y-6">
          <div className="space-y-3">
            <VerdictBadge verdict={analysis.verdict} size="lg" />
            {analysis.override_applied && (
              <OverrideBadge reason={analysis.score_override_reason} />
            )}
            {analysis.text_only_formula && <TextOnlyBadge />}
            {analysis.crosscheck_fallback && <FallbackBadge />}
            {communityDisagrees && (
              <span className="block text-xs text-[#BA7517] font-medium bg-[#FAEEDA] px-2 py-1 rounded" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                ⚠ Community disagrees
              </span>
            )}
          </div>

          {/* Signal Groups */}
          {analysis.groups && (
            <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                Signal Groups
              </h3>
              
              {analysis.groups.content && (
                <GroupScoreBar 
                  groupKey="content" 
                  label="Content Intelligence" 
                  score={analysis.groups.content.score} 
                  subSignals={analysis.groups.content.sub_signals} 
                />
              )}
              
              {analysis.groups.source && (
                <GroupScoreBar 
                  groupKey="source" 
                  label="Source & Corroboration" 
                  score={analysis.groups.source.score} 
                  subSignals={analysis.groups.source.sub_signals} 
                />
              )}
              
              {analysis.groups.facts && (
                <GroupScoreBar 
                  groupKey="facts" 
                  label="Fact Verification" 
                  score={analysis.groups.facts.score} 
                  subSignals={analysis.groups.facts.sub_signals} 
                />
              )}
            </div>
          )}

          {/* Fact Check and Wikidata Badges */}
          {analysis.groups?.facts?.factcheck_result?.rating && (
            <FactCheckBadge result={analysis.groups.facts.factcheck_result} />
          )}
          
          {analysis.groups?.facts?.wikidata_status && (
            <WikidataBadge status={analysis.groups.facts.wikidata_status} />
          )}

          {/* Cross-verification panel */}
          <div className="pt-4 border-t border-[var(--border-color)] space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
              Cross-Verification
            </h3>
            <CrosscheckPanel
              sources={analysis.crosscheck_sources || []}
              fallback={analysis.crosscheck_fallback}
            />
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
                <span className="inline-flex items-center gap-1 text-xs bg-[var(--surface-dim)] text-[var(--text-secondary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                  <span>⚠</span> Unverified domain
                </span>
              )}
              {analysis.source_info && analysis.source_info.bias && analysis.source_info.bias !== "unknown" && (
                <span className="inline-block text-xs bg-[var(--surface-dim)] text-[var(--text-secondary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                  Bias: {analysis.source_info.bias}
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
        <main className="flex-1 p-4 md:p-10 max-w-4xl">
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
          <div className="mb-8 p-4 md:p-5 rounded-xl bg-[var(--surface-dim)] border border-[var(--border-color)]">
            <h3
              className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2"
              style={{ fontFamily: "'Work Sans', sans-serif" }}
            >
              AI Explanation
            </h3>
            <p
              className="text-sm md:text-base text-[var(--text-primary)] leading-relaxed"
              style={{ fontFamily: "'Newsreader', serif" }}
            >
              {analysis.explanation || "No explanation available."}
            </p>
          </div>

          {/* Debiased Rewrite Button */}
          {analysis.article_body && (
            <div className="mb-8">
              <button
                onClick={handleRewrite}
                disabled={rewriteLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bright)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--surface-dim)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                style={{ fontFamily: "'Work Sans', sans-serif" }}
              >
                {rewriteLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating neutral version...
                  </>
                ) : showRewrite ? (
                  <>📄 Hide neutral version</>
                ) : (
                  <>✨ Show neutral version</>
                )}
              </button>

              {/* Side-by-side rewrite display */}
              {showRewrite && rewrite && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[#E24B4A]/20 bg-[#FCEBEB]/20">
                    <h4
                      className="text-xs font-semibold uppercase tracking-wider text-[#791F1F] mb-3"
                      style={{ fontFamily: "'Work Sans', sans-serif" }}
                    >
                      Original
                    </h4>
                    <p
                      className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap"
                      style={{ fontFamily: "'Newsreader', serif" }}
                    >
                      {rewrite.original}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-[#639922]/20 bg-[#EAF3DE]/20">
                    <h4
                      className="text-xs font-semibold uppercase tracking-wider text-[#27500A] mb-3"
                      style={{ fontFamily: "'Work Sans', sans-serif" }}
                    >
                      Neutral Rewrite
                    </h4>
                    <p
                      className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap"
                      style={{ fontFamily: "'Newsreader', serif" }}
                    >
                      {rewrite.rewritten}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Corroborating sources */}
          {analysis.crosscheck_sources && analysis.crosscheck_sources.length > 0 && (
            <div className="mb-8">
              <h3
                className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3"
                style={{ fontFamily: "'Work Sans', sans-serif" }}
              >
                Corroborating Sources
              </h3>
              <div className="flex flex-wrap gap-3">
                {analysis.crosscheck_sources.map((s) => (
                  <a
                    key={s.domain}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#639922]/20 bg-[#EAF3DE]/30 text-xs font-medium text-[#27500A] hover:bg-[#EAF3DE] hover:border-[#639922]/40 transition-colors"
                    style={{ fontFamily: "'Work Sans', sans-serif" }}
                  >
                    <span className="text-[#639922]">↗</span>
                    {s.name || s.domain}
                  </a>
                ))}
              </div>
            </div>
          )}

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
