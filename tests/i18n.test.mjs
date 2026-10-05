import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T, LANG_NAMES } from '../src/ui/i18n.js';
import { ALLERGENS } from '../src/domain/allergens.js';
import { UI_LANGS } from '../src/adapters/profileStore.js';

test('every UI language has every string', () => {
  const keys = Object.keys(T.en).sort();
  for (const lang of UI_LANGS) {
    assert.ok(T[lang], lang);
    assert.deepEqual(Object.keys(T[lang]).sort(), keys, lang);
    assert.equal(T[lang].days.length, 5, lang);
    assert.ok(LANG_NAMES[lang], lang);
  }
});

test('every allergen is named in every UI language', () => {
  for (const a of ALLERGENS) for (const lang of UI_LANGS) assert.ok(a.names[lang], `${a.id} ${lang}`);
});

test('the clear label cannot be confused with the no-number / unreadable labels', () => {
  const shared3 = (a, b) => { for (let i = 0; i + 3 <= a.length; i++) { const g = a.slice(i, i + 3); if (g.trim().length === 3 && b.includes(g)) return g; } return null; };
  const words = (x) => new Set(x.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length >= 4));
  const sharedWord = (a, b) => [...words(a)].find((w) => words(b).has(w)) ?? null;
  for (const lang of UI_LANGS) {
    const cjk = ['ko', 'zh', 'ja'].includes(lang);
    for (const other of ['nonumbers', 'unreadable']) {
      assert.equal(cjk ? shared3(T[lang].clear, T[lang][other]) : sharedWord(T[lang].clear, T[lang][other]), null, `${lang} clear vs ${other}`);
    }
  }
});
