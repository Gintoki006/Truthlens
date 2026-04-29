'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

export function Header({ forwardRef }) {
  const [dateline, setDateline] = useState('Loading...');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const getDateline = async () => {
      // 1. Get current date in the user's local timezone
      const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
      const localDate = new Intl.DateTimeFormat('en-US', dateOptions).format(new Date());

      // 2. Extract a fallback city from the browser's timezone (e.g., "America/New_York" -> "New York")
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let city = tz ? tz.split('/')[1]?.replace(/_/g, ' ') : 'London';
      if (!city) city = 'London';

      // Set initial fallback so there's no layout jump
      setDateline(`${city}, ${localDate}`);

      // 3. Try to fetch the actual city from a free IP Geolocation API without asking for invasive browser permissions
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data && data.city) {
          setDateline(`${data.city}, ${localDate}`);
        }
      } catch (error) {
        console.error('Failed to fetch accurate location, using timezone fallback.');
      }
    };

    getDateline();
  }, []);

  return (
    <motion.header
      ref={forwardRef}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-transparent docked full-width top-0 z-50 relative"
    >
      <div className="flex flex-col items-center w-full px-4 py-6 max-w-[1400px] mx-auto">
        <div className="w-full flex flex-col md:flex-row justify-between items-center md:items-end mb-4 gap-2 md:gap-0 font-['Work_Sans'] text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-stone-400">
          <div className="flex flex-col md:flex-row items-center gap-1 md:gap-4">
            <span>VOL. XII — NO. 402</span>
            <span className="md:border-l md:border-slate-400 md:pl-4">
              {dateline}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-secondary">GLOBAL TRUTH INDEX: 68.4</span>
            <span className="material-symbols-outlined text-[14px]">
              trending_down
            </span>
          </div>
        </div>
        <motion.h1
          initial={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          className="text-6xl md:text-8xl text-center font-black font-serif uppercase tracking-tighter text-slate-900 dark:text-stone-100 border-b-4 border-slate-900 dark:border-stone-100 mb-2"
        >
          TRUTHLENS
        </motion.h1>
        <div className="border-y-2 border-slate-900 dark:border-stone-100 my-1 py-3 md:py-2 w-full flex flex-row justify-between items-center gap-4 md:gap-0 px-2 md:px-0">
          {/* Mobile Left Text */}
          <div className="flex md:hidden text-slate-900 dark:text-stone-100 items-center">
             <span className="font-['Work_Sans'] font-bold text-[10px] tracking-widest uppercase">Menu</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex flex-wrap justify-center gap-4 md:gap-8 font-serif font-['Newsreader'] uppercase tracking-tight text-sm">
            <a
              className="border-b-2 border-slate-900 dark:border-stone-100 text-slate-950 dark:text-stone-50 pb-1"
              href="#"
            >
              Analysis
            </a>
            <a
              className="text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100 transition-colors"
              href="#"
            >
              Methodology
            </a>
            <a
              className="text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100 transition-colors"
              href="#"
            >
              About
            </a>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-900 dark:text-stone-100">
                search
              </span>
              <span className="material-symbols-outlined text-slate-900 dark:text-stone-100">
                account_circle
              </span>
              <ThemeToggle />
            </div>
            <button className="bg-primary text-on-primary px-4 py-1 text-xs font-['Work_Sans'] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
              Subscribe
            </button>
          </div>

          {/* Mobile Actions (Top Right) */}
          <div className="flex md:hidden items-center gap-4">
             <ThemeToggle />
             <span 
               onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
               className="material-symbols-outlined text-slate-900 dark:text-stone-100 cursor-pointer text-2xl"
             >
               {isMobileMenuOpen ? 'close' : 'menu'}
             </span>
          </div>
        </div>
        
        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden w-full overflow-hidden border-b border-slate-300 dark:border-stone-700 flex flex-col"
            >
              <nav className="flex flex-col items-center py-6 gap-6 font-serif font-['Newsreader'] uppercase tracking-tight text-lg">
                <a className="text-slate-900 dark:text-stone-100 border-b border-slate-200 dark:border-stone-800 pb-1" href="#">Analysis</a>
                <a className="text-slate-600 dark:text-stone-400" href="#">Methodology</a>
                <a className="text-slate-600 dark:text-stone-400" href="#">About</a>
                <div className="flex gap-4 mt-2">
                  <span className="material-symbols-outlined text-slate-900 dark:text-stone-100">search</span>
                  <span className="material-symbols-outlined text-slate-900 dark:text-stone-100">account_circle</span>
                </div>
                <button className="bg-primary text-on-primary px-8 py-2 text-sm font-['Work_Sans'] font-bold uppercase tracking-widest mt-2">
                  Subscribe
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.header>
  );
}
