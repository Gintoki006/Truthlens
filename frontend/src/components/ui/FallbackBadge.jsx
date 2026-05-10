"use client";

/**
 * FallbackBadge — amber badge shown when the dynamic fallback formula
 * was used because Serper returned no results on a fresh article.
 *
 * "Story may be too recent to verify"
 */
export default function FallbackBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[#BA7517]/30 bg-[#FAEEDA] px-3 py-1 text-xs font-semibold text-[#633806] tracking-wide"
      style={{ fontFamily: "'Work Sans', sans-serif" }}
    >
      <span>⏳</span>
      Story may be too recent to verify
    </span>
  );
}
