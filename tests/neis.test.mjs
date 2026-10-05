import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNeisSource } from '../src/adapters/neis.js';

function fakeFetch(total) {
  const calls = [];
  const rows = Array.from({ length: total }, (_, i) => ({
    SD_SCHUL_CODE: '9010047', SCHUL_NM: '마산고등학교', MMEAL_SC_CODE: '2', MMEAL_SC_NM: '중식',
    MLSV_YMD: `202609${String(i + 1).padStart(2, '0')}`, DDISH_NM: `쌀밥<br/>달걀찜 (1.5)<br/>바나나`,
  }));
  const fn = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const pIndex = Number(u.searchParams.get('pIndex'));
    const pSize = Number(u.searchParams.get('pSize'));
    const slice = rows.slice((pIndex - 1) * pSize, pIndex * pSize);
    const body = slice.length
      ? { mealServiceDietInfo: [{ head: [{ list_total_count: total }, { RESULT: { CODE: 'INFO-000' } }] }, { row: slice }] }
      : { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } };
    return { ok: true, status: 200, json: async () => body };
  };
  return { fn, calls };
}

test('AC-8 pages through keyless 5-row pages and maps to meals', async () => {
  const { fn, calls } = fakeFetch(12);
  const src = createNeisSource({ fetch: fn });
  const meals = await src.listMeals({ office: 'S10', school: '9010047', from: '20260901', to: '20260930', mealType: '2' });
  assert.equal(meals.length, 12);
  assert.equal(calls.length, 3);
  assert.equal(meals[0].date, '2026-09-01');
  assert.equal(meals[0].dishes.length, 3);
  assert.deepEqual(meals[0].dishes[1].codes, [1, 5]);
});

test('no data returns an empty list', async () => {
  const { fn } = fakeFetch(0);
  const src = createNeisSource({ fetch: fn });
  assert.deepEqual(await src.listMeals({ office: 'S10', school: '1', from: '20260901', to: '20260902' }), []);
});

test('uses the key and a large page when a key is given', async () => {
  const { fn, calls } = fakeFetch(12);
  const src = createNeisSource({ fetch: fn, key: 'abc' });
  await src.listMeals({ office: 'S10', school: '9010047', from: '20260901', to: '20260930' });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /KEY=abc/);
});
