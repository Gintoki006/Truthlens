'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/context/AuthContext';

function UserAvatar({ user, size = 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs';
  const photoUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const name =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    '';
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : (user?.email?.[0] || 'U').toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name || 'User avatar'}
        className={`${sizeClasses} rounded-full object-cover border-2 border-slate-900 dark:border-stone-100`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-primary dark:bg-stone-100 text-on-primary dark:text-stone-900 flex items-center justify-center font-['Work_Sans'] font-bold border-2 border-slate-900 dark:border-stone-100`}
    >
      {initials}
    </div>
  );
}

export function Header({ forwardRef }) {
  const [dateline, setDateline] = useState('Loading...');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const pathname = usePathname();
  const { user, loading: authLoading, signOut } = useAuth();

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const getDateline = async () => {
      // 1. Get current date in the user's local timezone
      const dateOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      };
      const localDate = new Intl.DateTimeFormat('en-US', dateOptions).format(
        new Date(),
      );

      // 2. Extract a fallback city from the browser's timezone (e.g., "America/New_York" -> "New York")
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let city = tz ? tz.split('/')[1]?.replace(/_/g, ' ') : 'London';
      if (!city) city = 'London';

      // Set initial fallback so there's no layout jump
      setDateline(`${city}, ${localDate}`);

      // 3. Try to fetch the actual city from a free IP Geolocation API without asking for invasive browser permissions
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (data && data.city) {
          setDateline(`${data.city}, ${localDate}`);
        }
      } catch (error) {
        // Silently ignore geolocation failure to avoid console noise
      }
    };

    getDateline();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsUserMenuOpen(false);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User';
  const displayEmail = user?.email || '';

  const navLinks = [
    { label: 'Analysis', href: '/' },
    { label: 'History', href: '/history' },
    { label: 'Dashboard', href: '/dashboard' },
  ];

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
          <Link href="/">TRUTHLENS</Link>
        </motion.h1>
        <div className="border-y-2 border-slate-900 dark:border-stone-100 my-1 py-3 md:py-2 w-full flex flex-row justify-between items-center gap-4 md:gap-0 px-2 md:px-0">
          {/* Mobile Left Text */}
          <div className="flex md:hidden text-slate-900 dark:text-stone-100 items-center">
            <span className="font-['Work_Sans'] font-bold text-[10px] tracking-widest uppercase">
              Menu
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex flex-wrap justify-center gap-4 md:gap-8 font-serif font-['Newsreader'] uppercase tracking-tight text-sm">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    isActive
                      ? 'border-b-2 border-slate-900 dark:border-stone-100 text-slate-950 dark:text-stone-50 pb-1'
                      : 'text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-100 transition-colors'
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />

            {/* Auth-aware user section */}
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-stone-700 animate-pulse" />
            ) : user ? (
              /* Signed-in state: avatar + dropdown */
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 group cursor-pointer"
                  aria-label="User menu"
                >
                  <UserAvatar user={user} />
                  <span className="material-symbols-outlined text-[14px] text-slate-600 dark:text-stone-400 group-hover:text-slate-900 dark:group-hover:text-stone-100 transition-colors">
                    {isUserMenuOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {/* User dropdown menu */}
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-3 w-64 bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 shadow-xl z-[200]"
                    >
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-stone-700">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-serif text-slate-900 dark:text-stone-100 truncate">
                              {displayName}
                            </p>
                            <p className="text-[10px] font-['Work_Sans'] text-slate-500 dark:text-stone-500 truncate uppercase tracking-wider">
                              {displayEmail}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Menu links */}
                      <div className="py-1">
                        <Link
                          href="/history"
                          className="flex items-center gap-3 px-4 py-2.5 text-xs font-['Work_Sans'] font-bold uppercase tracking-widest text-slate-600 dark:text-stone-400 hover:bg-slate-50 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-stone-100 transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            history
                          </span>
                          My History
                        </Link>
                        <Link
                          href="/dashboard"
                          className="flex items-center gap-3 px-4 py-2.5 text-xs font-['Work_Sans'] font-bold uppercase tracking-widest text-slate-600 dark:text-stone-400 hover:bg-slate-50 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-stone-100 transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            dashboard
                          </span>
                          Dashboard
                        </Link>
                      </div>

                      {/* Sign out */}
                      <div className="border-t border-slate-200 dark:border-stone-700 py-1">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-xs font-['Work_Sans'] font-bold uppercase tracking-widest text-secondary hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            logout
                          </span>
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Signed-out state: Login button */
              <Link
                href="/login"
                className="bg-primary text-on-primary px-4 py-1 text-xs font-['Work_Sans'] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[14px]">
                  person
                </span>
                Sign In
              </Link>
            )}
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
              <nav className="flex flex-col items-center py-6 gap-5 font-serif font-['Newsreader'] uppercase tracking-tight text-lg">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={
                        isActive
                          ? 'text-slate-900 dark:text-stone-100 border-b border-slate-200 dark:border-stone-800 pb-1'
                          : 'text-slate-600 dark:text-stone-400'
                      }
                    >
                      {link.label}
                    </Link>
                  );
                })}

                {/* Mobile auth section */}
                <div className="w-full border-t border-slate-200 dark:border-stone-700 pt-5 mt-1 flex flex-col items-center gap-4">
                  {authLoading ? (
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-stone-700 animate-pulse" />
                  ) : user ? (
                    <>
                      {/* User info row */}
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} size="sm" />
                        <div>
                          <p className="text-sm font-serif text-slate-900 dark:text-stone-100">
                            {displayName}
                          </p>
                          <p className="text-[9px] font-['Work_Sans'] text-slate-500 dark:text-stone-500 uppercase tracking-wider">
                            {displayEmail}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="bg-secondary text-white px-8 py-2 text-sm font-['Work_Sans'] font-bold uppercase tracking-widest flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          logout
                        </span>
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Link
                        href="/login"
                        className="bg-primary text-on-primary px-8 py-2 text-sm font-['Work_Sans'] font-bold uppercase tracking-widest"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/signup"
                        className="text-slate-600 dark:text-stone-400 text-sm font-['Work_Sans'] font-bold uppercase tracking-widest hover:text-slate-900 dark:hover:text-stone-100 transition-colors"
                      >
                        Create Account
                      </Link>
                    </div>
                  )}
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
