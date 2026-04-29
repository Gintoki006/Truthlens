'use client';

import { useRef } from 'react';
import { useScroll } from 'framer-motion';

import { BackgroundTexture } from '@/components/background-texture';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { HeroSection } from '@/components/hero-section';
import { FeaturesSection } from '@/components/features-section';
import { StatsSection } from '@/components/stats-section';
import { LiveFeedSection } from '@/components/live-feed-section';
import { AboutSection } from '@/components/about-section';
import { Footer } from '@/components/footer';

export default function Home() {
  const containerRef = useRef(null);
  const heroRef = useRef(null);

  const { scrollY } = useScroll();

  return (
    <main
      ref={containerRef}
      className="min-h-screen selection:bg-primary selection:text-white transition-colors duration-300"
    >
      <BackgroundTexture />
      <BottomNav scrollY={scrollY} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 border-x-[0.5px] border-slate-400 dark:border-stone-700 min-h-screen bg-white/40 dark:bg-stone-950/40 backdrop-blur-[2px] shadow-2xl">
        <Header />

        <HeroSection forwardRef={heroRef} />

        <StatsSection />

        <FeaturesSection />

        <LiveFeedSection />
        
        <AboutSection />
      </div>

      <Footer />
    </main>
  );
}
