'use client';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ScrollReveal, TypewriterEffect } from './animations';
import AnalyzeForm from '@/components/forms/AnalyzeForm';

export function HeroSection({ forwardRef }) {
  const { scrollYProgress: heroProgress } = useScroll({
    target: forwardRef,
    offset: ['start start', 'end start'],
  });
  const heroOpacity = useTransform(heroProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(heroProgress, [0, 0.5], [1, 0.95]);
  const heroY = useTransform(heroProgress, [0, 0.5], [0, -60]);

  return (
    <motion.section
      ref={forwardRef}
      style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
      className="py-10 md:py-16 flex flex-col items-center text-center border-b-[0.5px] border-slate-400 dark:border-stone-700"
    >
      <ScrollReveal delay={0.3}>
        <span className="bg-secondary text-white px-3 py-1 font-['Work_Sans'] text-[10px] font-bold uppercase tracking-[0.2em] mb-4 inline-block">
          Verify truth in one tap
        </span>
      </ScrollReveal>

      <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-slate-900 dark:text-stone-100 max-w-5xl mb-4 tracking-tight min-h-[60px] md:min-h-[80px] flex items-center justify-center leading-none">
        <TypewriterEffect 
          phrases={[
            'The truth has a score.',  
            'Your First Line of Defense Against Misinformation',
            'Truth, Verified in Real Time', 
            'Fake or Fact? Instantly Know.'
          ]} 
        />
      </h2>

      <ScrollReveal delay={0.6} className="max-w-2xl mb-8">
        <p className="font-body-lg text-body-lg text-on-surface-variant dark:text-stone-300">
          Paste any link. Know the truth in seconds. Our algorithmic engine
          dissects syntactic patterns, source history, and semantic consistency
          to provide a definitive integrity rating.
        </p>
      </ScrollReveal>

      <ScrollReveal delay={0.8} className="w-full max-w-3xl mb-6">
        <AnalyzeForm />
      </ScrollReveal>
    </motion.section>
  );
}
