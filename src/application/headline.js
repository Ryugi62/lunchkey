import { summaryStatus } from './weekView.js';

/**
 * What the big card at the top of a meal says. Pure, so the UI's most important sentence is tested.
 * @param {{dishes: {matched:number[]}[], summary: {contains:number, clear:number, nonumbers:number, unreadable:number}}} meal
 * @returns {{tone:'no'|'warn'|'neutral'|'ok'|'none', count:number, matched:number[]}}
 */
export function headline(meal) {
  if (!meal || !meal.dishes.length) return { tone: 'none', count: 0, matched: [] };
  const status = summaryStatus(meal.summary);
  const matched = [...new Set(meal.dishes.flatMap((d) => d.matched))].sort((a, b) => a - b);
  if (status === 'contains') return { tone: 'no', count: meal.summary.contains, matched };
  if (status === 'unknown') return { tone: 'warn', count: meal.summary.unreadable, matched };
  if (status === 'nolisted') return { tone: 'neutral', count: meal.summary.nonumbers, matched };
  if (status === 'clear') return { tone: 'ok', count: 0, matched };
  return { tone: 'none', count: 0, matched };
}
