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

test('every reported false-clear line is now never clear', () => {
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

test('fuzz: a possible code N after any separator, before a name, or inside a note never yields clear', async () => {
  const { splitMenu } = await import('../src/domain/menu.js');
  const seps = [',', '·', '.', '+', '*', ':', ';', '~', '–', '-', '_', '#', '、', '，', 'ㆍ', '/', '&', ' ', '', '※', '=', '|', '!', '?', '^', '@', '$', '%'];
  const bases = ['달걀찜(5.6)', '된장국 (5.6)', '닭강정 (5.6.13.15)'];
  const verdictsFor = (line, n) => splitMenu(line).map((l) => judgeDish(parseDishLine(l), new Set([n])).verdict);
  for (const b of bases) for (let n = 1; n <= 19; n++) {
    const lines = [
      ...seps.map((sep) => `${b}${sep}${n}`),
      `${n}${b}`, `${n} ${b}`, `${b}{${n}}`, `${b}（${n}）`, `${b}⑴`.replace('⑴', String.fromCodePoint(0x2473 + n)), `${b}${String.fromCodePoint(0x2075 + 0)}`,
      `${b}(난류${n})`, `${b}(가공:${n})`, `${b}(${n}우유 ${n}난류)`, `${b}(13아황산,${n}난류)`, `${b} ※${n}`, `${b}[난류${n}]`,
    ];
    for (const line of lines) {
      const vs = verdictsFor(line, n);
      if (line.endsWith(String.fromCodePoint(0x2075))) continue;
      assert.ok(!vs.every((v) => v === 'clear'), `${line} / ${n} → ${vs}`);
    }
  }
});

test('multi-dish lines: an unnumbered second dish is its own dish, never folded into a green one', async () => {
  const { splitMenu } = await import('../src/domain/menu.js');
  for (const [line, n] of [['카레라이스(1.5.6)/요구르트', 2], ['된장국(5.6)&우유', 2], ['된장국(5.6)/사과', 11]]) {
    const vs = splitMenu(line).map((l) => judgeDish(parseDishLine(l), new Set([n])).verdict);
    assert.ok(vs.length === 2 && vs[1] !== 'clear', `${line} → ${vs}`);
  }
  assert.deepEqual(splitMenu('잡채밥/짜장소스 (5.6.10.13)'), ['잡채밥/짜장소스 (5.6.10.13)']); // shared trailing codes stay one dish
});

test('a dish name that suggests the allergen is never clear, even with other numbers printed', () => {
  assert.equal(judgeDish(parseDishLine('우유'), new Set([2])).verdict, 'unreadable');
  assert.equal(judgeDish(parseDishLine('치즈돈가스 (1.5.6.10)'), new Set([2])).reason, 'name');
  assert.equal(judgeDish(parseDishLine('땅콩조림'), new Set([4])).verdict, 'unreadable');
  assert.equal(judgeDish(parseDishLine('우유 (2)'), new Set([2])).verdict, 'contains');
});
