"use client"

export default function SubSignalRow({ label, score, colorClass }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-dashed border-[#d4d4d4] dark:border-stone-700 opacity-80 hover:opacity-100 transition-opacity">
      <span className="font-label text-[10px] uppercase tracking-[0.1em] font-bold truncate w-40 text-[#747878] dark:text-stone-400">{label}</span>
      <span className={`font-serif text-[14px] font-bold ${colorClass || 'text-[#1c1b1b]'}`}>{score}</span>
    </div>
  )
}
