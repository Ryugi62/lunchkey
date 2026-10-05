import { isAllergenCode } from '../domain/allergens.js';

export const UI_LANGS = ['en', 'ko', 'vi', 'zh', 'tl', 'ja', 'ru'];
const empty = () => ({ allergens: [], lang: 'en', name: '', school: null });

function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
}

/** @param {{allergens:number[], lang:string, name?:string, school?:{office:string, code:string, name:string}|null}} p */
export function encodeProfile(p) {
  const payload = { a: p.allergens.filter(isAllergenCode), l: p.lang, n: p.name ?? '' };
  if (p.school) payload.s = [p.school.office, p.school.code, p.school.name];
  return `#p=${toB64(JSON.stringify(payload))}`;
}

/** @param {string} hash */
export function decodeProfile(hash) {
  try {
    const m = String(hash).match(/p=([A-Za-z0-9_-]+)/);
    if (!m) return empty();
    const o = JSON.parse(fromB64(m[1]));
    const allergens = (Array.isArray(o.a) ? o.a : []).map(Number).filter(isAllergenCode);
    const lang = UI_LANGS.includes(o.l) ? o.l : 'en';
    const s = Array.isArray(o.s) && o.s.length === 3 && /^[A-Z]\d{2}$/.test(o.s[0]) && /^\d{7}$/.test(o.s[1])
      ? { office: o.s[0], code: o.s[1], name: String(o.s[2]).slice(0, 60) } : null;
    return { allergens: [...new Set(allergens)].sort((a, b) => a - b), lang, name: typeof o.n === 'string' ? o.n.slice(0, 40) : '', school: s };
  } catch {
    return empty();
  }
}
