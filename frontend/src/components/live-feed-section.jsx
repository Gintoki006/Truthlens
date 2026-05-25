'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ScrollReveal, HorizontalScroll } from './animations';
import { getSupabaseBrowserClient } from '@/lib/supabase';

const verdictConfig = {
  real: { label: 'VERIFIED', color: '#2e7d32' },
  suspicious: { label: 'SUSPICIOUS', color: '#e65100' },
  fake: { label: 'FLAGGED', color: '#c62828' },
};

function timeAgo(dateString) {
  if (!dateString) return 'just now';
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const fallbackFeedItems = [
  { headline: 'NASA Confirms Water Found on Mars Surface', source_name: 'Reuters', verdict: 'real', score_final: 94 },
  { headline: '5G Towers Linked to Spread of COVID-19', source_name: 'ViralHealth.blog', verdict: 'fake', score_final: 8 },
  { headline: 'Global Sea Levels Rise 3mm Per Year, Study Finds', source_name: 'Nature Journal', verdict: 'real', score_final: 97 },
  { headline: 'Eating Chocolate Daily Cures Heart Disease', source_name: 'DailyBuzz.net', verdict: 'suspicious', score_final: 22 },
  { headline: 'WHO Declares Mpox a Global Health Emergency', source_name: 'AP News', verdict: 'real', score_final: 96 },
  { headline: 'Government Secretly Adds Microchips to Vaccines', source_name: 'TruthPatriots.org', verdict: 'fake', score_final: 3 },
  { headline: 'EU Passes Landmark AI Regulation Act', source_name: 'Financial Times', verdict: 'real', score_final: 95 },
  { headline: 'Scientists Warn: Bananas Will Be Extinct by 2030', source_name: 'ClickFacts.io', verdict: 'suspicious', score_final: 18 },
];

export function LiveFeedSection() {
  const [items, setItems] = useState([]);
  const [latestEntryStr, setLatestEntryStr] = useState('...');
  const [totalIndexed, setTotalIndexed] = useState('...');

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('feed_item')
          .select('id, headline, source_name, verdict, score_final, analyzed_at')
          .order('analyzed_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        
        if (data && data.length > 0) {
          setItems(data);
          setLatestEntryStr(timeAgo(data[0].analyzed_at));
        } else {
          setItems(fallbackFeedItems);
          setLatestEntryStr('14 mins ago');
        }
      } catch (err) {
        console.error("Failed to fetch live feed:", err);
        setItems(fallbackFeedItems);
        setLatestEntryStr('14 mins ago');
      }

      try {
        const url = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${url}/api/stats`);
        if (res.ok) {
          const stats = await res.json();
          setTotalIndexed(stats.articlesAnalyzed.toLocaleString());
        }
      } catch (e) {
        console.error(e);
      }
    }
    fetchData();
  }, []);

  const headerContent = (
    <ScrollReveal>
      <div className="border-t-[0.5px] border-slate-900 dark:border-stone-100 pt-8 pb-12 max-w-7xl mx-auto px-4 md:px-8">
        <h2 className="font-serif text-5xl md:text-7xl text-slate-900 dark:text-stone-100 mb-6 tracking-tight">
          Analysis Ledger
        </h2>
        <div className="flex flex-col lg:flex-row gap-8 justify-between items-start lg:items-end">
          <p className="font-body-lg text-lg text-on-surface-variant dark:text-stone-400 max-w-2xl leading-relaxed">
            Our algorithmic engine continuously cross-references articles
            against verified historical data and parses syntactic manipulation.
            This ledger serves as a transparent log of recently processed
            narratives, detailing source credibility and objective factual
            consistency.
          </p>
          <div className="flex flex-row gap-8 pb-1">
            <div className="border-l-[2px] border-primary dark:border-stone-600 pl-4">
              <span className="block font-label-caps text-[10px] text-slate-500 dark:text-stone-400 uppercase tracking-widest mb-1">
                Latest Entry
              </span>
              <span className="font-serif font-bold text-lg text-slate-900 dark:text-stone-200">
                {latestEntryStr}
              </span>
            </div>
            <div className="border-l-[2px] border-primary dark:border-stone-600 pl-4">
              <span className="block font-label-caps text-[10px] text-slate-500 dark:text-stone-400 uppercase tracking-widest mb-1">
                Total Indexed
              </span>
              <span className="font-serif font-bold text-lg text-slate-900 dark:text-stone-200">
                {totalIndexed}
              </span>
            </div>
          </div>
        </div>
      </div>
    </ScrollReveal>
  );

  return (
    <HorizontalScroll header={headerContent}>
      {items.map((item, i) => {
        const config = verdictConfig[item.verdict] || verdictConfig.suspicious;
        return (
          <motion.div
            key={item.id || i}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="shrink-0 w-[300px] md:w-[380px] h-[250px] bg-white/95 dark:bg-stone-900/95 border-[0.5px] border-slate-400 dark:border-stone-700 p-6 flex flex-col justify-between backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative z-[60]"
          >
            <div className="flex justify-between items-start gap-4">
              <span className="font-label-caps text-[10px] text-slate-500 dark:text-stone-400">
                #{String(i + 1).padStart(2, '0')}
              </span>
              <span
                className="px-2 py-0.5 text-[9px] font-['Work_Sans'] font-bold uppercase tracking-widest text-white rounded-sm shrink-0"
                style={{ backgroundColor: config.color }}
              >
                {config.label}
              </span>
            </div>
            <div className="flex-1 flex flex-col justify-center mt-2">
              <h3 className="font-headline-sm text-lg text-slate-900 dark:text-stone-100 leading-snug line-clamp-3">
                {item.headline}
              </h3>
              <span className="font-body-md text-[11px] uppercase tracking-widest text-slate-500 dark:text-stone-400 mt-2">
                Source: {item.source_name || item.source}
              </span>
            </div>
            <div className="mt-4">
              <div className="flex justify-between items-end mb-1">
                <span className="font-label-caps text-[9px] text-slate-500 dark:text-stone-400">
                  Integrity Score
                </span>
                <motion.span
                  className="font-display-xl text-[24px] leading-none"
                  style={{ color: config.color }}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  {item.score_final}
                </motion.span>
              </div>
              <div className="w-full h-1 bg-slate-200 dark:bg-stone-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: config.color }}
                  initial={{ width: '0%' }}
                  whileInView={{ width: `${item.score_final}%` }}
                  transition={{
                    duration: 1.2,
                    delay: 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
    </HorizontalScroll>
  );
}
