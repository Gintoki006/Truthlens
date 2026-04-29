'use client';
import { motion, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import { useState } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';

export function BottomNav({ scrollY }) {
  const [show, setShow] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setShow(latest > 250);
  });

  return (
    <AnimatePresence>
      {show && (
        <motion.nav
          initial={{ y: 80, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] items-center gap-1 px-2 py-2 rounded-full bg-[#fcfcfc]/80 dark:bg-stone-900/80 backdrop-blur-xl border border-slate-200 dark:border-stone-700 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] justify-center"
        >
          <a href="#" className="px-4 py-2 rounded-full text-[11px] font-['Work_Sans'] font-bold uppercase tracking-widest text-slate-900 dark:text-stone-100 bg-slate-100 dark:bg-stone-800 transition-colors hover:bg-slate-200 dark:hover:bg-stone-700">Analysis</a>
          <a href="#" className="px-4 py-2 rounded-full text-[11px] font-['Work_Sans'] font-bold uppercase tracking-widest text-slate-500 dark:text-stone-400 transition-colors hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-stone-100">Methodology</a>
          <a href="#" className="px-4 py-2 rounded-full text-[11px] font-['Work_Sans'] font-bold uppercase tracking-widest text-slate-500 dark:text-stone-400 transition-colors hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-stone-100">About</a>
          <div className="w-px h-5 bg-slate-300 dark:bg-stone-600 mx-1" />
          <div className="flex items-center px-1 md:px-2">
            <ThemeToggle />
          </div>
          <button className="px-3 md:px-4 py-2 rounded-full text-[9px] md:text-[11px] font-['Work_Sans'] font-bold uppercase tracking-widest bg-primary text-on-primary dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 transition-opacity whitespace-nowrap">Subscribe</button>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
