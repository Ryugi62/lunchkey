import { isAllergenCode } from './allergens.js';

/** @typedef {'coded'|'uncoded'|'malformed'} ParseStatus */
/** @typedef {{raw:string, nameKo:string, codes:number[], unknownCodes:number[], parseStatus:ParseStatus}} DishLine */

const MARKERS = /^[\s*@#+~!·•.]+|[\s*@#+~!·•]+$/g;
const CIRCLED = /[①-⑳]/g; // ① .. ⑳
// A trailing code group: optional "(", numbers separated by "." or ",", optional trailing "." and ")".
const TRAILING = /\(?\s*(\d{1,2}(?:\s*[.,]\s*\d{1,2})*)\s*[.,]?\s*\)?\s*$/;

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

/**
 * Parse one printed dish line into its Korean name and allergen codes.
 * @param {string} raw
 * @returns {DishLine}
 */
export function parseDishLine(raw) {
  let s = String(raw ?? '').replace(MARKERS, '');
  const found = [];

  for (const ch of s.match(CIRCLED) ?? []) found.push(ch.codePointAt(0) - 0x2460 + 1);
  s = s.replace(CIRCLED, '').replace(MARKERS, '');

  const m = s.match(TRAILING);
  // Only treat the trailing group as codes if something (the dish name) remains before it.
  // "공통양념-2": a bare number after a hyphen with no parentheses is a variant tag, not a code.
  const hyphenTag = m && !m[0].includes('(') && !/[.,]/.test(m[1]) && s[m.index - 1] === '-';
  if (m && m.index > 0 && !hyphenTag) {
    for (const n of m[1].split(/[.,]/)) found.push(Number(n.trim()));
    s = s.slice(0, m.index);
    // Some schools tag menu variants as "부대찌개1 (…)" or "호박죽-1 (…)": with a parenthesized code group,
    // a number glued to the name is a variant tag, not an allergen code.
    if (m[0].includes('(')) s = s.replace(/-?\d{1,2}\s*$/, '');
  }
  if (hyphenTag) s = s.slice(0, m.index - 1);
  const nameKo = s.replace(/-\d{1,2}(?=\(|$)/g, '').replace(/[\s(.]+$/, '').replace(MARKERS, '').trim();

  const codes = [...new Set(found.filter(isAllergenCode))].sort((a, b) => a - b);
  const unknownCodes = [...new Set(found.filter((n) => !isAllergenCode(n)))].sort((a, b) => a - b);
  /** @type {ParseStatus} */
  const parseStatus = unknownCodes.length ? 'malformed' : codes.length ? 'coded' : 'uncoded';
  return { raw: String(raw ?? ''), nameKo, codes, unknownCodes, parseStatus };
}
