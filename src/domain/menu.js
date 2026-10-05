import { isAllergenCode } from './allergens.js';

// Legend words schools sometimes print instead of numbers, e.g. "(난류)".
const LEGEND_WORDS = new Map([
  ['난류', 1], ['달걀', 1], ['계란', 1], ['우유', 2], ['메밀', 3], ['땅콩', 4], ['대두', 5], ['밀', 6], ['고등어', 7], ['게', 8], ['새우', 9],
  ['돼지고기', 10], ['복숭아', 11], ['토마토', 12], ['아황산', 13], ['아황산류', 13], ['호두', 14], ['닭고기', 15], ['쇠고기', 16], ['소고기', 16],
  ['오징어', 17], ['조개류', 18], ['조개', 18], ['굴', 18], ['전복', 18], ['홍합', 18], ['잣', 19],
]);

/** @typedef {'coded'|'uncoded'|'malformed'} ParseStatus */
/** @typedef {{raw:string, nameKo:string, codes:number[], unknownCodes:number[], ambiguousCodes:number[], parseStatus:ParseStatus}} DishLine */

const MARKERS = /^[\s*@#+~!·•.]+|[\s*@#+~!·•]+$/g;
const SEP = '[.,/·\\s]+';
// Any bracketed group made only of numbers and separators: (1.2.5) (1, 5) (1 5 6) (1/5/6) (1·5) (1..5) (2.)
const GROUP = new RegExp(`\\(\\s*(\\d{1,2}(?:${SEP}\\d{1,2})*)\\s*[.,]?\\s*\\)`, 'g');

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

const HAS_CODE_GROUP = /[(\[<]\s*\d{1,2}(?:[.,/·\s]+\d{1,2})*\s*[.,]?\s*[)\]>]|[\u2460-\u24ff\u2776-\u2793]/;
// Side items that may share the main dish's numbers ("밥/짜장소스 (5.6.10)").
const SIDE = /^(?:소스|쌈장|양념장|초장|간장|양념|밥|쌀밥|상추|쌈|드레싱|케첩|케찹|머스터드|마요|단무지|피클|김치|배추김치|깍두기)$/;

/** Split on separators that are OUTSIDE brackets only. */
function splitOutside(line) {
  const out = []; let depth = 0; let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if ('([<{'.includes(ch)) depth++;
    if (')]>}'.includes(ch)) depth = Math.max(0, depth - 1);
    const isSep = depth === 0 && ('/&+'.includes(ch) || (ch === ',' && /[\uac00-\ud7a3]/.test(line.slice(i + 1).trimStart()[0] ?? '')));
    if (isSep) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/**
 * One printed line can hold several dishes:
 * - "카레라이스(1.5.6)/요구르트(2)" → two dishes (split on / & + , outside brackets)
 * - "새우튀김 (1.5.6.9) 타르타르소스" → two dishes (Korean text after the last code group is its own, unnumbered dish)
 * - "잡채밥/짜장소스 (5.6.10)" → one dish whose numbers may be shared; it is marked `shared:` so it is never shown green
 *   unless the earlier parts are plain side items.
 * @param {string} line
 * @returns {string[]}
 */
export function splitCompound(line) {
  // Trailing dish after the last code group, separated by a space: "새우튀김 (1.5.6.9) 타르타르소스".
  const tail = line.match(/^(.*[)\]>])\s+([^()\[\]<>]*[\uac00-\ud7a3]{2,}[^()\[\]<>]*)$/);
  if (tail && HAS_CODE_GROUP.test(tail[1]) && !/^\s*[-–]?\d/.test(tail[2]) === true && !/^[\s\d]*$/.test(tail[2])) {
    return [...splitCompound(tail[1].trim()), tail[2].trim()];
  }
  const parts = splitOutside(line);
  if (parts.length < 2 || !parts.every((x) => /[\uac00-\ud7a3]/.test(x))) return [line];
  const coded = parts.map((x) => HAS_CODE_GROUP.test(x));
  if (!coded.some(Boolean)) return [line];
  if (coded.filter(Boolean).length === 1 && coded[coded.length - 1]) {
    const earlier = parts.slice(0, -1).map((x) => x.replace(/[^\uac00-\ud7a3]/g, ''));
    return earlier.every((x) => SIDE.test(x)) ? [line] : [`shared:${line}`];
  }
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
  // "shared:" marks a line whose numbers belong to only some of its dishes (see splitCompound): never green.
  const shared = String(raw ?? '').startsWith('shared:');
  if (shared) raw = String(raw).slice('shared:'.length);
  const found = [];
  const ambiguous = []; // numbers that COULD be codes but aren't clearly codes: never allowed to support "clear"
  const maybe = (n) => { if (isAllergenCode(n)) ambiguous.push(n); };
  let hadGroup = false;
  let unreadableMark = false;

  let s = String(raw ?? '');
  // Enclosed numbers are codes: ①..⑳, ❶..❿, ⓫..⓴, ⓵..⓾, ➀..➉, ➊..➓. Read them before NFKC (which would make ① a bare "1").
  const ENCLOSED = [[0x2460, 0x2473, 1], [0x2776, 0x277f, 1], [0x24eb, 0x24f4, 11], [0x24f5, 0x24fe, 1], [0x2780, 0x2789, 1], [0x278a, 0x2793, 1]];
  s = s.replace(/[\u2460-\u24ff\u2776-\u2793]/g, (ch) => {
    const cp = ch.codePointAt(0);
    const r = ENCLOSED.find(([a, b]) => cp >= a && cp <= b);
    if (r) { found.push(cp - r[0] + r[2]); hadGroup = true; return ' '; }
    unreadableMark = true; return ' '; // any other enclosed character: can't be read
  });
  // ㆍ (U+318D) is a common middle-dot stand-in; swap it BEFORE NFKC (which turns it into a jamo).
  s = s.replace(/[ㆍ\u119e]/g, '·').normalize('NFKC').replace(MARKERS, '');
  // A bracket holding only an allergen's name ("(난류)", "(게)", "(아황산)") is that code.
  s = s.replace(/[([]\s*([\uac00-\ud7a3]{1,5}(?:\s*[,·/\s]\s*[\uac00-\ud7a3]{1,5})*)\s*[)\]]/g, (all, list) => {
    const ids = list.split(/[,·/\s]+/).map((w) => LEGEND_WORDS.get(w));
    if (ids.length && ids.every(Boolean)) { found.push(...ids); hadGroup = true; return ' '; }
    return all;
  });

  // Portion notes ("(30g*3개)", "(20kg)", "(50 ml)") are not codes, but any 1–19 number inside stays ambiguous.
  s = s.replace(/\(\s*[\d.]+\s*(?:g|kg|ml|mL|l|L|개|ea|EA|인분|조각|%)(?:\s*[*x×]\s*\d+\s*(?:개|ea|EA|조각)?)?\s*\)/g, (note) => { for (const m of note.matchAll(/\d+/g)) maybe(+m[0]); return ' '; });
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
      if (/[([<]\s*$/.test(s)) unreadableMark = true; // "마파두부 (5.6." — a cut-off list may be missing codes
    }
  }

  // An unclosed bracket with digits or digit-separator-digit runs can't be read at all.
  const leftover = /[([<]\s*\d|\d\s*[.,/·]\s*\d/.test(s);
  // Everything left: any 1–19 number still in the name is ambiguous, except counting words ("10곡", "3색", "2탄").
  const COUNTER = /^(?:곡|색|가지|종류|인분|학년|단계|등급|겹|혼합|탄)/;
  s = s.replace(/\d+/g, (num, at, whole) => {
    const after = whole.slice(at + num.length);
    const glued = at === 0 || /[\uac00-\ud7a3]/.test(whole[at - 1] ?? '');
    if (glued && COUNTER.test(after) && !(at === 0 && Number(num) <= 19 && !/^(?:곡|색|가지|종류|혼합)/.test(after))) return num; // part of the dish name
    const v = Number(num);
    if (num.length === 2 && hadGroup) { maybe(Number(num[0])); maybe(Number(num[1])); } // "(5.6)¹²" → 12, or 1 and 2
    if (num.length > 2 || v > 19 || v === 0) return num; // "비타500", "오렌지 31": not a code
    maybe(v);
    return /[가-힣]/.test(whole[at - 1] ?? '') && /[가-힣]/.test(after[0] ?? '') ? num : ' ';
  });

  const nameKo = s.replace(/\(\s*[-–·.,\s]*\)/g, ' ').replace(/(?:^|\s)(?:개|조각)(?=\s|$)/g, ' ').replace(/\s{2,}/g, ' ').replace(/\s*([/&])\s*/g, '$1').replace(/[\s(.:;,·~_\-]+$/, '').replace(/^[\s(.:;,·~_\-]+/, '').replace(MARKERS, '').trim();

  const codes = [...new Set(found.filter(isAllergenCode))].sort((a, b) => a - b);
  const unknownCodes = [...new Set(found.filter((n) => !isAllergenCode(n)))].sort((a, b) => a - b);
  const ambiguousCodes = [...new Set(ambiguous)].filter((n) => !codes.includes(n)).sort((a, b) => a - b);
  /** @type {ParseStatus} */
  const parseStatus = unknownCodes.length || leftover || unreadableMark ? 'malformed' : codes.length ? 'coded' : 'uncoded';
  return { raw: String(raw ?? ''), nameKo, codes, unknownCodes, ambiguousCodes, parseStatus, shared };
}
