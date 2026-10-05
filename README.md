# LunchKey 🔑

[![test](https://github.com/Ryugi62/lunchkey/actions/workflows/test.yml/badge.svg)](https://github.com/Ryugi62/lunchkey/actions/workflows/test.yml)

**Korean school lunch menus print allergens as bare numbers: `새알심만두국 (1.2.5.6.9.10.15.16.18)`. LunchKey reads the live menu of any Korean school and shows each dish for one child, in the parent's own language:**

- ⛔ contains your child's allergen
- ✓ none of your child's allergens listed
- ? not labeled, ask the school

Live: **https://ryugi62.github.io/lunchkey/**. One-click sample: https://ryugi62.github.io/lunchkey/?demo=1 (Vietnamese: `?demo=1&lang=vi`).
No login, no server, no cost. Built solo for WarriorHacks 2.0 (theme: *solve an issue in your community, county, state, or nation*).

<p>
  <img src="docs/shots/week-vi-390.png" width="32%" alt="A Changwon elementary school's lunch in Vietnamese: a red card says 2 dishes contain milk; each dish shows its allergen numbers decoded">
  <img src="docs/shots/setup-allergens-390.png" width="32%" alt="Allergen picker: the 19 numbered allergens in the parent's language, with the Korean word under each">
  <img src="docs/shots/week-zh-390.png" width="32%" alt="The same week in Chinese">
</p>

## The problem

- South Korea has **202,208 multicultural K-12 students**, 4.0% of all students. That is a record high and still rising ([2025 Education Statistics, KEDI](https://www.kedi.re.kr/khome/main/announce/selectBroadAnnounceForm.do?selectTp=0&board_sq_no=3&article_sq_no=36108)). Many of their parents grew up in Vietnam, China, the Philippines, Japan or Central Asia and do not read Korean well.
- In a survey of 27,679 Korean students, **6.8% had a doctor-diagnosed food allergy**, and 7.6% had a reaction in the past year ([Allergy Asthma Respir Dis, 2013, data from 2012](https://synapse.koreamed.org/upload/synapsedata/pdfdata/0206aard/aard-1-227.pdf)).
- **Who exactly is hurt:** on those two numbers, about 13,700 multicultural children have a diagnosed food allergy (202,208 × 6.8%, an upper bound). Each of them has a parent who must check a Korean-only menu. The per-child view also helps any parent of an allergic child, roughly 340,000 children at the same rate.
- Every school publishes its menu through the national NEIS system, **only in Korean, with allergens as numbers 1–19**. To check one day for one child, a parent must:
  1. read each Korean dish name;
  2. find its numbers;
  3. look each one up on the term's legend sheet;
  4. compare them with their child's list.

  That is about 7 dishes a day, 5 days a week, in a second language.

**Why not just point Google Lens or Papago at the menu?** Camera translation turns `달걀찜 (1.5)` into "steamed egg (1.5)". The numbers stay numbers. It doesn't know your child's allergens, can't tell "nothing printed" apart from "nothing dangerous", and you have to redo it every day. LunchKey decodes the numbers, applies them to *your* child, and fetches the menu for you.

## What it does

1. **Pick your language**: English, Tiếng Việt, 中文, Filipino, 日本語, Русский or 한국어.
2. **Find the school**: paste or type its Korean name (it is on every school notice), optionally within a province. The lunch menu comes live from the Ministry of Education's open API.
3. **Pick what your child must avoid** from the 19 numbered allergens. Each is shown in your language with the Korean word under it.
4. **See the week.** Each day tab shows one of:
   - ⛔ and a count;
   - ✓, only when *every* dish is labeled and none match;
   - ?, when nothing matches but something is unlabeled.

   Each dish shows its verdict, an explanation of the dish name, and every allergen number decoded, with your child's in red.
5. **Print a one-page fridge sheet** in your language, or **copy a family link**. The link holds the school and allergens in its `#hash`, which is never sent to a server. It does *not* include the child's name.
6. **Paste a menu** from a daycare or kindergarten. These use the same numbers and the same checker.

### Three verdicts, one rule: never "clear" without evidence

| Verdict | When | Why |
|---|---|---|
| ⛔ **Contains** | a printed number matches your child's allergen | always wins, even if other text on the line is unreadable |
| ✓ **None of your child's allergens listed** | numbers are printed and none match | "listed" is the honest claim: we read what the school printed |
| ? **Not labeled, ask the school** | no number printed, or code-like text we can't read cleanly | we can't tell, so it is never shown as clear, and neither is a day or meal that contains it |

## Does it actually read real menus? Measured, not claimed

`npm run audit` asks the live NEIS API one school-week of lunches at a time. **170 distinct schools** (10 per office × **all 17 provincial education offices**), lunches from 2026-08-31 to 2026-10-02. Run on 2026-10-06:

| | |
|---|---|
| Schools with published lunches | 160 of 170, in **17 of 17** offices |
| Lunches · dish lines (each school-day counted once) | 3,580 · **24,745** |
| Lines with allergen numbers / no numbers / unreadable | 79.4% / 20.6% / **0%** |
| Menu numbering not mistaken for allergens (`호박죽-1`, `공통양념-2`) | 128 lines |
| Number notes not mistaken for allergens (`(20kg)`, `(25초등)`, `바나나1/2`) | all 25 listed in [`docs/audit.json`](docs/audit.json) checked by hand |
| Dish names fully / partly / not explained by the glossary | 78.6% / 20.2% / 1.2% |

**Hand checks, with their findings:**
- **Parser.** 150 real lines were checked one by one against the printed text and against an independent regex: 150/150 agree. One line, `깍두기(5) (9)`, is ambiguous. It is read conservatively, so it can only over-warn. The labels are in [`docs/audit-labels.json`](docs/audit-labels.json). A test asserts **zero false "clear"** on them for every single-allergen child (SPEC criterion 2).
- **What the checks caught along the way:**
  - `공통양념-2` ("common seasoning #2") was read as milk.
  - `(20kg)`, `(25초등)` and `바나나1/2` were read as codes.
  - Lines like `달걀찜 (1 5 6)` or `카레라이스(1.2.5.6)/요구르트(2)` lost codes.

  All of these are fixed, each with a regression test.
- **Dish names.** 100 English explanations were checked by hand: 95 were acceptable on the first pass. The 5 mis-splits (화채 → "julienned" and similar) are fixed, with tests.

### Dish names: explained, not machine-translated
A wrong translation could hide an ingredient. So each name is built only from a **glossary of 650+ Korean menu words** (English, Vietnamese, Chinese), using longest-match segmentation. For example, `돼지고기김치찌개` becomes pork + kimchi + stew. A part LunchKey doesn't know is shown romanized and marked "(?)". It is never guessed.

The allergen verdict never depends on the dish name, only on the printed numbers. English glosses were checked by the author, a native Korean speaker. Vietnamese and Chinese glosses were drafted with AI help and checked against dictionaries; native-speaker review is the next step. Filipino, Japanese and Russian users see English dish explanations, tagged as English for screen readers.

## How it's built

```
src/domain/       allergens (19 × 7 languages) · menu parser · verdict · gloss · romanize   — pure, no I/O
src/application/  weekView (+ summaryStatus) · pasteView                                  — pure, depends on domain
src/adapters/     neis (fetch injected, error codes, retry on 5xx/network only) · profileStore (#hash)
src/ui/           app.js (composition root) · i18n (7 languages) · styles
scripts/          audit.mjs (national sample) · check-layers.mjs
```

- **Zero dependencies, no build step.** Plain ES modules on GitHub Pages and a free public API, so it costs $0 to keep running.
- **Keyless NEIS returns only the first 5 rows and ignores paging.** I measured this on 2026-10-06. So LunchKey asks narrow questions: one school, one week, lunch only. That is at most 5 rows, and the tests use a fake API that behaves the same way.
- **Resilience.** NEIS error codes are shown as errors, never as "no menu". The last loaded weeks are saved on the phone and shown, labeled, if the network fails. The sample school ships with a bundled week.
- **Tests: 48** (`npm test`, Node's built-in runner, CI on Node 20/22/24). They cover every acceptance criterion in [`SPEC.md`](SPEC.md), the hand-checked real lines, the "never green with unknowns" rule, and a layer check. The check fails if `domain/` or `application/` imports adapters or the UI, or touches `fetch`, `localStorage` or `document`.
- **Accessibility.**
  - Every verdict is shown as an icon, a word and a color.
  - Each language block carries its own `lang` attribute.
  - Day tabs are real tabs with arrow keys.
  - A single polite live region announces the day's result.
  - Tap targets are at least 44 px, nothing scrolls sideways at 390 px, and dark mode works.

Run locally: `npm test` · `npm run audit` · `npm run serve`, then open http://127.0.0.1:4321.

## Limits (honest)

- LunchKey reads the **19 allergens that Korean school menus number**. It can't see ingredients a school didn't number, and it is **not medical advice**. Every screen says so and points parents to the school's nutrition teacher.
- School search needs the Korean name. Parents have it on every notice and can paste it, but a Korean keyboard isn't required. Keyless search shows at most 5 matches, so the app asks for more of the name or a province.
- **No user study yet.** The next step is to try it with multicultural family support centers in Changwon and measure the time it takes to check a day, with LunchKey versus with the legend sheet.

## Why me, why here

I study in Changwon, an industrial city in South Gyeongnam with many migrant and multicultural families. The menu system is the same in all 17 provinces, so a fix for my community works nationwide.

## Disclosure

Built solo by Taegeol Kim (undergraduate, Changwon National University) with AI coding assistance (Claude). Every number above is produced by scripts in this repo and can be re-run.

License: MIT · Data: NEIS Open API, Korean Ministry of Education.
