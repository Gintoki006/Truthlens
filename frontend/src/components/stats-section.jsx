'use client';
import { Counter } from './animations';

export function StatsSection() {
  return (
    <section className="py-16 grid grid-cols-2 md:grid-cols-4 gap-8 border-b-[0.5px] border-slate-400 dark:border-stone-700">
      <Counter value="1.2M+" label="Articles Analyzed" />
      <Counter value="99.1%" label="Accuracy Rate" />
      <Counter value="1,200" label="Source Databases" />
      <Counter value="<2s" label="Avg. Response" />
    </section>
  );
}
