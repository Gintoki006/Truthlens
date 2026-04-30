"use client";

import { useEffect, useState } from "react";

/**
 * Individual signal score bar with animated fill.
 */
export default function SignalBar({ label, score, maxScore = 100, color }) {
  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth((score / maxScore) * 100);
    }, 200);
    return () => clearTimeout(timer);
  }, [score, maxScore]);

  const barColor =
    color || (score >= 70 ? "#639922" : score >= 40 ? "#BA7517" : "#E24B4A");

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]"
          style={{ fontFamily: "'Work Sans', sans-serif" }}
        >
          {label}
        </span>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: barColor }}
        >
          {score}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[var(--border-color)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${animatedWidth}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 8px ${barColor}40`,
          }}
        />
      </div>
    </div>
  );
}
