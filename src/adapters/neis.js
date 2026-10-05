import { parseDishLine, splitMenu } from '../domain/menu.js';

const BASE = 'https://open.neis.go.kr/hub';

/** The 17 provincial education offices (NEIS ATPT_OFCDC_SC_CODE). */
export const OFFICES = [
  ['B10', 'Seoul', '서울'], ['C10', 'Busan', '부산'], ['D10', 'Daegu', '대구'], ['E10', 'Incheon', '인천'], ['F10', 'Gwangju', '광주'],
  ['G10', 'Daejeon', '대전'], ['H10', 'Ulsan', '울산'], ['I10', 'Sejong', '세종'], ['J10', 'Gyeonggi', '경기'], ['K10', 'Gangwon', '강원'],
  ['M10', 'Chungbuk', '충북'], ['N10', 'Chungnam', '충남'], ['P10', 'Jeonbuk', '전북'], ['Q10', 'Jeonnam', '전남'], ['R10', 'Gyeongbuk', '경북'],
  ['S10', 'Gyeongnam', '경남'], ['T10', 'Jeju', '제주'],
].map(([code, en, ko]) => ({ code, en, ko }));

export class NeisError extends Error {
  constructor(code, message) { super(`NEIS ${code}: ${message}`); this.code = code; }
}

/**
 * NEIS Open API adapter (Korean Ministry of Education).
 * Measured 2026-10-06: without a key the API returns only the FIRST 5 rows and ignores pIndex.
 * So keyless callers must ask narrow questions (one school, one week, lunch only = at most 5 rows).
 * With a key, pages of 1000 rows are fetched until list_total_count.
 * @param {{fetch: typeof fetch, key?: string, base?: string}} deps
 */
export function createNeisSource({ fetch: doFetch, key, base = BASE }) {
  const pSize = key ? 1000 : 5;

  async function getPage(service, params, pIndex) {
    const u = new URL(`${base}/${service}`);
    u.searchParams.set('Type', 'json');
    u.searchParams.set('pIndex', String(pIndex));
    u.searchParams.set('pSize', String(pSize));
    if (key) u.searchParams.set('KEY', key);
    for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, String(v));
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      let res;
      try {
        res = await doFetch(u.toString());
      } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 300 * (attempt + 1))); continue; } // network: retry
      if (res.status >= 500) { lastErr = new NeisError(`HTTP-${res.status}`, 'server error'); await new Promise((r) => setTimeout(r, 300 * (attempt + 1))); continue; }
      if (!res.ok) throw new NeisError(`HTTP-${res.status}`, 'request rejected');
      const body = await res.json();
      const block = body[service];
      if (block) return { total: Number(block[0].head[0].list_total_count), rows: block[1]?.row ?? [] };
      const code = body.RESULT?.CODE ?? 'UNKNOWN';
      if (code === 'INFO-200') return { total: 0, rows: [] }; // the only "no data" answer
      throw new NeisError(code, body.RESULT?.MESSAGE ?? 'unexpected response');
    }
    throw lastErr;
  }

  async function getAll(service, params, limit = Infinity) {
    const first = await getPage(service, params, 1);
    const rows = [...first.rows];
    if (key) {
      const pages = Math.ceil(Math.min(first.total, limit) / pSize);
      for (let p = 2; p <= pages; p++) rows.push(...(await getPage(service, params, p)).rows);
    }
    return { rows, total: first.total, truncated: rows.length < Math.min(first.total, limit) };
  }

  return {
    keyless: !key,
    /**
     * One school's meals for a date range. Keyless: ask for one week of one meal type (≤ 5 rows).
     * @returns {Promise<import('../application/weekView.js').Meal[] & {truncated?: boolean}>}
     */
    async listMeals({ office, school, from, to, mealType = '2' }) {
      const { rows, truncated } = await getAll('mealServiceDietInfo', {
        ATPT_OFCDC_SC_CODE: office, SD_SCHUL_CODE: school, MLSV_FROM_YMD: from, MLSV_TO_YMD: to, MMEAL_SC_CODE: mealType,
      });
      const seen = new Set();
      const meals = rows.filter((r) => { const k = `${r.SD_SCHUL_CODE}:${r.MLSV_YMD}:${r.MMEAL_SC_CODE}`; if (seen.has(k)) return false; seen.add(k); return true; })
        .map((r) => ({
          schoolCode: r.SD_SCHUL_CODE,
          date: `${r.MLSV_YMD.slice(0, 4)}-${r.MLSV_YMD.slice(4, 6)}-${r.MLSV_YMD.slice(6, 8)}`,
          mealType: String(r.MMEAL_SC_CODE),
          mealName: r.MMEAL_SC_NM,
          dishes: splitMenu(r.DDISH_NM).map(parseDishLine),
        }));
      meals.truncated = truncated;
      return meals;
    },
    /** Search schools by (Korean) name, optionally within one provincial office. */
    async searchSchools({ name, office, limit = 20 }) {
      const { rows, total, truncated } = await getAll('schoolInfo', { SCHUL_NM: name, ATPT_OFCDC_SC_CODE: office }, limit);
      const schools = rows.filter((r) => /^\d{7}$/.test(String(r.SD_SCHUL_CODE).trim())).slice(0, limit).map((r) => ({
        office: r.ATPT_OFCDC_SC_CODE, officeName: r.ATPT_OFCDC_SC_NM, code: r.SD_SCHUL_CODE,
        name: r.SCHUL_NM, nameEn: r.ENG_SCHUL_NM, kind: r.SCHUL_KND_SC_NM, address: r.ORG_RDNMA,
      }));
      return { schools, total, truncated };
    },
  };
}
