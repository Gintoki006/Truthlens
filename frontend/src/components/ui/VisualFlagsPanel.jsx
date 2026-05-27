"use client";

export default function VisualFlagsPanel({ flags }) {
  if (!flags || flags.length === 0) return null;

  return (
    <div className="rounded-none border-2 border-secondary dark:border-red-500 bg-[#fef2f2] dark:bg-[#2c1313] p-5 space-y-3">
      <div className="flex items-center gap-2 border-b-2 border-secondary/20 dark:border-red-500/30 pb-2">
        <span className="material-symbols-outlined text-secondary dark:text-red-400 text-[18px]">warning</span>
        <h3 className="font-['Newsreader'] text-xl font-bold uppercase tracking-wider text-secondary dark:text-red-400">
          Visual Red Flags
        </h3>
      </div>
      <ul className="space-y-2">
        {flags.map((flag, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm font-['Work_Sans'] leading-relaxed text-secondary dark:text-red-200">
            <span className="material-symbols-outlined text-[16px] mt-0.5 text-secondary dark:text-red-500">error</span>
            <span>{flag}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
