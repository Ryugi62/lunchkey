import { parseDishLine, splitMenu } from '../domain/menu.js';

const BASE = 'https://open.neis.go.kr/hub';

/**
 * NEIS Open API adapter (Korean Ministry of Education). Keyless calls return at most 5 rows per page.
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
      try {
        const res = await doFetch(u.toString());
        if (!res.ok) throw new Error(`NEIS HTTP ${res.status}`);
        const body = await res.json();
        const block = body[service];
        if (!block) return { total: 0, rows: [] }; // INFO-200: no data
        const total = Number(block[0].head[0].list_total_count);
        return { total, rows: block[1]?.row ?? [] };
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    throw lastErr;
  }

  async function getAll(service, params, limit = Infinity) {
    const first = await getPage(service, params, 1);
    const rows = [...first.rows];
    const pages = Math.ceil(Math.min(first.total, limit) / pSize);
    for (let p = 2; p <= pages; p++) rows.push(...(await getPage(service, params, p)).rows);
    return rows;
  }

  return {
    /** @returns {Promise<import('../application/weekView.js').Meal[]>} */
    async listMeals({ office, school, from, to, mealType }) {
      const rows = await getAll('mealServiceDietInfo', {
        ATPT_OFCDC_SC_CODE: office, SD_SCHUL_CODE: school, MLSV_FROM_YMD: from, MLSV_TO_YMD: to, MMEAL_SC_CODE: mealType,
      });
      return rows.map((r) => ({
        schoolCode: r.SD_SCHUL_CODE,
        date: `${r.MLSV_YMD.slice(0, 4)}-${r.MLSV_YMD.slice(4, 6)}-${r.MLSV_YMD.slice(6, 8)}`,
        mealType: String(r.MMEAL_SC_CODE),
        mealName: r.MMEAL_SC_NM,
        dishes: splitMenu(r.DDISH_NM).map(parseDishLine),
      }));
    },
    /** Search schools by (Korean) name. */
    async searchSchools({ name, office, limit = 20 }) {
      const rows = await getAll('schoolInfo', { SCHUL_NM: name, ATPT_OFCDC_SC_CODE: office }, limit);
      return rows.slice(0, limit).map((r) => ({
        office: r.ATPT_OFCDC_SC_CODE, officeName: r.ATPT_OFCDC_SC_NM, code: r.SD_SCHUL_CODE,
        name: r.SCHUL_NM, nameEn: r.ENG_SCHUL_NM, kind: r.SCHUL_KND_SC_NM, address: r.ORG_RDNMA,
      }));
    },
  };
}
