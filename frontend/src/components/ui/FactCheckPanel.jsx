"use client";

import SignalBar from "@/components/ui/SignalBar";

/**
 * FactCheckPanel — displays fact verification sub-signal scores and details.
 *
 * Shows the composite Signal 5 score broken down into:
 * - FEVER dataset match
 * - Google Fact Check verdict
 * - Wikidata entity confirmation
 */
export default function FactCheckPanel({ score, scoreFever, scoreGfactcheck, scoreWikidata, details }) {
  if (score == null) return null;

  const fever = details?.fever || {};
  const gfactcheck = details?.gfactcheck || {};
  const wikidata = details?.wikidata || {};

  const topMatch = fever?.top_match;
  const verdict = gfactcheck?.verdict;
  const verdictSource = gfactcheck?.source;
  const confirmedEntities = (wikidata?.entity_results || []).filter((e) => e.confirmed);

  // Determine overall status
  const hasStrongEvidence = score >= 70;
  const hasNegativeEvidence = score < 30;

  return (
    <div className="space-y-3">
      {/* Sub-signal bars */}
      <div className="space-y-2">
        <SignalBar label="FEVER Dataset" score={scoreFever ?? 50} />
        <SignalBar label="Fact Checkers" score={scoreGfactcheck ?? 50} />
        <SignalBar label="Wikidata" score={scoreWikidata ?? 50} />
      </div>

      {/* Evidence details */}
      {(topMatch || verdict || confirmedEntities.length > 0) && (
        <div
          className={`rounded-lg border px-4 py-3 space-y-2 ${
            hasStrongEvidence
              ? "border-[#639922]/20 bg-[#EAF3DE]/50"
              : hasNegativeEvidence
              ? "border-[#E24B4A]/20 bg-[#FCEBEB]/50"
              : "border-[var(--border-color)] bg-[var(--surface-dim)]"
          }`}
        >
          {/* Google Fact Check verdict */}
          {verdict && (
            <div className="flex items-start gap-2">
              <span className="text-sm mt-0.5">🏛️</span>
              <div>
                <p
                  className="text-xs font-semibold text-[var(--text-primary)]"
                  style={{ fontFamily: "'Work Sans', sans-serif" }}
                >
                  Fact-checker verdict:{" "}
                  <span
                    className={
                      score >= 70 ? "text-[#639922]" : score < 30 ? "text-[#E24B4A]" : "text-[#BA7517]"
                    }
                  >
                    {verdict}
                  </span>
                </p>
                {verdictSource && (
                  <p
                    className="text-[10px] text-[var(--text-secondary)] mt-0.5"
                    style={{ fontFamily: "'Work Sans', sans-serif" }}
                  >
                    via {verdictSource}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* FEVER match */}
          {topMatch && topMatch.similarity >= 0.70 && (
            <div className="flex items-start gap-2">
              <span className="text-sm mt-0.5">📚</span>
              <div>
                <p
                  className="text-xs text-[var(--text-primary)]"
                  style={{ fontFamily: "'Work Sans', sans-serif" }}
                >
                  <span className="font-semibold">FEVER match:</span>{" "}
                  <span className="italic">&ldquo;{topMatch.claim}&rdquo;</span>
                </p>
                <p
                  className="text-[10px] text-[var(--text-secondary)] mt-0.5"
                  style={{ fontFamily: "'Work Sans', sans-serif" }}
                >
                  {topMatch.label} · {Math.round(topMatch.similarity * 100)}% similar
                </p>
              </div>
            </div>
          )}

          {/* Wikidata confirmations */}
          {confirmedEntities.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-sm mt-0.5">🌐</span>
              <div>
                <p
                  className="text-xs text-[var(--text-primary)]"
                  style={{ fontFamily: "'Work Sans', sans-serif" }}
                >
                  <span className="font-semibold">Verified entities:</span>{" "}
                  {confirmedEntities.map((e, i) => (
                    <span key={e.entity}>
                      {i > 0 && ", "}
                      <span className="text-[#639922] font-medium">{e.entity}</span>
                      {e.description && (
                        <span className="text-[var(--text-secondary)]"> ({e.description})</span>
                      )}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No evidence found */}
      {!topMatch && !verdict && confirmedEntities.length === 0 && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-dim)] px-4 py-3">
          <p
            className="text-xs text-[var(--text-secondary)] text-center"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            No pre-verified claims found for this content.
          </p>
        </div>
      )}
    </div>
  );
}
