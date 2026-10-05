import { summaryStatus } from './weekView.js';

/**
 * What the big card at the top of a meal says. Pure, so the UI's most important sentence is tested.
 * @param {{dishes: {matched:number[]}[], summary: {contains:number, clear:number, nonumbers:number, unreadable:number}}} meal
 * @returns {{tone:'no'|'warn'|'neutral'|'ok'|'none', count:number, matched:number[], maybe:number[], unnumbered:object[]}}
 */
export function headline(meal) {
  if (!meal || !meal.dishes.length) return { tone: 'none', count: 0, matched: [], maybe: [], unnumbered: [] };
  const status = summaryStatus(meal.summary);
  const matched = [...new Set(meal.dishes.flatMap((d) => d.matched))].sort((a, b) => a - b);
  const maybe = [...new Set(meal.dishes.flatMap((d) => d.maybe ?? []))].sort((a, b) => a - b);
  const unnumbered = meal.dishes.filter((d) => d.verdict === 'nonumbers');
  const base = { matched, maybe, unnumbered };
  if (status === 'contains') return { tone: 'no', count: meal.summary.contains, ...base };
  if (status === 'unknown') return { tone: 'warn', count: meal.summary.unreadable, ...base };
  if (status === 'nolisted') return { tone: 'neutral', count: meal.summary.nonumbers, ...base };
  if (status === 'clear') return { tone: 'ok', count: 0, ...base };
  return { tone: 'none', count: 0, ...base };
}
