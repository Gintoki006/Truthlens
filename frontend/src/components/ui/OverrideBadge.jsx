"use client"

export default function OverrideBadge({ reason }) {
  if (!reason) return null;
  return (
    <div className="mt-3 bg-red-100 border border-red-200 text-red-800 text-xs px-3 py-2 rounded-md shadow-sm">
      <span className="font-semibold uppercase tracking-wider text-[10px]">Score Override</span>
      <p className="mt-0.5 text-sm font-medium">{reason}</p>
    </div>
  )
}
