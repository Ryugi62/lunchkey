import { judgeDish } from '../domain/verdict.js';
import { glossDish } from '../domain/gloss.js';

/** @typedef {{allergens:number[], lang:string, name?:string}} ChildProfile */
/** @typedef {{date:string, mealType:string, mealName?:string, dishes:import('../domain/menu.js').DishLine[]}} Meal */

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Monday–Friday range around a date (YYYY-MM-DD). */
export function weekRange(dateIso) {
  const d = new Date(`${dateIso}T00:00:00Z`);
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
    const summary = { contains: 0, clear: 0, unlabeled: 0 };
    for (const d of dishes) summary[d.verdict] += 1;
    if (!byDate.has(meal.date)) byDate.set(meal.date, []);
    byDate.get(meal.date).push({ mealType: meal.mealType, mealName: meal.mealName, dishes, summary });
  }
  return { days: [...byDate.entries()].map(([date, ms]) => ({ date, meals: ms })) };
}
