// Composition root: wires the NEIS adapter, the profile store and the pure domain/application code to the DOM.
import { ALLERGENS, allergenName } from '../domain/allergens.js';
import { GLOSS_LANGS } from '../domain/gloss.js';
import { buildWeekView, weekRange } from '../application/weekView.js';
import { buildPasteView } from '../application/pasteView.js';
import { headline } from '../application/headline.js';
import { createNeisSource, OFFICES } from '../adapters/neis.js';
import { encodeProfile, decodeProfile, UI_LANGS } from '../adapters/profileStore.js';
import { t, LANG_NAMES } from './i18n.js';

const SAMPLE = { school: { office: 'S10', code: '9022479', name: '의창초등학교' }, allergens: [1, 2], name: 'Mina' };
const SAMPLE_WEEK = '2026-09-28'; // bundled copy in docs/sample-week.json (used if the live API can't be reached)
const STORE = 'lunchkey.v1';
const CACHE = 'lunchkey.cache.v1';
const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') === '1';
const KEY_STORE = 'lunchkey.neisKey';
if (params.get('key')) { try { localStorage.setItem(KEY_STORE, params.get('key')); } catch { /* ignore */ } }
let neisKey = ''; try { neisKey = localStorage.getItem(KEY_STORE) || ''; } catch { /* ignore */ }
const neis = createNeisSource({ fetch: (u) => fetch(u), key: neisKey || undefined }); // optional free NEIS key enables full paging
const $app = document.getElementById('app');
const $cta = document.getElementById('cta');
const $lang = document.getElementById('langSelect');
const $print = document.getElementById('printSheet');
const $status = document.getElementById('status');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const todayIso = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // Korea time
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const htmlLang = (l) => (l === 'tl' ? 'fil' : l);
const fmtDate = (iso, lang, opts = { month: 'short', day: 'numeric' }) => {
  try { return new Intl.DateTimeFormat(htmlLang(lang), { ...opts, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)); } catch { return iso; }
};
const announce = (msg) => { $status.textContent = msg; };

let state = loadState();

function loadState() {
  const fromHash = decodeProfile(location.hash);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { /* private mode */ }
  // Stored shape: { children: [profile...], active } (older single-profile saves are upgraded).
  let children = saved?.children ?? (saved ? [saved] : []);
  let active = saved?.active ?? 0;
  let notice = '';
  if (fromHash.school || fromHash.allergens.length) {
    const same = children.findIndex((c) => c.school?.code === fromHash.school?.code && JSON.stringify(c.allergens) === JSON.stringify(fromHash.allergens));
    if (same >= 0) active = same;
    else if (children.length && fromHash.allergens.length) { children.push({ ...fromHash, lang: children[active]?.lang ?? fromHash.lang }); active = children.length - 1; notice = 'linkedChild'; }
    else if (children.length && !fromHash.allergens.length) { children[active] = { ...children[active], school: fromHash.school }; } // a school link: keep the child, set the school
    else { children = [fromHash]; active = 0; }
  }
  if (!children.length) children = [{ allergens: [], lang: guessLang(), name: '', school: null }];
  let profile = children[Math.min(active, children.length - 1)];
  if (DEMO) { profile = { ...profile, ...SAMPLE, lang: UI_LANGS.includes(params.get('lang')) ? params.get('lang') : profile.lang }; children = [profile]; active = 0; }
  const step = params.get('paste') === '1' ? 'paste' : profile.school && profile.allergens.length ? 'week' : profile.school ? 'allergens' : 'lang';
  return { children, active, profile, step, monday: weekRange(todayIso()).monday, day: null, firstLoad: true, notice, pasteText: '', office: '', weeks: new Map() };
}
function guessLang() {
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('fil') || nav.startsWith('tl')) return 'tl';
  const l = nav.slice(0, 2);
  return UI_LANGS.includes(l) ? l : 'en';
}
function save() {
  if (DEMO) return; // the sample profile never overwrites a parent's own profile
  state.children[state.active] = state.profile;
  try { localStorage.setItem(STORE, JSON.stringify({ children: state.children, active: state.active })); } catch { /* ignore */ }
}
function setLang(lang) { state.profile.lang = lang; save(); render(); }
function steps(n) { return `<div class="steps" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`; }
function cta(html) { $cta.innerHTML = html; $cta.hidden = !html; }

function renderLang() {
  const L = t(state.profile.lang);
  $app.innerHTML = `${steps(1)}<h1>${esc(L.pickLang)}</h1><p class="sub">${esc(L.tagline)}</p>
    <div class="grid" role="group">${UI_LANGS.map((l) => `<button class="choice" lang="${htmlLang(l)}" aria-pressed="${l === state.profile.lang}" data-lang="${l}">${esc(LANG_NAMES[l])}</button>`).join('')}</div>
    <p style="margin-top:24px"><a class="btn link" href="?demo=1&lang=${state.profile.lang}">${esc(L.sampleSchool)}</a></p>`;
  $app.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => setLang(b.dataset.lang));
  cta(`<button class="btn" id="go">${esc(L.next)}</button>`);
  $cta.querySelector('#go').onclick = () => { state.step = 'school'; render(); };
}

function renderSchool() {
  const L = t(state.profile.lang);
  const offs = OFFICES.map((o) => `<option value="${o.code}" ${o.code === state.office ? 'selected' : ''}>${esc(o.en)} · ${esc(o.ko)}</option>`).join('');
  $app.innerHTML = `${steps(2)}<h1>${esc(L.findSchool)}</h1><p class="sub">${esc(L.schoolHint)}</p>
    <form id="f"><p><select id="office" aria-label="${esc(L.province)}"><option value="">${esc(L.allProvinces)}</option>${offs}</select></p>
    <div class="row"><input type="text" id="q" lang="ko" autocomplete="off" aria-label="${esc(L.findSchool)}" value="${esc(state.profile.school?.name ?? '')}"><button class="btn" type="submit">${esc(L.search)}</button></div></form>
    <ul class="list" id="res" aria-live="polite"></ul>
    <p style="margin-top:16px"><button class="btn link" id="paste">${esc(L.pasteInstead)}</button></p>`;
  const $res = $app.querySelector('#res');
  $app.querySelector('#office').onchange = (e) => { state.office = e.target.value; };
  $app.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const q = $app.querySelector('#q').value.trim();
    if (!q) return;
    $res.innerHTML = `<li class="aux">${esc(L.searching)}</li>`;
    try {
      const { schools, total, truncated } = await neis.searchSchools({ name: q, office: state.office, limit: 20 });
      $res.innerHTML = schools.length
        ? schools.map((s, i) => `<li><button class="school" data-i="${i}"><b lang="ko">${esc(s.name)}</b><span class="aux">${s.nameEn ? `<span lang="en">${esc(s.nameEn)}</span> · ` : ''}<span lang="ko">${esc(s.kind)} · ${esc(s.address ?? s.officeName)}</span></span></button></li>`).join('')
          + (truncated ? `<li class="aux">${esc(L.searchMore(schools.length, total))}</li>` : '')
        : `<li class="aux">${esc(L.noSchool)}</li>`;
      $res.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { const s = schools[Number(b.dataset.i)]; state.profile.school = { office: s.office, code: s.code, name: s.name }; save(); state.step = 'allergens'; render(); });
    } catch { $res.innerHTML = `<li class="err">${esc(L.errNet)}</li>`; }
  };
  $app.querySelector('#paste').onclick = () => { state.step = 'paste'; render(); };
  cta(`<button class="btn ghost" id="back">${esc(L.back)}</button>`);
  $cta.querySelector('#back').onclick = () => { state.step = 'lang'; render(); };
}

function allergenGrid(lang, selected) {
  return `<div class="grid" role="group">${ALLERGENS.map((a) => `<button class="choice" role="checkbox" aria-checked="${selected.includes(a.id)}" data-a="${a.id}"><span class="num">${a.id}</span>${esc(allergenName(a.id, lang))}${lang === 'ko' ? '' : `<span class="ko" lang="ko">${esc(a.names.ko)}</span>`}</button>`).join('')}</div>`;
}
function bindGrid(onChange) {
  $app.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => {
    const id = Number(b.dataset.a); const s = state.profile.allergens;
    state.profile.allergens = s.includes(id) ? s.filter((x) => x !== id) : [...s, id].sort((x, y) => x - y);
    save(); b.setAttribute('aria-checked', String(state.profile.allergens.includes(id))); onChange?.();
  });
}

function renderAllergens() {
  const L = t(state.profile.lang);
  $app.innerHTML = `${steps(3)}<h1>${esc(L.pickAllergens)}</h1><p class="sub">${esc(L.pickAllergensHint)}</p>
    <p><input type="text" id="cn" maxlength="40" placeholder="${esc(L.childName)}" aria-label="${esc(L.childName)}" value="${esc(state.profile.name)}"></p>
    ${allergenGrid(state.profile.lang, state.profile.allergens)}<p class="note">${esc(L.safety)}</p>`;
  $app.querySelector('#cn').oninput = (e) => { state.profile.name = e.target.value; save(); };
  const sync = () => { const go = $cta.querySelector('#go'); if (go) go.disabled = !state.profile.allergens.length; };
  bindGrid(sync);
  cta(`<button class="btn ghost" id="back">${esc(L.back)}</button><button class="btn" id="go">${esc(L.seeWeek)}</button>`);
  sync();
  $cta.querySelector('#back').onclick = () => { state.step = 'school'; render(); };
  $cta.querySelector('#go').onclick = () => { state.step = 'week'; state.day = null; state.firstLoad = true; render(); };
}

function verdictLabel(v, L) {
  const icon = { contains: '⛔', clear: '✓', nonumbers: '○', unreadable: '?' }[v];
  return `<span class="verdict ${v}"><span aria-hidden="true">${icon}</span>${esc(L[v])}</span>`;
}

function dishCard(d, lang, L) {
  const showGloss = lang !== 'ko';
  const glossLang = d.gloss.status === 'none' ? 'ko' : GLOSS_LANGS.includes(lang) ? htmlLang(lang) : 'en';
  const chips = d.codes.map((c) => `<span class="chip ${d.matched.includes(c) ? 'hit' : ''}">${c} ${esc(allergenName(c, lang))}</span>`).join('');
  return `<article class="dish ${d.verdict}">
    ${verdictLabel(d.verdict, L)}${d.matched.length ? ` <b class="err">${esc(d.matched.map((c) => allergenName(c, lang)).join(', '))}</b>` : ''}
    <div class="name" lang="${showGloss ? glossLang : 'ko'}">${esc(showGloss ? d.gloss.text : d.nameKo)}</div>
    ${showGloss ? `<div class="ko" lang="ko">${esc(d.nameKo)}</div>` : ''}
    ${chips ? `<div class="chips">${chips}</div>` : ''}
    <details><summary>${esc(L.howRead)}</summary>
      <div>${esc(L.printed)}: <code lang="ko">${esc(d.raw)}</code></div>
      <div>${esc(L.codes)}: <code>${d.codes.join(', ') || '—'}${d.unknownCodes.length ? ` · ? ${d.unknownCodes.join(', ')}` : ''}</code></div>
      ${showGloss ? `<div>${d.gloss.parts.map((p) => `<code lang="ko">${esc(p.ko)}</code>→${esc(p.out)}${p.known ? '' : ' (?)'}`).join(' + ')}</div>` : ''}
    </details>
  </article>`;
}

function readCache() { try { return JSON.parse(localStorage.getItem(CACHE) || '{}'); } catch { return {}; } }
function writeCache(key, meals) {
  try { const c = readCache(); c[key] = meals; const keys = Object.keys(c); if (keys.length > 12) delete c[keys[0]]; localStorage.setItem(CACHE, JSON.stringify(c)); } catch { /* ignore */ }
}
async function bundledSample() {
  const body = await (await fetch('docs/sample-week.json')).json();
  const src = createNeisSource({ fetch: async () => ({ ok: true, status: 200, json: async () => body }) });
  return [...(await src.listMeals({ office: 'S10', school: '9022479', from: '', to: '' }))];
}

/** Lunch for one school-week. Live first; on failure, the copy saved on this phone (or the bundled sample in demo mode). */
async function loadWeek(monday) {
  const key = `${state.profile.school.office}:${state.profile.school.code}:${monday}`;
  if (state.weeks.has(key)) return state.weeks.get(key); // tab clicks re-render from memory, no network
  const r = weekRange(monday);
  try {
    const meals = [...(await neis.listMeals({ office: state.profile.school.office, school: state.profile.school.code, from: r.from, to: r.to, mealType: '2' }))];
    writeCache(key, meals);
    state.weeks.set(key, { meals, offline: false });
    return { meals, offline: false };
  } catch (err) {
    const cached = readCache()[key];
    if (cached) return { meals: cached, offline: true };
    if (DEMO) { state.monday = SAMPLE_WEEK; return { meals: await bundledSample(), offline: true }; }
    throw err;
  }
}

function header(p, L) {
  const chips = state.children.length > 1 || !DEMO
    ? `<div class="kids">${state.children.map((c, i) => `<button class="kid" aria-pressed="${i === state.active}" data-kid="${i}">${esc(c.name || `#${i + 1}`)} · ${c.allergens.map((a) => esc(allergenName(a, p.lang))).join(', ')}</button>`).join('')}${DEMO ? '' : `<button class="kid add" id="addkid">${esc(L.addChild)}</button>`}</div>` : '';
  return `<div><h2 lang="ko">${esc(p.school.name)}</h2><div class="aux">${esc(p.name ? `${p.name} · ` : '')}${p.allergens.map((a) => esc(allergenName(a, p.lang))).join(', ')} · <button class="btn link" id="edit">${esc(L.edit)}</button></div>${chips}</div>`;
}
function bindHeader() {
  $app.querySelector('#edit').onclick = () => { state.step = 'allergens'; render(); };
  $app.querySelectorAll('[data-kid]').forEach((b) => b.onclick = () => { state.active = Number(b.dataset.kid); state.profile = state.children[state.active]; save(); state.day = null; render(); });
  const add = $app.querySelector('#addkid');
  if (add) add.onclick = () => { state.children.push({ allergens: [], lang: state.profile.lang, name: '', school: state.profile.school }); state.active = state.children.length - 1; state.profile = state.children[state.active]; save(); state.step = 'allergens'; render(); };
}

async function renderWeek() {
  const L = t(state.profile.lang);
  const p = state.profile;
  const quick = state.weeks.has(`${p.school.office}:${p.school.code}:${state.monday}`);
  if (!quick) { $app.innerHTML = `${header(p, L)}<div class="skeleton" style="margin-top:24px"></div><div class="skeleton"></div>`; bindHeader(); cta(''); }
  let res;
  try { res = await loadWeek(state.monday); } catch { $app.insertAdjacentHTML('beforeend', `<p class="err">${esc(L.errNet)}</p>`); return; }
  // First load only: if this week has no menu yet, look back up to 4 weeks and say so; if nothing, stay and say "not published".
  if (!res.meals.length && state.firstLoad) {
    const start = state.monday;
    let found = false;
    for (let k = 1; k <= 4 && !found; k++) {
      const m = addDays(start, -7 * k);
      try { const r2 = await loadWeek(m); if (r2.meals.length) { state.notice = L.showingWeek(fmtDate(m, p.lang)); state.monday = m; res = r2; found = true; } } catch { break; }
    }
    if (!found) state.notice = L.notPublished;
  }
  state.firstLoad = false;
  if (state.notice === 'linkedChild') state.notice = L.linkedChild;
  if (DEMO && !state.notice) state.notice = L.sample;
  const view = buildWeekView(res.meals, p);
  const dates = [0, 1, 2, 3, 4].map((i) => addDays(state.monday, i));
  const today = todayIso();
  if (!state.day || !dates.includes(state.day)) state.day = dates.includes(today) && view.days.some((d) => d.date === today) ? today : (view.days[0]?.date ?? dates[0]);
  const dayView = view.days.find((d) => d.date === state.day);
  const mark = (dv) => (!dv ? `<span aria-label="${esc(L.noLunch)}" title="${esc(L.noLunch)}">–</span>` : { contains: `⛔ ${dv.summary.contains}`, clear: '✓', nolisted: '○', unknown: '?', empty: '–' }[dv.status]);
  const tabs = dates.map((d, i) => {
    const dv = view.days.find((x) => x.date === d);
    return `<button class="tab ${dv ? `s-${dv.status}` : ''}" role="tab" id="tab-${d}" aria-controls="panel" aria-selected="${d === state.day}" tabindex="${d === state.day ? 0 : -1}" data-d="${d}">${esc(L.days[i])}<span class="dot">${esc(fmtDate(d, p.lang))}</span><span class="mark">${mark(dv)}</span></button>`;
  }).join('');
  const body = !dayView ? `<div class="hero none"><div class="big">—</div><p>${esc(L.noMeal)}</p></div>` : dayView.meals.map((m) => {
    const h = headline(m);
    const names = h.matched.map((c) => allergenName(c, p.lang)).join(', ');
    const hero = {
      no: `<div class="hero no"><div class="big">⛔ ${esc(L.containsCount(h.count, names))}</div><p>${esc(L.lunch)}</p></div>`,
      warn: `<div class="hero warn"><div class="big">? ${esc(L.unknownHero(h.count))}</div><p>${esc(L.lunch)}</p></div>`,
      neutral: `<div class="hero neutral"><div class="big">○ ${esc(L.nolistedHero(h.count))}</div><p>${esc(L.lunch)}</p></div>`,
      ok: `<div class="hero ok"><div class="big">✓ ${esc(L.allClear)}</div><p>${esc(L.lunch)}</p></div>`,
      none: `<div class="hero none"><div class="big">—</div><p>${esc(L.noMeal)}</p></div>`,
    }[h.tone];
    const order = { contains: 0, unreadable: 1, nonumbers: 2, clear: 3 };
    return hero + [...m.dishes].sort((a, b) => order[a.verdict] - order[b.verdict]).map((d) => dishCard(d, p.lang, L)).join('');
  }).join('');
  $app.innerHTML = `${header(p, L)}
    ${state.notice ? `<p class="banner">${esc(state.notice)}</p>` : ''}${res.offline ? `<p class="banner">${esc(L.errNet)} ${esc(L.savedCopy)}</p>` : ''}
    <div class="weeknav" style="margin-top:12px"><button class="btn link" id="prev">${esc(L.prevWeek)}</button><span class="aux">${esc(L.week)} ${esc(fmtDate(state.monday, p.lang))}</span><button class="btn link" id="next">${esc(L.nextWeek)}</button></div>
    <div class="tabs" role="tablist">${tabs}</div><div id="panel" role="tabpanel" aria-labelledby="tab-${state.day}">${body}</div>
    <p class="note">${esc(L.safety)}</p><p class="note">${esc(L.glossNote)} · ${esc(L.dataSource)}</p>
    <p class="note"><button class="btn link" id="schoollink">${esc(L.schoolLink)}</button></p>`;
  bindHeader();
  const go = (n) => { state.monday = addDays(state.monday, n); state.day = null; state.notice = ''; renderWeek(); };
  $app.querySelector('#prev').onclick = () => go(-7);
  $app.querySelector('#next').onclick = () => go(7);
  const tabEls = [...$app.querySelectorAll('[data-d]')];
  tabEls.forEach((b, i) => {
    b.onclick = () => { state.day = b.dataset.d; renderWeek().then(() => document.getElementById(`tab-${state.day}`)?.focus()); };
    b.onkeydown = (e) => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (k) { e.preventDefault(); tabEls[(i + k + tabEls.length) % tabEls.length].click(); } };
  });
  if (dayView) {
    const h = headline(dayView.meals[0] ?? null);
    announce({ no: L.containsCount(h.count, h.matched.map((c) => allergenName(c, p.lang)).join(', ')), warn: L.unknownHero(h.count), neutral: L.nolistedHero(h.count), ok: L.allClear, none: L.noMeal }[h.tone]);
  }
  renderPrint(view, dates, L);
  const copy = async (url, btn, note) => {
    try { await navigator.clipboard.writeText(url); } catch { prompt(note, url); }
    btn.textContent = L.copied; announce(`${L.copied}. ${note}`);
  };
  $app.querySelector('#schoollink').onclick = (e) => copy(`${location.origin}${location.pathname}${encodeProfile({ allergens: [], lang: p.lang, name: '', school: p.school })}`, e.currentTarget, L.schoolLink);
  cta(`<button class="btn ghost" id="share">${esc(L.share)}</button><button class="btn" id="print">${esc(L.print)}</button>`);
  $cta.querySelector('#print').onclick = () => window.print();
  $cta.querySelector('#share').onclick = (e) => copy(`${location.origin}${location.pathname}${encodeProfile({ ...p, name: '' })}`, e.currentTarget, L.shareNote);
}

function renderPrint(view, dates, L) {
  const p = state.profile;
  const cell = (d) => {
    const dv = view.days.find((x) => x.date === d);
    if (!dv) return '—';
    return dv.meals.flatMap((m) => m.dishes).map((x) => {
      const mark = { contains: '⛔', clear: '✓', nonumbers: '○', unreadable: '?' }[x.verdict];
      const name = p.lang === 'ko' ? x.nameKo : `${x.gloss.text} (${x.nameKo})`;
      return `<div class="${x.verdict === 'contains' ? 'x' : ''}">${mark} ${esc(name)}${x.matched.length ? ` — ${esc(x.matched.map((c) => allergenName(c, p.lang)).join(', '))}` : ''}</div>`;
    }).join('');
  };
  $print.innerHTML = `<h2>🔑 ${esc(p.name || '')} — <span lang="ko">${esc(p.school.name)}</span> · ${esc(L.week)} ${esc(fmtDate(state.monday, p.lang))}</h2>
    <p>⛔ ${esc(L.contains)} · ✓ ${esc(L.clear)} · ○ ${esc(L.nonumbers)} · ? ${esc(L.unreadable)} — ${p.allergens.map((a) => esc(allergenName(a, p.lang))).join(', ')}</p>
    <table><tr>${dates.map((d, i) => `<th>${esc(L.days[i])} ${esc(fmtDate(d, p.lang))}</th>`).join('')}</tr><tr>${dates.map((d) => `<td>${cell(d)}</td>`).join('')}</tr></table>
    <p>${esc(L.safety)}</p>`;
}

function renderPaste() {
  const L = t(state.profile.lang);
  if (!state.pasteText) state.pasteText = '쌀밥\n달걀찜 (1.5)\n까르보닭갈비 (2.5.6.13.15.16)\n배추김치 (9)\n우유 (2)';
  $app.innerHTML = `<h1>${esc(L.pasteTitle)}</h1><p class="sub">${esc(L.pasteHint)}</p>
    <textarea id="txt" rows="7" lang="ko" aria-label="${esc(L.pasteTitle)}">${esc(state.pasteText)}</textarea>
    <h2 style="margin-top:24px">${esc(L.pickAllergens)}</h2>${allergenGrid(state.profile.lang, state.profile.allergens)}
    <div id="out" style="margin-top:24px"></div>`;
  const run = () => {
    const v = buildPasteView(state.pasteText, state.profile);
    $app.querySelector('#out').innerHTML = v.dishes.map((d) => dishCard(d, state.profile.lang, L)).join('') + `<p class="note">${esc(L.safety)}</p>`;
  };
  $app.querySelector('#txt').oninput = (e) => { state.pasteText = e.target.value; };
  bindGrid(run);
  cta(`<button class="btn ghost" id="back">${esc(L.back)}</button><button class="btn" id="go">${esc(L.check)}</button>`);
  $cta.querySelector('#back').onclick = () => { state.step = state.profile.school && state.profile.allergens.length ? 'week' : 'school'; render(); };
  $cta.querySelector('#go').onclick = run;
  run();
}

function render() {
  document.documentElement.lang = htmlLang(state.profile.lang);
  $lang.innerHTML = UI_LANGS.map((l) => `<option value="${l}" ${l === state.profile.lang ? 'selected' : ''}>${esc(LANG_NAMES[l])}</option>`).join('');
  ({ lang: renderLang, school: renderSchool, allergens: renderAllergens, week: renderWeek, paste: renderPaste })[state.step]();
}
$lang.onchange = () => setLang($lang.value);
if (location.hash.includes('p=')) { save(); history.replaceState(null, '', location.pathname + location.search); }
render();
