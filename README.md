# LunchKey 🔑

[![test](https://github.com/Ryugi62/lunchkey/actions/workflows/test.yml/badge.svg)](https://github.com/Ryugi62/lunchkey/actions/workflows/test.yml)

**Korean school lunch menus print allergens as bare numbers: `새알심만두국 (1.2.5.6.9.10.15.16.18)`. LunchKey reads the live menu of any Korean school and shows each dish for one child, in the parent's own language:**

- ⛔ contains your child's allergen
- ✓ none of your child's allergens listed
- ○ no numbers printed
- ? numbers it couldn't read, ask the school

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
- **Who exactly is hurt:** a rough estimate is about 13,700 multicultural children with a diagnosed food allergy (202,208 × 6.8%, using old prevalence data). Many multicultural families have a parent who reads Korean, so the core users are households where the parent who handles school can't. I found no published count for that group, so I don't claim one.
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
   - ✓, only when *every* dish has numbers and none match;
   - ○, when nothing matches but some dishes have no numbers printed;
   - ?, when something code-like couldn't be read.

   Each dish shows its verdict, an explanation of the dish name, and every allergen number decoded, with your child's in red. Families with several children switch with one tap.
5. **Print a one-page fridge sheet** in your language, or **copy a family link**. The link holds the school and allergens in its `#hash`, which is never sent to a server. It does *not* include the child's name. Opening a link for a second child adds that child instead of replacing the first.
6. **No Korean typing needed when the school shares a link.** "For schools and family centers: copy a link with this school already chosen" gives a nutrition teacher or a multicultural family center a link to print as a QR code. The parent then only picks a language and the allergens.
7. **Paste a menu** from a daycare or kindergarten. These use the same numbers and the same checker.

### Four verdicts, one rule: never green without evidence

| Verdict | When | Shown as |
|---|---|---|
| ⛔ **Contains** | a printed number matches your child's allergen | red — always wins |
| ? **Couldn't read the numbers — ask the school** | code-like text that can't be read cleanly, or a number that *might* be one of your child's codes (menu numbering like `배추김치1 (9)`, notes like `(1난류)`) | amber |
| ○ **No numbers printed** | nothing code-like printed (plain rice, fruit) | grey, neutral — not green |
| ✓ **None of your child's allergens listed** | numbers printed, read cleanly, none match | green — the only green |

A day or meal is green only if every dish is ✓. Two safety layers make sure of that:
- **The parser treats any leftover number from 1 to 19 as possibly a code**, unless it is part of a counting word (`10곡`, `3색`).
- **The dish name can only add warnings.** For example, `우유` (milk) printed without a number shows "Might contain Milk" to a milk-allergic child.

A fuzz test checks this. For every code N and 9 real dish bases, it puts N after 28 separators (`,` `·` `ㆍ` `;` `~` `–` `※` …), in front of the name, inside notes (`(난류N)`, `(가공:N)`), in full-width brackets, as every circled-number style and as a superscript. That is about 7,000 generated lines, and none of them may produce ✓ for a child avoiding N. Legend words printed instead of numbers (`(난류)`, `(게)`) count as codes, and a list that is cut off (`(5.6.`) is unreadable. Lines with two dishes (`카레라이스(1.5.6)/요구르트`) are split, so the unnumbered dish is never folded into a green one.

## Does it actually read real menus? (measured, not claimed)

`npm run audit` asks the live NEIS API one school-week of lunches at a time: **170 distinct schools** (10 per office × **all 17 provincial education offices**). Each school-day counted once. Run 2026-10-06:

| | Aug 31 – Oct 2, 2026 | June 2026 (looked at once, one fix) | **May 2026 (never used for tuning)** |
|---|---|---|---|
| Schools with lunches / offices | 160 · 17 of 17 | 165 · 17 of 17 | 145 · 15 of 17 |
| Lunches · dish lines | 3,580 · **24,745** | 2,792 · **19,209** | 2,441 · **16,799** |
| Lines with numbers / no numbers / flagged unreadable (→ ?) | 79.4% / 20.6% / 0% | 79.1% / 20.9% / 0.01% | 79.7% / 20.3% / 0.01% |
| Lines holding a number that *might* be a code (shown as ? only to children avoiding it) | 272 (1.1%) | 193 (1.0%) | 161 (1.0%) |
| Dish names fully / partly / not explained | 78.6% / 19.0% / 2.4% | 77.0% / 20.4% / 2.5% | 76.2% / 21.1% / 2.8% |

Every one of those odd lines is listed in [`docs/audit.json`](docs/audit.json), [`docs/audit-heldout-june.json`](docs/audit-heldout-june.json) and [`docs/audit-holdout-may.json`](docs/audit-holdout-may.json) (no caps). Each audit also breaks the counts down by office (`byOffice`). The sample is a convenience sample (schools found by short name searches, because keyless NEIS can't page a full list).

**Hand checks.** These are in [`docs/audit-labels.json`](docs/audit-labels.json) and enforced by tests. Labeled by the author (a native Korean reader), cross-checked with a separate regex. There was no independent second labeler.
- **Held-out May sample:** 150 lines from a month never used for tuning, read after the parser was frozen. 150/150 agree.
- **Even sample:** 150 lines from Aug–Oct, 150/150. Most of these are easy `(1.2.5)` lines (113 standard, 34 with no numbers), so the "0 errors in 150, about 2% upper bound" figure covers the easy majority.
- **Stratified odd formats:** all 111 distinct odd formats found in the audits (glued numbers, fractions, lone numbers, menu numbering, number notes). For each one, every number that could be a code is checked, and none ever gets ✓.
- **What the checks and three AI-assisted review rounds caught**, each now a regression test:
  - "common seasoning #2" read as milk;
  - `(20kg)` and `(25초등)` read as codes;
  - `달걀찜 (1 5 6)`, `A(…)/B2`, `[2]`, `(1난류)`, `닭강정(5.6)·1`, `1미역국(5.6)` and `(난류)` giving a false ✓;
  - `ㆍ` read wrongly after normalization.
- **Dish names:** 100 English explanations were checked by hand. 95 were acceptable on the first pass, and the 5 wrong splits are fixed. Since then, a one-syllable match next to an unknown piece is treated as unknown, because "파운드" must not become "green onion".

**How often a child sees each colour** (`dayLoadPercentBySingleAllergen` in the audit). For a child avoiding only peanut, school days come out:
- ⛔ 5%: peanut is printed on the menu;
- ? 0.6%;
- ○ 82%: some dish had no numbers, usually rice or fruit;
- ✓ 13%.

Amber "?" days stay under 2% for every allergen, so the warning keeps its meaning. Milk shows ⛔ on 81% of days because the daily milk carton is numbered.

### Dish names: explained, not machine-translated
A wrong translation could hide an ingredient. So each name is built only from a **glossary of 650+ Korean menu words** (English, Vietnamese, Chinese), using longest-match segmentation. For example, `돼지고기김치찌개` becomes "pork kimchi stew", and `달걀찜` becomes "steamed egg" / "trứng hấp" / "蒸鸡蛋" (word order per language). A part LunchKey doesn't know is marked "(?)" right in the name: romanized in English, kept in Korean letters in Vietnamese and Chinese. It is never guessed.

The allergen verdict never depends on the dish name, only on the printed numbers. English glosses were checked by the author, a native Korean speaker. Vietnamese and Chinese glosses were drafted with AI help and checked against dictionaries; native-speaker review is the next step. Filipino, Japanese and Russian users see English dish explanations, tagged as English for screen readers.

## How it's built

```
src/domain/       allergens (19 × 7 languages) · menu parser · verdict · gloss · romanize   — pure, no I/O
src/application/  weekView (+ summaryStatus) · headline · pasteView                       — pure, depends on domain
src/adapters/     neis (fetch injected, error codes, retry on 5xx/network only) · profileStore (#hash)
src/ui/           app.js (composition root) · i18n (7 languages) · styles
scripts/          audit.mjs (national sample) · check-layers.mjs
```

- **Zero dependencies, no build step.** Plain ES modules on GitHub Pages and a free public API, so it costs $0 to keep running.
- **Keyless NEIS returns only the first 5 rows and ignores paging.** I measured this on 2026-10-06. So LunchKey asks narrow questions: one school, one week, lunch only. That is at most 5 rows, fetched once per week and re-rendered from memory, and the tests use a fake API that behaves the same way.
- **Sustainability.** The code already supports a free personal NEIS key (`?key=…`, stored on the device) for full paging. If keyless sample access ever changes, the fallback is a small scheduled job that pre-fetches opted-in schools into static JSON on GitHub Pages, behind the same adapter port.
- **Resilience.** NEIS error codes are shown as errors, never as "no menu". The last loaded weeks are saved on the phone as raw menu text and re-parsed when shown, so a parser fix reaches saved weeks too; they appear labeled if the network fails. The sample school ships with a bundled week.
- **Tests: 72** (`npm test`, Node's built-in runner, CI on Node 20/22/24). They cover every acceptance criterion in [`SPEC.md`](SPEC.md), the hand-checked real lines, the never-✓ property and fuzz tests, three hand-labeled sets (incl. the held-out May sample), the top-card logic (`application/headline.js`), the link-merge rules (`application/children.js`), and a layer check. The check fails if `domain/` or `application/` imports adapters or the UI, or touches `fetch`, `localStorage` or `document`.
- **Accessibility.**
  - Every verdict is shown as an icon, a word and a color.
  - Each language block carries its own `lang` attribute.
  - Day tabs are real tabs with arrow keys.
  - A polite live region announces the day's result.
  - Tap targets are at least 44 px, nothing scrolls sideways at 390 px, and dark mode works.

Run locally: `npm test` · `npm run audit` · `npm run serve`, then open http://127.0.0.1:4321.

## Limits (honest)

- Two dishes on one line separated only by a space (`스파게티(1.2.5.6) 마늘빵`) are not split. Name hints catch the common risky words (milk, egg, peanut and others), but not every case.
- I haven't tested the live API from outside Korea. If NEIS is slow or blocked abroad, the demo falls back to its bundled week and says so.

- LunchKey reads the **19 allergens that Korean school menus number**. It can't see ingredients a school didn't number, and it is **not medical advice**. The setup, week and paste screens say so and point parents to the school's nutrition teacher.
- School search needs the Korean name, which is on every notice and can be pasted, or a school link or QR code from the school or a family center. Keyless search shows at most 5 matches, so the app asks for more of the name or a province. English-name search isn't possible without a key: there is no such filter, and the full school list can't be paged.
- **No user study yet.** That is the honest gap. Plan after WarriorHacks: I own it. Pilot it with a multicultural family support center in Changwon handing out the school-link QR. Measure the minutes and mistakes it takes to check one day with LunchKey versus the legend sheet.

## Why me, why here

I study in Changwon, an industrial city in South Gyeongnam with many migrant and multicultural families. The menu system is the same in all 17 provinces, so a fix for my community works nationwide.

## Disclosure

Built solo by Taegeol Kim (undergraduate, Changwon National University) with AI coding assistance (Claude). Every number above is produced by scripts in this repo and can be re-run.

License: MIT · Data: NEIS Open API, Korean Ministry of Education.
