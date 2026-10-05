import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeekView, weekRange, summaryStatus } from '../src/application/weekView.js';
import { parseDishLine } from '../src/domain/menu.js';

const meal = (date, lines) => ({ date, mealType: '2', dishes: lines.map(parseDishLine) });

test('UC-2 week view counts verdicts per meal', () => {
  const view = buildWeekView([meal('2026-10-05', ['쌀밥', '달걀찜 (1.5)', '우유 (2)'])], { allergens: [2], lang: 'en' });
  const m = view.days[0].meals[0];
  assert.equal(m.summary.contains, 1);
  assert.equal(m.summary.clear, 1);
  assert.equal(m.summary.nonumbers, 1);
  assert.equal(m.dishes[2].verdict, 'contains');
  assert.ok(m.dishes[1].gloss.text.length > 0);
});

test('weekRange gives Monday to Friday', () => {
  assert.deepEqual(weekRange('2026-10-07'), { from: '20261005', to: '20261009', monday: '2026-10-05' });
});

test('a day with only unnumbered dishes is never green (neutral "nolisted")', () => {
  const view = buildWeekView([meal('2026-10-05', ['쌀밥', '바나나', '수박'])], { allergens: [7], lang: 'en' });
  assert.equal(view.days[0].status, 'nolisted');
  assert.equal(view.days[0].meals[0].status, 'nolisted');
});

test('an unreadable dish turns the day amber', () => {
  const view = buildWeekView([meal('2026-10-05', ['된장국 (5.6)', '요구르트(2']) ], { allergens: [1], lang: 'en' });
  assert.equal(view.days[0].status, 'unknown');
});

test('summaryStatus: green only when every dish is coded and none match', () => {
  assert.equal(summaryStatus({ contains: 0, clear: 5, nonumbers: 0, unreadable: 0 }), 'clear');
  assert.equal(summaryStatus({ contains: 0, clear: 4, nonumbers: 1, unreadable: 0 }), 'nolisted');
  assert.equal(summaryStatus({ contains: 0, clear: 4, nonumbers: 1, unreadable: 1 }), 'unknown');
  assert.equal(summaryStatus({ contains: 1, clear: 0, nonumbers: 3, unreadable: 2 }), 'contains');
});

test('weekend looks ahead to the coming week', () => {
  assert.equal(weekRange('2026-10-10').monday, '2026-10-12');
  assert.equal(weekRange('2026-10-11').monday, '2026-10-12');
});

test('paste keeps a double-spaced line as one dish', async () => {
  const { buildPasteView } = await import('../src/application/pasteView.js');
  const v = buildPasteView('달걀찜  (1.5)\n우유 (2)', { allergens: [1], lang: 'en' });
  assert.equal(v.dishes.length, 2);
  assert.equal(v.dishes[0].verdict, 'contains');
});
