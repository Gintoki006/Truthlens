"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function DashboardView() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveFeed, setLiveFeed] = useState([]);
  const [feedIndex, setFeedIndex] = useState(0);

  useEffect(() => {
    async function fetchLiveFeed() {
      try {
        const res = await fetch('/api/feed');
        if (res.ok) {
          const data = await res.json();
          if (data.items) {
            setLiveFeed(data.items.slice(0, 10)); // up to 10 latest
          }
        }
      } catch (err) {}
    }
    fetchLiveFeed();
  }, []);

  useEffect(() => {
    if (liveFeed.length > 1) {
      const interval = setInterval(() => {
        setFeedIndex((prev) => (prev + 1) % liveFeed.length);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [liveFeed]);

  useEffect(() => {
    async function fetchStats() {
      const supabase = getSupabaseBrowserClient();
      try {
        let query = supabase
          .from("analysis")
          .select("id, article_title, verdict, score_final, source_domain, created_at, score_nlp, score_source, score_ml, score_crosscheck")
          .order("created_at", { ascending: false })
          .limit(20);

        if (user) {
          query = query.eq("user_id", user.id);
        }

        const { data } = await query;
        if (!data || data.length === 0) {
          setStats(null);
          return;
        }

        const avgScore = Math.round(data.reduce((s, a) => s + a.score_final, 0) / data.length);
        
        setStats({
          avgScore,
          recentAnalyses: data.slice(0, 5),
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-[#f8f7f5] dark:bg-background">
        <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-10 text-center bg-[#f8f7f5] dark:bg-background">
        <h2 className="text-2xl font-serif font-bold text-primary mb-4">NO AUDITS FOUND</h2>
        <p className="text-on-surface-variant font-body mb-8">Start a new analysis to see your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f7f5] dark:bg-background w-full h-full p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        
        {/* OVERVIEW Header */}
        <div className="border-b-[3px] border-[#1c1b1b] dark:border-stone-100 pb-2 mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
          <span className="font-label text-[10px] tracking-[0.2em] uppercase font-bold text-[#1c1b1b] dark:text-stone-100">OVERVIEW</span>
          <span className="font-label text-[8px] tracking-[0.1em] uppercase text-on-surface-variant">SYSTEM STATUS: ONLINE • MONITORING ACTIVE SIGNALS • GLOBAL FEED SYNCHRONIZED</span>
        </div>

        {/* Top Cards */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mb-16"
        >

          {/* Live Feed Ticker */}
          <motion.div variants={itemVariants} className="bg-[#ededed] dark:bg-surface-container relative p-8 border-t-[6px] border-[#b7211f] flex flex-col min-h-[260px] shadow-sm overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
            <div className="flex justify-between items-center relative z-10">
              <h3 className="font-label text-[10px] tracking-[0.2em] uppercase text-[#747878] dark:text-stone-400 font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#b7211f] animate-pulse"></span>
                LIVE INTERCEPTS
              </h3>
            </div>
            <div className="mt-6 relative z-10 flex-1 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {liveFeed.length > 0 ? (
                  <motion.div
                    key={feedIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col h-full justify-center"
                  >
                    <span className="font-label text-[9px] uppercase tracking-widest text-[#747878] dark:text-stone-400 mb-3">
                      {liveFeed[feedIndex].source_domain || liveFeed[feedIndex].source_name || "UNKNOWN"} • {new Date(liveFeed[feedIndex].published_at || liveFeed[feedIndex].analyzed_at || new Date()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <h4 className="font-serif text-[22px] md:text-[26px] font-bold text-[#1c1b1b] dark:text-stone-100 leading-tight hover:text-[#b7211f] transition-colors line-clamp-3">
                      <Link href={liveFeed[feedIndex].analysis_id ? `/results/${liveFeed[feedIndex].analysis_id}?view=results` : '#'}>
                        {liveFeed[feedIndex].headline || "Unknown Signal Intercepted"}
                      </Link>
                    </h4>
                    <span className={`mt-4 inline-flex self-start font-label text-[8px] font-bold uppercase tracking-[0.2em] px-2 py-1 border ${
                      liveFeed[feedIndex].verdict === 'fake' ? 'border-[#b7211f] text-[#b7211f] bg-[#FCEBEB]/50' : 
                      liveFeed[feedIndex].verdict === 'suspicious' ? 'border-[#c4842b] text-[#c4842b] bg-[#fdfaf5]/50' : 
                      liveFeed[feedIndex].verdict === 'real' ? 'border-[#00c853] text-[#00c853] bg-[#e6f4ea]/50' :
                      'border-[#747878] text-[#747878] bg-[#e5e4df]/50'
                    }`}>
                      {liveFeed[feedIndex].verdict || "UNVERIFIED"}
                    </span>
                  </motion.div>
                ) : (
                  <div className="text-[#747878] font-label text-[10px] tracking-[0.1em] uppercase">LISTENING FOR SIGNALS...</div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>

        {/* ACTIVE INVESTIGATIONS Header */}
        <div className="flex justify-between items-end border-b-[4px] border-[#1c1b1b] dark:border-stone-100 pb-2 mb-0">
          <h2 className="font-serif text-3xl md:text-[40px] font-black uppercase tracking-tighter text-[#1c1b1b] dark:text-stone-100" style={{ letterSpacing: '-0.05em' }}>RECENT ANALYSIS</h2>
          <Link href="?view=archive" className="font-label text-[8px] uppercase tracking-[0.1em] text-[#747878] dark:text-stone-400 font-bold hover:text-primary transition-colors border-b-[1.5px] border-[#747878] dark:border-stone-400 pb-0.5 mb-1">
            VIEW ALL ENTRIES
          </Link>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[80px_1fr_130px_80px_100px] md:grid-cols-[100px_1fr_150px_100px_120px] gap-2 md:gap-4 bg-[#e5e4df] dark:bg-surface-container-highest px-6 py-4 border-b-[3px] border-[#1c1b1b] dark:border-stone-100">
          <span className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#1c1b1b] dark:text-stone-100 leading-tight">REF<br/>NO.</span>
          <span className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#1c1b1b] dark:text-stone-100 flex items-center">INVESTIGATION SUBJECT</span>
          <span className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#1c1b1b] dark:text-stone-100 flex items-center">PRIMARY SOURCE</span>
          <span className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#1c1b1b] dark:text-stone-100 flex items-center">SCORE</span>
          <span className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#1c1b1b] dark:text-stone-100 flex items-center">STATUS</span>
        </div>

        {/* Table Rows */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col"
        >
          {stats.recentAnalyses.map((item, idx) => {
            const isCritical = item.verdict === 'fake';
            const isHighRisk = item.verdict === 'suspicious';
            const isCleared = item.verdict === 'real';

            return (
              <motion.div variants={itemVariants} key={item.id}>
                <Link 
                  href={`/results/${item.id}?view=results`}
                  className="grid grid-cols-[80px_1fr_130px_80px_100px] md:grid-cols-[100px_1fr_150px_100px_120px] gap-2 md:gap-4 px-6 py-8 border-b border-[#d4d4d4] dark:border-stone-700 hover:bg-[#e5e4df]/30 dark:hover:bg-surface-container-low transition-colors group"
                >
                  <div className="flex flex-col justify-start pt-1">
                    <span className="font-label text-[9px] font-bold uppercase tracking-widest text-[#1c1b1b] dark:text-stone-100 leading-none">#AUD-</span>
                    <span className="font-label text-[9px] font-bold uppercase tracking-widest text-[#1c1b1b] dark:text-stone-100 mt-1">{String(idx + 1).padStart(3, '0')}</span>
                  </div>
                  
                  <div className="flex flex-col justify-start pr-4 min-w-0">
                  <span className="font-serif text-[17px] font-bold text-[#1c1b1b] dark:text-stone-100 group-hover:text-[#b7211f] transition-colors leading-[1.2] mb-3 break-words">
                    {item.article_title || "Unverified claims of central bank liquidity crisis"}
                  </span>
                  <span className="font-label text-[7px] uppercase tracking-[0.2em] text-[#747878] dark:text-stone-400 font-bold">
                    CLUSTER ID: FN-{String(idx + 1).padStart(3, '0')}-Z
                  </span>
                </div>

                <div className="flex items-start pt-1">
                  <span className="font-label text-[8px] uppercase tracking-[0.15em] text-[#747878] dark:text-stone-400 font-bold break-words w-full pr-2">
                    {item.source_domain || "INDEPENDENT-NEWS.LY"}
                  </span>
                </div>

                <div className="flex items-start">
                  <div className={`border-[1.5px] px-3 py-1.5 ${isCritical || isHighRisk ? 'border-[#b7211f] text-[#b7211f]' : 'border-[#1c1b1b] dark:border-stone-100 text-[#1c1b1b] dark:text-stone-100'} bg-transparent w-[45px] flex justify-center`}>
                    <span className="font-serif text-[18px] font-black">{item.score_final}</span>
                  </div>
                </div>

                <div className="flex items-start pt-1">
                  {isCritical ? (
                    <div className="border border-[#b7211f] px-2.5 py-1 bg-[#FCEBEB]/30 flex flex-col justify-center">
                      <span className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#b7211f] text-center leading-none">
                        FAKE
                      </span>
                    </div>
                  ) : isHighRisk ? (
                    <div className="border border-[#b7211f] px-2.5 py-1 bg-[#FCEBEB]/30 flex flex-col justify-center">
                      <span className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#b7211f] text-center leading-[1.2]">
                        SUSPICIOUS
                      </span>
                    </div>
                  ) : isCleared ? (
                    <div className="border border-[#747878] dark:border-stone-400 px-2.5 py-1 bg-[#e5e4df]/50 dark:bg-stone-800 flex flex-col justify-center">
                      <span className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#444748] dark:text-stone-300 text-center leading-none">
                        REAL
                      </span>
                    </div>
                  ) : (
                    <div className="border border-[#747878] dark:border-stone-400 px-2.5 py-1 bg-[#e5e4df]/50 dark:bg-stone-800 flex flex-col justify-center">
                      <span className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#444748] dark:text-stone-300 text-center leading-none">
                        PENDING
                      </span>
                    </div>
                  )}
                </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

      </div>
    </div>
  );
}
