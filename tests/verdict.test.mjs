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

test('AC-3 uncoded dish is "no numbers", never clear', () => {
  assert.equal(judgeDish(parseDishLine('바나나'), new Set([11])).verdict, 'nonumbers');
  assert.equal(judgeDish(parseDishLine('바나나'), new Set()).verdict, 'nonumbers');
});

test('AC-4 malformed dish: contains wins, otherwise unreadable', () => {
  assert.equal(judgeDish(parseDishLine('특식 (2.25)'), new Set([2])).verdict, 'contains');
  assert.equal(judgeDish(parseDishLine('특식 (2.25)'), new Set([5])).verdict, 'unreadable');
});

test('R2 engineer finding: every reported false-clear line is now never clear', () => {
  const cases = [
    ['된장국(5.6)/요구르트2', 2], ['된장국(5.6)&우유2', 2], ['카레(5.6)/계란후라이1', 1], ['된장국(5.6)/요구르트 2', 2],
    ['국(5)(6) 우유 2', 2], ['달걀찜 (1.5) 6', 6], ['닭강정(15.6) 1', 1], ['우유2 (5)', 2], ['부대찌개1 (5.6)', 1],
    ['계란국(1.5)<6>', 6], ['된장국(5.6) 우유[2]', 2], ['된장국 (5.6) (1난류)', 1], ['떡(5.6)[2]', 2], ['된장국(5.6) 2', 2],
    ['치즈돈가스(1.2.5.6.10)13', 13], ['카레라이스(1.5.6)/요구르트2', 2],
  ];
  for (const [line, a] of cases) assert.notEqual(judgeDish(parseDishLine(line), new Set([a])).verdict, 'clear', `${line} / ${a}`);
});

test('property: appending a possible code N to any coded line never yields clear for a child avoiding N', () => {
  const bases = ['달걀찜 (1.5)', '된장국(5.6)', '배추김치 (9)', '닭강정 (5.6.13.15)'];
  for (const b of bases) for (let n = 1; n <= 19; n++) {
    for (const suffix of [`${n}`, ` ${n}`, `/요구르트${n}`, `[${n}]`, `<${n}>`, ` (${n}난류)`, `&우유${n}`]) {
      const v = judgeDish(parseDishLine(b + suffix), new Set([n])).verdict;
      assert.notEqual(v, 'clear', `${b + suffix} / ${n}`);
    }
  }
});

test('empty profile: coded dishes are clear', () => {
  assert.equal(judgeDish(parseDishLine('국 (5)'), new Set()).verdict, 'clear');
});

test('a number glued to a dish with no code group is ambiguous: amber for that allergen, grey otherwise', () => {
  assert.equal(judgeDish(parseDishLine('요구르트2'), new Set([2])).verdict, 'unreadable');
  assert.equal(judgeDish(parseDishLine('요구르트2'), new Set([1])).verdict, 'nonumbers');
});
