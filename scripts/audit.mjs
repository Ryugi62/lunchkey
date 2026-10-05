// UC-6: national audit of the parser and glossary on real NEIS menus.
// Keyless NEIS returns only the first 5 rows and ignores pIndex (measured 2026-10-06), so the audit asks narrow questions:
// distinct schools are found with many short name queries per office, and menus are read one school-week of lunches at a time (≤ 5 rows).
// Usage: node scripts/audit.mjs [schoolsPerOffice=10] [firstMonday=2026-08-31] [weeks=5]
import { writeFileSync, mkdirSync } from 'node:fs';
import { createNeisSource, OFFICES } from '../src/adapters/neis.js';
import { glossDish } from '../src/domain/gloss.js';
import { weekRange } from '../src/application/weekView.js';

const [perOffice = 10, firstMonday = '2026-08-31', weeks = 5] = process.argv.slice(2);
const KEYS = ['중앙', '동', '서', '남', '북', '신', '대', '산', '성', '해', '평', '광', '명', '용', '봉', '천', '화', '양', '덕', '월'];
const neis = createNeisSource({ fetch });
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

async function pickSchools(office) {
  const byCode = new Map();
  for (const k of KEYS) {
    if (byCode.size >= Number(perOffice)) break;
    try {
      const { schools } = await neis.searchSchools({ name: k, office: office.code, limit: 5 });
      for (const s of schools) if (/초등|중학|고등/.test(s.kind) && !byCode.has(s.code)) byCode.set(s.code, s);
    } catch { /* skip this key */ }
  }
  return [...byCode.values()].slice(0, Number(perOffice)).map((s) => ({ office: office.code, code: s.code, name: s.name, kind: s.kind }));
}

const t0 = Date.now();
const schools = (await pool(OFFICES, 4, pickSchools)).flat();
const distinct = new Set(schools.map((s) => s.code)).size;
const mondays = Array.from({ length: Number(weeks) }, (_, i) => addDays(firstMonday, 7 * i));
const jobs = schools.flatMap((s) => mondays.map((m) => ({ s, m })));
let errors = 0;
const fetched = await pool(jobs, 4, async ({ s, m }) => {
  const r = weekRange(m);
  try { return { s, meals: [...(await neis.listMeals({ office: s.office, school: s.code, from: r.from, to: r.to, mealType: '2' }))] }; }
  catch { errors++; return { s, meals: [] }; }
});

const seen = new Set();
const stat = { lines: 0, coded: 0, uncoded: 0, malformed: 0, uncodedWithDigits: 0, variantTags: 0, glossFull: 0, glossPartial: 0, glossNone: 0 };
const malformed = [], uncodedDigits = [], unglossed = new Map(), all = [];
const schoolsWithMeals = new Set(), officesWithMeals = new Set();
let mealsN = 0;
for (const { s, meals } of fetched) {
  for (const m of meals) {
    const k = `${s.code}:${m.date}`;
    if (seen.has(k)) continue; // never count the same school-day twice
    seen.add(k); mealsN++; schoolsWithMeals.add(s.code); officesWithMeals.add(s.office);
    for (const d of m.dishes) {
      stat.lines++; stat[d.parseStatus]++; all.push(d);
      if (/-\d{1,2}(?=[\s(]|$)/.test(d.raw)) stat.variantTags++;
      // Non-circular check: digits anywhere in the RAW line (minus variant tags and digits kept in the name) but no code read.
      const digitsOutsideName = d.raw.replace(/-\d{1,2}(?=[\s(]|$)/g, '').replace(/\(\s*[\d.]+\s*(?:g|kg|ml|l|개|ea|인분|조각|%)[^)]*\)|\d\/\d\s*$/gi, '').replace(d.nameKo, '');
      if (d.parseStatus === 'uncoded' && /\d|[①-⑳]/.test(digitsOutsideName)) { stat.uncodedWithDigits++; if (uncodedDigits.length < 30) uncodedDigits.push(d.raw); }
      if (d.parseStatus === 'malformed' && malformed.length < 30) malformed.push(d.raw);
      const g = glossDish(d.nameKo, 'en');
      stat[g.status === 'full' ? 'glossFull' : g.status === 'partial' ? 'glossPartial' : 'glossNone']++;
      if (g.status !== 'full') for (const p of g.parts.filter((x) => !x.known)) unglossed.set(p.ko, (unglossed.get(p.ko) ?? 0) + 1);
    }
  }
}
const pct = (a, b) => (b ? Math.round((a / b) * 10000) / 100 : null);
const summary = {
  measuredAt: new Date().toISOString(), lunchesFrom: firstMonday, weeks: Number(weeks),
  offices: OFFICES.length, officesWithMeals: officesWithMeals.size, schoolsSampled: schools.length, distinctSchools: distinct, schoolsWithMeals: schoolsWithMeals.size,
  lunches: mealsN, dishLines: stat.lines,
  statusShare: { coded: pct(stat.coded, stat.lines), uncoded: pct(stat.uncoded, stat.lines), malformed: pct(stat.malformed, stat.lines) },
  uncodedLinesWithDigits: stat.uncodedWithDigits, variantTagLines: stat.variantTags,
  glossShare: { full: pct(stat.glossFull, stat.lines), partial: pct(stat.glossPartial, stat.lines), none: pct(stat.glossNone, stat.lines) },
  errors, seconds: Math.round((Date.now() - t0) / 1000),
};
mkdirSync('docs', { recursive: true });
const step = Math.max(1, Math.floor(all.length / 150));
const sample = all.filter((_, i) => i % step === 0).slice(0, 150).map((d) => ({ raw: d.raw, nameKo: d.nameKo, codes: d.codes, status: d.parseStatus }));
writeFileSync('docs/audit-sample.json', JSON.stringify(sample, null, 1));
writeFileSync('docs/audit.json', JSON.stringify({ summary, malformedExamples: malformed, uncodedWithDigitsExamples: uncodedDigits, topUnglossed: [...unglossed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80), schools }, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (distinct < Number(perOffice) * OFFICES.length * 0.85) { console.error(`too few distinct schools: ${distinct}`); process.exit(1); }
