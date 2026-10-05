import { judgeDish } from '../domain/verdict.js';
import { glossDish } from '../domain/gloss.js';

/** @typedef {{allergens:number[], lang:string, name?:string}} ChildProfile */
/** @typedef {{date:string, mealType:string, mealName?:string, dishes:import('../domain/menu.js').DishLine[]}} Meal */

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * Summary status for a meal or a day. Green only with evidence:
 * contains = any dish matches · unknown = something code-like could not be read (amber)
 * nolisted = no match, but some dishes have no numbers printed (neutral, not green) · clear = every dish coded, none match.
 * @param {{contains:number, clear:number, nonumbers:number, unreadable:number}} summary
 * @returns {'contains'|'unknown'|'nolisted'|'clear'|'empty'}
 */
export function summaryStatus(summary) {
  if (summary.contains) return 'contains';
  if (summary.unreadable) return 'unknown';
  if (summary.nonumbers) return 'nolisted';
  if (summary.clear) return 'clear';
  return 'empty';
}

const zero = () => ({ contains: 0, clear: 0, nonumbers: 0, unreadable: 0 });

/** Monday–Friday range for a date (YYYY-MM-DD). Saturday and Sunday look ahead to the coming week. */
export function weekRange(dateIso) {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const wd = d.getUTCDay();
  if (wd === 6) d.setUTCDate(d.getUTCDate() + 2);
  if (wd === 0) d.setUTCDate(d.getUTCDate() + 1);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - dow);
  const fri = new Date(mon); fri.setUTCDate(mon.getUTCDate() + 4);
  return { from: ymd(mon), to: ymd(fri), monday: iso(mon) };
}

/**
 * Judge every dish of every meal for one child, grouped by day.
 * @param {Meal[]} meals
 * @param {ChildProfile} profile
 */
export function buildWeekView(meals, profile) {
  const avoid = new Set(profile.allergens);
  const byDate = new Map();
  for (const meal of [...meals].sort((a, b) => (a.date + a.mealType).localeCompare(b.date + b.mealType))) {
    const dishes = meal.dishes.map((d) => ({ ...d, ...judgeDish(d, avoid), gloss: glossDish(d.nameKo, profile.lang) }));
    const summary = zero();
    for (const d of dishes) summary[d.verdict] += 1;
    if (!byDate.has(meal.date)) byDate.set(meal.date, []);
    byDate.get(meal.date).push({ mealType: meal.mealType, mealName: meal.mealName, dishes, summary, status: summaryStatus(summary) });
  }
  return {
    days: [...byDate.entries()].map(([date, ms]) => {
      const total = ms.reduce((a, m) => { for (const k of Object.keys(a)) a[k] += m.summary[k]; return a; }, zero());
      return { date, meals: ms, summary: total, status: summaryStatus(total) };
    }),
  };
}
