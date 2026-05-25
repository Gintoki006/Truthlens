"use client";

import { useEffect, useState, Fragment } from "react";
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
import LiveFeedView from "@/components/ui/LiveFeedView";
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
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  useEffect(() => {
    const view = searchParams.get("view");
    if (view) {
      setActiveView(view);
    }
  }, [searchParams]);

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

  const [tickerItems, setTickerItems] = useState([]);
  
  useEffect(() => {
    async function fetchTicker() {
      try {
        const res = await fetch('/api/feed?limit=20');
        if (res.ok) {
          const data = await res.json();
          if (data.items) {
            const analyzed = data.items.filter(item => item.verdict);
            const toShow = analyzed.length >= 3 ? analyzed : data.items;
            setTickerItems(toShow.slice(0, 5));
          }
        }
      } catch (err) {}
    }
    fetchTicker();
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
        ...(analysis.factcheck_details?.score_groq_news !== undefined ? { semantic_analysis: analysis.factcheck_details.score_groq_news } : {})
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
        ...(analysis.factcheck_details?.score_groq_fact !== undefined ? { semantic_logic: analysis.factcheck_details.score_groq_fact } : {})
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
          <span className="font-bold">TRUTHLENS OS</span>
          <span className="opacity-70">— NO. 402</span>
        </div>
        <div className="flex-grow overflow-hidden relative h-4 ml-8 flex items-center min-w-0">
          <div className="absolute flex w-max animate-[marquee_40s_linear_infinite] hover:[animation-play-state:paused] items-center h-full top-0 left-0">
            {tickerItems.length > 0 ? (
              [...tickerItems, ...tickerItems].map((item, i) => (
                <span key={i} className="flex items-center space-x-8 pr-8">
                  <span>
                    <span className={`font-bold mr-2 ${item.verdict === 'fake' ? 'text-[#b7211f]' : item.verdict === 'real' ? 'text-[#00c853]' : item.verdict === 'suspicious' ? 'text-[#c4842b]' : 'text-secondary'}`}>
                      {item.verdict ? `[${item.verdict.toUpperCase()}]` : 'ALERT:'}
                    </span>
                    <Link href={item.analysis_id ? `/results/${item.analysis_id}?view=results` : '#'} className="text-white hover:text-white/70 transition-colors">
                      {item.headline ? (item.headline.length > 60 ? item.headline.substring(0, 60) + '...' : item.headline) : "SYSTEM UPDATE"}
                    </Link>
                  </span>
                  <span className="text-outline-variant">{"///"}</span>
                </span>
              ))
            ) : (
              [1, 2].map(idx => (
                <Fragment key={idx}>
                  <span className="flex items-center space-x-8 pr-8">
                    <span><span className="text-secondary font-bold mr-2">ALERT:</span> SYNTHETIC AUDIO DETECTED IN SECTOR 4</span>
                    <span className="text-outline-variant">{"///"}</span>
                  </span>
                  <span className="flex items-center space-x-8 pr-8">
                    <span>GLOBAL CREDIBILITY INDEX DOWN 0.4%</span>
                    <span className="text-outline-variant">{"///"}</span>
                  </span>
                  <span className="flex items-center space-x-8 pr-8">
                    <span>NEW BOTNET CLUSTER IDENTIFIED (NODE: OMEGA)</span>
                    <span className="text-outline-variant">{"///"}</span>
                  </span>
                  <span className="flex items-center space-x-8 pr-8">
                    <span><span className="text-secondary font-bold mr-2">UPDATE:</span> LINGUISTIC DRIFT IN PRIMARY SOURCES</span>
                    <span className="text-outline-variant">{"///"}</span>
                  </span>
                </Fragment>
              ))
            )}
          </div>
        </div>
        <div className="ml-4 flex items-center space-x-2">
          <span className="material-symbols-outlined text-[14px]">public</span>
          <span>{currentTime || "UTC --:--:--"}</span>
        </div>
      </div>

      {/* TopAppBar */}
      <header className="bg-surface dark:bg-background text-primary dark:text-on-background docked full-width top-0 border-b-4 border-primary dark:border-on-background flat no shadows flex flex-col items-center w-full px-4 md:px-8 pt-6 pb-2 max-w-full relative">
        <div className="w-full flex flex-col md:flex-row justify-between items-center md:items-end mb-4">
          <div className="hidden md:flex flex-col flex-1 pb-4">
            <span className="font-label text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">THE VERIFICATION ENGINE</span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-8xl text-center font-black font-serif uppercase tracking-tighter text-slate-900 dark:text-stone-100 border-b-4 border-slate-900 dark:border-stone-100 mb-2 py-2 md:py-4 shrink-0">
            <Link href="/">TRUTHLENS</Link>
          </h1>
          <div className="flex items-center justify-end md:flex-1 space-x-6 md:pb-4 absolute top-6 right-4 md:relative md:top-auto md:right-auto">
            <button className="hover:text-secondary dark:hover:text-secondary-fixed transition-colors">
              <span className="material-symbols-outlined" data-icon="settings">settings</span>
            </button>
          </div>
        </div>
        <nav className="w-full flex justify-start md:justify-center space-x-6 md:space-x-12 mt-2 overflow-x-auto pb-2 no-scrollbar px-2 md:px-0">
          <button 
            onClick={() => setActiveView("dashboard")}
            className={`uppercase tracking-[0.2em] text-xs font-label transition-colors pb-1 ${activeView === "dashboard" ? "text-primary dark:text-on-background font-bold border-b-2 border-primary dark:border-on-background" : "text-on-surface-variant dark:text-on-tertiary-container hover:text-secondary dark:hover:text-secondary-fixed"}`}
          >
            DASHBOARD
          </button>
          <button 
            onClick={() => setActiveView("results")}
            className={`uppercase tracking-[0.2em] text-xs font-label transition-colors pb-1 ${activeView === "results" ? "text-primary dark:text-on-background font-bold border-b-2 border-primary dark:border-on-background" : "text-on-surface-variant dark:text-on-tertiary-container hover:text-secondary dark:hover:text-secondary-fixed"}`}
          >
            CURRENT ANALYSIS
          </button>
          <button 
            onClick={() => setActiveView("archive")}
            className={`uppercase tracking-[0.2em] text-xs font-label transition-colors pb-1 ${activeView === "archive" ? "text-primary dark:text-on-background font-bold border-b-2 border-primary dark:border-on-background" : "text-on-surface-variant dark:text-on-tertiary-container hover:text-secondary dark:hover:text-secondary-fixed"}`}
          >
            ARCHIVE LEDGER
          </button>
          <button 
            onClick={() => setActiveView("live_news")}
            className={`uppercase tracking-[0.2em] text-xs font-label transition-colors pb-1 flex items-center gap-1 ${activeView === "live_news" ? "text-[#b7211f] font-bold border-b-2 border-[#b7211f]" : "text-on-surface-variant dark:text-on-tertiary-container hover:text-[#b7211f]"}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#b7211f] animate-pulse"></span> LIVE NEWS
          </button>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SideNavBar */}
        <motion.aside 
          layout
          initial={false}
          animate={{ width: isSidebarExpanded ? 256 : 80 }}
          transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
          className="bg-surface-container-low dark:bg-surface-container text-primary dark:text-on-background docked left-0 border-r-[0.5px] border-outline-variant flat no shadows flex flex-col h-full shrink-0 overflow-y-hidden hidden lg:flex"
        >
          <div className={`p-4 ${isSidebarExpanded ? 'p-6' : ''} editorial-rule-thin mb-4 flex-1`}>
            {/* Toggle Button */}
            <div className={`flex items-center ${isSidebarExpanded ? 'justify-end' : 'justify-center'} mb-6`}>
              <button 
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                className="text-on-surface-variant hover:text-primary transition-colors p-1"
                title={isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isSidebarExpanded ? "keyboard_double_arrow_left" : "keyboard_double_arrow_right"}
                </span>
              </button>
            </div>

            {isSidebarExpanded && (
              <div className="flex flex-col mb-8">
                <span className="font-display text-2xl font-bold text-primary truncate">TRUTHLENS</span>
                <span className="font-label uppercase tracking-widest text-[10px] text-on-surface-variant mt-1">VERIFICATION ENGINE</span>
              </div>
            )}
            
            <button 
              onClick={() => setIsAnalyzeModalOpen(true)} 
              className={`w-full bg-primary text-on-primary font-label text-[10px] uppercase tracking-[0.1em] py-3 hover:bg-surface-tint transition-colors mb-8 flex justify-center items-center ${isSidebarExpanded ? 'px-4' : 'px-0'}`}
              title="New Analysis"
            >
              <span className="material-symbols-outlined text-[14px]">{isSidebarExpanded ? 'add' : 'add'}</span> 
              {isSidebarExpanded && <span className="ml-2">NEW ANALYSIS</span>}
            </button>
            
            {isSidebarExpanded && <div className="font-label text-[10px] tracking-[0.2em] uppercase text-on-surface-variant mb-4 px-2 truncate">TABLE OF CONTENTS</div>}
            
            <nav className="flex flex-col space-y-1">
              <button 
                onClick={() => setActiveView("dashboard")}
                title="Dashboard"
                className={`flex items-center py-3 font-label uppercase tracking-widest text-[10px] transition-all duration-200 ${isSidebarExpanded ? 'px-4' : 'justify-center'} ${
                  activeView === "dashboard" 
                    ? "bg-primary text-on-primary font-bold" 
                    : "text-on-surface-variant dark:text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
                {isSidebarExpanded && <span className="ml-4 truncate">DASHBOARD</span>}
              </button>
              <button 
                onClick={() => setActiveView("results")}
                title="This Analysis"
                className={`flex items-center py-3 font-label uppercase tracking-widest text-[10px] transition-all duration-200 ${isSidebarExpanded ? 'px-4' : 'justify-center'} ${
                  activeView === "results" 
                    ? "bg-primary text-on-primary font-bold" 
                    : "text-on-surface-variant dark:text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <span className="material-symbols-outlined" data-icon="analytics">analytics</span>
                {isSidebarExpanded && <span className="ml-4 truncate">THIS ANALYSIS</span>}
              </button>
              <button 
                onClick={() => setActiveView("live_news")}
                title="Live News"
                className={`flex items-center py-3 font-label uppercase tracking-widest text-[10px] transition-all duration-200 ${isSidebarExpanded ? 'px-4' : 'justify-center'} ${
                  activeView === "live_news" 
                    ? "bg-[#FCEBEB]/50 text-[#b7211f] font-bold border-l-4 border-[#b7211f]" 
                    : "text-on-surface-variant dark:text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <span className="material-symbols-outlined text-[#b7211f]" data-icon="cell_tower">cell_tower</span>
                {isSidebarExpanded && <span className="ml-4 truncate">LIVE NEWS</span>}
              </button>
            </nav>
          </div>
          
          <div className="mt-auto p-4 editorial-rule-thin">
            <nav className="flex flex-col space-y-1">
              <button 
                onClick={() => setActiveView("archive")}
                title="Archive"
                className={`flex items-center py-2 font-label uppercase tracking-widest text-[10px] transition-colors w-full ${isSidebarExpanded ? 'px-4 text-left' : 'justify-center'} ${
                  activeView === "archive" 
                    ? "bg-surface-container-highest text-primary font-bold" 
                    : "text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]" data-icon="archive">archive</span>
                {isSidebarExpanded && <span className="ml-4 truncate">ARCHIVE</span>}
              </button>
              {user && (
                <button 
                  onClick={async () => {
                    await signOut();
                    window.location.href = "/";
                  }}
                  title="Logout"
                  className={`flex items-center py-2 text-on-surface-variant hover:bg-surface-container-highest font-label uppercase tracking-widest text-[10px] transition-colors w-full ${isSidebarExpanded ? 'px-4 text-left' : 'justify-center'}`}
                >
                  <span className="material-symbols-outlined text-[16px]" data-icon="logout">logout</span>
                  {isSidebarExpanded && <span className="ml-4 truncate">LOGOUT</span>}
                </button>
              )}
            </nav>
          </div>
        </motion.aside>

        {/* Main Stage */}
        <main className="flex-1 flex overflow-hidden bg-surface flex-col md:flex-row relative">
          <AnimatePresence mode="wait">
            {activeView === "archive" ? (
              <motion.div 
                key="archive"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="w-full h-full"
              >
                <ArchiveView />
              </motion.div>
            ) : activeView === "dashboard" ? (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="w-full h-full"
              >
                <DashboardView />
              </motion.div>
            ) : activeView === "live_news" ? (
              <motion.div 
                key="live_news"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="w-full h-full"
              >
                <LiveFeedView />
              </motion.div>
            ) : (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="w-full h-full flex flex-col md:flex-row"
              >
                {/* Verification Sidebar */}
              <section className="w-full md:w-80 flex flex-col h-full bg-[#f8f7f4] overflow-y-auto shrink-0 border-r-[1.5px] border-[#d4d4d4] dark:border-stone-700 dark:bg-surface-container-low">
                <div className="p-6 md:p-8 space-y-8 flex-1">
                  
                  {/* REF NO */}
                  <div className="border-b-[1.5px] border-[#d4d4d4] dark:border-stone-700 pb-3 flex justify-between items-center">
                    <span className="font-label text-[9px] uppercase tracking-[0.2em] font-bold text-[#1c1b1b] dark:text-stone-100">
                      REF NO. TR-{analysis.id ? String(parseInt(analysis.id.replace(/-/g, '').substring(0, 8), 16) % 1000).padStart(3, '0') : '001'}
                    </span>
                    {user && (
                      <button onClick={handleBookmark} disabled={bookmarkLoading} className="text-[#1c1b1b] dark:text-stone-100 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[16px]">{bookmarked ? 'bookmark_added' : 'bookmark_add'}</span>
                      </button>
                    )}
                  </div>

                  {/* Verdict */}
                  <div className={`border-2 py-3 px-4 flex items-center justify-center space-x-2 ${
                    analysis.verdict === 'fake' || analysis.verdict === 'suspicious' 
                      ? 'border-[#b7211f] text-[#b7211f]' 
                      : 'border-[#00c853] text-[#00c853]'
                  }`}>
                    <span className="material-symbols-outlined text-[16px] font-bold">
                      {analysis.verdict === 'fake' || analysis.verdict === 'suspicious' ? 'warning' : 'verified'}
                    </span>
                    <span className="font-label text-[11px] uppercase tracking-[0.2em] font-black">
                      VERDICT: {analysis.verdict || "UNKNOWN"}
                    </span>
                  </div>

                  {/* Badges / Entity Warning */}
                  {groups?.facts?.wikidata_status && groups.facts.wikidata_status !== "unverified" && (
                    <div className="border-[1.5px] border-[#b7211f] p-4 flex flex-col items-center text-center bg-white dark:bg-stone-900 shadow-[2px_2px_0px_#b7211f]">
                      <div className="flex items-center text-[#b7211f] mb-2">
                         <span className="material-symbols-outlined text-[18px] mr-2 font-bold">priority_high</span>
                         <span className="font-label text-[9px] font-black tracking-[0.15em] uppercase">CROSS-REFERENCE DISCREPANCY</span>
                      </div>
                      <p className="font-body text-[11px] leading-relaxed text-[#1c1b1b] dark:text-stone-300">
                        {groups.facts.wikidata_status === "contradicted" ? "Entity predicates contradicted by Wikidata knowledge graph protocols." : "Entities confirmed by Wikidata."}
                      </p>
                    </div>
                  )}

                  {/* FIG 1. SIGNAL ANALYSIS */}
                  <div>
                    <div className="border-b-[3px] border-[#1c1b1b] dark:border-stone-100 pb-2 mb-4">
                      <span className="font-label text-[11px] uppercase tracking-[0.2em] font-black text-[#1c1b1b] dark:text-stone-100">FIG 1. SIGNAL ANALYSIS</span>
                    </div>
                    
                    <div className="space-y-2 mt-4">
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

                  {/* FIG 2. CROSS-VERIFICATION */}
                  <div>
                    <div className="border-b-[3px] border-[#1c1b1b] dark:border-stone-100 pb-2 mb-4">
                      <span className="font-label text-[11px] uppercase tracking-[0.2em] font-black text-[#1c1b1b] dark:text-stone-100">FIG 2. CROSS-VERIFICATION</span>
                    </div>

                    {analysis.crosscheck_sources && analysis.crosscheck_sources.length > 0 ? (
                      <div className="space-y-6">
                        {/* DEBUNKING SOURCES */}
                        {analysis.crosscheck_sources.some(s => s.stance === "debunks") && (
                          <div className="space-y-0">
                            <span className="block font-label text-[9px] uppercase tracking-[0.2em] font-black text-[#b7211f] mb-1">DEBUNKING SOURCES</span>
                            {analysis.crosscheck_sources.filter(s => s.stance === "debunks").map((s, i) => (
                              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between border-b-[1.5px] border-[#b7211f]/30 py-3 group hover:bg-[#b7211f]/5 transition-all px-2 -mx-2">
                                <span className="font-serif text-[13px] uppercase font-bold text-[#b7211f] group-hover:text-[#9a1b19] transition-colors">{s.name || s.domain}</span>
                                <span className="material-symbols-outlined text-[14px] text-[#b7211f] opacity-0 group-hover:opacity-100 -translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-300">arrow_outward</span>
                              </a>
                            ))}
                          </div>
                        )}

                        {/* CORROBORATING SOURCES */}
                        {analysis.crosscheck_sources.some(s => s.stance !== "debunks") && (
                          <div className="space-y-0">
                            {analysis.crosscheck_sources.some(s => s.stance === "debunks") && (
                               <span className="block font-label text-[9px] uppercase tracking-[0.2em] font-black text-[#1c1b1b] dark:text-stone-100 mb-1 mt-4">CORROBORATING SOURCES</span>
                            )}
                            {analysis.crosscheck_sources.filter(s => s.stance !== "debunks").map((s, i) => (
                              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between border-b-[1.5px] border-[#d4d4d4] dark:border-stone-700 py-3 group hover:bg-[#1c1b1b]/5 dark:hover:bg-stone-800 transition-all px-2 -mx-2">
                                <span className="font-serif text-[13px] uppercase font-bold text-[#1c1b1b] dark:text-stone-100 group-hover:text-primary transition-colors">{s.name || s.domain}</span>
                                <span className="material-symbols-outlined text-[14px] text-[#1c1b1b] dark:text-stone-100 opacity-0 group-hover:opacity-100 -translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-300">arrow_outward</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-[1.5px] border-[#1c1b1b] dark:border-stone-100 p-4 bg-white dark:bg-stone-900 shadow-[2px_2px_0px_#1c1b1b]">
                        <span className="block font-label text-[9px] uppercase tracking-[0.15em] font-black text-[#b7211f] mb-3 text-center">NO CORROBORATION FOUND</span>
                        <p className="font-body text-[11px] italic text-[#747878] leading-relaxed text-center">
                          Extensive search of primary and secondary news registries yields zero matches for claim ID TR-{analysis.id ? String(parseInt(analysis.id.replace(/-/g, '').substring(0, 8), 16) % 1000).padStart(3, '0') : '001'}.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Source Registry */}
                  {analysis.source_domain && (
                    <div className="pt-4 border-t-[1.5px] border-[#d4d4d4] dark:border-stone-700">
                      <span className="block font-label text-[9px] uppercase tracking-[0.2em] font-black text-[#1c1b1b] dark:text-stone-100 mb-2">SOURCE REGISTRY</span>
                      <a href={`https://${analysis.source_domain}`} target="_blank" rel="noopener noreferrer" className="font-serif text-[13px] font-bold text-[#1c1b1b] dark:text-stone-100 underline decoration-2 underline-offset-4 hover:text-primary transition-colors">
                        {analysis.source_domain}
                      </a>
                    </div>
                  )}

                  {/* Peer Review */}
                  <div className="pt-4 pb-12 md:pb-0">
                    <span className="block font-label text-[9px] uppercase tracking-[0.2em] font-black text-[#1c1b1b] dark:text-stone-100 mb-4">PEER REVIEW</span>
                    <div className="flex border-[2px] border-[#1c1b1b] dark:border-stone-100 shadow-[3px_3px_0px_#1c1b1b]">
                      <button onClick={() => handleVote("up")} className="flex-1 flex justify-between items-center px-3 py-2 bg-[#1c1b1b] text-white hover:bg-black transition-colors border-r-[2px] border-[#1c1b1b]">
                        <span className="font-label text-[9px] uppercase font-black tracking-widest">VERIFY</span>
                        <span className="font-serif text-[14px] font-black">{votes.up}</span>
                      </button>
                      <button onClick={() => handleVote("down")} className="flex-1 flex justify-between items-center px-3 py-2 bg-white dark:bg-stone-900 text-[#1c1b1b] dark:text-stone-100 hover:bg-gray-100 transition-colors">
                        <span className="font-label text-[9px] uppercase font-black tracking-widest">DEBUNK</span>
                        <span className="font-serif text-[14px] font-black">{votes.down}</span>
                      </button>
                    </div>
                  </div>

                </div>
              </section>

          {/* Main Analysis Content */}
          <section className="flex-1 flex flex-col h-full overflow-y-auto bg-white dark:bg-stone-950 relative z-10 p-6 md:p-12 lg:px-24">
            <div className="max-w-4xl mx-auto w-full">
              
              {/* Brutalist Assessment Header */}
              <div className="flex flex-col items-center mb-16 pt-4">
                <span className="font-label text-[10px] tracking-[0.2em] uppercase font-black text-[#1c1b1b] dark:text-stone-100 mb-2">VERIFICATION ASSESSMENT: TR-{analysis.id ? String(parseInt(analysis.id.replace(/-/g, '').substring(0, 8), 16) % 1000).padStart(3, '0') : '001'}</span>
                <div className="w-full max-w-sm border-t-[1px] border-b-[3px] border-[#1c1b1b] dark:border-stone-100 h-2 mb-8"></div>
                
                {/* Score Number */}
                <span className="font-serif text-8xl md:text-[140px] leading-none font-black text-[#1c1b1b] dark:text-stone-100 mb-8 tracking-tighter">
                  {analysis.score_final || 0}
                </span>
                
                <span className="font-label text-[10px] tracking-[0.3em] uppercase font-black text-[#1c1b1b] dark:text-stone-100 mb-4">AUTHENTICITY SCORE</span>
                
                {/* Linear Scale Bar */}
                <div className="w-full max-w-md flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className="font-serif text-[11px] font-bold text-[#1c1b1b] dark:text-stone-100">000</span>
                    <span className="font-label text-[7px] uppercase tracking-[0.1em] text-[#747878] dark:text-stone-400">MIN</span>
                  </div>
                  <div className="flex-1 relative h-3 bg-[#e5e4df] dark:bg-stone-800 flex items-center">
                    <div className="absolute left-0 top-0 bottom-0 bg-[#1c1b1b] dark:bg-stone-100" style={{ width: `${analysis.score_final || 0}%` }}></div>
                    <div className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-[#b7211f]" style={{ left: `${analysis.score_final || 0}%` }}></div>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-serif text-[11px] font-bold text-[#1c1b1b] dark:text-stone-100">100</span>
                    <span className="font-label text-[7px] uppercase tracking-[0.1em] text-[#747878] dark:text-stone-400">MAX</span>
                  </div>
                </div>
              </div>

              {/* Headline */}
              <h1 className="font-serif text-4xl md:text-5xl leading-tight font-black text-[#1c1b1b] dark:text-stone-100 mb-12 tracking-tight">
                {analysis.article_title || "Untitled Article"}
              </h1>

              {/* AI Explanation */}
              <div className="border-[2px] border-[#1c1b1b] dark:border-stone-100 p-6 md:p-8 mb-12 bg-white dark:bg-stone-900 shadow-[4px_4px_0px_#1c1b1b]">
                <h4 className="font-label text-[10px] tracking-[0.2em] uppercase font-black text-[#1c1b1b] dark:text-stone-100 mb-6">AI EXPLANATION</h4>
                <p className="font-body text-[15px] md:text-base leading-[1.8] text-[#1c1b1b] dark:text-stone-300 text-justify">
                  {analysis.explanation || "No explanation available."}
                </p>
              </div>

              {/* Actions */}
              {analysis.article_body && (
                <div className="mb-16">
                  <button 
                    onClick={handleRewrite}
                    disabled={rewriteLoading}
                    className="flex items-center px-4 py-3 border-[1px] border-[#d4d4d4] dark:border-stone-700 bg-[#f8f7f4] dark:bg-stone-800 hover:bg-[#e5e4df] dark:hover:bg-stone-700 transition-colors rounded-none font-body text-xs font-medium text-[#1c1b1b] dark:text-stone-100"
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
                  <h4 className="font-label text-[10px] tracking-[0.2em] uppercase font-black text-[#1c1b1b] dark:text-stone-100 mb-8 flex items-center">
                    ARTICLE ANALYSIS 
                    <span className="mx-3 text-[#d4d4d4] dark:text-stone-700">—</span>
                    <span className="text-[#747878] dark:text-stone-400">CLICK ANY SENTENCE FOR DETAILS</span>
                  </h4>
                  <div className="font-body text-lg leading-loose text-on-surface">
                    <SentenceHighlight sentences={analysis.sentences} />
                  </div>
                </div>
              )}
            </div>
          </section>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-surface dark:bg-background text-primary dark:text-on-background docked full-width bottom-0 border-t-4 border-double border-primary dark:border-on-background flat no shadows flex justify-between items-center w-full px-8 py-4 max-w-full z-20">
        <span className="font-display text-lg font-bold">VERIFICATION ENGINE</span>
        <div className="flex space-x-6">
          <span className="text-on-surface-variant dark:text-tertiary-container font-label text-[8px] tracking-[0.2em] uppercase">
            SEPARATING SIGNAL FROM NOISE.
          </span>
        </div>
        <span className="font-label text-[8px] tracking-[0.15em] uppercase">© TRUTHLENS OS. ALL RIGHTS RESERVED.</span>
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
