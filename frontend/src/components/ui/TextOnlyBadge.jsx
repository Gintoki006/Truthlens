"use client"

export default function TextOnlyBadge() {
  return (
    <div className="mt-3 bg-slate-100 text-slate-600 text-[11px] px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 border border-slate-200 shadow-sm font-medium">
      <span>ℹ️</span> Scored on content only — no source domain
    </div>
  )
}
