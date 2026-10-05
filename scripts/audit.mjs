// UC-6: national audit of the parser and glossary on real NEIS menus (keyless API, polite).
// Usage: node scripts/audit.mjs [schoolsPerOffice=10] [from=20260901] [to=20260930]
import { writeFileSync, mkdirSync } from 'node:fs';
import { createNeisSource } from '../src/adapters/neis.js';
import { glossDish } from '../src/domain/gloss.js';

const OFFICES = ['B10', 'C10', 'D10', 'E10', 'F10', 'G10', 'H10', 'I10', 'J10', 'K10', 'M10', 'N10', 'P10', 'Q10', 'R10', 'S10', 'T10'];
const [perOffice = 10, from = '20260901', to = '20260930'] = process.argv.slice(2);
const neis = createNeisSource({ fetch });

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

async function pickSchools(office) {
  // Spread picks across the office's list: read the total, then sample evenly spaced 5-row pages.
  const u = new URL('https://open.neis.go.kr/hub/schoolInfo');
  Object.entries({ Type: 'json', pIndex: 1, pSize: 5, ATPT_OFCDC_SC_CODE: office }).forEach(([k, v]) => u.searchParams.set(k, v));
  const first = await (await fetch(u)).json();
  const total = Number(first.schoolInfo[0].head[0].list_total_count);
  const pages = Math.ceil(total / 5);
  const want = Number(perOffice);
  const idx = Array.from({ length: want }, (_, k) => 1 + Math.floor((k * pages) / want));
  const picks = [];
  for (const p of idx) {
    u.searchParams.set('pIndex', String(p));
    const j = await (await fetch(u)).json();
    const rows = j.schoolInfo?.[1]?.row ?? [];
    const r = rows.find((x) => /초등|중학|고등/.test(x.SCHUL_KND_SC_NM)) ?? rows[0];
    if (r) picks.push({ office, code: r.SD_SCHUL_CODE, name: r.SCHUL_NM, kind: r.SCHUL_KND_SC_NM });
  }
  return picks;
}

const t0 = Date.now();
const schools = (await pool(OFFICES, 4, pickSchools)).flat();
const results = await pool(schools, 4, async (s) => {
  try { return { s, meals: await neis.listMeals({ office: s.office, school: s.code, from, to, mealType: '2' }) }; }
  catch (e) { return { s, meals: [], error: String(e) }; }
});

const stat = { lines: 0, coded: 0, uncoded: 0, malformed: 0, codeLike: 0, codeLikeParsed: 0, residualDigits: 0, glossFull: 0, glossPartial: 0, glossNone: 0 };
const malformed = [], residual = [], unglossed = new Map(), all = [];
let mealsN = 0, schoolsWithMeals = 0;
for (const { meals } of results) {
  if (meals.length) schoolsWithMeals++;
  for (const m of meals) {
    mealsN++;
    for (const d of m.dishes) {
      stat.lines++; stat[d.parseStatus]++; all.push(d);
      // Variant tags like 호박죽-1 / 공통양념-2 are menu numbering, not allergen codes.
      const stripped = d.raw.replace(/-\d{1,2}(?=\(|\s|$)/g, '');
      if (stripped !== d.raw) stat.variantTags = (stat.variantTags ?? 0) + 1;
      const codeLike = /\d|[①-⑳]/.test(stripped.replace(d.nameKo, ''));
      if (codeLike) { stat.codeLike++; if (d.parseStatus === 'coded') stat.codeLikeParsed++; }
      if (d.parseStatus === 'malformed' && malformed.length < 30) malformed.push(d.raw);
      if (/[\d.]\s*$/.test(d.nameKo)) { stat.residualDigits++; if (residual.length < 30) residual.push(d.raw); }
      const g = glossDish(d.nameKo, 'en');
      stat[g.status === 'full' ? 'glossFull' : g.status === 'partial' ? 'glossPartial' : 'glossNone']++;
      if (g.status !== 'full') for (const p of g.parts.filter((x) => !x.known)) unglossed.set(p.ko, (unglossed.get(p.ko) ?? 0) + 1);
    }
  }
}
const pct = (a, b) => (b ? Math.round((a / b) * 10000) / 100 : null);
const summary = {
  measuredAt: new Date().toISOString(), range: { from, to, mealType: 'lunch' },
  offices: OFFICES.length, schoolsSampled: schools.length, schoolsWithMeals, meals: mealsN, dishLines: stat.lines,
  parseRateOfCodeLikeLines: pct(stat.codeLikeParsed, stat.codeLike),
  statusShare: { coded: pct(stat.coded, stat.lines), uncoded: pct(stat.uncoded, stat.lines), malformed: pct(stat.malformed, stat.lines) },
  residualDigitLines: stat.residualDigits, variantTagLines: stat.variantTags ?? 0,
  glossShare: { full: pct(stat.glossFull, stat.lines), partial: pct(stat.glossPartial, stat.lines), none: pct(stat.glossNone, stat.lines), fullOrPartial: pct(stat.glossFull + stat.glossPartial, stat.lines) },
  errors: results.filter((r) => r.error).length, seconds: Math.round((Date.now() - t0) / 1000),
};
mkdirSync('docs', { recursive: true });
// Deterministic sample of 120 lines for hand checking (every k-th line).
const step = Math.max(1, Math.floor(all.length / 120));
const sample = all.filter((_, i) => i % step === 0).slice(0, 120).map((d) => ({ raw: d.raw, nameKo: d.nameKo, codes: d.codes, status: d.parseStatus }));
writeFileSync('docs/audit-sample.json', JSON.stringify(sample, null, 1));
writeFileSync('docs/audit.json', JSON.stringify({ summary, malformedExamples: malformed, residualExamples: residual, topUnglossed: [...unglossed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80), schools }, null, 2));
console.log(JSON.stringify(summary, null, 2));
