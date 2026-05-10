"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";

const VERDICT_COLORS = {
  real: "#639922",
  suspicious: "#BA7517",
  fake: "#E24B4A",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const supabase = getSupabaseBrowserClient();
      try {
        // If user is logged in, fetch their personal stats
        let query = supabase
          .from("analysis")
          .select("verdict, score_final, source_domain, created_at, score_nlp, score_source, score_ml, score_crosscheck")
          .order("created_at", { ascending: false })
          .limit(200);

        if (user) {
          query = query.eq("user_id", user.id);
        }

        const { data } = await query;

        if (!data || data.length === 0) {
          setStats(null);
          return;
        }

        // Verdict breakdown
        const verdictCounts = { real: 0, suspicious: 0, fake: 0 };
        data.forEach((a) => {
          if (verdictCounts[a.verdict] !== undefined) verdictCounts[a.verdict]++;
        });
        const verdictData = Object.entries(verdictCounts).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          color: VERDICT_COLORS[name],
        }));

        // Score trend (last 7 days)
        const now = new Date();
        const trendData = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dayStr = date.toLocaleDateString("en", { weekday: "short" });
          const dayAnalyses = data.filter((a) => {
            const d = new Date(a.created_at);
            return d.toDateString() === date.toDateString();
          });
          const avgScore =
            dayAnalyses.length > 0
              ? Math.round(
                  dayAnalyses.reduce((s, a) => s + a.score_final, 0) / dayAnalyses.length
                )
              : null;
          trendData.push({ day: dayStr, score: avgScore });
        }

        // Top domains
        const domainCounts = {};
        data.forEach((a) => {
          if (a.source_domain) {
            domainCounts[a.source_domain] = (domainCounts[a.source_domain] || 0) + 1;
          }
        });
        const topDomains = Object.entries(domainCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([domain, count]) => ({ domain, count }));

        // Average signal scores
        const avgSignals = {
          nlp: Math.round(data.reduce((s, a) => s + (a.score_nlp || 0), 0) / data.length),
          source: Math.round(data.reduce((s, a) => s + (a.score_source || 0), 0) / data.length),
          ml: Math.round(data.reduce((s, a) => s + (a.score_ml || 0), 0) / data.length),
          crosscheck: (() => {
            const cc = data.filter((a) => a.score_crosscheck != null);
            return cc.length > 0 ? Math.round(cc.reduce((s, a) => s + a.score_crosscheck, 0) / cc.length) : null;
          })(),
        };

        // Average overall score
        const avgScore = Math.round(data.reduce((s, a) => s + a.score_final, 0) / data.length);

        setStats({
          total: data.length,
          verdictData,
          trendData,
          topDomains,
          avgSignals,
          avgScore,
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user]);

  return (
    <div className="min-h-screen bg-[var(--surface-bright)]">
      <header className="border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Newsreader', serif" }}>
          TruthLens
        </Link>
        <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          {user ? "Personal Stats" : "Dashboard"}
        </span>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2" style={{ fontFamily: "'Newsreader', serif" }}>
          {user ? "Your Analysis Stats" : "Misinformation Dashboard"}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-10" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          {user ? "Personal insights from your analysis history" : "Aggregated insights across all analyses"}
        </p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-[var(--surface-dim)] animate-pulse" />
            ))}
          </div>
        ) : !stats ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-4xl">📊</p>
            <p className="text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
              {user ? "No analyses yet. Analyze an article to see your stats!" : "No data available yet."}
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-[#b7211f] text-white rounded-lg text-sm font-medium hover:bg-[#9a1b19] transition-colors"
            >
              Analyze an article
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Summary Stats Row */}
            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 md:p-6 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bright)] text-center">
                <p className="text-3xl md:text-4xl font-bold text-[#b7211f]" style={{ fontFamily: "'Newsreader', serif" }}>
                  {stats.total}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mt-1" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                  Total Analyses
                </p>
              </div>
              <div className="p-4 md:p-6 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bright)] text-center">
                <p
                  className="text-3xl md:text-4xl font-bold tabular-nums"
                  style={{
                    fontFamily: "'Newsreader', serif",
                    color: stats.avgScore >= 70 ? "#639922" : stats.avgScore >= 40 ? "#BA7517" : "#E24B4A",
                  }}
                >
                  {stats.avgScore}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mt-1" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                  Avg Score
                </p>
              </div>
              <div className="p-4 md:p-6 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bright)] text-center">
                <p className="text-3xl md:text-4xl font-bold text-[#639922]" style={{ fontFamily: "'Newsreader', serif" }}>
                  {stats.verdictData.find((v) => v.name === "Real")?.value || 0}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mt-1" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                  Real
                </p>
              </div>
              <div className="p-4 md:p-6 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bright)] text-center">
                <p className="text-3xl md:text-4xl font-bold text-[#E24B4A]" style={{ fontFamily: "'Newsreader', serif" }}>
                  {stats.verdictData.find((v) => v.name === "Fake")?.value || 0}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mt-1" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                  Fake
                </p>
              </div>
            </div>

            {/* Average Signal Scores */}
            <div className="p-6 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bright)]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                Average Signal Scores
              </h3>
              <div className="space-y-4">
                {[
                  { label: "NLP Analysis", value: stats.avgSignals.nlp },
                  { label: "Source Trust", value: stats.avgSignals.source },
                  { label: "ML Ensemble", value: stats.avgSignals.ml },
                  ...(stats.avgSignals.crosscheck != null ? [{ label: "Cross-Check", value: stats.avgSignals.crosscheck }] : []),
                ].map((signal) => (
                  <div key={signal.label} className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-secondary)] w-24 shrink-0" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                      {signal.label}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--surface-dim)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${signal.value}%`,
                          backgroundColor: signal.value >= 70 ? "#639922" : signal.value >= 40 ? "#BA7517" : "#E24B4A",
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-8 text-right" style={{
                      color: signal.value >= 70 ? "#639922" : signal.value >= 40 ? "#BA7517" : "#E24B4A",
                      fontFamily: "'Work Sans', sans-serif",
                    }}>
                      {signal.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verdict Donut */}
            <div className="p-6 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bright)]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                Verdict Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.verdictData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {stats.verdictData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {stats.verdictData.map((v, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }} />
                    {v.name}: {v.value}
                  </span>
                ))}
              </div>
            </div>

            {/* Score Trend */}
            <div className="p-6 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bright)]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                Average Score (7 Days)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="day" fontSize={11} tick={{ fill: "var(--text-secondary)" }} />
                  <YAxis domain={[0, 100]} fontSize={11} tick={{ fill: "var(--text-secondary)" }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#b7211f"
                    strokeWidth={2}
                    dot={{ fill: "#b7211f", r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Top Domains */}
            <div className="p-6 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bright)]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                Most Analyzed Domains
              </h3>
              {stats.topDomains.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.topDomains} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis type="number" fontSize={11} tick={{ fill: "var(--text-secondary)" }} />
                    <YAxis type="category" dataKey="domain" fontSize={11} tick={{ fill: "var(--text-secondary)" }} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#b7211f" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-[var(--text-secondary)] text-center py-8" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                  No domains analyzed yet
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
