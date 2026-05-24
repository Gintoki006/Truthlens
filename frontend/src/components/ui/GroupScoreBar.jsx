"use client"
import { useState } from "react"
import SubSignalRow from "./SubSignalRow"

const GROUP_COLORS = {
  content: { bg: "bg-[#EEEDFE]", text: "text-[#3C3489]", bar: "bg-[#534AB7]", emoji: "🟣" },
  source:  { bg: "bg-[#E1F5EE]", text: "text-[#085041]", bar: "bg-[#1D9E75]", emoji: "🟢" },
  facts:   { bg: "bg-[#FAEEDA]", text: "text-[#633806]", bar: "bg-[#BA7517]", emoji: "🟡" },
}

export default function GroupScoreBar({ groupKey, label, score, subSignals }) {
  const [expanded, setExpanded] = useState(false)
  const c = GROUP_COLORS[groupKey] || GROUP_COLORS.content

  return (
    <div className={`rounded-lg p-3 mb-2 ${c.bg}`}>
      <div className="flex items-center justify-between cursor-pointer"
           onClick={() => setExpanded(!expanded)}>
        <span className={`text-sm font-medium ${c.text}`}>
          {c.emoji} {label}
        </span>
        <div className="flex items-center gap-2">
          <strong className={`text-sm ${c.text}`}>{score}</strong>
          <span className={`text-xs ${c.text}`}>{expanded ? "▲" : "▾"}</span>
        </div>
      </div>
      <div className="mt-2 h-1 bg-white/50 rounded-full overflow-hidden">
        <div className={`h-1 rounded-full ${c.bar} transition-all duration-500`}
             style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      {expanded && subSignals && (
        <div className="mt-3 space-y-1 border-t border-white/40 pt-2">
          {Object.entries(subSignals).map(([key, val]) => (
            <SubSignalRow key={key} label={key.replace(/_/g, ' ')} score={val} />
          ))}
        </div>
      )}
    </div>
  )
}
