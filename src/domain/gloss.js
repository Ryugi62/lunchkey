import { GLOSSARY } from './glossary.js';
import { romanize } from './romanize.js';

/** @typedef {{text:string, coverage:number, status:'full'|'partial'|'none', parts:{ko:string, out:string, known:boolean}[]}} Gloss */

export const GLOSS_LANGS = ['en', 'vi', 'zh'];
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
 * Korean and English/Chinese put modifiers first; Vietnamese puts the head first, so parts are reversed.
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
  const ordered = L === 'vi' ? [...parts].reverse() : parts;
  const sep = L === 'zh' ? '' : ' ';
  const text = status === 'none' ? romanize(clean.replace(/\s+/g, ' ')) : ordered.map((p) => p.out).join(sep);
  return { text, coverage, status, parts };
}
