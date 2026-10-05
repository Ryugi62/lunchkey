import { isAllergenCode } from './allergens.js';

/** @typedef {'coded'|'uncoded'|'malformed'} ParseStatus */
/** @typedef {{raw:string, nameKo:string, codes:number[], unknownCodes:number[], ambiguousCodes:number[], parseStatus:ParseStatus}} DishLine */

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
    .map((x) => x.trim())
    .filter(Boolean)
    .flatMap(splitCompound);
}

const HAS_CODE_GROUP = /[(\[<]\s*\d{1,2}(?:[.,/·\s]+\d{1,2})*\s*[.,]?\s*[)\]>]|[\u2460-\u2473\u2776-\u277f]/;
/**
 * "카레라이스(1.5.6)/요구르트(2)" is two dishes. Split on / & + , when both sides name a dish.
 * If only the LAST part carries a code group ("잡채밥/짜장소스 (5.6.10)"), the codes are shared and the line stays one dish.
 * @param {string} line
 * @returns {string[]}
 */
export function splitCompound(line) {
  const parts = line.split(/\s*[/&+]\s*|\s*,\s*(?=[\uac00-\ud7a3])/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2 || !parts.every((x) => /[\uac00-\ud7a3]/.test(x))) return [line];
  const coded = parts.map((x) => HAS_CODE_GROUP.test(x));
  if (!coded.some(Boolean)) return [line];
  if (coded.filter(Boolean).length === 1 && coded[coded.length - 1]) return [line];
  return parts;
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
  const found = [];
  const ambiguous = []; // numbers that COULD be codes but aren't clearly codes: never allowed to support "clear"
  const maybe = (n) => { if (isAllergenCode(n)) ambiguous.push(n); };
  let hadGroup = false;

  let s = String(raw ?? '');
  // Circled numbers are codes: ①..⑳ and ❶..❿. Read them before NFKC, which would turn ① into a bare "1".
  s = s.replace(/[①-⑳]/g, (ch) => { found.push(ch.codePointAt(0) - 0x2460 + 1); hadGroup = true; return ' '; });
  s = s.replace(/[❶-❿]/g, (ch) => { found.push(ch.codePointAt(0) - 0x2776 + 1); hadGroup = true; return ' '; });
  // Full-width brackets/digits, parenthesized ⑴ and superscript ¹ become plain ASCII.
  s = s.normalize('NFKC').replace(/ㆍ/g, '·').replace(MARKERS, '');

  // Portion notes are not codes: "(30g*3개)", "(20kg)", "(50 ml)". If several numbers precede a unit ("(2.13 ml)"), it is unreadable.
  s = s.replace(/\(\s*([\d.]+)\s*(?:g|kg|ml|l|개|ea|인분|조각|%)[^)]*\)/gi, (all, num) => (/^\d+(?:\.\d+)?$/.test(num) && !/^\d{1,2}\.\d{1,2}$/.test(num) ? ' ' : `(${num})`));
  // A trailing fraction "바나나1/2" is a portion; its numbers stay ambiguous.
  s = s.replace(/(?<=[가-힣])\s*([1-3])\/([2-4])\s*$/, (_, a, b) => { maybe(+a); maybe(+b); return ''; });
  // Bracketed notes that mix numbers and words ("(25초등)", "(1난류 2우유)", "(가공:2)", "[난류1]"): drop the note,
  // keep EVERY number in it as ambiguous.
  s = s.replace(/[([<][^)\]>]*?(?:\d[^)\]>]*[가-힣A-Za-z]|[가-힣A-Za-z][^)\]>]*\d)[^)\]>]*[)\]>]/g, (note) => { for (const m of note.matchAll(/\d+/g)) maybe(+m[0]); return ' '; });
  // A bracketed single number outside 1–19, like "(80)" or "(0)", is a portion size.
  s = s.replace(/\(\s*(\d+)\s*\)/g, (all, n) => (isAllergenCode(+n) ? all : ' '));
  // Menu numbering glued right before a code group: "부대찌개1 (…)", "호박죽-1 (…)", "요구르트80 (2)" → ambiguous.
  s = s.replace(/(?<=[가-힣])-?(\d{1,2})(?=\*?\s*[(\[<])/g, (_, n) => { maybe(+n); return ''; });
  // Code groups in ( ), [ ] or < >: read as codes (over-warning is the safe side).
  s = s.replace(GROUP, (_, g) => { found.push(...numbers(g)); hadGroup = true; return ' '; });
  s = s.replace(/[[<]\s*(\d{1,2}(?:[.,/·\s]+\d{1,2})*)\s*[.,]?\s*[\]>]/g, (_, g) => { found.push(...numbers(g)); hadGroup = true; return ' '; });

  if (!hadGroup) {
    // An unbracketed list with dots/commas is a code group: "볶음밥1.5.6.10", "우유 2.", "짜장면 1, 5".
    const m = s.match(/(?:^|[^\d])((?:\d{1,2}[.,]\s*)+\d{0,2}\.?)\s*$/);
    if (m && /[가-힣]/.test(s.slice(0, s.length - m[1].length))) {
      found.push(...numbers(m[1]));
      hadGroup = true;
      s = s.slice(0, s.length - m[1].length);
    }
  }

  // An unclosed bracket with digits or digit-separator-digit runs can't be read at all.
  const leftover = /[([<]\s*\d|\d\s*[.,/·]\s*\d/.test(s);
  // Everything left: any 1–19 number still in the name is ambiguous, except counting words ("10곡", "3색", "2탄").
  const COUNTER = /^(?:곡|색|탄|가지|종|혼합|개|인분|년|학년|월|일|호|절|매|수|분|단계|차|회|등급|겹|절미|줄|알|입|봉|팩|컵|미)/;
  s = s.replace(/\d+/g, (num, at, whole) => {
    const after = whole.slice(at + num.length);
    if (COUNTER.test(after)) return num; // part of the dish name
    const v = Number(num);
    if (num.length > 2 || v > 19 || v === 0) return num; // "비타500", "오렌지 31": not a code
    maybe(v);
    return /[가-힣]/.test(whole[at - 1] ?? '') && /[가-힣]/.test(after[0] ?? '') ? num : ' ';
  });

  const nameKo = s.replace(/\s{2,}/g, ' ').replace(/\s*([/&])\s*/g, '$1').replace(/[\s(.:;,·~_\-]+$/, '').replace(/^[\s(.:;,·~_\-]+/, '').replace(MARKERS, '').trim();

  const codes = [...new Set(found.filter(isAllergenCode))].sort((a, b) => a - b);
  const unknownCodes = [...new Set(found.filter((n) => !isAllergenCode(n)))].sort((a, b) => a - b);
  const ambiguousCodes = [...new Set(ambiguous)].filter((n) => !codes.includes(n)).sort((a, b) => a - b);
  /** @type {ParseStatus} */
  const parseStatus = unknownCodes.length || leftover ? 'malformed' : codes.length ? 'coded' : 'uncoded';
  return { raw: String(raw ?? ''), nameKo, codes, unknownCodes, ambiguousCodes, parseStatus };
}
