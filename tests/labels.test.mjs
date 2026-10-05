import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDishLine } from '../src/domain/menu.js';
import { judgeDish } from '../src/domain/verdict.js';

const { labels } = JSON.parse(readFileSync(new URL('../docs/audit-labels.json', import.meta.url)));

test('SPEC criterion 2: parser matches all hand-checked real menu lines', () => {
  const wrong = labels.filter((l) => JSON.stringify(parseDishLine(l.raw).codes) !== JSON.stringify(l.expectedCodes));
  assert.deepEqual(wrong.map((l) => l.raw), []);
});

test('SPEC criterion 2: zero false "clear" on the labeled set, for every single-allergen child', () => {
  for (let a = 1; a <= 19; a++) {
    for (const l of labels) {
      if (l.expectedCodes.includes(a)) assert.notEqual(judgeDish(parseDishLine(l.raw), new Set([a])).verdict, 'clear', `${l.raw} / ${a}`);
    }
  }
});
