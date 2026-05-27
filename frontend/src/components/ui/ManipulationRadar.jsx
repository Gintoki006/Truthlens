"use client";

export default function ManipulationRadar({ emotionalTone, tactics }) {
  if (!emotionalTone && (!tactics || tactics.length === 0)) return null;

  return (
    <div className="rounded-none border-2 border-slate-900 dark:border-stone-500 p-5 space-y-4 bg-slate-50 dark:bg-[#1a1a1a]">
      <div className="flex items-center justify-between border-b-2 border-slate-900 dark:border-stone-500 pb-2">
        <h3 className="font-['Newsreader'] text-xl font-bold uppercase tracking-wider text-slate-900 dark:text-stone-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">psychology</span>
          Manipulation Analysis
        </h3>
        {emotionalTone && (
          <span className="px-3 py-1 bg-slate-900 dark:bg-stone-100 text-on-primary dark:text-stone-900 text-xs font-['Work_Sans'] font-bold uppercase tracking-widest">
            Tone: {emotionalTone}
          </span>
        )}
      </div>

      {tactics && tactics.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-['Work_Sans'] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-stone-400">
            Detected Tactics
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {tactics.map((tactic, idx) => {
              // Map some common tactics to icons
              const lower = tactic.toLowerCase();
              let icon = "campaign";
              if (lower.includes("urgency") || lower.includes("fear") || lower.includes("alarm")) icon = "notifications_active";
              if (lower.includes("authority") || lower.includes("expert") || lower.includes("fake context")) icon = "verified_user";
              if (lower.includes("emotion") || lower.includes("anger") || lower.includes("outrage")) icon = "mood_bad";

              return (
                <div key={idx} className="flex items-start gap-3 p-3 bg-white dark:bg-[#222] border border-slate-200 dark:border-stone-700">
                  <span className="material-symbols-outlined text-slate-700 dark:text-stone-400 mt-0.5">{icon}</span>
                  <span className="text-sm font-['Work_Sans'] font-medium text-slate-800 dark:text-stone-200">
                    {tactic}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
