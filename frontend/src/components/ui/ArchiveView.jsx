"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function ArchiveView() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verdictFilter, setVerdictFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('ALL_TIME');

  useEffect(() => {
    async function fetchHistory() {
      const supabase = getSupabaseBrowserClient();
      try {
        let query = supabase
          .from("analysis")
          .select("id, article_title, article_body, verdict, score_final, source_domain, created_at")
          .order("created_at", { ascending: false })
          .limit(50);

        if (user) {
          query = query.eq("user_id", user.id);
        }

        const { data } = await query;
        if (data) {
          setHistory(data);
        }
      } catch (err) {
        console.error("Archive fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-[#f8f7f5] dark:bg-background">
        <div className="w-8 h-8 border-3 border-[#b7211f]/20 border-t-[#b7211f] rounded-full animate-spin" />
      </div>
    );
  }

  // Get top 3 for the "Recent Findings" sidebar
  const recentFindings = history.slice(0, 3);

  const filteredHistory = history.filter(item => {
    if (verdictFilter !== 'ALL') {
      const matchFake = verdictFilter === 'FAKE' && item.verdict === 'fake';
      const matchSuspicious = verdictFilter === 'SUSPICIOUS' && item.verdict === 'suspicious';
      const matchReal = verdictFilter === 'REAL' && item.verdict === 'real';
      if (!matchFake && !matchSuspicious && !matchReal) return false;
    }
    
    if (timeFilter === '7_DAYS') {
      if (new Date(item.created_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) return false;
    } else if (timeFilter === '30_DAYS') {
      if (new Date(item.created_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) return false;
    }
    
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f7f5] dark:bg-background w-full h-full px-6 py-12 md:px-12">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="border-b-[4px] border-[#1c1b1b] dark:border-stone-100 pb-8 mb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4">
            <h1 className="font-serif text-5xl md:text-7xl text-[#1c1b1b] dark:text-stone-100 tracking-tight leading-none" style={{ letterSpacing: '-0.04em' }}>
              Archive of Record
            </h1>
            <div className="flex items-center gap-2 pb-2">
              <span className="font-label text-[9px] uppercase tracking-[0.2em] font-bold text-[#747878] dark:text-stone-400">REGISTRY STATUS:</span>
              <span className="bg-[#b7211f] text-white font-label text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-1">IMPECCABLE</span>
            </div>
          </div>
          <p className="font-serif italic text-xl md:text-2xl text-[#444748] dark:text-stone-300 max-w-4xl">
            A definitive ledger of verified claims, media integrity audits, and algorithmic credibility scoring.
          </p>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-12">
          
          {/* Left Column - History List */}
          <div className="min-w-0">
            {/* Functional Filters */}
            <div className="bg-[#f2f1ec] dark:bg-surface-container border-t-[3px] border-[#1c1b1b] dark:border-stone-100 border-b border-[#d4d4d4] dark:border-stone-700 p-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              
              <div className="flex gap-8 w-full md:w-auto">
                <div>
                  <div className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#747878] dark:text-stone-400 mb-2">FILTER BY TIME</div>
                  <select 
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                    className="border border-[#1c1b1b] dark:border-stone-100 bg-[#f8f7f5] dark:bg-background px-4 py-2 flex items-center justify-between min-w-[200px] font-serif text-sm appearance-none outline-none focus:ring-0 cursor-pointer"
                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231c1b1b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
                  >
                    <option value="ALL_TIME">All Time (Current)</option>
                    <option value="7_DAYS">Last 7 Days</option>
                    <option value="30_DAYS">Last 30 Days</option>
                  </select>
                </div>

                <div className="hidden md:block">
                  <div className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#747878] dark:text-stone-400 mb-2">VERDICT INDEX</div>
                  <div className="flex gap-1">
                    {['ALL', 'REAL', 'SUSPICIOUS', 'FAKE'].map(verdict => (
                      <button 
                        key={verdict}
                        onClick={() => setVerdictFilter(verdict)}
                        className={`font-label text-[8px] font-bold uppercase tracking-[0.2em] px-3 py-1 border border-[#1c1b1b] dark:border-stone-100 transition-colors ${
                          verdictFilter === verdict 
                            ? 'bg-[#1c1b1b] dark:bg-stone-100 text-white dark:text-stone-900' 
                            : 'bg-transparent text-[#1c1b1b] dark:text-stone-100 hover:bg-[#1c1b1b]/10 dark:hover:bg-stone-100/10'
                        }`}
                      >
                        {verdict}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => { setTimeFilter('ALL_TIME'); setVerdictFilter('ALL'); }}
                className="font-label text-[9px] font-bold uppercase tracking-[0.2em] text-[#1c1b1b] dark:text-stone-100 border-b border-[#1c1b1b] dark:border-stone-100 pb-0.5 flex items-center gap-1 hover:text-[#b7211f] hover:border-[#b7211f] transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">filter_list</span> RESET INDEX
              </button>
            </div>

            {/* List */}
            {filteredHistory.length === 0 ? (
              <div className="text-center py-20">
                <h3 className="font-serif text-2xl text-primary">No records found matching filters.</h3>
              </div>
            ) : (
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col border-b-[2px] border-[#1c1b1b] dark:border-stone-100"
              >
                {filteredHistory.map((item, idx) => {
                  const issueNum = String(filteredHistory.length - idx).padStart(3, '0');
                  const dateStr = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
                  
                  return (
                    <motion.div variants={itemVariants} key={item.id}>
                      <Link 
                        href={`/results/${item.id}?view=results`}
                        className="flex flex-col md:flex-row gap-6 md:gap-8 py-8 border-t-[1.5px] border-[#d4d4d4] dark:border-stone-700 group hover:bg-[#e5e4df]/30 dark:hover:bg-surface-container-low transition-colors px-2"
                      >
                      <div className="flex flex-col shrink-0 md:w-24 pt-1">
                        <span className="font-label text-[9px] uppercase tracking-[0.2em] text-[#747878] dark:text-stone-400 font-bold mb-1">AUDIT BATCH</span>
                        <span className="font-label text-[14px] uppercase tracking-[0.2em] text-[#1c1b1b] dark:text-stone-100 font-black">REF {issueNum}</span>
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <h3 className="font-serif text-2xl md:text-[28px] text-[#1c1b1b] dark:text-stone-100 leading-[1.1] mb-3 group-hover:text-[#b7211f] transition-colors break-words">
                          {item.article_title || "Untitled Investigation"}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="font-label text-[11px] uppercase tracking-[0.2em] font-bold text-[#747878] dark:text-stone-400">
                            {dateStr}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#d4d4d4] dark:bg-stone-600"></span>
                          <span className="font-label text-[11px] uppercase tracking-[0.2em] font-bold text-[#1c1b1b] dark:text-stone-100">
                            {item.source_domain || "USER SUBMISSION"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 shrink-0 mt-4 md:mt-0">
                        <div className="flex flex-col items-center">
                          <span className="font-label text-[7px] uppercase tracking-[0.2em] text-[#747878] dark:text-stone-400 font-bold mb-1">SCORE</span>
                          <div className="border-[2px] border-[#1c1b1b] dark:border-stone-100 w-12 h-12 flex items-center justify-center bg-white dark:bg-stone-950">
                            <span className="font-serif text-2xl font-black text-[#1c1b1b] dark:text-stone-100">{item.score_final}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 w-28">
                          <div className="bg-[#1c1b1b] dark:bg-stone-100 w-full py-1.5 flex justify-center">
                            <span className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-white dark:text-stone-900">ANALYZED</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`material-symbols-outlined text-[12px] font-bold ${
                              item.verdict === 'fake' ? 'text-[#b7211f]' : 
                              item.verdict === 'suspicious' ? 'text-[#c4842b]' : 
                              'text-[#00c853]'
                            }`}>
                              {item.verdict === 'fake' ? 'cancel' : 
                               item.verdict === 'suspicious' ? 'warning' : 
                               'check_circle'}
                            </span>
                            <span className={`font-label text-[9px] font-bold uppercase tracking-[0.2em] ${
                              item.verdict === 'fake' ? 'text-[#b7211f]' : 
                              item.verdict === 'suspicious' ? 'text-[#c4842b]' : 
                              'text-[#00c853]'
                            }`}>
                              {item.verdict || "UNKNOWN"}
                            </span>
                          </div>
                        </div>
                      </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>

          {/* Right Column - Recent Findings Sidebar */}
          <div className="w-full">
            <div className="bg-[#fcfbf9] dark:bg-stone-900 border-[1.5px] border-[#e0dfda] dark:border-stone-800 p-8 relative shadow-sm">
              <div className="absolute top-6 right-6 w-12 h-12 border-[2px] border-[#f0f0f0] dark:border-stone-800 flex items-center justify-center opacity-50 z-0">
                <div className="w-6 h-6 border-[2px] border-[#f0f0f0] dark:border-stone-800" />
              </div>
              
              <h3 className="font-serif text-2xl font-bold text-[#1c1b1b] dark:text-stone-100 mb-2 relative z-10">RECENT FINDINGS</h3>
              <div className="h-[2px] bg-[#1c1b1b] dark:bg-stone-100 w-full mb-8 relative z-10" />

              <div className="flex flex-col gap-8 relative z-10">
                {recentFindings.map((item, idx) => (
                  <div key={`sidebar-${item.id}`} className={idx !== recentFindings.length - 1 ? "border-b border-[#d4d4d4] dark:border-stone-700 pb-8" : ""}>
                    <span className="font-label text-[7px] uppercase tracking-[0.2em] font-bold text-[#b7211f] mb-3 block">
                      {idx === 0 ? "LATEST DECLASSIFIED" : idx === 1 ? "2 HOURS AGO" : "YESTERDAY"}
                    </span>
                    <h4 className="font-serif text-lg text-[#1c1b1b] dark:text-stone-100 leading-tight mb-3">
                      {item.article_title || "Untitled Analysis"}
                    </h4>
                    <p className="font-body text-xs text-[#747878] dark:text-stone-400 line-clamp-3 mb-4 leading-relaxed">
                      {item.article_body ? item.article_body.substring(0, 100) + '...' : "No content snippet available for this record."}
                    </p>
                    <Link 
                      href={`/results/${item.id}?view=results`}
                      className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#1c1b1b] dark:text-stone-100 border-b-[1.5px] border-[#1c1b1b] dark:border-stone-100 pb-0.5 inline-flex items-center gap-1 hover:text-[#b7211f] hover:border-[#b7211f] transition-colors"
                    >
                      READ LEDGER <span className="material-symbols-outlined text-[12px] font-bold">arrow_right_alt</span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
