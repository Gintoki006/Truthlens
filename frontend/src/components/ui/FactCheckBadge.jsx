"use client"

export default function FactCheckBadge({ result }) {
  if (!result || !result.rating) return null;
  
  return (
    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-md p-2 text-xs flex items-start gap-2 shadow-sm">
      <div className="flex-shrink-0 pt-0.5">🔍</div>
      <div>
        <p className="font-medium text-slate-800">
          Fact Check: <span className="font-bold capitalize">{result.rating}</span>
        </p>
        <p className="text-slate-600 mt-0.5">
          Verified by {result.checker || "Fact Checker"}
          {result.url && (
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline inline-block">
              [View full review]
            </a>
          )}
        </p>
      </div>
    </div>
  )
}
