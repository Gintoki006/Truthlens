"use client";

export default function ExtractedClaimsPanel({ ocrText, mainClaims, entities }) {
  if (!ocrText && (!mainClaims || mainClaims.length === 0)) return null;

  return (
    <div className="rounded-none border-2 border-slate-900 dark:border-stone-500 bg-transparent p-5 space-y-4">
      <div className="flex items-center gap-2 border-b-2 border-slate-900 dark:border-stone-500 pb-2">
        <span className="material-symbols-outlined text-[18px]">document_scanner</span>
        <h3 className="font-['Newsreader'] text-xl font-bold uppercase tracking-wider text-slate-900 dark:text-stone-100">
          Extracted Context
        </h3>
      </div>
      
      {mainClaims && mainClaims.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-400">
            Identified Claims
          </h4>
          <ul className="space-y-2">
            {mainClaims.map((claim, idx) => (
              <li key={idx} className="flex gap-3 text-sm font-['Work_Sans'] leading-relaxed text-slate-800 dark:text-stone-200">
                <span className="text-secondary dark:text-red-400 font-bold">›</span>
                {claim}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(!mainClaims || mainClaims.length === 0) && ocrText && (
        <div className="space-y-2">
           <h4 className="text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-400">
            Raw Extracted Text
          </h4>
          <p className="text-sm font-['Work_Sans'] leading-relaxed text-slate-800 dark:text-stone-200 whitespace-pre-wrap">
            {ocrText}
          </p>
        </div>
      )}

      {entities && entities.length > 0 && (
        <div className="pt-2 border-t border-slate-200 dark:border-stone-700">
          <h4 className="text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-400 mb-2">
            Detected Entities
          </h4>
          <div className="flex flex-wrap gap-2">
            {entities.map((entity, idx) => (
              <span key={idx} className="px-2 py-1 bg-slate-100 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 text-[11px] font-['Geist_Mono'] font-medium text-slate-700 dark:text-stone-300">
                {entity}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
