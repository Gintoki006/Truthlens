"use client"

export default function SubSignalRow({ label, score, colorClass }) {
  return (
    <div className="flex items-center justify-between py-0.5 opacity-80 hover:opacity-100 transition-opacity">
      <span className="font-body text-xs font-medium capitalize truncate w-40 text-on-surface">{label}</span>
      <span className={`font-headline text-sm font-bold ${colorClass || 'text-on-surface'}`}>{score}</span>
    </div>
  )
}
