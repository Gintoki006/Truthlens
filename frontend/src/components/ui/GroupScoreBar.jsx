"use client"
import { useState } from "react"
import SubSignalRow from "./SubSignalRow"

const GROUP_COLORS = {
  content: { bg: "bg-[#f3edfc]", dot: "bg-[#7c4dff]", text: "text-[#7c4dff]" },
  source:  { bg: "bg-[#e6f4ea]", dot: "bg-[#00c853]", text: "text-[#00c853]" },
  facts:   { bg: "bg-[#fff8e1]", dot: "bg-[#ffc107]", text: "text-[#ffc107]" },
}

export default function GroupScoreBar({ groupKey, label, score, subSignals }) {
  const [expanded, setExpanded] = useState(false)
  const c = GROUP_COLORS[groupKey] || GROUP_COLORS.content

  return (
    <div className={`border-[0.5px] border-outline-variant ${c.bg}`}>
      <div className="flex items-center justify-between p-3 cursor-pointer select-none"
           onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full ${c.dot} mr-3`}></div>
          <span className="font-body text-sm font-medium text-on-surface">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-headline text-lg font-bold ${c.text}`}>{score}</span>
          <span className={`text-[10px] ${c.text} flex items-center justify-center`}>
            <span className="material-symbols-outlined text-[16px]">{expanded ? "expand_less" : "expand_more"}</span>
          </span>
        </div>
      </div>
      {expanded && subSignals && (
        <div className="px-3 pb-3 space-y-1">
          <div className="border-t-[0.5px] border-outline-variant mb-2 opacity-30"></div>
          {Object.entries(subSignals).map(([key, val]) => (
            <SubSignalRow key={key} label={key.replace(/_/g, ' ')} score={val} colorClass={c.text} />
          ))}
        </div>
      )}
    </div>
  )
}
