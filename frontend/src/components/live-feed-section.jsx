'use client';
import { motion } from 'framer-motion';
import { ScrollReveal, HorizontalScroll } from './animations';

const feedItems = [
  {
    headline: 'NASA Confirms Water Found on Mars Surface',
    source: 'Reuters',
    verdict: 'TRUE',
    score: 94,
    color: '#2e7d32',
  },
  {
    headline: '5G Towers Linked to Spread of COVID-19',
    source: 'ViralHealth.blog',
    verdict: 'FAKE',
    score: 8,
    color: '#c62828',
  },
  {
    headline: 'Global Sea Levels Rise 3mm Per Year, Study Finds',
    source: 'Nature Journal',
    verdict: 'TRUE',
    score: 97,
    color: '#2e7d32',
  },
  {
    headline: 'Eating Chocolate Daily Cures Heart Disease',
    source: 'DailyBuzz.net',
    verdict: 'MISLEADING',
    score: 22,
    color: '#e65100',
  },
  {
    headline: 'WHO Declares Mpox a Global Health Emergency',
    source: 'AP News',
    verdict: 'TRUE',
    score: 96,
    color: '#2e7d32',
  },
  {
    headline: 'Government Secretly Adds Microchips to Vaccines',
    source: 'TruthPatriots.org',
    verdict: 'FAKE',
    score: 3,
    color: '#c62828',
  },
  {
    headline: "India Becomes World's 5th Largest Economy",
    source: 'Bloomberg',
    verdict: 'TRUE',
    score: 92,
    color: '#2e7d32',
  },
  {
    headline: 'Solar Panels Cause More Pollution Than Coal',
    source: 'EnergyMyths.com',
    verdict: 'FAKE',
    score: 11,
    color: '#c62828',
  },
  {
    headline: 'EU Passes Landmark AI Regulation Act',
    source: 'Financial Times',
    verdict: 'TRUE',
    score: 95,
    color: '#2e7d32',
  },
  {
    headline: 'Scientists Warn: Bananas Will Be Extinct by 2030',
    source: 'ClickFacts.io',
    verdict: 'MISLEADING',
    score: 18,
    color: '#e65100',
  },
  {
    headline: 'SpaceX Successfully Lands Starship Booster',
    source: 'The Verge',
    verdict: 'TRUE',
    score: 98,
    color: '#2e7d32',
  },
  {
    headline: 'Drinking Bleach Can Cure Cancer, Doctors Say',
    source: 'NaturalCures.blog',
    verdict: 'FAKE',
    score: 2,
    color: '#c62828',
  },
];

export function LiveFeedSection() {
  const headerContent = (
    <ScrollReveal>
      <div className="border-t-[0.5px] border-slate-900 dark:border-stone-100 pt-8 pb-12 max-w-7xl mx-auto px-4 md:px-8">
        <h2 className="font-serif text-5xl md:text-7xl text-slate-900 dark:text-stone-100 mb-6 tracking-tight">
          Analysis Ledger
        </h2>
        <div className="flex flex-col lg:flex-row gap-8 justify-between items-start lg:items-end">
          <p className="font-body-lg text-lg text-on-surface-variant dark:text-stone-400 max-w-2xl leading-relaxed">
            Our algorithmic engine continuously cross-references articles
            against verified historical data and parses syntactic manipulation.
            This ledger serves as a transparent log of recently processed
            narratives, detailing source credibility and objective factual
            consistency.
          </p>
          <div className="flex flex-row gap-8 pb-1">
            <div className="border-l-[2px] border-primary dark:border-stone-600 pl-4">
              <span className="block font-label-caps text-[10px] text-slate-500 dark:text-stone-400 uppercase tracking-widest mb-1">
                Latest Entry
              </span>
              <span className="font-serif font-bold text-lg text-slate-900 dark:text-stone-200">
                14 mins ago
              </span>
            </div>
            <div className="border-l-[2px] border-primary dark:border-stone-600 pl-4">
              <span className="block font-label-caps text-[10px] text-slate-500 dark:text-stone-400 uppercase tracking-widest mb-1">
                Total Indexed
              </span>
              <span className="font-serif font-bold text-lg text-slate-900 dark:text-stone-200">
                1,245,609
              </span>
            </div>
          </div>
        </div>
      </div>
    </ScrollReveal>
  );

  return (
    <HorizontalScroll header={headerContent}>
      {feedItems.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: i * 0.05 }}
          className="shrink-0 w-[300px] md:w-[380px] h-[250px] bg-white/95 dark:bg-stone-900/95 border-[0.5px] border-slate-400 dark:border-stone-700 p-6 flex flex-col justify-between backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative z-[60]"
        >
          <div className="flex justify-between items-start gap-4">
            <span className="font-label-caps text-[10px] text-slate-500 dark:text-stone-400">
              #{String(i + 1).padStart(2, '0')}
            </span>
            <span
              className="px-2 py-0.5 text-[9px] font-['Work_Sans'] font-bold uppercase tracking-widest text-white rounded-sm shrink-0"
              style={{ backgroundColor: item.color }}
            >
              {item.verdict}
            </span>
          </div>
          <div className="flex-1 flex flex-col justify-center mt-2">
            <h3 className="font-headline-sm text-lg text-slate-900 dark:text-stone-100 leading-snug">
              {item.headline}
            </h3>
            <span className="font-body-md text-[11px] uppercase tracking-widest text-slate-500 dark:text-stone-400 mt-2">
              Source: {item.source}
            </span>
          </div>
          <div className="mt-4">
            <div className="flex justify-between items-end mb-1">
              <span className="font-label-caps text-[9px] text-slate-500 dark:text-stone-400">
                Integrity Score
              </span>
              <motion.span
                className="font-display-xl text-[24px] leading-none"
                style={{ color: item.color }}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                {item.score}
              </motion.span>
            </div>
            <div className="w-full h-1 bg-slate-200 dark:bg-stone-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: item.color }}
                initial={{ width: '0%' }}
                whileInView={{ width: `${item.score}%` }}
                transition={{
                  duration: 1.2,
                  delay: 0.3,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </HorizontalScroll>
  );
}
