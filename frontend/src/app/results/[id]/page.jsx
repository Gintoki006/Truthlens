"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import DashboardView from "@/components/ui/DashboardView";
import ArchiveView from "@/components/ui/ArchiveView";
import AnalyzeForm from "@/components/forms/AnalyzeForm";
import { motion, AnimatePresence } from "framer-motion";

export default function ResultsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, signOut } = useAuth();
  const { analysis, loading, error } = useAnalysis(params.id);
  const [votes, setVotes] = useState({ up: 0, down: 0 });
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [rewrite, setRewrite] = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [showRewrite, setShowRewrite] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [activeView, setActiveView] = useState(searchParams.get("view") || "results");
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toISOString().substring(11, 19);
      setCurrentTime(`UTC ${timeString}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);
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

  // Reconstruct groups if they were fetched flat from Supabase
  // Reconstruct groups if they were fetched flat from Supabase
  const groups = analysis.groups || {
    content: {
      score: analysis.text_only_formula ? Math.round((analysis.score_nlp * (0.40)) + (analysis.score_ml * (0.60))) : Math.round((analysis.score_nlp * 0.31) + (analysis.score_ml * 0.69)),
      weight: analysis.text_only_formula ? (analysis.crosscheck_fallback ? 0.60 : 0.50) : 0.65,
      sub_signals: {
        nlp: analysis.score_nlp || 0,
        roberta: analysis.score_roberta || 0,
        lr_model: analysis.score_lr || 0,
        ml_ensemble: analysis.score_ml || 0,
        ...(analysis.factcheck_details?.score_groq_news !== undefined ? { groq_analysis: analysis.factcheck_details.score_groq_news } : {})
      }
    },
    source: {
      score: analysis.text_only_formula ? (analysis.score_crosscheck || 0) : Math.round((analysis.score_source * 0.45) + ((analysis.score_crosscheck || 0) * 0.55)),
      weight: analysis.text_only_formula ? (analysis.crosscheck_fallback ? 0 : 0.30) : 0.35,
      sub_signals: analysis.text_only_formula ? {
        crosscheck: analysis.score_crosscheck || 0
      } : {
        domain_trust: analysis.score_source || 0,
        crosscheck: analysis.score_crosscheck || 0
      }
    },
    facts: analysis.score_factcheck != null ? {
      score: analysis.score_factcheck || 0,
      sub_signals: {
        factcheck: analysis.score_gfactcheck || 50,
        wikidata: analysis.score_wikidata || 50,
        fever: analysis.score_fever || 50,
        ...(analysis.factcheck_details?.score_groq_fact !== undefined ? { groq_logic: analysis.factcheck_details.score_groq_fact } : {})
      },
      factcheck_result: {
        rating: analysis.factcheck_details?.gfactcheck?.verdict || null,
        checker: analysis.factcheck_details?.gfactcheck?.source || null,
        url: analysis.factcheck_details?.gfactcheck?.review_url || null,
      },
      wikidata_status: (analysis.score_wikidata || 50) >= 90 ? "confirmed" : ((analysis.score_wikidata || 50) <= 20 ? "contradicted" : "unverified")
    } : null
  };

  const communityDisagrees =
    (analysis.verdict === "real" && votes.down >= 5) ||
    (analysis.verdict === "fake" && votes.up >= 5);

  return (
    <div className="font-body min-h-screen flex flex-col antialiased bg-[var(--surface-bright)] text-[var(--text-primary)]">
      {/* Global Misinformation Ticker */}
      <div className="w-full bg-primary text-on-primary font-label text-[10px] tracking-[0.2em] uppercase py-2 px-4 flex justify-between items-center border-b-[0.5px] border-outline-variant">
        <div className="flex items-center space-x-4">
          <span className="font-bold">VOL. LXIV</span>
          <span className="opacity-70">No. 28,452</span>
        </div>
        <div className="flex-grow overflow-hidden relative h-4 ml-8">
          <div className="absolute whitespace-nowrap animate-[ticker_30s_linear_infinite] flex space-x-8">
            <span><span className="text-secondary font-bold mr-2">ALERT:</span> SYNTHETIC AUDIO DETECTED IN SECTOR 4</span>
            <span className="text-outline-variant">{"///"}</span>
            <span>GLOBAL CREDIBILITY INDEX DOWN 0.4%</span>
            <span className="text-outline-variant">{"///"}</span>
            <span>NEW BOTNET CLUSTER IDENTIFIED (NODE: OMEGA)</span>
            <span className="text-outline-variant">{"///"}</span>
            <span><span className="text-secondary font-bold mr-2">UPDATE:</span> LINGUISTIC DRIFT IN PRIMARY SOURCES</span>
          </div>
        </div>
        <div className="ml-4 flex items-center space-x-2">
          <span className="material-symbols-outlined text-[14px]">public</span>
          <span>{currentTime || "UTC --:--:--"}</span>
        </div>
      </div>

      {/* TopAppBar */}
      <header className="bg-surface dark:bg-background text-primary dark:text-on-background docked full-width top-0 border-b-4 border-primary dark:border-on-background flat no shadows flex flex-col items-center w-full px-8 pt-6 pb-2 max-w-full">
        <div className="w-full flex justify-between items-end mb-4">
          <div className="flex flex-col">
            <span className="font-label text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">THE INVESTIGATIVE LEDGER</span>
          </div>
          <h1 className="text-6xl md:text-8xl text-center font-black font-serif uppercase tracking-tighter text-slate-900 dark:text-stone-100 border-b-4 border-slate-900 dark:border-stone-100 mb-2 py-4">
            <Link href="/">TRUTHLENS</Link>
          </h1>
          <div className="flex items-center space-x-6">
            {user && (
              <button 
                onClick={handleBookmark}
                disabled={bookmarkLoading}
                className={`hover:text-secondary dark:hover:text-secondary-fixed transition-colors ${bookmarked ? 'text-secondary' : ''}`}
                title={bookmarked ? "Remove bookmark" : "Bookmark"}
              >
                <span className="material-symbols-outlined" data-icon="bookmark">{bookmarked ? 'bookmark_added' : 'bookmark_add'}</span>
              </button>
            )}
            <button className="hover:text-secondary dark:hover:text-secondary-fixed transition-colors">
              <span className="material-symbols-outlined" data-icon="settings">settings</span>
            </button>
          </div>
        </div>
        <nav className="w-full flex justify-center space-x-12 mt-2 hidden sm:flex">
          <button 
            onClick={() => setActiveView("dashboard")}
            className={`uppercase tracking-[0.2em] text-[10px] font-label transition-colors pb-1 ${activeView === "dashboard" ? "text-primary dark:text-on-background font-bold border-b-2 border-primary dark:border-on-background" : "text-on-surface-variant dark:text-on-tertiary-container hover:text-secondary dark:hover:text-secondary-fixed"}`}
          >
            DASHBOARD
          </button>
          <button 
            onClick={() => setActiveView("results")}
            className={`uppercase tracking-[0.2em] text-[10px] font-label transition-colors pb-1 ${activeView === "results" ? "text-primary dark:text-on-background font-bold border-b-2 border-primary dark:border-on-background" : "text-on-surface-variant dark:text-on-tertiary-container hover:text-secondary dark:hover:text-secondary-fixed"}`}
          >
            CURRENT ANALYSIS
          </button>
          <button 
            onClick={() => setActiveView("archive")}
            className={`uppercase tracking-[0.2em] text-[10px] font-label transition-colors pb-1 ${activeView === "archive" ? "text-primary dark:text-on-background font-bold border-b-2 border-primary dark:border-on-background" : "text-on-surface-variant dark:text-on-tertiary-container hover:text-secondary dark:hover:text-secondary-fixed"}`}
          >
            ARCHIVE LEDGER
          </button>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SideNavBar */}
        <aside className="bg-surface-container-low dark:bg-surface-container text-primary dark:text-on-background docked left-0 border-r-[0.5px] border-outline-variant flat no shadows flex flex-col h-full shrink-0 w-64 overflow-y-auto hidden lg:flex">
          <div className="p-6 editorial-rule-thin mb-4">
            <div className="flex flex-col mb-8">
              <span className="font-display text-2xl font-bold text-primary">TRUTHLENS LEDGER</span>
              <span className="font-label uppercase tracking-widest text-[10px] text-on-surface-variant mt-1">INVESTIGATIVE UNIT</span>
            </div>
            <button onClick={() => setIsAnalyzeModalOpen(true)} className="w-full bg-primary text-on-primary font-label text-[10px] uppercase tracking-[0.1em] py-3 px-4 hover:bg-surface-tint transition-colors mb-8 flex justify-center items-center">
              <span className="material-symbols-outlined mr-2 text-[14px]">add</span> NEW ANALYSIS
            </button>
            
            <div className="font-label text-[10px] tracking-[0.2em] uppercase text-on-surface-variant mb-4 px-2">TABLE OF CONTENTS</div>
            <nav className="flex flex-col space-y-1">
              <button 
                onClick={() => setActiveView("dashboard")}
                className={`flex items-center px-4 py-3 font-label uppercase tracking-widest text-[10px] transition-all duration-200 ${
                  activeView === "dashboard" 
                    ? "bg-primary text-on-primary font-bold" 
                    : "text-on-surface-variant dark:text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <span className="material-symbols-outlined mr-4" data-icon="dashboard">dashboard</span> DASHBOARD
              </button>
              <button 
                onClick={() => setActiveView("results")}
                className={`flex items-center px-4 py-3 font-label uppercase tracking-widest text-[10px] transition-all duration-200 ${
                  activeView === "results" 
                    ? "bg-primary text-on-primary font-bold" 
                    : "text-on-surface-variant dark:text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <span className="material-symbols-outlined mr-4" data-icon="analytics">analytics</span> THIS ANALYSIS
              </button>
            </nav>
          </div>
          
          <div className="mt-auto p-4 editorial-rule-thin">
            <nav className="flex flex-col space-y-1">
              <button 
                onClick={() => setActiveView("archive")}
                className={`flex items-center px-4 py-2 font-label uppercase tracking-widest text-[10px] transition-colors w-full text-left ${
                  activeView === "archive" 
                    ? "bg-surface-container-highest text-primary font-bold" 
                    : "text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                <span className="material-symbols-outlined mr-4 text-[16px]" data-icon="archive">archive</span> ARCHIVE
              </button>
              {user && (
                <button 
                  onClick={async () => {
                    await signOut();
                    window.location.href = "/";
                  }}
                  className="flex items-center px-4 py-2 text-on-surface-variant hover:bg-surface-container-highest font-label uppercase tracking-widest text-[10px] transition-colors w-full text-left"
                >
                  <span className="material-symbols-outlined mr-4 text-[16px]" data-icon="logout">logout</span> LOGOUT
                </button>
              )}
            </nav>
          </div>
        </aside>

        {/* Main Stage */}
        <main className="flex-1 flex overflow-hidden bg-surface flex-col md:flex-row">
          {activeView === "archive" ? (
            <ArchiveView />
          ) : activeView === "dashboard" ? (
            <DashboardView />
          ) : (
            <>
              {/* Verification Sidebar */}
              <section className="w-full md:w-80 flex flex-col editorial-border-r h-full bg-surface-container-low overflow-y-auto shrink-0 border-b md:border-b-0 border-outline-variant">
            <div className="p-6 space-y-8">
              {/* Suspicious/Real Badge */}
              <div className={`inline-flex items-center px-4 py-2 border-[1px] font-label text-xs tracking-[0.1em] uppercase font-bold rounded-full ${
                analysis.verdict === 'fake' || analysis.verdict === 'suspicious' 
                  ? 'border-[#c4842b] bg-[#fdfaf5] text-[#c4842b]' 
                  : 'border-[#00c853] bg-[#e6f4ea] text-[#00c853]'
              }`}>
                <span className="material-symbols-outlined mr-2 text-[16px]">
                  {analysis.verdict === 'fake' || analysis.verdict === 'suspicious' ? 'warning' : 'verified'}
                </span>
                {analysis.verdict || "UNKNOWN"}
              </div>

              {/* Badges */}
              {(analysis.override_applied || analysis.text_only_formula || analysis.crosscheck_fallback || communityDisagrees || analysis.confidence_warning) && (
                <div className="space-y-2 flex flex-col items-start">
                  {analysis.override_applied && (
                     <div className="inline-flex items-center px-3 py-1.5 border-[1px] border-[#7c4dff] bg-[#f3edfc] text-[#7c4dff] font-label text-[10px] tracking-[0.1em] uppercase font-bold rounded-full">
                       <span className="material-symbols-outlined mr-2 text-[14px]">policy</span> OVERRIDE APPLIED
                     </div>
                  )}
                  {analysis.text_only_formula && (
                     <div className="inline-flex items-center px-3 py-1.5 border-[1px] border-[#444748] bg-[#f4f4f0] text-[#444748] font-label text-[10px] tracking-[0.1em] uppercase font-bold rounded-full">
                       <span className="material-symbols-outlined mr-2 text-[14px]">description</span> TEXT-ONLY FORMULA
                     </div>
                  )}
                  {analysis.crosscheck_fallback && (
                     <div className="inline-flex items-center px-3 py-1.5 border-[1px] border-[#c4842b] bg-[#fdfaf5] text-[#c4842b] font-label text-[10px] tracking-[0.1em] uppercase font-bold rounded-full">
                       <span className="material-symbols-outlined mr-2 text-[14px]">sync_problem</span> FALLBACK SEARCH
                     </div>
                  )}
                  {communityDisagrees && (
                     <div className="inline-flex items-center px-3 py-1.5 border-[1px] border-[#b7211f] bg-[#ffdad6] text-[#b7211f] font-label text-[10px] tracking-[0.1em] uppercase font-bold rounded-full">
                       <span className="material-symbols-outlined mr-2 text-[14px]">group_off</span> COMMUNITY DISAGREES
                     </div>
                  )}
                  {analysis.confidence_warning && (
                     <div className="inline-flex items-center px-3 py-1.5 border-[1px] border-[#c4842b] bg-[#fdfaf5] text-[#c4842b] font-label text-[10px] tracking-[0.1em] uppercase font-bold rounded-full">
                       <span className="material-symbols-outlined mr-2 text-[14px]">warning</span> LOW CONFIDENCE
                     </div>
                  )}
                </div>
              )}

              {/* Signal Groups */}
              <div>
                <h4 className="font-label text-[10px] tracking-[0.15em] uppercase text-on-surface-variant mb-4 font-bold">SIGNAL GROUPS</h4>
                <div className="space-y-3">
                  {groups.content && (
                    <GroupScoreBar 
                      groupKey="content" 
                      label="Content Intelligence" 
                      score={groups.content.score} 
                      subSignals={groups.content.sub_signals} 
                    />
                  )}
                  {groups.source && (
                    <GroupScoreBar 
                      groupKey="source" 
                      label="Source & Corroboration" 
                      score={groups.source.score} 
                      subSignals={groups.source.sub_signals} 
                    />
                  )}
                  {groups.facts && (
                    <GroupScoreBar 
                      groupKey="facts" 
                      label="Fact Verification" 
                      score={groups.facts.score} 
                      subSignals={groups.facts.sub_signals} 
                    />
                  )}
                </div>
              </div>

              {/* Entity warning / Wikidata Status */}
              {groups?.facts?.wikidata_status && groups.facts.wikidata_status !== "unverified" && (
                <>
                  <div className={`p-3 border-[0.5px] flex items-start ${
                    groups.facts.wikidata_status === "contradicted" 
                      ? 'border-secondary bg-secondary-fixed/10' 
                      : 'border-[#00c853] bg-[#e6f4ea]'
                  }`}>
                    <span className={`font-headline font-bold mr-3 ${
                      groups.facts.wikidata_status === "contradicted" ? 'text-secondary' : 'text-[#00c853]'
                    }`}>W</span>
                    <span className={`font-body text-sm ${
                      groups.facts.wikidata_status === "contradicted" ? 'text-secondary' : 'text-[#00c853]'
                    }`}>
                      {groups.facts.wikidata_status === "contradicted" ? "Entity predicates contradicted by Wikidata" : "Entities confirmed by Wikidata"}
                    </span>
                  </div>
                  <div className="editorial-rule-thin"></div>
                </>
              )}

              {/* Cross-Verification */}
              <div>
                <h4 className="font-label text-[10px] tracking-[0.15em] uppercase text-on-surface-variant mb-4 font-bold">CROSS-VERIFICATION</h4>
                {analysis.crosscheck_sources && analysis.crosscheck_sources.length > 0 ? (
                  <div className="space-y-2">
                    {analysis.crosscheck_sources.map((s, i) => (
                      <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="block p-3 border-[0.5px] border-outline-variant bg-surface hover:bg-surface-container-highest transition-colors">
                        <div className="font-label text-[10px] tracking-wide uppercase font-bold text-on-surface-variant mb-1">{s.name || s.domain}</div>
                        <div className="font-body text-xs text-on-surface line-clamp-2">{s.title || s.url}</div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border-[0.5px] border-secondary/50 bg-secondary-fixed/5">
                    <div className="flex items-center mb-2">
                      <span className="material-symbols-outlined text-secondary mr-2 text-[18px]">search_off</span>
                      <span className="font-label text-[10px] tracking-wide uppercase font-bold text-secondary">NO CORROBORATION FOUND</span>
                    </div>
                    <p className="font-body text-xs text-secondary/80">No major outlets were found covering this claim.</p>
                  </div>
                )}
              </div>

              <div className="editorial-rule-thin"></div>

              {/* Source Info */}
              {analysis.source_domain && (
                <>
                  <div>
                    <h4 className="font-label text-[10px] tracking-[0.15em] uppercase text-on-surface-variant mb-4 font-bold">SOURCE INFO</h4>
                    <a className="font-body text-sm text-primary underline decoration-outline-variant underline-offset-4" href={`https://${analysis.source_domain}`} target="_blank" rel="noopener noreferrer">
                      {analysis.source_domain}
                    </a>
                    {analysis.source_info && !analysis.source_info.is_known && (
                      <p className="font-body text-xs text-secondary mt-2">Unverified domain</p>
                    )}
                    {analysis.source_info && analysis.source_info.bias && analysis.source_info.bias !== "unknown" && (
                      <p className="font-body text-xs text-on-surface-variant mt-2 capitalize">Bias: {analysis.source_info.bias}</p>
                    )}
                  </div>
                  <div className="editorial-rule-thin"></div>
                </>
              )}

              {/* Community Votes */}
              <div>
                <h4 className="font-label text-[10px] tracking-[0.15em] uppercase text-on-surface-variant mb-4 font-bold">COMMUNITY VOTES</h4>
                <div className="flex space-x-4">
                  <button onClick={() => handleVote("up")} className="flex items-center px-4 py-2 border-[0.5px] border-outline-variant bg-surface hover:bg-surface-container-highest transition-colors rounded-md">
                    <span className="material-symbols-outlined text-[16px] mr-2 text-[#00c853]">thumb_up</span>
                    <span className="font-headline text-sm font-bold">{votes.up}</span>
                  </button>
                  <button onClick={() => handleVote("down")} className="flex items-center px-4 py-2 border-[0.5px] border-outline-variant bg-surface hover:bg-surface-container-highest transition-colors rounded-md">
                    <span className="material-symbols-outlined text-[16px] mr-2 text-secondary">thumb_down</span>
                    <span className="font-headline text-sm font-bold">{votes.down}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Main Analysis Content */}
          <section className="flex-1 flex flex-col h-full overflow-y-auto bg-surface relative z-10 p-6 md:p-12">
            <div className="max-w-4xl mx-auto w-full">
              
              {/* Authenticity Gauge */}
              <div className="flex justify-center mb-12">
                <div className="relative w-56 h-28 overflow-hidden">
                  <svg className="w-full h-full" viewBox="0 0 100 50">
                    {/* Background Arc */}
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e9e8e4" strokeLinecap="round" strokeWidth="8"></path>
                    {/* Foreground Arc */}
                    <path 
                      d="M 10 50 A 40 40 0 0 1 90 50" 
                      fill="none" 
                      stroke={analysis.score_final > 70 ? "#00c853" : analysis.score_final > 40 ? "#ffc107" : "#c4842b"} 
                      strokeLinecap="round" 
                      strokeWidth="8"
                      strokeDasharray="125.6" 
                      strokeDashoffset={125.6 - (125.6 * (analysis.score_final || 0)) / 100}
                      style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                    ></path>
                  </svg>
                  <div className="absolute bottom-0 left-0 w-full text-center flex flex-col items-center">
                    <span className={`font-headline text-5xl font-bold ${
                      analysis.score_final > 70 ? "text-[#00c853]" : analysis.score_final > 40 ? "text-[#ffc107]" : "text-[#c4842b]"
                    }`}>
                      {analysis.score_final || 0}
                    </span>
                    <span className="font-label text-[8px] tracking-[0.2em] uppercase text-on-surface-variant mt-1">AUTHENTICITY SCORE</span>
                  </div>
                </div>
              </div>

              {/* Headline */}
              <h1 className="font-headline text-3xl md:text-4xl leading-tight font-bold text-primary mb-8">
                {analysis.article_title || "Untitled Article"}
              </h1>

              {/* AI Explanation */}
              <div className="border-[1px] border-primary rounded-xl p-6 mb-8 bg-surface shadow-ink-sm">
                <h4 className="font-label text-[10px] tracking-[0.2em] uppercase font-bold text-primary mb-4">AI EXPLANATION</h4>
                <p className="font-body text-base leading-relaxed text-on-surface">
                  {analysis.explanation || "No explanation available."}
                </p>
              </div>

              {/* Actions */}
              {analysis.article_body && (
                <div className="mb-12">
                  <button 
                    onClick={handleRewrite}
                    disabled={rewriteLoading}
                    className="flex items-center px-4 py-2 border-[1px] border-outline-variant rounded-md hover:bg-surface-container-highest transition-colors font-body text-sm font-medium"
                  >
                    {rewriteLoading ? (
                      <span className="material-symbols-outlined animate-spin mr-2 text-[16px]">sync</span>
                    ) : (
                      <span className="material-symbols-outlined mr-2 text-[16px] text-[#c4842b]">auto_awesome</span>
                    )}
                    {showRewrite ? "Hide neutral version" : "Show neutral version"}
                  </button>
                  
                  {showRewrite && rewrite && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-6 border-[0.5px] border-secondary/20 bg-[#FCEBEB]/20">
                        <h4 className="font-label text-[10px] tracking-[0.2em] uppercase font-bold text-secondary mb-4">Original</h4>
                        <p className="font-body text-sm leading-relaxed whitespace-pre-wrap">{rewrite.original}</p>
                      </div>
                      <div className="p-6 border-[0.5px] border-[#00c853]/20 bg-[#e6f4ea]/20">
                        <h4 className="font-label text-[10px] tracking-[0.2em] uppercase font-bold text-[#00c853] mb-4">Neutral Rewrite</h4>
                        <p className="font-body text-sm leading-relaxed whitespace-pre-wrap">{rewrite.rewritten}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Article Analysis */}
              {analysis.sentences && analysis.sentences.length > 0 && (
                <div>
                  <h4 className="font-label text-[10px] tracking-[0.2em] uppercase font-bold text-primary mb-6 flex items-center">
                    ARTICLE ANALYSIS 
                    <span className="mx-3 text-outline-variant">—</span>
                    <span className="text-on-surface-variant">CLICK ANY SENTENCE FOR DETAILS</span>
                  </h4>
                  <div className="font-body text-lg leading-loose text-on-surface">
                    <SentenceHighlight sentences={analysis.sentences} />
                  </div>
                </div>
              )}
            </div>
          </section>
            </>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-surface dark:bg-background text-primary dark:text-on-background docked full-width bottom-0 border-t-4 border-double border-primary dark:border-on-background flat no shadows flex justify-between items-center w-full px-8 py-4 max-w-full z-20">
        <span className="font-display text-lg font-bold">TRUTHLENS</span>
        <nav className="flex space-x-6">
          <a className="text-on-surface-variant dark:text-tertiary-container font-label text-[8px] tracking-[0.15em] uppercase hover:text-primary dark:hover:text-on-background" href="#">PRIVACY POLICY</a>
          <a className="text-on-surface-variant dark:text-tertiary-container font-label text-[8px] tracking-[0.15em] uppercase hover:text-primary dark:hover:text-on-background" href="#">METHODOLOGY</a>
          <a className="text-on-surface-variant dark:text-tertiary-container font-label text-[8px] tracking-[0.15em] uppercase hover:text-primary dark:hover:text-on-background" href="#">DATA SOURCES</a>
          <a className="text-on-surface-variant dark:text-tertiary-container font-label text-[8px] tracking-[0.15em] uppercase hover:text-primary dark:hover:text-on-background" href="#">CONTACT</a>
        </nav>
        <span className="font-label text-[8px] tracking-[0.15em] uppercase">© MMXXIV TRUTHLENS INVESTIGATIVE LEDGER. ALL RIGHTS RESERVED.</span>
      </footer>

      <AnimatePresence>
        {isAnalyzeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-3xl bg-surface-bright dark:bg-surface-container rounded-none shadow-2xl p-6 md:p-10 border-[0.5px] border-outline-variant overflow-hidden"
            >
              <button 
                onClick={() => setIsAnalyzeModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              
              <div className="text-center mb-8">
                <span className="bg-secondary text-white px-3 py-1 font-label text-[10px] font-bold uppercase tracking-[0.2em] mb-4 inline-block">
                  New Audit
                </span>
                <h3 className="text-3xl font-serif font-black uppercase tracking-tight text-primary">Start New Analysis</h3>
              </div>
              
              <AnalyzeForm />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

}
