import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeekView, weekRange } from '../src/application/weekView.js';
import { parseDishLine } from '../src/domain/menu.js';

const meal = (date, lines) => ({ date, mealType: '2', dishes: lines.map(parseDishLine) });

test('UC-2 week view counts verdicts per meal', () => {
  const view = buildWeekView([meal('2026-10-05', ['쌀밥', '달걀찜 (1.5)', '우유 (2)'])], { allergens: [2], lang: 'en' });
  const m = view.days[0].meals[0];
  assert.equal(m.summary.contains, 1);
  assert.equal(m.summary.clear, 1);
  assert.equal(m.summary.unlabeled, 1);
  assert.equal(m.dishes[2].verdict, 'contains');
  assert.ok(m.dishes[1].gloss.text.length > 0);
});

test('weekRange gives Monday to Friday', () => {
  assert.deepEqual(weekRange('2026-10-07'), { from: '20261005', to: '20261009', monday: '2026-10-05' });
});
