/**
 * Merge a profile that arrived in a link (#hash) into the children saved on this phone. Pure.
 * - family link (allergens set): same child → select it; otherwise add a new child (never overwrite a sibling)
 * - school link (no allergens): set the school on the current child if it has none; otherwise start a new child
 * @param {{allergens:number[], lang:string, name:string, school:any}[]} children
 * @param {number} active
 * @param {{allergens:number[], lang:string, name:string, school:any}} incoming
 * @param {string} fallbackLang language to use when a school link carries none
 */
export function mergeIncoming(children, active, incoming, fallbackLang) {
  const kids = children.map((c) => ({ ...c }));
  if (!incoming.school && !incoming.allergens.length) return { children: kids, active, notice: '' };
  const same = kids.findIndex((c) => c.school?.code === incoming.school?.code && JSON.stringify(c.allergens) === JSON.stringify(incoming.allergens));
  if (same >= 0 && incoming.allergens.length) return { children: kids, active: same, notice: '' };
  if (!kids.length) return { children: [{ ...incoming, lang: incoming.allergens.length ? incoming.lang : fallbackLang }], active: 0, notice: '' };
  if (incoming.allergens.length) {
    kids.push({ ...incoming, lang: kids[active]?.lang ?? incoming.lang });
    return { children: kids, active: kids.length - 1, notice: 'linkedChild' };
  }
  const cur = kids[active];
  if (!cur.school) { kids[active] = { ...cur, school: incoming.school }; return { children: kids, active, notice: '' }; }
  if (cur.school.code === incoming.school.code) return { children: kids, active, notice: '' };
  kids.push({ allergens: [], lang: cur.lang, name: '', school: incoming.school });
  return { children: kids, active: kids.length - 1, notice: '' };
}
