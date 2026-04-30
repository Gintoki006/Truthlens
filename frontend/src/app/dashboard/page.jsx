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
        const { data } = await supabase
          .from("analysis")
          .select("verdict, score_final, source_domain, created_at")
          .order("created_at", { ascending: false })
          .limit(200);

        if (!data) {
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

        setStats({
          total: data.length,
          verdictData,
          trendData,
          topDomains,
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--surface-bright)]">
      <header className="border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Newsreader', serif" }}>
          TruthLens
        </Link>
        <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          Dashboard
        </span>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2" style={{ fontFamily: "'Newsreader', serif" }}>
          Misinformation Dashboard
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-10" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          Aggregated insights across all analyses
        </p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-[var(--surface-dim)] animate-pulse" />
            ))}
          </div>
        ) : !stats ? (
          <p className="text-[var(--text-secondary)]">No data available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="p-6 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bright)] md:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                Most Analyzed Domains
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.topDomains} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis type="number" fontSize={11} tick={{ fill: "var(--text-secondary)" }} />
                  <YAxis type="category" dataKey="domain" fontSize={11} tick={{ fill: "var(--text-secondary)" }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#b7211f" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary stat */}
            <div className="p-6 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bright)] md:col-span-2 text-center">
              <p className="text-5xl font-bold text-[#b7211f]" style={{ fontFamily: "'Newsreader', serif" }}>
                {stats.total}
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                Total Articles Analyzed
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
