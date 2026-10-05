import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headline } from '../src/application/headline.js';
import { buildWeekView } from '../src/application/weekView.js';
import { parseDishLine } from '../src/domain/menu.js';

const m = (lines, allergens) => buildWeekView([{ date: '2026-10-05', mealType: '2', dishes: lines.map(parseDishLine) }], { allergens, lang: 'en' }).days[0].meals[0];

test('headline: contains wins and names the matched allergens', () => {
  assert.deepEqual(headline(m(['우유 (2)', '달걀찜 (1.5)', '쌀밥'], [1, 2])), { tone: 'no', count: 2, matched: [1, 2] });
});
test('headline: unreadable → amber, never green', () => {
  assert.equal(headline(m(['된장국 (5.6)', '요구르트(2'], [1])).tone, 'warn');
});
test('headline: only unnumbered staples left → neutral, not green', () => {
  assert.deepEqual(headline(m(['쌀밥', '된장국 (5.6)'], [1])), { tone: 'neutral', count: 1, matched: [] });
});
test('headline: green only when every dish is numbered and none match', () => {
  assert.equal(headline(m(['된장국 (5.6)', '배추김치 (9)'], [1])).tone, 'ok');
});
test('headline: an empty menu is "none", not "0 not labeled"', () => {
  assert.equal(headline({ dishes: [], summary: { contains: 0, clear: 0, nonumbers: 0, unreadable: 0 } }).tone, 'none');
});
