import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNeisSource, NeisError } from '../src/adapters/neis.js';

const mealRow = (i) => ({
  SD_SCHUL_CODE: '9010047', SCHUL_NM: '마산고등학교', MMEAL_SC_CODE: '2', MMEAL_SC_NM: '중식',
  MLSV_YMD: `202609${String(i + 1).padStart(2, '0')}`, DDISH_NM: '쌀밥<br/>달걀찜 (1.5)<br/>바나나',
});

/** Mimics the REAL keyless NEIS: pIndex is ignored, only the first pSize (≤5) rows come back. With a key, paging works. */
function realisticFetch(rows, service = 'mealServiceDietInfo') {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const keyed = u.searchParams.has('KEY');
    const pSize = keyed ? Number(u.searchParams.get('pSize')) : 5;
    const pIndex = keyed ? Number(u.searchParams.get('pIndex')) : 1;
    const slice = rows.slice((pIndex - 1) * pSize, pIndex * pSize);
    const body = rows.length
      ? { [service]: [{ head: [{ list_total_count: rows.length }, { RESULT: { CODE: 'INFO-000' } }] }, { row: slice }] }
      : { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } };
    return { ok: true, status: 200, json: async () => body };
  };
  return { fn, calls };
}

test('AC-8 keyless: one call, first 5 rows, truncation is reported (never a silent repeat)', async () => {
  const { fn, calls } = realisticFetch(Array.from({ length: 12 }, (_, i) => mealRow(i)));
  const meals = await createNeisSource({ fetch: fn }).listMeals({ office: 'S10', school: '9010047', from: '20260901', to: '20260930' });
  assert.equal(calls.length, 1);
  assert.equal(meals.length, 5);
  assert.equal(meals.truncated, true);
  assert.equal(meals[0].date, '2026-09-01');
  assert.deepEqual(meals[0].dishes[1].codes, [1, 5]);
  assert.match(calls[0], /MMEAL_SC_CODE=2/);
});

test('AC-8 one week of lunch fits in one keyless page', async () => {
  const { fn } = realisticFetch(Array.from({ length: 5 }, (_, i) => mealRow(i)));
  const meals = await createNeisSource({ fetch: fn }).listMeals({ office: 'S10', school: '9010047', from: '20260901', to: '20260905' });
  assert.equal(meals.length, 5);
  assert.equal(meals.truncated, false);
});

test('with a key, pages until list_total_count', async () => {
  const { fn, calls } = realisticFetch(Array.from({ length: 12 }, (_, i) => mealRow(i)));
  const meals = await createNeisSource({ fetch: fn, key: 'abc' }).listMeals({ office: 'S10', school: '9010047', from: '20260901', to: '20260930' });
  assert.equal(meals.length, 12);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /KEY=abc/);
});

test('INFO-200 is the only empty answer', async () => {
  const { fn } = realisticFetch([]);
  assert.deepEqual([...(await createNeisSource({ fetch: fn }).listMeals({ office: 'S10', school: '1', from: '20260901', to: '20260902' }))], []);
});

test('other NEIS result codes are errors, not "no menu"', async () => {
  const fn = async () => ({ ok: true, status: 200, json: async () => ({ RESULT: { CODE: 'ERROR-337', MESSAGE: '일별 트래픽 제한을 넘은 호출입니다.' } }) });
  await assert.rejects(createNeisSource({ fetch: fn }).listMeals({ office: 'S10', school: '1', from: '1', to: '2' }), (e) => e instanceof NeisError && e.code === 'ERROR-337');
});

test('4xx is not retried; 5xx is retried', async () => {
  let n = 0;
  const f4 = async () => { n++; return { ok: false, status: 400, json: async () => ({}) }; };
  await assert.rejects(createNeisSource({ fetch: f4 }).listMeals({ office: 'S10', school: '1', from: '1', to: '2' }));
  assert.equal(n, 1);
  let m = 0;
  const f5 = async () => { m++; return m < 2 ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ RESULT: { CODE: 'INFO-200' } }) }; };
  assert.equal((await createNeisSource({ fetch: f5 }).listMeals({ office: 'S10', school: '1', from: '1', to: '2' })).length, 0);
  assert.equal(m, 2);
});

test('school search drops placeholder schools with blank codes and reports truncation', async () => {
  const rows = [
    { ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '       ', SCHUL_NM: '(가칭)서울초' },
    ...Array.from({ length: 6 }, (_, i) => ({ ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: `701000${i}`, SCHUL_NM: `서울${i}초등학교`, SCHUL_KND_SC_NM: '초등학교' })),
  ];
  const { fn } = realisticFetch(rows, 'schoolInfo');
  const r = await createNeisSource({ fetch: fn }).searchSchools({ name: '서울' });
  assert.equal(r.schools.length, 4);
  assert.equal(r.truncated, true);
  assert.ok(r.schools.every((s) => /^\d{7}$/.test(s.code)));
});
