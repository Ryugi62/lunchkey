import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDishLine } from '../src/domain/menu.js';
import { judgeDish } from '../src/domain/verdict.js';

test('AC-5 clear when coded and no match', () => {
  const v = judgeDish(parseDishLine('달걀찜 (1.5)'), new Set([2]));
  assert.equal(v.verdict, 'clear');
  assert.deepEqual(v.matched, []);
});

test('AC-5 contains when a code matches', () => {
  const v = judgeDish(parseDishLine('수제비 (2.6)'), new Set([2]));
  assert.equal(v.verdict, 'contains');
  assert.deepEqual(v.matched, [2]);
});

test('AC-3 uncoded dish is unlabeled, never clear', () => {
  assert.equal(judgeDish(parseDishLine('바나나'), new Set([11])).verdict, 'unlabeled');
  assert.equal(judgeDish(parseDishLine('바나나'), new Set()).verdict, 'unlabeled');
});

test('AC-4 malformed dish: contains wins, otherwise unlabeled', () => {
  assert.equal(judgeDish(parseDishLine('특식 (2.25)'), new Set([2])).verdict, 'contains');
  assert.equal(judgeDish(parseDishLine('특식 (2.25)'), new Set([5])).verdict, 'unlabeled');
});

test('empty profile: coded dishes are clear', () => {
  assert.equal(judgeDish(parseDishLine('국 (5)'), new Set()).verdict, 'clear');
});
