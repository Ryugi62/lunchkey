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
