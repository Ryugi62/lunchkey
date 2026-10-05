import { parseDishLine, splitMenu } from '../domain/menu.js';
import { buildWeekView } from './weekView.js';

/** UC-3: judge a pasted menu (one dish per line or NEIS-style <br/>). */
export function buildPasteView(text, profile) {
  const lines = splitMenu(String(text).replace(/\r/g, '')).flatMap((l) => l.split(/\s{2,}|\t/)).filter(Boolean);
  const meal = { date: 'pasted', mealType: '0', dishes: lines.map(parseDishLine) };
  return buildWeekView([meal], profile).days[0]?.meals[0] ?? { dishes: [], summary: { contains: 0, clear: 0, unlabeled: 0 } };
}
