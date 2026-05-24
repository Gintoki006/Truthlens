"use client"

export default function SubSignalRow({ label, score }) {
  return (
    <div className="flex items-center justify-between py-0.5 opacity-80 hover:opacity-100 transition-opacity">
      <span className="text-xs font-medium capitalize truncate w-32">{label}</span>
      <span className="text-xs font-bold">{score}</span>
    </div>
  )
}
