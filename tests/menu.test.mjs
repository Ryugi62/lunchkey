import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDishLine, splitMenu } from '../src/domain/menu.js';

test('AC-1 parses the standard NEIS format', () => {
  const d = parseDishLine('새알심만두국 (1.2.5.6.9.10.15.16.18)');
  assert.equal(d.nameKo, '새알심만두국');
  assert.deepEqual(d.codes, [1, 2, 5, 6, 9, 10, 15, 16, 18]);
  assert.equal(d.parseStatus, 'coded');
});

test('AC-2 parses common variants the same way', () => {
  const cases = [
    ['달걀찜(1.5)', '달걀찜', [1, 5]],
    ['우유 2.', '우유', [2]],
    ['닭강정 ⑮⑥', '닭강정', [6, 15]],
    ['배추김치 (9)*', '배추김치', [9]],
    ['볶음밥1.5.6.10', '볶음밥', [1, 5, 6, 10]],
    ['요구르트(2.)', '요구르트', [2]],
    ['짜장면 (1, 5, 6, 10, 13)', '짜장면', [1, 5, 6, 10, 13]],
    ['*친환경쌀밥', '친환경쌀밥', []],
    ['훈제오리구이(5.6.13)@', '훈제오리구이', [5, 6, 13]],
  ];
  for (const [raw, name, codes] of cases) {
    const d = parseDishLine(raw);
    assert.equal(d.nameKo, name, raw);
    assert.deepEqual(d.codes, codes, raw);
  }
});

test('AC-3 a dish with no codes is uncoded', () => {
  const d = parseDishLine('바나나');
  assert.equal(d.parseStatus, 'uncoded');
  assert.deepEqual(d.codes, []);
});

test('AC-4 out-of-range codes are kept apart and mark the line malformed', () => {
  const d = parseDishLine('특식 (2.25)');
  assert.deepEqual(d.codes, [2]);
  assert.deepEqual(d.unknownCodes, [25]);
  assert.equal(d.parseStatus, 'malformed');
});

test('names with digits that are not codes stay intact', () => {
  const d = parseDishLine('3색나물 (5.13)');
  assert.equal(d.nameKo, '3색나물');
  assert.deepEqual(d.codes, [5, 13]);
});

test('AC-6 splits NEIS DDISH_NM on <br/>', () => {
  const lines = splitMenu('친환경쌀밥 <br/>새알심만두국 (1.2.5)<br/> <br/>바나나 ');
  assert.deepEqual(lines, ['친환경쌀밥', '새알심만두국 (1.2.5)', '바나나']);
});

test('duplicate codes are removed and sorted', () => {
  assert.deepEqual(parseDishLine('국 (5.1.5.2)').codes, [1, 2, 5]);
});

test('variant tags glued to the name are not codes (audit finding)', () => {
  const a = parseDishLine('호박죽-1 (13)');
  assert.equal(a.nameKo, '호박죽'); assert.deepEqual(a.codes, [13]);
  const b = parseDishLine('부대찌개1 (1.2.5.6.9.10.15.16)');
  assert.equal(b.nameKo, '부대찌개'); assert.deepEqual(b.codes, [1, 2, 5, 6, 9, 10, 15, 16]);
  const c = parseDishLine('친환경현미밥.');
  assert.equal(c.nameKo, '친환경현미밥'); assert.equal(c.parseStatus, 'uncoded');
});

test('hand-check finding: "공통양념-2" is a variant tag, not milk', () => {
  const d = parseDishLine('공통양념-2');
  assert.equal(d.nameKo, '공통양념');
  assert.equal(d.parseStatus, 'uncoded');
  assert.equal(parseDishLine('파김치-1(자율) (9)').nameKo, '파김치(자율)');
});

test('R1 engineer finding: odd separators and multi-dish lines are read fully or never cleared', async () => {
  const { judgeDish } = await import('../src/domain/verdict.js');
  const egg = new Set([1]);
  const lines = ['달걀찜 (1 5 6)', '달걀찜 (1/5/6)', '달걀찜 (1·5·6)', '스크램블에그 (1..5)', '카레라이스(1.2.5.6)/요구르트(2)', '계란말이(1.5)&김(5)', '달걀(1.)(5.)'];
  for (const l of lines) {
    const d = parseDishLine(l);
    assert.notEqual(judgeDish(d, egg).verdict, 'clear', l);
    assert.ok(d.codes.includes(1), l);
  }
  assert.equal(parseDishLine('카레라이스(1.2.5.6)/요구르트(2)').nameKo, '카레라이스/요구르트');
});

test('digits that belong to the name are kept', () => {
  assert.equal(parseDishLine('비타500 (2)').nameKo, '비타500');
  assert.equal(parseDishLine('요플레100').nameKo, '요플레100');
  assert.equal(parseDishLine('15혼합곡밥 (5)').nameKo, '15혼합곡밥');
});

test('an unclosed bracket with digits is malformed, never clear', () => {
  assert.equal(parseDishLine('달걀찜 (1.5) (2').parseStatus, 'malformed');
  assert.deepEqual(parseDishLine('달걀찜 (1.5').codes, [1, 5]); // fully readable even without ")"
});

test('audit finding: portion notes are not codes', () => {
  const a = parseDishLine('배추김치(20kg) (9)');
  assert.equal(a.nameKo, '배추김치'); assert.deepEqual(a.codes, [9]); assert.equal(a.parseStatus, 'coded');
  const b = parseDishLine('김치전(30g*3개) (1.2.5.6.12.15.16)');
  assert.equal(b.nameKo, '김치전'); assert.deepEqual(b.codes, [1, 2, 5, 6, 12, 15, 16]);
  const c = parseDishLine('바나나1/2');
  assert.equal(c.nameKo, '바나나'); assert.equal(c.parseStatus, 'uncoded');
});

test('audit finding: number-led notes are not codes', () => {
  assert.deepEqual(parseDishLine('총각김치(25초등) (9)').codes, [9]);
  assert.equal(parseDishLine('총각김치(25초등) (9)').parseStatus, 'coded');
  assert.equal(parseDishLine('아삭모둠피클(4색)').parseStatus, 'uncoded');
  assert.deepEqual(parseDishLine('갈릭연어스테이크(70) (2.5.6.12.13.16)').codes, [2, 5, 6, 12, 13, 16]);
  assert.equal(parseDishLine('압맥보리밥(80)').parseStatus, 'uncoded');
  assert.deepEqual(parseDishLine('우유 (2)').codes, [2]);
});

test('glued numbers before a code group: 20+ is a portion, 1–19 is ambiguous', () => {
  const a = parseDishLine('요구르트80* (2)');
  assert.equal(a.nameKo, '요구르트'); assert.deepEqual(a.codes, [2]); assert.equal(a.parseStatus, 'coded');
  const b = parseDishLine('자장면14 (1.2.5.6.10.13)');
  assert.equal(b.parseStatus, 'coded'); assert.deepEqual(b.ambiguousCodes, [14]);
});
