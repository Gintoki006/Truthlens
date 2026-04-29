'use client';

export function Footer() {
  return (
    <footer className="relative z-[60] bg-white/40 dark:bg-stone-950/40 backdrop-blur-[2px] w-full border-t-4 border-double border-slate-900 dark:border-stone-100 mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 flex flex-col gap-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-8 border-t-[0.5px] border-slate-400 pt-8 text-center sm:text-left">
          <div className="sm:col-span-2 md:col-span-1 flex flex-col items-center sm:items-start text-center sm:text-left">
            <span className="font-black text-lg text-slate-900 dark:text-stone-100 font-serif uppercase tracking-tight">
              TRUTHLENS
            </span>
            <p className="font-serif font-['Newsreader'] text-xs leading-relaxed uppercase tracking-widest mt-4 text-slate-500 max-w-[250px] sm:max-w-none">
              The ultimate analytical lens for an era of information volatility.
            </p>
          </div>
          <div className="flex flex-col items-center sm:items-start">
            <h6 className="font-serif font-['Newsreader'] text-xs leading-relaxed uppercase tracking-widest font-bold mb-4 text-slate-900 dark:text-stone-100">
              Policies
            </h6>
            <ul className="flex flex-col items-center sm:items-start gap-2 font-serif font-['Newsreader'] text-xs uppercase tracking-widest">
              <li>
                <a
                  className="text-slate-500 dark:text-stone-500 hover:text-slate-900 dark:hover:text-stone-200 transition-opacity"
                  href="#"
                >
                  Ethics Policy
                </a>
              </li>
              <li>
                <a
                  className="text-slate-500 dark:text-stone-500 hover:text-slate-900 dark:hover:text-stone-200 transition-opacity"
                  href="#"
                >
                  Editorial Standards
                </a>
              </li>
            </ul>
          </div>
          <div className="flex flex-col items-center sm:items-start">
            <h6 className="font-serif font-['Newsreader'] text-xs leading-relaxed uppercase tracking-widest font-bold mb-4 text-slate-900 dark:text-stone-100">
              Organization
            </h6>
            <ul className="flex flex-col items-center sm:items-start gap-2 font-serif font-['Newsreader'] text-xs uppercase tracking-widest">
              <li>
                <a
                  className="text-slate-500 dark:text-stone-500 hover:text-slate-900 dark:hover:text-stone-200 transition-opacity"
                  href="#"
                >
                  Masthead
                </a>
              </li>
              <li>
                <a
                  className="text-slate-500 dark:text-stone-500 hover:text-slate-900 dark:hover:text-stone-200 transition-opacity"
                  href="#"
                >
                  Archives
                </a>
              </li>
            </ul>
          </div>
          <div className="flex flex-col items-center sm:items-start">
            <h6 className="font-serif font-['Newsreader'] text-xs leading-relaxed uppercase tracking-widest font-bold mb-4 text-slate-900 dark:text-stone-100">
              Legal
            </h6>
            <ul className="flex flex-col items-center sm:items-start gap-2 font-serif font-['Newsreader'] text-xs uppercase tracking-widest">
              <li>
                <a
                  className="text-slate-500 dark:text-stone-500 hover:text-slate-900 dark:hover:text-stone-200 transition-opacity"
                  href="#"
                >
                  Privacy
                </a>
              </li>
              <li>
                <a
                  className="text-slate-500 dark:text-stone-500 hover:text-slate-900 dark:hover:text-stone-200 transition-opacity"
                  href="#"
                >
                  Terms
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t-[0.5px] border-slate-400 pt-8 text-center">
          <p className="font-serif font-['Newsreader'] text-xs leading-relaxed uppercase tracking-widest text-slate-500">
            © 2024 TRUTHLENS INVESTIGATIVE JOURNALISM. VOL. XII — NO. 402. ALL
            RIGHTS RESERVED.
          </p>
        </div>
      </div>
    </footer>
  );
}
