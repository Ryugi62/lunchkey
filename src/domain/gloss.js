import { GLOSSARY } from './glossary.js';
import { romanize } from './romanize.js';

/** @typedef {{text:string, coverage:number, status:'full'|'partial'|'none', parts:{ko:string, out:string, known:boolean}[]}} Gloss */

export const GLOSS_LANGS = ['en', 'vi', 'zh'];
// Cooking-method words: Korean puts them last ("달걀찜" = egg + steamed); English and Chinese put them first.
const METHODS = new Set(['볶음', '구이', '조림', '무침', '튀김', '찜', '부침', '초무침', '강정', '숙회', '말이', '훈제', '직화']);
const KEYS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const MAX_KEY = KEYS[0]?.length ?? 1;
const isHangul = (ch) => /[가-힣]/.test(ch);

/** Greedy longest-match segmentation over the glossary. */
function segment(name) {
  const parts = [];
  let i = 0, unknown = '';
  const flush = () => { if (unknown) { parts.push({ ko: unknown, known: false }); unknown = ''; } };
  while (i < name.length) {
    let hit = null;
    for (let len = Math.min(MAX_KEY, name.length - i); len >= 1; len--) {
      const s = name.slice(i, i + len);
      if (GLOSSARY[s]) { hit = s; break; }
    }
    if (hit) { flush(); parts.push({ ko: hit, known: true }); i += hit.length; }
    else { unknown += name[i]; i += 1; }
  }
  flush();
  return parts;
}

/**
 * Gloss a Korean dish name into en / vi / zh from reviewed parts. Other languages use English.
 * Order: English/Chinese put a final cooking method first ("steamed egg"); Vietnamese puts a final head noun first.
 * Unknown parts are romanized and marked "(?)" — never guessed.
 * @param {string} nameKo
 * @param {string} lang
 * @returns {Gloss}
 */
export function glossDish(nameKo, lang) {
  const L = GLOSS_LANGS.includes(lang) ? lang : 'en';
  const clean = String(nameKo).replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[^가-힣a-zA-Z0-9\s]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const parts = words.flatMap((w) => segment(w)).map((p) => ({
    ko: p.ko,
    known: p.known,
    out: p.known ? GLOSSARY[p.ko][L] : romanize(p.ko),
  }));
  const hangulTotal = [...clean].filter(isHangul).length || 1;
  const hangulKnown = parts.filter((p) => p.known).reduce((n, p) => n + [...p.ko].filter(isHangul).length, 0);
  const coverage = Math.round((hangulKnown / hangulTotal) * 1000) / 1000;
  const status = coverage >= 1 ? 'full' : coverage > 0 ? 'partial' : 'none';
  if (status === 'none') return { text: romanize(clean.replace(/\s+/g, ' ')), coverage, status, parts };
  return { text: order(parts, L), coverage, status, parts };
}

/** Put the parts in a natural order for the target language and mark unknown parts with "(?)". */
function order(parts, L) {
  let ps = parts.map((p) => ({ ...p, out: p.known ? p.out : `${p.out}(?)` }));
  const last = ps[ps.length - 1];
  const methodLast = ps.length > 1 && last.known && METHODS.has(last.ko);
  if (methodLast) {
    // Drop the method if another part already says it ("떡갈비구이" = grilled short-rib patties + grilled).
    const said = ps.slice(0, -1).some((p) => p.out.toLowerCase().includes(last.out.toLowerCase()));
    if (said) ps = ps.slice(0, -1);
    else if (L === 'en' || L === 'zh') ps = [last, ...ps.slice(0, -1)]; // "steamed egg", "蒸鸡蛋"; Vietnamese keeps "trứng hấp"
  } else if (L === 'vi' && ps.length > 1) {
    ps = [last, ...ps.slice(0, -1)]; // head noun first: "canh hầm thịt heo kim chi"
  }
  const out = [];
  for (const p of ps) if (out[out.length - 1] !== p.out) out.push(p.out);
  return out.join(L === 'zh' ? '' : ' ');
}
