"use client"
import { useState } from "react"
import SubSignalRow from "./SubSignalRow"

export default function GroupScoreBar({ groupKey, label, score, subSignals }) {
  const [expanded, setExpanded] = useState(false)
  
  const isFacts = groupKey === 'facts'
  const textColor = isFacts ? "text-[#b7211f]" : "text-[#1c1b1b] dark:text-stone-100"
  const borderClass = isFacts ? "border-b-[3px] border-[#1c1b1b] dark:border-stone-100" : "border-b-[1px] border-[#d4d4d4] dark:border-stone-700"
  
  // Custom subtitles based on the exact dossier screenshot
  const subtitle = groupKey === 'content' ? 'Semantic/NLP Audit' : 
                   groupKey === 'source' ? 'Domain/Origin Index' : 
                   'Internal Database Match'

  return (
    <div className={`${borderClass} pb-3 mb-6`}>
      <div className="flex justify-between items-end cursor-pointer group" onClick={() => setExpanded(!expanded)}>
        <div className="flex flex-col">
          <span className={`font-serif text-base font-bold ${textColor} uppercase group-hover:opacity-70 transition-opacity`}>
            {label}
            {subSignals && Object.keys(subSignals).length > 0 && (
              <span className="material-symbols-outlined text-[18px] ml-2 align-middle">{expanded ? "expand_less" : "expand_more"}</span>
            )}
          </span>
          <span className="font-label text-[9px] uppercase tracking-[0.1em] text-[#747878] dark:text-stone-400 italic mt-1">{subtitle}</span>
        </div>
        <span className={`font-serif text-3xl font-black ${textColor} leading-none`}>{score}</span>
      </div>
      
      {expanded && subSignals && (
        <div className="pt-4 space-y-2">
          {Object.entries(subSignals).map(([key, val]) => (
            <SubSignalRow key={key} label={key.replace(/_/g, ' ')} score={val} colorClass={textColor} />
          ))}
        </div>
      )}
    </div>
  )
}
