// Revised Romanization of Korean, syllable by syllable (no sound-change rules).
const INITIAL = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const MEDIAL = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const FINAL = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];

/** @param {string} text */
export function romanize(text) {
  let out = '';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0) - 0xac00;
    if (code < 0 || code > 11171) { out += ch; continue; }
    const i = Math.floor(code / 588), m = Math.floor((code % 588) / 28), f = code % 28;
    let ini = INITIAL[i];
    // initial ㄹ at the start of a word is written "r"; after a final ㄹ it is "l" (bulgogi keeps g).
    if (i === 5 && out.endsWith('l')) ini = 'l';
    out += ini + MEDIAL[m] + FINAL[f];
  }
  return out;
}
