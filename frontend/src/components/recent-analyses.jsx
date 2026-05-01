'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { ScrollReveal } from './animations';

const verdictConfig = {
  real: { label: 'VERIFIED', color: '#2e7d32', bg: 'bg-green-50 dark:bg-green-950/30' },
  suspicious: { label: 'SUSPICIOUS', color: '#e65100', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  fake: { label: 'FLAGGED', color: '#c62828', bg: 'bg-red-50 dark:bg-red-950/30' },
};

// Placeholder data for when no real analyses exist yet
const placeholderAnalyses = [
  {
    id: 'demo-1',
    article_title: 'NASA Confirms Water Found on Mars Surface',
    source_domain: 'reuters.com',
    verdict: 'real',
    score_final: 94,
    created_at: new Date(Date.now() - 14 * 60000).toISOString(),
    isDemo: true,
  },
  {
    id: 'demo-2',
    article_title: '5G Towers Linked to Spread of COVID-19',
    source_domain: 'viralhealth.blog',
    verdict: 'fake',
    score_final: 8,
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
    isDemo: true,
  },
  {
    id: 'demo-3',
    article_title: 'Global Sea Levels Rise 3mm Per Year, Study Finds',
    source_domain: 'nature.com',
    verdict: 'real',
    score_final: 97,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    isDemo: true,
  },
  {
    id: 'demo-4',
    article_title: 'Eating Chocolate Daily Cures Heart Disease',
    source_domain: 'dailybuzz.net',
    verdict: 'fake',
    score_final: 22,
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    isDemo: true,
  },
  {
    id: 'demo-5',
    article_title: 'EU Passes Landmark AI Regulation Act',
    source_domain: 'ft.com',
    verdict: 'real',
    score_final: 95,
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    isDemo: true,
  },
  {
    id: 'demo-6',
    article_title: 'Scientists Warn: Bananas Will Be Extinct by 2030',
    source_domain: 'clickfacts.io',
    verdict: 'suspicious',
    score_final: 34,
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    isDemo: true,
  },
];

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentAnalysesStrip() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingPlaceholder, setUsingPlaceholder] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchRecent() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('analysis')
          .select('id, article_title, source_domain, verdict, score_final, created_at')
          .order('created_at', { ascending: false })
          .limit(6);

        if (error) throw error;

        if (data && data.length > 0) {
          setAnalyses(data);
          setUsingPlaceholder(false);
        } else {
          setAnalyses(placeholderAnalyses);
          setUsingPlaceholder(true);
        }
      } catch {
        // Fallback to placeholder data on any error
        setAnalyses(placeholderAnalyses);
        setUsingPlaceholder(true);
      } finally {
        setLoading(false);
      }
    }

    fetchRecent();
  }, []);

  const handleClick = (item) => {
    if (item.isDemo) return; // Don't navigate for demo items
    router.push(`/results/${item.id}`);
  };

  return (
    <ScrollReveal delay={0.2}>
      <section className="py-12 border-b-[0.5px] border-slate-400 dark:border-stone-700">
        {/* Section header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h3 className="font-serif text-xl md:text-2xl text-slate-900 dark:text-stone-100 tracking-tight">
              Recent Analyses
            </h3>
            {usingPlaceholder && (
              <span className="px-2 py-0.5 text-[8px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-500 border border-slate-300 dark:border-stone-700">
                Sample Data
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-400">
              Live
            </span>
          </div>
        </div>

        {/* Loading skeleton */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0"
            >
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="p-6 border-[0.5px] border-slate-200 dark:border-stone-800 animate-pulse"
                >
                  <div className="h-3 w-16 bg-slate-200 dark:bg-stone-800 rounded mb-4" />
                  <div className="h-4 w-full bg-slate-200 dark:bg-stone-800 rounded mb-2" />
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-stone-800 rounded mb-4" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-stone-800 rounded" />
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0"
            >
              {analyses.map((item, i) => {
                const config = verdictConfig[item.verdict] || verdictConfig.suspicious;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    onClick={() => handleClick(item)}
                    className={`
                      group p-6 border-[0.5px] border-slate-300 dark:border-stone-700
                      bg-white/60 dark:bg-stone-900/60 backdrop-blur-sm
                      ${!item.isDemo ? 'cursor-pointer hover:bg-stone-50/80 dark:hover:bg-stone-800/80' : ''}
                      transition-all duration-300 relative overflow-hidden
                    `}
                  >
                    {/* Top row — verdict + time */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="px-2 py-0.5 text-[8px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-white"
                        style={{ backgroundColor: config.color }}
                      >
                        {config.label}
                      </span>
                      <span className="text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-stone-500">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className={`font-serif text-sm leading-snug text-slate-900 dark:text-stone-100 mb-3 line-clamp-2 ${!item.isDemo ? 'group-hover:underline' : ''}`}>
                      {item.article_title || 'Untitled Article'}
                    </h4>

                    {/* Bottom row — source + score */}
                    <div className="flex items-end justify-between">
                      <span className="text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-500">
                        {item.source_domain || 'Unknown'}
                      </span>
                      <div className="flex items-end gap-1">
                        <span className="text-[9px] font-['Work_Sans'] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-stone-500">
                          Score
                        </span>
                        <span
                          className="font-serif text-2xl leading-none font-bold"
                          style={{ color: config.color }}
                        >
                          {item.score_final}
                        </span>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="mt-3 w-full h-[2px] bg-slate-200 dark:bg-stone-700 overflow-hidden">
                      <motion.div
                        className="h-full"
                        style={{ backgroundColor: config.color }}
                        initial={{ width: '0%' }}
                        whileInView={{ width: `${item.score_final}%` }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </ScrollReveal>
  );
}
