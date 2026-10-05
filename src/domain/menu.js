import { isAllergenCode } from './allergens.js';

/** @typedef {'coded'|'uncoded'|'malformed'} ParseStatus */
/** @typedef {{raw:string, nameKo:string, codes:number[], unknownCodes:number[], parseStatus:ParseStatus}} DishLine */

const MARKERS = /^[\s*@#+~!·•.]+|[\s*@#+~!·•]+$/g;
const CIRCLED = /[①-⑳]/g; // ① .. ⑳
const SEP = '[.,/·\\s]+';
// Any bracketed group made only of numbers and separators: (1.2.5) (1, 5) (1 5 6) (1/5/6) (1·5) (1..5) (2.)
const GROUP = new RegExp(`\\(\\s*(\\d{1,2}(?:${SEP}\\d{1,2})*)\\s*[.,]?\\s*\\)`, 'g');
// An unbracketed trailing group: "볶음밥1.5.6.10", "우유 2.", "우유 2", "짜장면 1, 5"
const TAIL = /(?:^|[^\d])((?:\d{1,2}[.,]\s*)+\d{0,2}\.?|\s\d{1,2})\s*$/;

/**
 * Split a NEIS DDISH_NM field into raw dish lines.
 * @param {string} ddish
 * @returns {string[]}
 */
export function splitMenu(ddish) {
  return String(ddish ?? '')
    .split(/<br\s*\/?>|\n/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

const numbers = (group) => group.split(/[^\d]+/).filter(Boolean).map(Number);

/**
 * Parse one printed dish line into its Korean name and allergen codes.
 * Safety rule: anything that looks like a code but can't be read cleanly makes the line `malformed`
 * (shown as "not labeled"), so an unreadable line can never be judged clear.
 * @param {string} raw
 * @returns {DishLine}
 */
export function parseDishLine(raw) {
  let s = String(raw ?? '').replace(MARKERS, '');
  const found = [];
  let hadGroup = false;

  // Portion notes are not codes: "(30g*3개)", "(20kg)", "(50g*2)", and a trailing fraction "바나나1/2" (half a banana).
  // If a fraction were really codes, the line ends up uncoded, which is shown as "not labeled" — never as clear.
  s = s.replace(/\(\s*[\d.]+\s*(?:g|kg|ml|l|개|ea|인분|조각|%)[^)]*\)/gi, ' ').replace(/(?<=[\uac00-\ud7a3])\s*[1-3]\/[2-4]\s*$/, '');
  // Notes that start with a number but are words: "(25초등)" (menu group), "(4색)" (4 colors), "(2탄)".
  s = s.replace(/\(\s*\d+\s*[\uac00-\ud7a3A-Za-z][^)]*\)/g, ' ');
  // A bracketed single number outside 1–19, like "(80)" or "(0)", is a portion size, not a code.
  s = s.replace(/\(\s*(\d+)\s*\)/g, (all, n) => (Number(n) >= 1 && Number(n) <= 19 ? all : ' '));
  for (const ch of s.match(CIRCLED) ?? []) found.push(ch.codePointAt(0) - 0x2460 + 1);
  if (CIRCLED.test(s)) hadGroup = true;
  s = s.replace(CIRCLED, ' ');

  s = s.replace(GROUP, (_, g) => { found.push(...numbers(g)); hadGroup = true; return ' '; });

  if (!hadGroup) {
    // "공통양념-2" / "호박죽-1": a number after a hyphen is menu numbering, not an allergen code.
    s = s.replace(/-\d{1,2}\s*$/, '');
    const m = s.match(TAIL);
    if (m && m.index + m[0].length - m[1].length > 0) {
      found.push(...numbers(m[1]));
      hadGroup = true;
      s = s.slice(0, s.length - m[1].length);
    }
  }
  // Variant tags next to a code group: "부대찌개1 (…)", "호박죽-1 (…)", "파김치-1(자율) (9)".
  s = s.replace(/-\d{1,2}(?=[\s(/&]|$)/g, '');
  if (hadGroup) s = s.replace(/(?<=[가-힣])\d(?=\s*(?:[/&]|$))/g, '');

  const nameKo = s.replace(/\s{2,}/g, ' ').replace(/\s*([/&])\s*/g, '$1').replace(/[\s(.]+$/, '').replace(MARKERS, '').trim();
  // Leftover code-like text (an unclosed bracket with digits, or digit-separator-digit runs) is unreadable.
  const leftover = /\(\s*\d|\d\s*[.,/·]\s*\d/.test(nameKo);

  const codes = [...new Set(found.filter(isAllergenCode))].sort((a, b) => a - b);
  const unknownCodes = [...new Set(found.filter((n) => !isAllergenCode(n)))].sort((a, b) => a - b);
  /** @type {ParseStatus} */
  const parseStatus = unknownCodes.length || leftover ? 'malformed' : codes.length ? 'coded' : 'uncoded';
  return { raw: String(raw ?? ''), nameKo, codes, unknownCodes, parseStatus };
}
