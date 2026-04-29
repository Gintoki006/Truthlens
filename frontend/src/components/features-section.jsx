'use client';
import { motion } from 'framer-motion';
import { ScrollReveal } from './animations';

export function FeaturesSection() {
  const features = [
    {
      title: 'AI-Powered NLP Analysis',
      body: 'Truthlens utilizes advanced Natural Language Processing to detect subtle linguistic manipulation. Our models are trained on over 50 years of verified investigative journalism to recognize the markers of inflammatory rhetoric, logical fallacies, and deceptive syntax.',
      link: 'Read Methodology',
      border:
        'border-b md:border-b-0 md:border-r-[0.5px] border-slate-400 dark:border-stone-700',
      bg: 'bg-white/90 dark:bg-stone-900/90',
    },
    {
      title: 'Source Credibility Check',
      body: 'Historical factual reporting matters. Every analysis cross-references the publisher\u0027s history of retractions, corrections, and verified reporting. We maintain a live ledger of global news outlets, weighting their scores based on institutional transparency.',
      link: 'Source Database',
      border:
        'border-b md:border-b-0 md:border-r-[0.5px] border-slate-400 dark:border-stone-700',
      bg: 'bg-stone-50/95 dark:bg-stone-800/95',
    },
    {
      title: 'Real-time Authenticity Scores',
      body: 'Our 0-100 scoring system provides an instant baseline for information quality.',
      link: null,
      border: '',
      bg: 'bg-white/90 dark:bg-stone-900/90',
    },
  ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-0 border-b-2 border-primary dark:border-stone-700">
      {features.map((card, i) => (
        <ScrollReveal
          key={i}
          delay={i * 0.15}
          className={`${card.border} ${card.bg} backdrop-blur-sm relative z-[60]`}
        >
          <motion.article
            whileHover={{ y: -5, backgroundColor: 'rgba(0,0,0,0.02)' }}
            className="p-8 md:p-12 lg:p-16 min-h-[420px] flex flex-col gap-4 h-full"
          >
            <h3 className="font-headline-sm text-headline-sm text-slate-900 dark:text-stone-100 hover:underline cursor-pointer">
              {card.title}
            </h3>
            <div className="editorial-rule-hairline w-12 dark:border-stone-500" />
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-stone-300">
              {card.body}
              {i === 2 && (
                <span className="block mt-4 p-4 border border-primary/10 dark:border-stone-700 bg-white dark:bg-stone-950 dark:text-stone-400 italic font-serif">
                  &quot;Numerical clarity in an era of qualitative confusion is
                  the first step toward restoration of trust.&quot;
                </span>
              )}
            </p>
            {card.link ? (
              <a
                className="font-label-caps text-label-caps text-secondary dark:text-stone-400 mt-auto inline-flex items-center gap-2 hover:text-slate-900 dark:hover:text-stone-200 transition-colors"
                href="#"
              >
                {card.link}{' '}
                <span className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </a>
            ) : (
              <div className="mt-auto flex items-center justify-between font-label-caps text-label-caps pt-4 border-t-[0.5px] border-slate-400 dark:border-stone-700 text-slate-900 dark:text-stone-100">
                <span>Live Updates</span>
                <span className="flex items-center gap-1 text-[#2e7d32] dark:text-[#4caf50]">
                  <span
                    className="material-symbols-outlined text-[14px]"
                    data-weight="fill"
                  >
                    check_circle
                  </span>{' '}
                  Verified
                </span>
              </div>
            )}
          </motion.article>
        </ScrollReveal>
      ))}
    </section>
  );
}
