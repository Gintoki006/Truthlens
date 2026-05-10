"use client";

/**
 * CrosscheckPanel — displays corroborating sources from Serper cross-verification.
 *
 * Shows clickable outlet links when corroborating sources are found,
 * or a "No major outlets found" message when empty.
 */
export default function CrosscheckPanel({ sources, fallback, score }) {
  // Fallback badge — story too recent to verify
  if (fallback) {
    return (
      <div className="rounded-lg border border-[#BA7517]/30 bg-[#FAEEDA] px-4 py-3 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">⏳</span>
          <span
            className="text-xs font-semibold text-[#633806] uppercase tracking-wider"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Too Recent to Verify
          </span>
        </div>
        <p
          className="text-xs text-[#633806]/80 leading-relaxed"
          style={{ fontFamily: "'Work Sans', sans-serif" }}
        >
          This story may be too recent for cross-verification via search.
          The cross-check weight has been redistributed across the other
          signals.
        </p>
      </div>
    );
  }

  // No corroborating sources found
  if (!sources || sources.length === 0) {
    return (
      <div className="rounded-lg border border-[#E24B4A]/20 bg-[#FCEBEB]/50 px-4 py-3 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔍</span>
          <span
            className="text-xs font-semibold text-[#791F1F] uppercase tracking-wider"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            No Corroboration Found
          </span>
        </div>
        <p
          className="text-xs text-[#791F1F]/70 leading-relaxed"
          style={{ fontFamily: "'Work Sans', sans-serif" }}
        >
          No major outlets were found covering this claim.
        </p>
      </div>
    );
  }

  // Corroborating sources found — show clickable links
  return (
    <div className="rounded-lg border border-[#639922]/20 bg-[#EAF3DE]/50 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">✓</span>
          <span
            className="text-xs font-semibold text-[#27500A] uppercase tracking-wider"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            Corroborated
          </span>
        </div>
        {score != null && (
          <span
            className="text-xs font-bold tabular-nums text-[#639922]"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            {score}/100
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {sources.map((s) => (
          <li key={s.domain} className="flex items-center gap-2">
            <span className="text-[#639922] text-xs">↗</span>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[#27500A] underline underline-offset-2 decoration-[#639922]/40 hover:text-[#639922] hover:decoration-[#639922] transition-colors"
              style={{ fontFamily: "'Work Sans', sans-serif" }}
            >
              {s.name || s.domain}
            </a>
            {s.trust_score && (
              <span className="text-[10px] text-[#27500A]/60 tabular-nums">
                ({s.trust_score})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
