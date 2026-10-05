# LunchKey — SPEC (v0.5, 2026-10-06)

## 0. One line
LunchKey turns a Korean school's official lunch menu, where allergens are printed only as bare numbers after Korean dish names (`새알심만두국 (1.2.5.6.9.10.15.16.18)`), into a per-child view in the parent's own language: each dish is marked **contains your child's allergen** (⛔), **might contain / couldn't read** (?), **no numbers printed** (○), or **none of your child's allergens listed** (✓ — the only green).
Essence: not a menu translator, but **the key that lets a parent who can't read Korean check their child's lunch with the same information a Korean parent has**.

## 1. Success criteria · deadline · non-goals
- Reference: Korean schools already publish menus with allergen numbers. Parents get a one-time number legend sheet at the start of each term. Nothing gives a per-child, in-language view of the live menu.
- Success (numbers):
  1. National sample (17 provincial education offices, ≥ 150 distinct schools, one month of lunches, each school-day once): **≤ 0.05% unreadable lines, all shown as ?**, and ≥ 150 hand-labeled lines (author, regex cross-check) agree with the parser. Measured by `npm run audit` → `docs/audit.json`, labels in `docs/audit-labels.json`. (2026-10-06: 170 schools, 24,745 lines, 0% unreadable; untouched May holdout 16,799 lines, 0.01%; 150/150 + 111 stratified.)
  2. **0 false "no listed allergen" results** on the hand-labeled test set. A dish whose codes include the child's allergen must never be shown as clear.
  3. Dish-name gloss: **≥ 80% of dish lines** in the audit sample get a full or partial English gloss. Unglossed names fall back to the Korean name plus romanization. A dish name is never invented.
  4. On a phone (390 px wide), a parent goes from opening the app to seeing this week's view in **≤ 3 taps** after picking a school once.
  5. Lighthouse-style accessibility basics: every status is shown by icon + text + color (never color alone), all controls are labeled, `lang` attributes are set per language, and there is no horizontal scroll at 390 px.
- Deadline: Devpost submission by 2026-10-14 13:45 KST. Internal v1: 2026-10-12 20:00 KST.
- Non-goals: medical advice; ingredient-level detection beyond the 19 legally labeled allergens; accounts or servers; storing children's data anywhere except the parent's own device and URL.

## 2. Constraints
- Theme (organizer): "Create a project that solves an issue in your community, county, state, or nation."
- Data: NEIS Open API `mealServiceDietInfo` and `schoolInfo` (Korean Ministry of Education). Keyless calls return **only the first 5 rows and ignore `pIndex`** (measured 2026-10-06); CORS is `*`. So the app asks narrow questions (one school-week of lunch = ≤ 5 rows). An optional key enables real paging.
- Allergen numbering follows the Korean school-meal allergen notice (19 items): 1 egg, 2 milk, 3 buckwheat, 4 peanut, 5 soybean, 6 wheat, 7 mackerel, 8 crab, 9 shrimp, 10 pork, 11 peach, 12 tomato, 13 sulfites, 14 walnut, 15 chicken, 16 beef, 17 squid, 18 shellfish (incl. oyster, abalone, mussel), 19 pine nut.
- Cost: $0 (static site on GitHub Pages, no backend).
- Privacy: the child's allergen profile lives in `localStorage` and, optionally, in a share link's `#hash`. A hash is never sent to a server.

## 3. Ubiquitous language (code names match)
| Term | Meaning | Code |
|---|---|---|
| Allergen | One of the 19 numbered allergens | `Allergen`, `ALLERGENS` |
| Allergen code | The number printed after a dish | `code` |
| Dish line | One dish as printed in the menu, e.g. `달걀찜 (1.5)` | `DishLine` |
| Parse status | `coded` (codes found) · `uncoded` (no codes printed) · `malformed` (something code-like that we could not read) | `parseStatus` |
| Child profile | The set of allergens one child must avoid, plus the display language | `ChildProfile` |
| Verdict | `contains` · `clear` (coded, read cleanly, no match) · `nonumbers` (nothing code-like printed) · `unreadable` (code-like text we can't read, or a possibly-code number matching the child) | `Verdict` |
| Meal | One school, one date, one meal type, with its dish lines | `Meal` |
| Gloss | English (or vi/zh) rendering of a Korean dish name built from a reviewed glossary | `Gloss` |
| Menu source | Where meals come from: NEIS API or pasted text | `MenuSource` port |

## 4. Domain model
- Value objects: `Allergen{id, names{ko,en,vi,zh,tl,ja,ru}}`, `DishLine{raw, nameKo, codes[], unknownCodes[], parseStatus}`, `Gloss{text, coverage, status}`.
- Entities: `Meal{schoolCode, date, mealType, dishes[]}`.
- Domain services: `parseDishLine`, `splitMenu`, `judgeDish(dish, profile) → Verdict`, `glossDish(nameKo, lang) → Gloss`, `romanize(hangul)`.
- Ports: `MenuSource.listMeals({office, school, from, to, mealType})`, `SchoolDirectory.search({office?, name})`, `ProfileStore.load/save`.

## 5. Use cases
| UC | Input | Output | Rule |
|---|---|---|---|
| UC-1 Find school | Korean name text (pasted or typed), optional province | keyless: up to 5 matches + "type more" notice | NEIS `schoolInfo`, placeholder schools with blank codes dropped |
| UC-2 Week view | school, week start, child profile, language | 5 days × meals × dishes with verdicts + gloss | `contains` wins; `unreadable` (incl. possible codes and name hints) and `nonumbers` are never shown as clear |
| UC-3 Paste a menu | free text (e.g. daycare menu photo transcription) | the same dish verdicts | same parser |
| UC-4 Fridge sheet | week view | printable one-page A4/Letter sheet in the parent's language | print CSS |
| UC-5 Share | profile | link with `#p=` hash | no server |
| UC-6 Audit | sample plan | parse-rate, malformed examples, gloss coverage | script, not in the app |

## 6. Acceptance criteria (each → ≥ 1 test)
- AC-1: Given `새알심만두국 (1.2.5.6.9.10.15.16.18)`, When parsed, Then nameKo=`새알심만두국`, codes=[1,2,5,6,9,10,15,16,18], status `coded`.
- AC-2: Given variants `달걀찜(1.5)`, `우유 2.`, `닭강정 ⑮⑥`, `김치 (9)*`, `볶음밥1.5.6.10`, `요구르트(2.)`, When parsed, Then the codes are read the same way as AC-1.
- AC-3: Given `바나나` (nothing printed), Then status `uncoded`, and the verdict for any profile is `nonumbers`, never `clear`.
- AC-4: Given `특식 (2.25)` (an out-of-range code inside a code group), Then 25 goes to `unknownCodes`, status `malformed`, verdict `unreadable` unless a valid code matches (`contains`). A bracket holding only one number outside 1–19 (`(80)`, `(0)`) is a portion size and is dropped; numbers removed as notes or menu numbering that lie in 1–19 go to `ambiguousCodes` and make the dish `unreadable` for a child avoiding them.
- AC-5: Given profile {2 milk} and dish codes [1,5], Then verdict `clear`. Given profile {2} and codes [2,6], Then `contains` with matched=[2].
- AC-6: Given NEIS `DDISH_NM` with `<br/>` separators, When split, Then one DishLine per dish, trimmed, empty parts dropped.
- AC-7: Given `돼지고기김치찌개`, When glossed to English, Then the text contains "pork", "kimchi" and "stew", with coverage 1.0. Given an unknown name, Then status `none`, and the text is the romanization, marked as not translated.
- AC-8: Given keyless NEIS (first 5 rows only), When a range with more rows is requested, Then one call is made, the first 5 rows are mapped to `Meal`s and `truncated` is reported; With a key, Then pages are fetched until `list_total_count`. Non-`INFO-200` result codes are errors; only 5xx/network errors are retried.
- AC-9: Given a profile, When encoded to a hash and decoded, Then you get the same profile back. Garbage hash → empty profile, no throw.
- AC-10: Layer rule: no file in `src/domain` or `src/application` imports from `src/adapters` or `src/ui`.

- AC-11: Given a day with no match, Then it is green only if every dish is `clear`; any `unreadable` → amber `unknown`; otherwise any `nonumbers` → neutral `nolisted`.
- AC-12 (property): appending any possible code N (`N`, ` N`, `/요구르트N`, `[N]`, `<N>`, `(N난류)`, `&우유N`) to a coded line never yields `clear` for a child avoiding N.

## 7. Architecture
```
src/domain/       allergens, menu parser, verdict, gloss, romanize   (pure)
src/application/  weekView, pasteView, ports (JSDoc)                  (pure, depends on domain)
src/adapters/     neis (fetch injected), paste, profileStore (hash/localStorage)
src/ui/           index.html, app.js (composition root), i18n, styles
scripts/          audit.mjs (national sample), check-layers.mjs
tests/            node:test
```

## 8. Non-functional
- No build step, zero runtime dependencies. The last 12 loaded school-weeks are saved in localStorage and shown (labeled) when the network fails; the sample school has a bundled week.
- NEIS politeness: the app makes 1 request per school-week; the audit uses ≤ 4 concurrent requests; retry with backoff on 5xx/network only.

## 9. Physical verification
- Live: pick 3 real schools (one in Changwon, one in Seoul, one rural) and check the week view against the school's own menu text.
- Audit numbers from a real national sample, committed with the date.
- Screenshots at 390 / 1280 px, and in vi and zh.

## 10a. UI acceptance (Toss-style checklist)
1. Mobile first: 390 px, no horizontal scroll (measured: scrollWidth 390). 2. One question per setup screen (language → school → allergens) with a progress bar. 3. Type scale: titles 22–24 px bold, body 16 px, auxiliary 13 px. 4. Cards 16 px radius, sections ≥ 24 px apart. 5. One fixed bottom CTA, ≥ 52 px tall. 6. The result leads with the count ("2 dishes contain Milk", 32 px), the verdict list below. 7. Evidence (printed line, numbers, gloss parts) sits in a closed `<details>`. 8. Short, friendly microcopy in 7 languages. 9. White + one blue + three status colors, icon + word + color for every status, dark mode. 10. System fonts, no CDN, skeleton loading.

## 10. Changelog
- v0.5 2026-10-06: split outside brackets + trailing-dish split, `shared:` lines never green, legend lists, two-digit leftovers, glued-only counting words, more name hints (egg/pork/crab dishes), mushroom bulgogi warns for beef, fetch timeout + labeled sample week, demo family (peanut sibling), headline names the possible allergen and the unnumbered dishes.
- v0.4 2026-10-06: default-ambiguous leftover numbers (counting-word allow-list), NFKC + circled/negative-circled digits, all numbers in mixed notes, multi-dish split (`splitCompound`), name hints that only add warnings (`hints.js`), "might contain X" chips with the reason, link merge as a pure function (`children.js`), school links carry no language, key stripped from the URL, untouched May holdout.
- v0.3 2026-10-06: ambiguousCodes + four verdicts, property test, headline module, in-memory weeks, multi-child, school link, NEIS key option, stratified hand labels (111) + June audit.
- v0.2 2026-10-06: keyless NEIS reality (first 5 rows), parser reads all bracket groups and odd separators, portion/number notes, `summaryStatus` (never green with unknowns), error codes, saved weeks, honest audit (distinct schools, dedup), hand labels, i18n wording of the clear verdict.
- v0.1 2026-10-06 first version.

