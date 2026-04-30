"use client";

import { useState } from "react";

/**
 * Color-coded sentence renderer with click-to-reveal tooltips.
 * Level mapping: verified → green, uncertain → amber, flagged → red.
 */
export default function SentenceHighlight({ sentences = [] }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const levelConfig = {
    verified: {
      bg: "bg-[#EAF3DE]/60",
      border: "border-[#639922]/20",
      hoverBg: "hover:bg-[#EAF3DE]",
      tooltipBg: "bg-[#27500A]",
    },
    uncertain: {
      bg: "bg-[#FAEEDA]/60",
      border: "border-[#BA7517]/20",
      hoverBg: "hover:bg-[#FAEEDA]",
      tooltipBg: "bg-[#633806]",
    },
    flagged: {
      bg: "bg-[#FCEBEB]/60",
      border: "border-[#E24B4A]/20",
      hoverBg: "hover:bg-[#FCEBEB]",
      tooltipBg: "bg-[#791F1F]",
    },
  };

  return (
    <div className="space-y-0.5 leading-relaxed text-base" style={{ fontFamily: "'Newsreader', serif" }}>
      {sentences.map((sentence, i) => {
        const config = levelConfig[sentence.level] || levelConfig.uncertain;
        const isActive = activeIndex === i;

        return (
          <span key={i} className="relative inline">
            <span
              onClick={() => setActiveIndex(isActive ? null : i)}
              className={`
                inline cursor-pointer rounded-sm px-0.5 py-0.5 border-b
                transition-all duration-200
                ${config.bg} ${config.border} ${config.hoverBg}
              `}
            >
              {sentence.text}{" "}
            </span>

            {/* Tooltip */}
            {isActive && (
              <span
                className={`
                  absolute left-0 top-full z-50 mt-1 
                  max-w-xs rounded-lg px-3 py-2
                  text-xs text-white shadow-xl
                  ${config.tooltipBg}
                  animate-in fade-in slide-in-from-top-1
                `}
                style={{ fontFamily: "'Work Sans', sans-serif" }}
              >
                <span className="font-semibold">Score: {sentence.score}/100</span>
                <br />
                {sentence.reason}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
