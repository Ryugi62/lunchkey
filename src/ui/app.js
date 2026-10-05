// Composition root: wires the NEIS adapter, the profile store and the pure domain/application code to the DOM.
import { ALLERGENS, allergenName } from '../domain/allergens.js';
import { buildWeekView, weekRange } from '../application/weekView.js';
import { buildPasteView } from '../application/pasteView.js';
import { createNeisSource } from '../adapters/neis.js';
import { encodeProfile, decodeProfile, UI_LANGS } from '../adapters/profileStore.js';
import { t, LANG_NAMES } from './i18n.js';

const SAMPLE = { school: { office: 'S10', code: '9022479', name: '의창초등학교' }, allergens: [1, 2], name: 'Mina' };
const STORE = 'lunchkey.v1';
const neis = createNeisSource({ fetch: (u) => fetch(u) });
const $app = document.getElementById('app');
const $cta = document.getElementById('cta');
const $lang = document.getElementById('langSelect');
const $print = document.getElementById('printSheet');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const todayIso = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // Korea time
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

let state = loadState();

function loadState() {
  const fromHash = decodeProfile(location.hash);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { /* private mode */ }
  const params = new URLSearchParams(location.search);
  let profile = fromHash.school || fromHash.allergens.length ? fromHash : saved ?? { allergens: [], lang: guessLang(), name: '', school: null };
  if (params.get('demo') === '1') profile = { ...profile, ...SAMPLE, lang: params.get('lang') && UI_LANGS.includes(params.get('lang')) ? params.get('lang') : profile.lang };
  const ready = profile.school && profile.allergens.length;
  return { profile, step: ready ? 'week' : 'lang', monday: weekRange(todayIso()).monday, day: null, cache: new Map(), autoJumped: 0 };
}
function guessLang() {
  const l = (navigator.language || 'en').slice(0, 2);
  return UI_LANGS.includes(l) ? l : l === 'fi' ? 'tl' : 'en';
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state.profile)); } catch { /* ignore */ }
}
function setLang(lang) {
  state.profile.lang = lang; document.documentElement.lang = lang === 'tl' ? 'fil' : lang; save(); render();
}

function steps(n) { return `<div class="steps" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`; }
function cta(html) { $cta.innerHTML = html; $cta.hidden = !html; }

function renderLang() {
  const L = t(state.profile.lang);
  $app.innerHTML = `${steps(1)}<h1>${esc(L.pickLang)}</h1><p class="sub">${esc(L.tagline)}</p>
    <div class="grid" role="group">${UI_LANGS.map((l) => `<button class="choice" lang="${l}" aria-pressed="${l === state.profile.lang}" data-lang="${l}">${esc(LANG_NAMES[l])}</button>`).join('')}</div>
    <p style="margin-top:24px"><button class="btn link" id="sample">${esc(L.sampleSchool)}</button></p>`;
  $app.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => setLang(b.dataset.lang));
  $app.querySelector('#sample').onclick = () => { Object.assign(state.profile, SAMPLE); save(); state.step = 'week'; render(); };
  cta(`<button class="btn" id="go">${esc(L.next)}</button>`);
  $cta.querySelector('#go').onclick = () => { state.step = 'school'; render(); };
}

function renderSchool() {
  const L = t(state.profile.lang);
  $app.innerHTML = `${steps(2)}<h1>${esc(L.findSchool)}</h1><p class="sub">${esc(L.schoolHint)}</p>
    <form class="row" id="f"><input type="text" id="q" lang="ko" autocomplete="off" aria-label="${esc(L.findSchool)}" value="${esc(state.profile.school?.name ?? '')}"><button class="btn" type="submit">${esc(L.search)}</button></form>
    <ul class="list" id="res"></ul>
    <p style="margin-top:16px"><button class="btn link" id="paste">${esc(L.pasteInstead)}</button></p>`;
  const $res = $app.querySelector('#res');
  $app.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const q = $app.querySelector('#q').value.trim();
    if (!q) return;
    $res.innerHTML = `<li class="aux">${esc(L.searching)}</li>`;
    try {
      const list = await neis.searchSchools({ name: q, limit: 20 });
      $res.innerHTML = list.length ? list.map((s, i) => `<li><button class="school" data-i="${i}"><b lang="ko">${esc(s.name)}</b><span class="aux">${esc(s.nameEn ?? '')} · ${esc(s.kind)} · <span lang="ko">${esc(s.address ?? s.officeName)}</span></span></button></li>`).join('') : `<li class="aux">${esc(L.noSchool)}</li>`;
      $res.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { const s = list[Number(b.dataset.i)]; state.profile.school = { office: s.office, code: s.code, name: s.name }; save(); state.step = 'allergens'; render(); });
    } catch (err) { $res.innerHTML = `<li class="err">${esc(String(err.message || err))}</li>`; }
  };
  $app.querySelector('#paste').onclick = () => { state.step = 'paste'; render(); };
  cta(`<button class="btn ghost" id="back">${esc(L.back)}</button>`);
  $cta.querySelector('#back').onclick = () => { state.step = 'lang'; render(); };
}

function allergenGrid(lang, selected) {
  return `<div class="grid" role="group">${ALLERGENS.map((a) => `<button class="choice" role="checkbox" aria-checked="${selected.includes(a.id)}" data-a="${a.id}"><span class="num">${a.id}</span>${esc(allergenName(a.id, lang))}${lang === 'ko' ? '' : `<span class="ko" lang="ko">${esc(a.names.ko)}</span>`}</button>`).join('')}</div>`;
}

function renderAllergens() {
  const L = t(state.profile.lang);
  const sel = state.profile.allergens;
  $app.innerHTML = `${steps(3)}<h1>${esc(L.pickAllergens)}</h1><p class="sub">${esc(L.pickAllergensHint)}</p>
    <p><input type="text" id="cn" maxlength="40" placeholder="${esc(L.childName)}" aria-label="${esc(L.childName)}" value="${esc(state.profile.name)}"></p>
    ${allergenGrid(state.profile.lang, sel)}`;
  $app.querySelector('#cn').oninput = (e) => { state.profile.name = e.target.value; save(); };
  $app.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => {
    const id = Number(b.dataset.a);
    state.profile.allergens = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id].sort((x, y) => x - y);
    save(); renderAllergens();
  });
  cta(`<button class="btn ghost" id="back">${esc(L.back)}</button><button class="btn" id="go" ${sel.length ? '' : 'disabled'}>${esc(L.seeWeek)}</button>`);
  $cta.querySelector('#back').onclick = () => { state.step = 'school'; render(); };
  $cta.querySelector('#go').onclick = () => { state.step = 'week'; state.day = null; render(); };
}

function verdictLabel(v, L) {
  const icon = { contains: '⛔', clear: '✓', unlabeled: '?' }[v];
  return `<span class="verdict ${v}"><span aria-hidden="true">${icon}</span>${esc(L[v])}</span>`;
}

function dishCard(d, lang, L) {
  const showGloss = lang !== 'ko';
  const chips = d.codes.map((c) => `<span class="chip ${d.matched.includes(c) ? 'hit' : ''}">${c} ${esc(allergenName(c, lang))}</span>`).join('');
  return `<article class="dish ${d.verdict}">
    ${verdictLabel(d.verdict, L)}${d.matched.length ? ` <b class="err">${esc(d.matched.map((c) => allergenName(c, lang)).join(', '))}</b>` : ''}
    <div class="name" ${showGloss && d.gloss.status !== 'none' ? '' : 'lang="ko"'}>${esc(showGloss ? d.gloss.text : d.nameKo)}</div>
    ${showGloss ? `<div class="ko" lang="ko">${esc(d.nameKo)}</div>` : ''}
    ${chips ? `<div class="chips">${chips}</div>` : ''}
    <details><summary>${esc(L.howRead)}</summary>
      <div>${esc(L.printed)}: <code lang="ko">${esc(d.raw)}</code></div>
      <div>${esc(L.codes)}: <code>${d.codes.join(', ') || '—'}${d.unknownCodes.length ? ` · ? ${d.unknownCodes.join(', ')}` : ''}</code></div>
      ${showGloss ? `<div>${d.gloss.parts.map((p) => `<code lang="ko">${esc(p.ko)}</code>→${esc(p.out)}${p.known ? '' : ' (?)'}`).join(' + ')}</div>` : ''}
    </details>
  </article>`;
}

async function loadWeek(monday) {
  const key = `${state.profile.school.office}:${state.profile.school.code}:${monday}`;
  if (state.cache.has(key)) return state.cache.get(key);
  const r = weekRange(monday);
  const meals = await neis.listMeals({ office: state.profile.school.office, school: state.profile.school.code, from: r.from, to: r.to });
  state.cache.set(key, meals);
  return meals;
}

async function renderWeek() {
  const L = t(state.profile.lang);
  const p = state.profile;
  $app.innerHTML = `<div class="weeknav"><div><h2 lang="ko">${esc(p.school.name)}</h2><div class="aux">${esc(p.name ? `${p.name} · ` : '')}${p.allergens.map((a) => esc(allergenName(a, p.lang))).join(', ')} · <button class="btn link" id="edit">${esc(L.edit)}</button></div></div></div>
    <div class="skeleton"></div><div class="skeleton"></div>`;
  $app.querySelector('#edit').onclick = () => { state.step = 'allergens'; render(); };
  cta('');
  let meals;
  try { meals = await loadWeek(state.monday); } catch (err) { $app.insertAdjacentHTML('beforeend', `<p class="err">${esc(err.message || err)}</p>`); return; }
  if (!meals.length && state.autoJumped < 4) { state.autoJumped += 1; state.monday = addDays(state.monday, -7); return renderWeek(); }
  state.autoJumped = 0;
  const view = buildWeekView(meals, p);
  const dates = [0, 1, 2, 3, 4].map((i) => addDays(state.monday, i));
  const today = todayIso();
  if (!state.day || !dates.includes(state.day)) state.day = dates.includes(today) && view.days.some((d) => d.date === today) ? today : (view.days[0]?.date ?? dates[0]);
  const dayView = view.days.find((d) => d.date === state.day);
  const tabs = dates.map((d, i) => {
    const dv = view.days.find((x) => x.date === d);
    const hits = dv ? dv.meals.reduce((n, m) => n + m.summary.contains, 0) : 0;
    const mark = !dv ? '–' : hits ? `⛔ ${hits}` : '✓';
    return `<button class="tab" role="tab" aria-selected="${d === state.day}" data-d="${d}">${esc(L.days[i])}<span class="dot">${d.slice(5).replace('-', '/')} · ${mark}</span></button>`;
  }).join('');
  const mealName = (m) => ({ 1: L.breakfast, 2: L.lunch, 3: L.dinner })[m.mealType] ?? m.mealName;
  const body = !dayView ? `<div class="hero none"><div class="big">—</div><p>${esc(L.noMeal)}</p></div>` : dayView.meals.map((m) => {
    const hitNames = [...new Set(m.dishes.flatMap((d) => d.matched))].map((c) => allergenName(c, p.lang)).join(', ');
    const hero = m.summary.contains
      ? `<div class="hero no"><div class="big">⛔ ${esc(L.containsCount(m.summary.contains, hitNames))}</div><p>${esc(mealName(m))} · ${m.summary.unlabeled ? `? ${m.summary.unlabeled} · ${esc(L.unlabeled)}` : ''}</p></div>`
      : `<div class="hero ok"><div class="big">✓ ${esc(L.allClear)}</div><p>${esc(mealName(m))}${m.summary.unlabeled ? ` · ? ${m.summary.unlabeled} · ${esc(L.unlabeled)}` : ''}</p></div>`;
    const order = { contains: 0, unlabeled: 1, clear: 2 };
    return hero + [...m.dishes].sort((a, b) => order[a.verdict] - order[b.verdict]).map((d) => dishCard(d, p.lang, L)).join('');
  }).join('');
  $app.innerHTML = `<div class="weeknav"><div><h2 lang="ko">${esc(p.school.name)}</h2><div class="aux">${esc(p.name ? `${p.name} · ` : '')}${p.allergens.map((a) => esc(allergenName(a, p.lang))).join(', ')} · <button class="btn link" id="edit">${esc(L.edit)}</button></div></div></div>
    <div class="weeknav" style="margin-top:12px"><button class="btn link" id="prev">${esc(L.prevWeek)}</button><span class="aux">${esc(L.week)} ${state.monday}</span><button class="btn link" id="next">${esc(L.nextWeek)}</button></div>
    <div class="tabs" role="tablist">${tabs}</div>${body}
    <p class="note">${esc(L.safety)}</p><p class="note">${esc(L.glossNote)} · Data: NEIS Open API (Korean Ministry of Education).</p>`;
  $app.querySelector('#edit').onclick = () => { state.step = 'allergens'; render(); };
  $app.querySelector('#prev').onclick = () => { state.monday = addDays(state.monday, -7); state.day = null; state.autoJumped = 99; renderWeek(); };
  $app.querySelector('#next').onclick = () => { state.monday = addDays(state.monday, 7); state.day = null; state.autoJumped = 99; renderWeek(); };
  $app.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { state.day = b.dataset.d; renderWeek(); });
  renderPrint(view, dates, L);
  cta(`<button class="btn ghost" id="share">${esc(L.share)}</button><button class="btn" id="print">${esc(L.print)}</button>`);
  $cta.querySelector('#print').onclick = () => window.print();
  $cta.querySelector('#share').onclick = async () => {
    const url = `${location.origin}${location.pathname}${encodeProfile(p)}`;
    try { await navigator.clipboard.writeText(url); } catch { prompt('', url); }
    $cta.querySelector('#share').textContent = L.copied;
  };
}

function renderPrint(view, dates, L) {
  const p = state.profile;
  const cell = (d) => {
    const dv = view.days.find((x) => x.date === d);
    if (!dv) return '—';
    return dv.meals.filter((m) => m.mealType === '2' || dv.meals.length === 1).flatMap((m) => m.dishes).map((x) => {
      const mark = { contains: '⛔', clear: '✓', unlabeled: '?' }[x.verdict];
      const name = p.lang === 'ko' ? x.nameKo : `${x.gloss.text} (${x.nameKo})`;
      return `<div class="${x.verdict === 'contains' ? 'x' : ''}">${mark} ${esc(name)}${x.matched.length ? ` — ${esc(x.matched.map((c) => allergenName(c, p.lang)).join(', '))}` : ''}</div>`;
    }).join('');
  };
  $print.innerHTML = `<h2>🔑 ${esc(p.name || '')} — <span lang="ko">${esc(p.school.name)}</span> · ${esc(L.week)} ${state.monday}</h2>
    <p>⛔ ${esc(L.contains)} · ✓ ${esc(L.clear)} · ? ${esc(L.unlabeled)} — ${p.allergens.map((a) => esc(allergenName(a, p.lang))).join(', ')}</p>
    <table><tr>${dates.map((d, i) => `<th>${esc(L.days[i])} ${d.slice(5)}</th>`).join('')}</tr><tr>${dates.map((d) => `<td>${cell(d)}</td>`).join('')}</tr></table>
    <p>${esc(L.safety)}</p>`;
}

function renderPaste() {
  const L = t(state.profile.lang);
  $app.innerHTML = `<h1>${esc(L.pasteTitle)}</h1><p class="sub">${esc(L.pasteHint)}</p>
    <textarea id="txt" rows="7" lang="ko" aria-label="${esc(L.pasteTitle)}">쌀밥\n달걀찜 (1.5)\n까르보닭갈비 (2.5.6.13.15.16)\n배추김치 (9)\n우유 (2)</textarea>
    ${state.profile.allergens.length ? '' : `<h2 style="margin-top:24px">${esc(L.pickAllergens)}</h2>${allergenGrid(state.profile.lang, state.profile.allergens)}`}
    <div id="out" style="margin-top:24px"></div>`;
  const run = () => {
    const v = buildPasteView($app.querySelector('#txt').value, state.profile);
    $app.querySelector('#out').innerHTML = v.dishes.map((d) => dishCard(d, state.profile.lang, L)).join('') + `<p class="note">${esc(L.safety)}</p>`;
  };
  $app.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => { const id = Number(b.dataset.a); const s = state.profile.allergens; state.profile.allergens = s.includes(id) ? s.filter((x) => x !== id) : [...s, id]; save(); renderPaste(); });
  cta(`<button class="btn ghost" id="back">${esc(L.back)}</button><button class="btn" id="go">${esc(L.check)}</button>`);
  $cta.querySelector('#back').onclick = () => { state.step = state.profile.school ? 'week' : 'school'; render(); };
  $cta.querySelector('#go').onclick = run;
  run();
}

function render() {
  document.documentElement.lang = state.profile.lang === 'tl' ? 'fil' : state.profile.lang;
  $lang.innerHTML = UI_LANGS.map((l) => `<option value="${l}" ${l === state.profile.lang ? 'selected' : ''}>${esc(LANG_NAMES[l])}</option>`).join('');
  ({ lang: renderLang, school: renderSchool, allergens: renderAllergens, week: renderWeek, paste: renderPaste })[state.step]();
}
$lang.onchange = () => setLang($lang.value);
if (location.hash.includes('p=')) { save(); history.replaceState(null, '', location.pathname + location.search); }
render();
