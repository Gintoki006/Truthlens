'use client';
import { motion } from 'framer-motion';
import { ScrollReveal, TextReveal } from './animations';

export function AboutSection() {
  return (
    <section className="py-24 px-4 md:px-8 border-t-[0.5px] border-slate-400 dark:border-stone-700">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        <ScrollReveal>
          <div className="editorial-rule-hairline w-24 mx-auto mb-8 dark:border-stone-500" />
          <h2 className="font-headline-lg text-[40px] md:text-[56px] leading-none tracking-tight text-slate-900 dark:text-stone-100 font-serif mb-6">
            <TextReveal text="The Mission of TruthLens" />
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <p className="font-body-lg text-lg md:text-xl text-on-surface-variant dark:text-stone-400 max-w-3xl leading-relaxed mb-10">
            Misinformation spreads faster than corrections. In an era of information volatility, users currently have no reliable, real-time tool to verify the authenticity of the news they consume. Existing fact-checkers are slow, manual, and lack transparency.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.4}>
          <div className="p-8 md:p-12 border-[0.5px] border-slate-400 dark:border-stone-700 bg-stone-50/80 dark:bg-stone-900/80 backdrop-blur-md relative z-[60]">
            <p className="font-serif font-['Newsreader'] text-xl md:text-2xl italic text-slate-900 dark:text-stone-200 mb-8 leading-snug">
              TruthLens is an AI-driven investigative system that instantly analyzes any article and returns a clear authenticity score, a definitive verdict, and a human-readable explanation.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 gap-y-12 text-left pt-8 border-t-[0.5px] border-slate-300 dark:border-stone-700">
              <div>
                <h4 className="font-label-caps text-xs tracking-widest text-slate-500 dark:text-stone-400 uppercase mb-2">Signal 1</h4>
                <p className="font-headline-sm text-sm text-slate-900 dark:text-stone-100">NLP & Semantic Analysis</p>
              </div>
              <div>
                <h4 className="font-label-caps text-xs tracking-widest text-slate-500 dark:text-stone-400 uppercase mb-2">Signal 2</h4>
                <p className="font-headline-sm text-sm text-slate-900 dark:text-stone-100">Source Credibility & Trust</p>
              </div>
              <div>
                <h4 className="font-label-caps text-xs tracking-widest text-slate-500 dark:text-stone-400 uppercase mb-2">Signal 3</h4>
                <p className="font-headline-sm text-sm text-slate-900 dark:text-stone-100">Machine Learning Classification</p>
              </div>
              <div>
                <h4 className="font-label-caps text-xs tracking-widest text-slate-500 dark:text-stone-400 uppercase mb-2">Signal 4</h4>
                <p className="font-headline-sm text-sm text-slate-900 dark:text-stone-100">Cross-Verification Engine</p>
              </div>
              <div>
                <h4 className="font-label-caps text-xs tracking-widest text-slate-500 dark:text-stone-400 uppercase mb-2">Signal 5</h4>
                <p className="font-headline-sm text-sm text-slate-900 dark:text-stone-100">Global Fact-Check Registries</p>
              </div>
              <div>
                <h4 className="font-label-caps text-xs tracking-widest text-slate-500 dark:text-stone-400 uppercase mb-2">Signal 6</h4>
                <p className="font-headline-sm text-sm text-slate-900 dark:text-stone-100">Semantic AI Logic Engine</p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
