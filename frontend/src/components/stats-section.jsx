'use client';
import { useState, useEffect } from 'react';
import { Counter } from './animations';

export function StatsSection() {
  const [stats, setStats] = useState({
    articles: "...",
    signals: "6",
    sources: "...",
    response: "<10s",
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const url = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${url}/api/stats`);
        if (!res.ok) return;
        const data = await res.json();
        
        let articles = data.articlesAnalyzed;
        let articlesStr = articles.toString();
        if (articles >= 1000000) articlesStr = (articles / 1000000).toFixed(1) + "M+";
        else if (articles >= 1000) articlesStr = (articles / 1000).toFixed(1) + "K+";
        
        setStats({
          articles: articlesStr,
          signals: "6",
          sources: data.sourceDatabases.toLocaleString(),
          response: "<10s"
        });
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      }
    }
    fetchStats();
  }, []);

  return (
    <section className="py-16 grid grid-cols-2 md:grid-cols-4 gap-8 border-b-[0.5px] border-slate-400 dark:border-stone-700">
      <Counter value={stats.articles} label="Articles Analyzed" />
      <Counter value={stats.signals} label="Heuristic Signals" />
      <Counter value={stats.sources} label="Source Databases" />
      <Counter value={stats.response} label="Avg. Response" />
    </section>
  );
}
