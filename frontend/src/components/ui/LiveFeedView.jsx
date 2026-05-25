"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LiveFeedView() {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const url = categoryFilter === 'ALL' 
        ? '/api/feed?limit=20' 
        : `/api/feed?category=${categoryFilter.toLowerCase()}&limit=20`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFeedItems(data.items || []);
      }
    } catch (err) {
      console.error("Live feed fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
    // Refresh every 30 seconds
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, [categoryFilter]);

  if (loading && feedItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-[#f8f7f5] dark:bg-background">
        <div className="w-8 h-8 border-3 border-[#b7211f]/20 border-t-[#b7211f] rounded-full animate-spin" />
      </div>
    );
  }

  // Get top 3 for the "Latest Alerts" sidebar
  const latestAlerts = feedItems.slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f7f5] dark:bg-background w-full h-full px-6 py-12 md:px-12">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="border-b-[4px] border-[#1c1b1b] dark:border-stone-100 pb-8 mb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4">
            <h1 className="font-serif text-5xl md:text-7xl text-[#1c1b1b] dark:text-stone-100 tracking-tight leading-none" style={{ letterSpacing: '-0.04em' }}>
              Live News Ledger
            </h1>
            <div className="flex items-center gap-2 pb-2">
              <span className="font-label text-[9px] uppercase tracking-[0.2em] font-bold text-[#b7211f] animate-pulse flex items-center">
                <span className="w-2 h-2 rounded-full bg-[#b7211f] mr-2"></span>
                LIVE TRANSMISSION
              </span>
            </div>
          </div>
          <p className="font-serif italic text-xl md:text-2xl text-[#444748] dark:text-stone-300 max-w-4xl">
            A real-time cryptographic audit of breaking global headlines, automatically cross-referenced against verified fact databases.
          </p>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">
          
          {/* Left Column - Feed List */}
          <div>
            {/* Functional Filters */}
            <div className="bg-[#f2f1ec] dark:bg-surface-container border-t-[3px] border-[#1c1b1b] dark:border-stone-100 border-b border-[#d4d4d4] dark:border-stone-700 p-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              
              <div className="flex gap-8 w-full md:w-auto">
                <div className="hidden md:block">
                  <div className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-[#747878] dark:text-stone-400 mb-2">SECTOR FILTER</div>
                  <div className="flex gap-1">
                    {['ALL', 'POLITICS', 'GENERAL', 'HEALTH', 'TECHNOLOGY'].map(cat => (
                      <button 
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`font-label text-[8px] font-bold uppercase tracking-[0.2em] px-3 py-1 border border-[#1c1b1b] dark:border-stone-100 transition-colors ${
                          categoryFilter === cat 
                            ? 'bg-[#1c1b1b] dark:bg-stone-100 text-white dark:text-stone-900' 
                            : 'bg-transparent text-[#1c1b1b] dark:text-stone-100 hover:bg-[#1c1b1b]/10 dark:hover:bg-stone-100/10'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={fetchFeed}
                className="font-label text-[9px] font-bold uppercase tracking-[0.2em] text-[#1c1b1b] dark:text-stone-100 border-b border-[#1c1b1b] dark:border-stone-100 pb-0.5 flex items-center gap-1 hover:text-[#b7211f] hover:border-[#b7211f] transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span> REFRESH FEED
              </button>
            </div>

            {/* List */}
            {feedItems.length === 0 ? (
              <div className="text-center py-20">
                <h3 className="font-serif text-2xl text-primary">No live broadcasts found for this sector.</h3>
              </div>
            ) : (
              <div className="flex flex-col border-b-[2px] border-[#1c1b1b] dark:border-stone-100">
                {feedItems.map((item, idx) => {
                  const issueNum = String(feedItems.length - idx).padStart(3, '0');
                  const dateStr = item.published_at 
                    ? new Date(item.published_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toUpperCase()
                    : new Date(item.analyzed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toUpperCase();
                  
                  return (
                    <Link 
                      key={item.id}
                      href={item.analysis_id ? `/results/${item.analysis_id}?view=results` : "#"}
                      className="flex flex-col md:flex-row gap-6 md:gap-8 py-8 border-t-[1.5px] border-[#d4d4d4] dark:border-stone-700 group hover:bg-[#e5e4df]/30 dark:hover:bg-surface-container-low transition-colors px-2"
                    >
                      <div className="flex flex-col shrink-0 md:w-24 pt-1">
                        <span className="font-label text-[9px] uppercase tracking-[0.2em] text-[#747878] dark:text-stone-400 font-bold mb-1">BROADCAST NO.</span>
                        <span className="font-label text-[14px] uppercase tracking-[0.2em] text-[#1c1b1b] dark:text-stone-100 font-black">REF {issueNum}</span>
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-center">
                        <h3 className="font-serif text-2xl md:text-[28px] text-[#1c1b1b] dark:text-stone-100 leading-[1.1] mb-3 group-hover:text-[#b7211f] transition-colors">
                          {item.headline || "Unknown Transmission"}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="font-label text-[11px] uppercase tracking-[0.2em] font-bold text-[#747878] dark:text-stone-400 flex items-center gap-1">
                             <span className="material-symbols-outlined text-[12px]">schedule</span> {dateStr}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#d4d4d4] dark:bg-stone-600"></span>
                          <span className="font-label text-[11px] uppercase tracking-[0.2em] font-bold text-[#1c1b1b] dark:text-stone-100">
                            {item.source_domain || item.source_name || "UNKNOWN ORIGIN"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 shrink-0 mt-4 md:mt-0">
                        <div className="flex flex-col items-center">
                          <span className="font-label text-[7px] uppercase tracking-[0.2em] text-[#747878] dark:text-stone-400 font-bold mb-1">SCORE</span>
                          <div className="border-[2px] border-[#1c1b1b] dark:border-stone-100 w-12 h-12 flex items-center justify-center bg-white dark:bg-stone-950">
                            <span className="font-serif text-2xl font-black text-[#1c1b1b] dark:text-stone-100">{item.score_final || "—"}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 w-28">
                          <div className="bg-[#1c1b1b] dark:bg-stone-100 w-full py-1.5 flex justify-center">
                            <span className="font-label text-[8px] font-bold uppercase tracking-[0.2em] text-white dark:text-stone-900">VERDICT</span>
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
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column - Latest Alerts Sidebar */}
          <div className="hidden lg:block">
            <div className="bg-[#fcfbf9] dark:bg-stone-900 border-[1.5px] border-[#e0dfda] dark:border-stone-800 p-8 relative shadow-sm">
              <div className="absolute top-6 right-6 w-12 h-12 border-[2px] border-[#f0f0f0] dark:border-stone-800 flex items-center justify-center opacity-50 z-0">
                <div className="w-6 h-6 border-[2px] border-[#f0f0f0] dark:border-stone-800 animate-pulse bg-[#b7211f]/10" />
              </div>
              
              <h3 className="font-serif text-2xl font-bold text-[#1c1b1b] dark:text-stone-100 mb-2 relative z-10">FLASH BULLETINS</h3>
              <div className="h-[2px] bg-[#1c1b1b] dark:bg-stone-100 w-full mb-8 relative z-10" />

              <div className="flex flex-col gap-8 relative z-10">
                {latestAlerts.map((item, idx) => (
                  <div key={`sidebar-${item.id}`} className={idx !== latestAlerts.length - 1 ? "border-b border-[#d4d4d4] dark:border-stone-700 pb-8" : ""}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-label text-[8px] uppercase tracking-[0.2em] text-[#747878] dark:text-stone-400 font-bold bg-[#e5e4df] dark:bg-stone-800 px-2 py-0.5">
                        {item.category || "GENERAL"}
                      </span>
                    </div>
                    <Link href={item.analysis_id ? `/results/${item.analysis_id}?view=results` : "#"} className="block font-serif text-lg leading-tight text-[#1c1b1b] dark:text-stone-100 mb-3 hover:text-[#b7211f] transition-colors">
                      {item.headline}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        item.verdict === 'fake' ? 'bg-[#b7211f]' : 
                        item.verdict === 'suspicious' ? 'bg-[#c4842b]' : 
                        'bg-[#00c853]'
                      }`}></span>
                      <span className={`font-label text-[8px] uppercase tracking-[0.2em] font-bold ${
                        item.verdict === 'fake' ? 'text-[#b7211f]' : 
                        item.verdict === 'suspicious' ? 'text-[#c4842b]' : 
                        'text-[#00c853]'
                      }`}>
                        {item.verdict || "UNKNOWN"}
                      </span>
                    </div>
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
